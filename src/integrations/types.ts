import type { CredentialRef } from "../credentials/source.ts";

export type IntegrationKind =
  | "model-provider"
  | "transport"
  | "memory"
  | "delegate"
  | "mcp-server"
  | "browser-backend"
  | "search"
  | "documents"
  | "ocr"
  | "speech";

export type AuthType = "none" | "api-key" | "token" | "external-cli" | "oauth-device";

export type ApiMode = "chat-completions" | "anthropic-messages" | "acp";

export type SettingSpec = {
  key: string;
  label: string;
  secret?: boolean;
  required?: boolean;
  default?: string;
};

export type CredentialState = "n/a" | "resolvable" | "locked" | "missing" | "needs-reauth";

export type IntegrationStatus = {
  id: string;
  kind: IntegrationKind;
  displayName: string;
  configured: boolean;
  credentialState: CredentialState;
  reachable?: boolean;
  reason?: string;
  howToConfigure: string;
};

export type ProbeContext = {
  settings: Record<string, string>;
  credentialRef?: CredentialRef;
  fixtureUrl?: string;
  needsReauth?: boolean;
};

/** A live round trip performs one real, side-effect-free request against the configured endpoint. */
export type RoundTripContext = ProbeContext & {
  /** Resolved secret value; never logged. Absent when the credential store is locked or unset. */
  credential?: string;
  credentialSource?: import("../credentials/source.ts").CredentialSource;
  timeoutMs?: number;
};

export type RoundTripResult = {
  ok: boolean;
  /** Human-readable detail without secrets. */
  detail: string;
  /** Typed class for failures so probes distinguish auth from transport. */
  failure?: "auth" | "transport" | "invalid" | "unsupported" | "not-configured";
  latencyMs?: number;
};

export type ReuseNote = {
  upstream: string;
  pin: string;
  license: string;
  prdIds: string[];
};

export type IntegrationProfile = {
  id: string;
  kind: IntegrationKind;
  displayName: string;
  aliases: string[];
  auth: { type: AuthType };
  settings: SettingSpec[];
  fixtureKey?: string;
  apiMode?: ApiMode;
  baseUrl?: string;
  defaultModels?: string[];
  /** `named-later` profiles are listed but never available until configured and release-pinned. */
  availability?: "bundled" | "named-later";
  probe: (ctx: ProbeContext) => Promise<IntegrationStatus>;
  /** Optional real request used by live probes. Absent means the profile cannot be live-verified. */
  roundTrip?: (ctx: RoundTripContext) => Promise<RoundTripResult>;
  reuse: ReuseNote;
};

export type ResolveSource = "explicit" | "config" | "fixture-env";

export type ResolvedIntegration = {
  profile: IntegrationProfile;
  settings: Record<string, string>;
  credentialRef: CredentialRef | null;
  source: ResolveSource;
  fixtureUrl?: string;
  model?: string;
};

export type IntegrationConfigEntry = {
  enabled: boolean;
  settings: Record<string, string>;
  credentialRef?: CredentialRef;
  status?: { needsReauth?: boolean; lastProbe?: string };
};

export type ProviderSelection = {
  id: string;
  model?: string;
};

export type CustomProvider = {
  id: string;
  displayName: string;
  apiMode: ApiMode;
  baseUrl: string;
  credentialRef?: CredentialRef;
};

export type McpServerConfig = {
  id: string;
  transport: "stdio" | "http";
  command?: string;
  url?: string;
  args?: string[];
  envRefs?: CredentialRef[];
};
