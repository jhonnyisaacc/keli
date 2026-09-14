import { resolveBinary } from "../../../execution/bounded-process.ts";
import { registerIntegration } from "../../registry.ts";
import { notConfigured } from "../../round-trip.ts";
import { statusOf } from "../../status.ts";
import type { IntegrationProfile } from "../../types.ts";

export const ocrTesseractProfile: IntegrationProfile = {
  id: "ocr-tesseract",
  kind: "ocr",
  displayName: "Tesseract OCR",
  aliases: ["tesseract"],
  auth: { type: "none" },
  settings: [{ key: "bin", label: "tesseract path" }],
  fixtureKey: "ocr",
  reuse: {
    upstream: "Tesseract OCR (optional binary)",
    pin: "local-process",
    license: "Apache-2.0",
    prdIds: ["I9"],
  },
  async probe(ctx) {
    const bin = resolveBinary(ctx.settings.bin ?? "tesseract");
    const fixture = Boolean(ctx.fixtureUrl);
    return statusOf({
      id: "ocr-tesseract",
      kind: "ocr",
      displayName: "Tesseract OCR",
      configured: fixture || Boolean(bin),
      credentialState: "n/a",
      reachable: fixture || Boolean(bin),
      reason: fixture ? "OCR fixture configured" : bin ? `tesseract at ${bin}` : "optional binary not installed",
      howToConfigure: "install tesseract-ocr or set KELI_FIXTURE_OCR",
    });
  },
  async roundTrip(ctx) {
    if (ctx.fixtureUrl) return { ok: true, detail: "OCR fixture configured" };
    return resolveBinary(ctx.settings.bin ?? "tesseract")
      ? { ok: true, detail: "tesseract present" }
      : notConfigured("Tesseract is optional and not required by CI");
  },
};

registerIntegration(ocrTesseractProfile);
