import type { CapabilityResult } from "../capabilities/types.ts";
import type { SourceReader } from "../sources/reader.ts";

function unavailable(capabilityId: string): CapabilityResult {
  return {
    capabilityId,
    ok: false,
    error: {
      code: "capability_unavailable",
      message: "No source collections indexed. Run: keli sources add <id> <path> && keli sources index",
    },
  };
}

export function sourcesSearch(
  input: { query: string; collection?: string; limit?: number },
  reader?: SourceReader,
): CapabilityResult {
  if (!reader) return unavailable("sources.search");
  const hits = reader.search(input);
  return { capabilityId: "sources.search", ok: true, output: { query: input.query, collection: input.collection ?? null, hits } };
}

export function sourcesRead(
  input: { sourceId: string; offset?: number; chars?: number },
  reader?: SourceReader,
): CapabilityResult {
  if (!reader) return unavailable("sources.read");
  const passage = reader.read(input);
  if (!passage) {
    return {
      capabilityId: "sources.read",
      ok: false,
      error: { code: "invalid_request", message: `Unknown source id: ${input.sourceId}` },
    };
  }
  return { capabilityId: "sources.read", ok: true, output: passage };
}

export function sourcesCollections(reader?: SourceReader): CapabilityResult {
  if (!reader) return unavailable("sources.collections");
  return { capabilityId: "sources.collections", ok: true, output: { collections: reader.collections() } };
}
