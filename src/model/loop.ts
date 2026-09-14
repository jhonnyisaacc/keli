import type { BehaviorService } from "../core/behavior.ts";
import type { GateService } from "../core/gate.ts";
import { parsePrompt, isUntrustedInstruction, isAmbiguousCorrection } from "../core/correction.ts";
import { explainSelection } from "../core/explain.ts";
import type { ModelProvider, ProviderMode } from "./provider.ts";
import type { DelegateService } from "./delegate-service.ts";
import { KeliError } from "../core/errors.ts";
import { projectScope } from "../state/repos.ts";
import type { CodingDelegate, RunOverrideDelegate } from "../core/types.ts";
import type { KeliConfig } from "../state/config.ts";
import { routingFromConfig, selectProviderForTurn } from "./routing.ts";
import { createModelProvider } from "./provider-factory.ts";
import { searchNotes } from "../memory/notes.ts";
import { listActiveSkills } from "../skills/store.ts";
import { maybeRecordSkillUse } from "../skills/activation.ts";
import { estimateTokens } from "../core/budgets.ts";
import { createRun, finishRun } from "../core/run-control.ts";
import { runBudgetedModelCall } from "./attempts.ts";
import type { CredentialSource } from "../credentials/source.ts";

export type TurnResult = {
  kind: "correction" | "action" | "override" | "blocked" | "error";
  message: string;
  rule?: { scope: string; key: string; value: string; revision: number };
  action?: unknown;
  explanation?: ReturnType<typeof explainSelection>;
  costUnknown?: boolean;
};

export class ModelLoop {
  constructor(
    private readonly behavior: BehaviorService,
    private readonly gate: GateService,
    private readonly projectId: string,
    private readonly projectName: string,
    private readonly provider?: ModelProvider,
    private readonly delegateService?: DelegateService,
    private readonly workspace = "/tmp",
    private readonly config?: KeliConfig | null,
    private readonly options: { credentials?: CredentialSource; retryBaseMs?: number } = {},
  ) {}

  async runTurn(prompt: string, options?: { mode?: ProviderMode; undo?: boolean }): Promise<TurnResult> {
    const scope = projectScope(this.projectId);
    const key = "coding.delegate";

    if (options?.undo) {
      const rule = this.behavior.undoRule(scope, key);
      return {
        kind: "correction",
        message: `Undone. Restored ${key}=${rule.value} at revision ${rule.revision}.`,
        rule: { scope, key, value: rule.value, revision: rule.revision },
      };
    }

    if (isUntrustedInstruction(prompt)) {
      return {
        kind: "blocked",
        message: "Quoted or untrusted instruction ignored; no behavior change committed.",
      };
    }

    if (isAmbiguousCorrection(prompt)) {
      return {
        kind: "blocked",
        message:
          `Ambiguous correction for ${this.projectName}. Which delegate should apply? Example: "${this.projectName} changes use Codex".`,
      };
    }

    const parsed = parsePrompt(prompt);

    if (parsed.kind === "correction" && parsed.correction) {
      const { projectName, delegate, sourceText } = parsed.correction;
      const rule = this.behavior.reviseCodingDelegate(projectName, delegate, {
        actor: "owner",
        text: sourceText,
        source: "user-correction",
        trusted: true,
      });
      return {
        kind: "correction",
        message: `Committed: ${projectName} changes use ${delegate} (revision ${rule.revision}).`,
        rule: { scope: rule.scope, key: rule.key, value: rule.value, revision: rule.revision },
      };
    }

    if (parsed.kind === "override" && parsed.override) {
      return await this.runAction(prompt, scope, key, parsed.override.delegate);
    }

    if (parsed.kind === "action" || parsed.kind === "unknown") {
      if (!this.behavior.getRule(scope, key)) {
        return {
          kind: "error",
          message: `No coding.delegate rule for project ${this.projectName}. Teach one first, e.g. "${this.projectName} changes use Codex".`,
        };
      }
      return await this.runAction(prompt, scope, key, undefined, options?.mode);
    }

    return { kind: "error", message: "Could not interpret prompt." };
  }

  private async runAction(
    prompt: string,
    scope: string,
    key: string,
    runOverride?: RunOverrideDelegate,
    mode?: ProviderMode,
  ): Promise<TurnResult> {
    const rule = this.behavior.requireRule(scope, key);
    const effectiveValue = (runOverride ?? rule.value) as CodingDelegate | "Grok";
    const useProviderPath = runOverride === "Grok" || !this.delegateService;

    const result = !useProviderPath && this.delegateService
      ? await this.gate.actWithDelegate(
          prompt,
          scope,
          key,
          (prepared) =>
            this.delegateService!.execute(prepared, this.workspace, runOverride),
          { effectiveDelegate: runOverride },
        )
      : await this.runViaProvider(prompt, scope, key, runOverride, mode, effectiveValue);

    const explanation = explainSelection(this.behavior, scope, key, runOverride);
    const status = (result.action as { status: string }).status;
    const costKnown = (result as { costKnown?: boolean }).costKnown;
    if (status === "executed") {
      maybeRecordSkillUse(
        this.behavior.database(),
        scope,
        prompt,
        this.config?.skills?.activationUses ?? 2,
      );
    }
    const usedDelegate = (result as { delegateExecution?: { usedFallback: boolean; delegate: string } })
      .delegateExecution;
    const delegateLabel = usedDelegate
      ? `${usedDelegate.delegate}${usedDelegate.usedFallback ? " (fallback)" : ""}`
      : effectiveValue;

    return {
      kind: status === "executed" ? "action" : "blocked",
      message:
        status === "executed"
          ? `Action executed with delegate ${delegateLabel}.`
          : `Action blocked: ${(result.action as { reason: string }).reason}`,
      action: result.action,
      explanation,
      costUnknown: costKnown === undefined
        ? !this.config?.pricing?.[String(providerIdForConfig(this.config, runOverride))]
        : !costKnown,
      rule: {
        scope,
        key,
        value: effectiveValue,
        revision: explanation.revision,
      },
    };
  }

  private async runViaProvider(
    prompt: string,
    scope: string,
    key: string,
    runOverride?: RunOverrideDelegate,
    mode?: ProviderMode,
    effectiveValue?: CodingDelegate | "Grok",
  ) {
    const routing = routingFromConfig(this.config ?? null);
    const routedId = selectProviderForTurn(routing, "action", process.env.KELI_PROVIDER_ID ?? this.config?.providers?.primary?.id);
    let provider: ModelProvider | undefined = this.provider;
    let providerId = "fixture";
    let model: string | undefined;
    let costKnown = false;
    if (runOverride === "Grok" || routedId !== "fixture" || !provider) {
      const created = await createModelProvider({
        config: this.config,
        explicitId: runOverride === "Grok" ? "grok" : routedId === "fixture" ? undefined : routedId,
        role: runOverride === "Grok" ? undefined : "task",
        credentials: this.options.credentials,
      });
      provider = created.provider;
      providerId = created.providerId;
      model = created.model;
      costKnown = created.costKnown;
    }
    if (!provider) {
      throw new KeliError("Provider required for action turns", "provider_required");
    }
    const delegate =
      effectiveValue === "Grok"
        ? "Grok"
        : (effectiveValue ?? this.behavior.requireRule(scope, key).value as CodingDelegate);
    const db = this.behavior.database();
    const notes = safeNotes(db, scope, prompt);
    const skills = listActiveSkills(db, scope).slice(0, 4);
    const skillBudget = skills.reduce((n, s) => n + s.content.length, 0);
    const boundedSkills = skillBudget > 24_000 ? skills.slice(0, 1) : skills;
    const advisoryContext = {
      notes: notes.map((n) => ({ title: n.title, body: n.body.slice(0, 400) })),
      skills: boundedSkills.map((s) => ({ id: s.id, content: s.content.slice(0, 1500) })),
    };

    const budgets = this.config?.budgets;
    const runId = createRun(db, scope, budgets?.bytesMax, {
      requestsMax: budgets?.requestsMax,
      tokensMax: budgets?.tokensMax,
      toolCallsMax: budgets?.toolCallsMax,
      monetaryBudgetCents: budgets?.monetaryBudgetCents,
    });

    const result = await this.gate.act(
      prompt,
      scope,
      key,
      async (req) => {
        const payload = {
          ...req,
          ...(runOverride ? { value: String(delegate) } : {}),
          advisoryContext,
        };
        const outcome = await runBudgetedModelCall(
          {
            db,
            runId,
            providerId,
            model,
            actionId: req.id,
            pricing: this.config?.pricing?.[providerId],
            estimateTokens: estimateTokens(JSON.stringify(payload)),
            retryBaseMs: this.options.retryBaseMs ?? budgets?.retryBaseMs,
          },
          () => provider!.propose(payload, mode),
        );
        if (outcome.stop === "aborted" && outcome.abortError) {
          return { id: req.id, error: `blocked: ${outcome.abortError.message}` };
        }
        if (outcome.stop === "no_progress") {
          return {
            id: req.id,
            error: `blocked: no progress after ${outcome.attempts} attempts (${outcome.result.error})`,
            usage: outcome.result.usage,
          };
        }
        return outcome.result;
      },
      { effectiveDelegate: runOverride === "Grok" ? "Grok" : runOverride },
    );
    const status = (result.action as { status: string }).status;
    finishRun(db, runId, status === "executed" ? "completed" : "failed");
    return { ...result, costKnown, runId };
  }
}

function safeNotes(db: import("bun:sqlite").Database, scope: string, prompt: string) {
  try {
    const q = prompt.split(/\s+/).filter((w) => w.length > 3).slice(0, 4).join(" OR ");
    if (!q) return [];
    return searchNotes(db, scope, q, 5);
  } catch {
    return [];
  }
}

function providerIdForConfig(config: KeliConfig | null | undefined, runOverride?: string): string {
  if (runOverride === "Grok") return "grok";
  return config?.providers?.primary?.id ?? config?.primaryModel ?? "fixture";
}
