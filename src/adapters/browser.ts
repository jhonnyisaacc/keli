import type { CapabilityResult } from "../capabilities/types.ts";
import type { NetworkPolicy } from "../execution/network-policy.ts";
import type { BrowserBackendConfig } from "../execution/browser-backends.ts";
import { navigateWithBrowser } from "../execution/browser-backends.ts";
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
