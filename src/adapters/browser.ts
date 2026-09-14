import type { CapabilityResult } from "../capabilities/types.ts";
import type { NetworkPolicy } from "../execution/network-policy.ts";
import type { BrowserBackendConfig } from "../execution/browser-backends.ts";
import { navigateWithBrowser, captureWithBrowser, type BrowserCaptureKind } from "../execution/browser-backends.ts";
import { KeliError } from "../core/errors.ts";

export async function browserNavigate(
  input: { url: string },
  policy: NetworkPolicy,
  browserConfig?: BrowserBackendConfig,
): Promise<CapabilityResult> {
  try {
    const output = await navigateWithBrowser(input.url, policy, browserConfig);
    return {
      capabilityId: "browser.navigate",
      ok: true,
      output,
    };
  } catch (e) {
    const keli = e instanceof KeliError ? e : null;
    return {
      capabilityId: "browser.navigate",
      ok: false,
      error: {
        code: keli?.code ?? "unknown",
        message: keli?.message ?? String(e),
        retryable: keli?.retryable ?? false,
      },
    };
  }
}

export async function browserCapture(
  input: { url: string; kind: BrowserCaptureKind },
  policy: NetworkPolicy,
  browserConfig?: BrowserBackendConfig,
): Promise<CapabilityResult> {
  try {
    const output = await captureWithBrowser(input.url, input.kind, policy, browserConfig);
    return {
      capabilityId: input.kind === "screenshot" ? "browser.screenshot" : "browser.download",
      ok: true,
      output: {
        url: output.url,
        kind: output.kind,
        contentType: output.contentType,
        bytes: output.bytes,
        sha256: output.sha256,
        bodyBase64: output.bodyBase64,
        backend: output.backend,
        title: output.title,
      },
    };
  } catch (e) {
    const keli = e instanceof KeliError ? e : null;
    return {
      capabilityId: input.kind === "screenshot" ? "browser.screenshot" : "browser.download",
      ok: false,
      error: {
        code: keli?.code ?? "unknown",
        message: keli?.message ?? String(e),
        retryable: keli?.retryable ?? false,
      },
    };
  }
}
