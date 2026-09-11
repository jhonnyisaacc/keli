export type ActionClass = "read" | "mutate" | "effect";

export type CapabilityDescriptor = {
  id: string;
  version: string;
  summary: string;
  actionClass: ActionClass;
  resources: string[];
  schema: Record<string, unknown>;
};

export type CapabilityProposal = {
  capabilityId: string;
  input: Record<string, unknown>;
  resources: string[];
};

export type CapabilityResult = {
  capabilityId: string;
  ok: boolean;
  output?: unknown;
  error?: { code: string; message: string; retryable?: boolean };
  artifacts?: { path: string; hash?: string }[];
};
