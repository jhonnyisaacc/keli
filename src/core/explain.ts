import type { BehaviorService } from "./behavior.ts";
import type { Rule } from "./types.ts";

export type Explanation = {
  scope: string;
  key: string;
  selectedValue: string;
  revision: number;
  source: string;
  provenance: Rule["provenance"];
  rationale: string;
};

export function explainSelection(
  behavior: BehaviorService,
  scope: string,
  key: string,
  runOverride?: string,
): Explanation {
  const rule = behavior.requireRule(scope, key);
  const source = rule.provenance.source ?? rule.provenance.text ?? "durable rule";
  let rationale = `Active ${key} at ${scope} revision ${rule.revision} selects ${rule.value}.`;
  if (runOverride) {
    rationale += ` Run override ${runOverride} applied for this turn only.`;
  }
  return {
    scope: rule.scope,
    key: rule.key,
    selectedValue: runOverride ?? rule.value,
    revision: rule.revision,
    source,
    provenance: rule.provenance,
    rationale,
  };
}
