import type { BehaviorService } from "../core/behavior.ts";
import type { GateService } from "../core/gate.ts";
import { parsePrompt, isUntrustedInstruction } from "../core/correction.ts";
import { explainSelection } from "../core/explain.ts";
import type { ModelProvider, ProviderMode } from "./provider.ts";
import type { DelegateService } from "./delegate-service.ts";
import { KeliError } from "../core/errors.ts";
import { projectScope } from "../state/repos.ts";
import type { CodingDelegate } from "../core/types.ts";

export type TurnResult = {
  kind: "correction" | "action" | "override" | "blocked" | "error";
  message: string;
  rule?: { scope: string; key: string; value: string; revision: number };
  action?: unknown;
  explanation?: ReturnType<typeof explainSelection>;
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
    runOverride?: CodingDelegate,
    mode?: ProviderMode,
  ): Promise<TurnResult> {
    const rule = this.behavior.requireRule(scope, key);
    const effectiveValue = (runOverride ?? rule.value) as CodingDelegate;

    const result = this.delegateService
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
    runOverride?: CodingDelegate,
    mode?: ProviderMode,
    effectiveValue?: CodingDelegate,
  ) {
    if (!this.provider) {
      throw new KeliError("Provider required for action turns", "provider_required");
    }
    const delegate = effectiveValue ?? this.behavior.requireRule(scope, key).value as CodingDelegate;
    return this.gate.act(
      prompt,
      scope,
      key,
      async (req) => {
        const response = await this.provider!.propose(
          runOverride ? { ...req, value: delegate } : req,
          mode,
        );
        return response;
      },
      { effectiveDelegate: runOverride },
    );
  }
}
