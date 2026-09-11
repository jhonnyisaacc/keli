import type { CapabilityResult } from "../capabilities/types.ts";
import { KeliError } from "../core/errors.ts";
import type { CredentialRef } from "../credentials/source.ts";
import { defaultCredentialSource } from "../credentials/source.ts";

export type BrowserSessionConnectInput = {
  url: string;
  credentialRef?: CredentialRef;
};

export async function browserSessionConnect(
  input: BrowserSessionConnectInput,
  fixtureUrl?: string,
): Promise<CapabilityResult> {
  const url = fixtureUrl ?? process.env.KELI_BROWSER_SESSION_FIXTURE_URL;
  if (!url) {
    return {
      capabilityId: "browser.session",
      ok: false,
      error: {
        code: "capability_unavailable",
        message: "browser.session requires KELI_BROWSER_SESSION_FIXTURE_URL or configured session backend",
      },
    };
  }

  let username: string | null = null;
  if (input.credentialRef) {
    const creds = defaultCredentialSource();
    try {
      username = await creds.get(input.credentialRef);
    } catch (e) {
      const keli = e instanceof KeliError ? e : null;
      return {
        capabilityId: "browser.session",
        ok: false,
        error: {
          code: keli?.code ?? "secret_unavailable",
          message: keli?.message ?? String(e),
        },
      };
    }
  }

  const response = await fetch(`${url.replace(/\/$/, "")}/browser/session`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      url: input.url,
      authenticated: Boolean(username),
    }),
  });

  if (!response.ok) {
    return {
      capabilityId: "browser.session",
      ok: false,
      error: { code: "engine_error", message: `Session fixture HTTP ${response.status}` },
    };
  }

  const payload = (await response.json()) as { sessionId: string; title: string };
  return {
    capabilityId: "browser.session",
    ok: true,
    output: {
      sessionId: payload.sessionId,
      url: input.url,
      title: payload.title,
      credentialUsed: input.credentialRef ? input.credentialRef.id : null,
    },
  };
}
