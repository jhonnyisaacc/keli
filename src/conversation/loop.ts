import type { Database } from "bun:sqlite";
import type { CapabilityRegistry } from "../capabilities/registry.ts";
import { BehaviorError, type BehaviorService } from "../core/behavior.ts";
import type { CapabilityGate } from "../core/capability-gate.ts";
import { isUntrustedInstruction, parsePrompt } from "../core/correction.ts";
import { KeliError } from "../core/errors.ts";
import { checkEvidence, policyFromRules, type AnswerDraft, type ResearchPolicy } from "../core/evidence.ts";
import { estimateTokens } from "../core/budgets.ts";
import { createRun, finishRun, getRun } from "../core/run-control.ts";
import type { FixtureEndpoints } from "../execution/dispatch-context.ts";
import type { ResourcePolicy } from "../execution/policy.ts";
import { writeCheckpoint } from "../memory/checkpoints.ts";
import { runBudgetedModelCall } from "../model/attempts.ts";
import type { ChatMessage, ChatModelProvider } from "../model/chat-provider.ts";
import type { ModelLoop } from "../model/loop.ts";
import type { SourceReader } from "../sources/reader.ts";
import { getProjectByName, projectScope } from "../state/repos.ts";
import type { KeliConfig } from "../state/config.ts";
import { buildSystemPrompt, historyMessages, isResearchCapability } from "./context.ts";
import { parseResearchCorrection } from "./corrections.ts";
import { parseDecision } from "./decision.ts";
import { appendTurn, findTurnBySource, listTurns, turnIdFor, type TurnKind } from "./turns.ts";
import type { TurnContext, TurnOutcome } from "./types.ts";

export type ChatModelFactory = () => Promise<{
  provider: ChatModelProvider;
  providerId: string;
  model?: string;
  costKnown: boolean;
}>;

export type ConversationDeps = {
  db: Database;
  behavior: BehaviorService;
  capabilityGate: CapabilityGate;
  registry: CapabilityRegistry;
  policy: ResourcePolicy;
  model: ChatModelFactory;
  config?: KeliConfig | null;
  sources?: SourceReader;
  networkHosts?: string[];
  fixtures?: FixtureEndpoints;
  /** Existing coding-delegate loop; kept as one supported capability behind the same entry point. */
  codingLoop?: ModelLoop;
  options?: {
    maxSteps?: number;
    retryBaseMs?: number;
    /** How many times a failed evidence check is fed back before returning missing_evidence. */
    evidenceRetries?: number;
    toolResultChars?: number;
  };
};

const DEFAULT_MAX_STEPS = 8;
const DEFAULT_TOOL_RESULT_CHARS = 4096;

type KnownSources = Map<string, { collection: string }>;

/**
 * General conversation and research loop. The model proposes one decision per step; tool
 * calls run through the capability gate under the turn's run budget; answers must pass the
 * deterministic evidence check before they are persisted as answers.
 */
export class ConversationLoop {
  constructor(private readonly deps: ConversationDeps) {}

  async runTurn(
    ctx: TurnContext,
    prompt: string,
    options: { sourceRef?: string; policy?: Partial<ResearchPolicy> } = {},
  ): Promise<TurnOutcome> {
    const { db } = this.deps;
    const sourceRef = options.sourceRef ?? `${ctx.origin.transport}:${crypto.randomUUID()}`;
    const turnIds: string[] = [];

    if (options.sourceRef) {
      const replay = this.findCompletedReply(ctx, options.sourceRef);
      if (replay) return replay;
    }

    const user = appendTurn(db, {
      id: turnIdFor(ctx.conversationId, sourceRef, "user"),
      conversationId: ctx.conversationId,
      scope: ctx.scope,
      role: "user",
      kind: "message",
      content: prompt,
      sourceRef,
    });
    turnIds.push(user.turn.id);

    if (isUntrustedInstruction(prompt)) {
      return this.finalize(ctx, sourceRef, turnIds, {
        kind: "blocked",
        text: "Quoted or untrusted instruction ignored; no behavior change committed.",
        steps: 0,
        toolCalls: 0,
        conversationId: ctx.conversationId,
        turnIds,
        costUnknown: false,
      });
    }

    const correction = parseResearchCorrection(prompt);
    if (correction) return this.applyCorrection(ctx, sourceRef, turnIds, correction);

    const coding = parsePrompt(prompt);
    if (
      this.deps.codingLoop &&
      (coding.kind === "correction" ||
        coding.kind === "override" ||
        (coding.kind === "action" && this.deps.behavior.getRule(ctx.scope, "coding.delegate")))
    ) {
      const result = await this.deps.codingLoop.runTurn(prompt);
      return this.finalize(ctx, sourceRef, turnIds, {
        kind: result.kind === "action" ? "answer" : result.kind === "correction" ? "correction" : result.kind === "blocked" ? "blocked" : "error",
        text: result.message,
        steps: 1,
        toolCalls: result.kind === "action" ? 1 : 0,
        conversationId: ctx.conversationId,
        turnIds,
        costUnknown: result.costUnknown ?? false,
        rule: result.rule,
      });
    }

    return this.research(ctx, prompt, sourceRef, turnIds, options.policy);
  }

  private findCompletedReply(ctx: TurnContext, sourceRef: string): TurnOutcome | null {
    for (const kind of ["answer", "missing_evidence", "clarify", "correction", "blocked", "error"] as TurnKind[]) {
      const existing = findTurnBySource(this.deps.db, ctx.conversationId, sourceRef, kind);
      if (existing) {
        const refs = (existing.refs ?? {}) as Partial<TurnOutcome>;
        return {
          kind: kind as TurnOutcome["kind"],
          text: existing.content,
          citations: refs.citations,
          attributions: refs.attributions,
          steps: refs.steps ?? 0,
          toolCalls: refs.toolCalls ?? 0,
          runId: existing.runId,
          conversationId: ctx.conversationId,
          turnIds: [existing.id],
          costUnknown: refs.costUnknown ?? true,
          rule: refs.rule,
          replayed: true,
        };
      }
    }
    return null;
  }

  private applyCorrection(
    ctx: TurnContext,
    sourceRef: string,
    turnIds: string[],
    correction: NonNullable<ReturnType<typeof parseResearchCorrection>>,
  ): TurnOutcome {
    const base = { steps: 0, toolCalls: 0, conversationId: ctx.conversationId, turnIds, costUnknown: false };
    if (correction.kind === "ambiguous") {
      return this.finalize(ctx, sourceRef, turnIds, { ...base, kind: "clarify", text: correction.question });
    }
    try {
      if (correction.kind === "undo") {
        const rule = this.deps.behavior.undoRule(ctx.scope, correction.key);
        return this.finalize(ctx, sourceRef, turnIds, {
          ...base,
          kind: "correction",
          text:
            rule.status === "retired"
              ? `Undone. ${correction.key} removed; defaults apply again.`
              : `Undone. Restored ${correction.key}=${rule.value} at revision ${rule.revision}.`,
          rule: { scope: rule.scope, key: rule.key, value: rule.value, revision: rule.revision },
        });
      }
      const project = getProjectByName(this.deps.db, correction.projectName);
      if (!project) {
        return this.finalize(ctx, sourceRef, turnIds, {
          ...base,
          kind: "clarify",
          text: `I don't know a project named "${correction.projectName}". Which project should this apply to?`,
        });
      }
      const scope = projectScope(project.id);
      const provenance = { actor: "owner", text: correction.sourceText, source: "user-correction", trusted: true };
      const rule =
        correction.kind === "requiredCollections"
          ? this.deps.behavior.reviseRule(
              { scope, key: "research.requiredCollections", value: correction.collections.join(",") },
              provenance,
            )
          : this.deps.behavior.reviseRule(
              { scope, key: "research.citationsRequired", value: String(correction.value) },
              provenance,
            );
      return this.finalize(ctx, sourceRef, turnIds, {
        ...base,
        kind: "correction",
        text: `Committed for ${project.name}: ${rule.key}=${rule.value} (revision ${rule.revision}). Tested on the next comparable request.`,
        rule: { scope: rule.scope, key: rule.key, value: rule.value, revision: rule.revision },
      });
    } catch (e) {
      const message = e instanceof BehaviorError ? e.message : String(e);
      return this.finalize(ctx, sourceRef, turnIds, { ...base, kind: "blocked", text: `Correction rejected: ${message}` });
    }
  }

  private async research(
    ctx: TurnContext,
    prompt: string,
    sourceRef: string,
    turnIds: string[],
    override?: Partial<ResearchPolicy>,
  ): Promise<TurnOutcome> {
    const { db, behavior } = this.deps;
    const scoped = policyFromRules(behavior.listRulesByPrefix(ctx.scope, "research."));
    // Callers (watches) may tighten the scope policy, never loosen it.
    const policy: ResearchPolicy = {
      requiredCollections: [...new Set([...scoped.requiredCollections, ...(override?.requiredCollections ?? [])])],
      citationsRequired: scoped.citationsRequired || override?.citationsRequired === true,
    };
    const language = behavior.getRule(ctx.scope, "conversation.language")?.value;
    const budgets = this.deps.config?.budgets;
    const runId =
      ctx.runId ??
      createRun(db, ctx.scope, budgets?.bytesMax, {
        requestsMax: budgets?.requestsMax,
        tokensMax: budgets?.tokensMax,
        toolCallsMax: budgets?.toolCallsMax,
        monetaryBudgetCents: budgets?.monetaryBudgetCents,
      });
    const maxSteps = this.deps.options?.maxSteps ?? DEFAULT_MAX_STEPS;
    const evidenceRetries = this.deps.options?.evidenceRetries ?? 1;
    const toolResultChars = this.deps.options?.toolResultChars ?? DEFAULT_TOOL_RESULT_CHARS;

    let created: Awaited<ReturnType<ChatModelFactory>>;
    try {
      created = await this.deps.model();
    } catch (e) {
      finishRun(db, runId, "failed");
      const message = e instanceof KeliError ? `${e.code}: ${e.message}` : String(e);
      return this.finalize(ctx, sourceRef, turnIds, {
        kind: "error",
        text: `No usable model provider: ${message}`,
        steps: 0,
        toolCalls: 0,
        runId,
        conversationId: ctx.conversationId,
        turnIds,
        costUnknown: true,
      });
    }

    const system = buildSystemPrompt({
      ctx,
      policy,
      language,
      registry: this.deps.registry,
      sources: this.deps.sources,
      db,
      prompt,
    });
    const history = historyMessages(listTurns(db, ctx.conversationId).filter((t) => t.sourceRef !== sourceRef));
    const messages: ChatMessage[] = [{ role: "system", content: system }, ...history, { role: "user", content: prompt }];
    const known: KnownSources = new Map();
    const evidence: string[] = [];
    let steps = 0;
    let toolCalls = 0;
    let evidenceFailures = 0;
    let malformed = 0;

    const finish = (outcome: Omit<TurnOutcome, "conversationId" | "turnIds" | "steps" | "toolCalls" | "runId" | "costUnknown">) => {
      finishRun(db, runId, outcome.kind === "error" || outcome.kind === "blocked" ? "failed" : "completed");
      try {
        writeCheckpoint(db, {
          scope: ctx.scope,
          runId,
          goal: prompt.slice(0, 200),
          state: { done: [outcome.kind], pending: [], evidence },
        });
      } catch {
        // checkpoint persistence is best effort
      }
      return this.finalize(ctx, sourceRef, turnIds, {
        ...outcome,
        steps,
        toolCalls,
        runId,
        conversationId: ctx.conversationId,
        turnIds,
        costUnknown: !created.costKnown,
      });
    };

    while (steps < maxSteps) {
      steps += 1;
      const run = getRun(db, runId);
      if (!run || run.status === "cancelled") {
        return finish({ kind: "blocked", text: "Run cancelled before the next step." });
      }

      const call = await runBudgetedModelCall(
        {
          db,
          runId,
          providerId: created.providerId,
          model: created.model,
          pricing: this.deps.config?.pricing?.[created.providerId],
          estimateTokens: estimateTokens(messages.map((m) => m.content).join("\n")),
          retryBaseMs: this.deps.options?.retryBaseMs ?? budgets?.retryBaseMs,
        },
        () => created.provider.complete(messages, { responseFormat: "json_object" }),
      );
      if (call.stop === "aborted" && call.abortError) {
        return finish({ kind: "blocked", text: `Stopped: ${call.abortError.message}` });
      }
      if (call.result.error) {
        const detail = call.stop === "no_progress" ? `no progress after ${call.attempts} attempts (${call.result.error})` : call.result.error;
        return finish({ kind: "error", text: `Model request failed: ${detail}` });
      }

      const parsed = parseDecision(call.result.content ?? "");
      if ("error" in parsed) {
        malformed += 1;
        if (malformed >= 2) return finish({ kind: "error", text: `Model returned malformed decisions twice: ${parsed.error}` });
        messages.push({ role: "assistant", content: call.result.content ?? "" });
        messages.push({ role: "user", content: `Your previous reply was not a valid decision (${parsed.error}). Reply with exactly one JSON object.` });
        continue;
      }
      const decision = parsed.decision;
      messages.push({ role: "assistant", content: JSON.stringify(decision) });

      if (decision.type === "clarify") {
        return finish({ kind: "clarify", text: decision.question });
      }
      if (decision.type === "missing_evidence") {
        const searched = decision.searched?.length ? ` Searched: ${decision.searched.join("; ")}.` : "";
        const needed = decision.needed?.length ? ` Needed: ${decision.needed.join("; ")}.` : "";
        return finish({ kind: "missing_evidence", text: `${decision.text}${searched}${needed}` });
      }
      if (decision.type === "tool_call") {
        toolCalls += 1;
        const result = await this.executeTool(ctx, runId, decision.capability, decision.input, known, evidence);
        appendTurn(db, {
          conversationId: ctx.conversationId,
          scope: ctx.scope,
          role: "tool",
          kind: "tool_result",
          content: result.content,
          refs: { capability: decision.capability, ok: result.ok, actionId: result.actionId },
          runId,
          sourceRef,
        });
        messages.push({
          role: "user",
          content: `Tool result for ${decision.capability}: ${result.content.slice(0, toolResultChars)}`,
        });
        continue;
      }

      const draft: AnswerDraft = {
        text: decision.text,
        citations: decision.citations ?? [],
        attributions: decision.attributions ?? [],
      };
      const verdict = checkEvidence(draft, policy, known);
      if (verdict.ok) {
        return finish({ kind: "answer", text: draft.text, citations: draft.citations, attributions: draft.attributions });
      }
      evidenceFailures += 1;
      if (evidenceFailures > evidenceRetries) {
        return finish({
          kind: "missing_evidence",
          text: `I can't give that answer yet. ${verdict.reasons.join(". ")}. Draft withheld until the evidence is retrieved.`,
          citations: draft.citations,
          attributions: draft.attributions,
        });
      }
      messages.push({
        role: "user",
        content: `Evidence check failed: ${verdict.reasons.join("; ")}. Retrieve the missing evidence with a tool call, mark the attribution stance as "no-coverage", or reply with type "missing_evidence".`,
      });
    }

    return finish({ kind: "error", text: `Stopped after ${maxSteps} steps without an answer.` });
  }

  private async executeTool(
    ctx: TurnContext,
    runId: string,
    capability: string,
    input: Record<string, unknown>,
    known: KnownSources,
    evidence: string[],
  ): Promise<{ ok: boolean; content: string; actionId?: string }> {
    if (!isResearchCapability(capability)) {
      return { ok: false, content: JSON.stringify({ error: `capability ${capability} is not allowed in research turns` }) };
    }
    const { actionId, result } = await this.deps.capabilityGate.run(
      { capabilityId: capability, input, resources: [] },
      this.deps.policy,
      ctx.scope,
      undefined,
      {
        runId,
        jobId: ctx.jobId,
        sources: this.deps.sources,
        networkHosts: this.deps.networkHosts,
        fixtures: this.deps.fixtures,
      },
    );
    if (result.ok) this.registerSources(capability, input, result.output, known, evidence);
    const payload = result.ok ? { ok: true, output: result.output } : { ok: false, error: result.error };
    return { ok: result.ok, content: JSON.stringify(payload), actionId };
  }

  private registerSources(
    capability: string,
    input: Record<string, unknown>,
    output: unknown,
    known: KnownSources,
    evidence: string[],
  ): void {
    const out = (output ?? {}) as Record<string, unknown>;
    if (capability === "sources.search" && Array.isArray(out.hits)) {
      for (const hit of out.hits as Array<{ sourceId?: string; collection?: string }>) {
        if (hit.sourceId && hit.collection) {
          known.set(hit.sourceId, { collection: hit.collection });
          evidence.push(hit.sourceId);
        }
      }
    } else if (capability === "sources.read" && typeof out.sourceId === "string" && typeof out.collection === "string") {
      known.set(out.sourceId, { collection: out.collection });
      evidence.push(out.sourceId);
    } else if (capability === "web.fetch" || capability === "http.fetch") {
      const url = String(input.url ?? "");
      if (url) {
        known.set(url, { collection: "web" });
        evidence.push(url);
      }
    } else if (capability === "search.query" && Array.isArray(out.results)) {
      for (const r of out.results as Array<{ url?: string }>) {
        if (r.url) known.set(r.url, { collection: "web" });
      }
    }
  }

  private finalize(ctx: TurnContext, sourceRef: string, turnIds: string[], outcome: TurnOutcome): TurnOutcome {
    const { turn } = appendTurn(this.deps.db, {
      id: turnIdFor(ctx.conversationId, sourceRef, "assistant"),
      conversationId: ctx.conversationId,
      scope: ctx.scope,
      role: "assistant",
      kind: outcome.kind,
      content: outcome.text,
      refs: {
        citations: outcome.citations,
        attributions: outcome.attributions,
        steps: outcome.steps,
        toolCalls: outcome.toolCalls,
        costUnknown: outcome.costUnknown,
        rule: outcome.rule,
      },
      runId: outcome.runId,
      sourceRef,
    });
    turnIds.push(turn.id);
    return { ...outcome, turnIds };
  }
}
