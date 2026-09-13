import type { IntegrationKind, IntegrationStatus, CredentialState } from "./types.ts";

export function statusOf(input: {
  id: string;
  kind: IntegrationKind;
  displayName: string;
  configured: boolean;
  credentialState?: CredentialState;
  reachable?: boolean;
  reason?: string;
  howToConfigure: string;
}): IntegrationStatus {
  return {
    id: input.id,
    kind: input.kind,
    displayName: input.displayName,
    configured: input.configured,
    credentialState: input.credentialState ?? (input.configured ? "n/a" : "missing"),
    reachable: input.reachable,
    reason: input.reason,
    howToConfigure: input.howToConfigure,
  };
}
