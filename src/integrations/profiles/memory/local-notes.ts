import { registerIntegration } from "../../registry.ts";
import { statusOf } from "../../status.ts";
import type { IntegrationProfile } from "../../types.ts";

export const localNotesProfile: IntegrationProfile = {
  id: "local-notes",
  kind: "memory",
  displayName: "Local notes (FTS)",
  aliases: ["notes"],
  auth: { type: "none" },
  settings: [],
  reuse: {
    upstream: "SQLite FTS5",
    pin: "in-tree",
    license: "Apache-2.0",
    prdIds: ["I1", "A29"],
  },
  async probe() {
    return statusOf({
      id: "local-notes",
      kind: "memory",
      displayName: "Local notes (FTS)",
      configured: true,
      credentialState: "n/a",
      reachable: true,
      reason: "built-in advisory notes; SQLite is the v0.1 memory authority",
      howToConfigure: "keli notes add --title ... --body ...",
    });
  },
  async roundTrip() {
    return { ok: true, detail: "local SQLite notes are available without a network probe" };
  },
};

registerIntegration(localNotesProfile);
