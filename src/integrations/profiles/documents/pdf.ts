import { resolveBinary } from "../../../execution/bounded-process.ts";
import { registerIntegration } from "../../registry.ts";
import { notConfigured } from "../../round-trip.ts";
import { statusOf } from "../../status.ts";
import type { IntegrationProfile } from "../../types.ts";

export const documentsPdfProfile: IntegrationProfile = {
  id: "documents-pdf",
  kind: "documents",
  displayName: "PDF text extraction",
  aliases: ["pdf"],
  auth: { type: "none" },
  settings: [{ key: "bin", label: "pdftotext path" }],
  fixtureKey: "documents",
  reuse: {
    upstream: "owned uncompressed PDF strings + optional pdftotext",
    pin: "in-tree",
    license: "Apache-2.0 (wrapper); no npm PDF parser adopted",
    prdIds: ["I9"],
  },
  async probe(ctx) {
    const bin = resolveBinary(ctx.settings.bin ?? "pdftotext");
    const fixture = Boolean(ctx.fixtureUrl);
    return statusOf({
      id: "documents-pdf",
      kind: "documents",
      displayName: "PDF text extraction",
      configured: true,
      credentialState: "n/a",
      reachable: true,
      reason: fixture
        ? "document fixture configured"
        : bin
          ? `pdftotext available at ${bin}`
          : "uncompressed text PDFs work without pdftotext; compressed PDFs need poppler-utils",
      howToConfigure: "keli setup (Documents/OCR) or install pdftotext",
    });
  },
  async roundTrip(ctx) {
    if (ctx.fixtureUrl) return { ok: true, detail: "document fixture configured" };
    return resolveBinary(ctx.settings.bin ?? "pdftotext")
      ? { ok: true, detail: "pdftotext present" }
      : notConfigured("pdftotext optional; uncompressed text PDFs still extract in-process");
  },
};

registerIntegration(documentsPdfProfile);
