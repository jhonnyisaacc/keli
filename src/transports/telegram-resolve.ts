import { defaultCredentialSource, type CredentialSource } from "../credentials/source.ts";
import { KeliError } from "../core/errors.ts";
import { fixtureUrlFor } from "../integrations/env.ts";
import { tryResolveIntegration } from "../integrations/resolve.ts";
import type { KeliConfig } from "../state/config.ts";
import { FixtureTelegramBackend, RestTelegramBackend, type TelegramBackend } from "./telegram-backend.ts";

export async function resolveTelegramBackend(
  config: KeliConfig | null | undefined,
  options: { credentials?: CredentialSource; fixtureUrl?: string } = {},
): Promise<TelegramBackend> {
  const fixture = options.fixtureUrl ?? fixtureUrlFor("telegram");
  const resolved = tryResolveIntegration("transport", { explicitId: "telegram", config });
  if (!resolved) {
    if (fixture) return new FixtureTelegramBackend(fixture);
    throw new KeliError("Telegram is not configured. Run: keli setup transport --transport telegram", "capability_unavailable");
  }
  if (!resolved.credentialRef) {
    if (fixture) return new FixtureTelegramBackend(fixture);
    throw new KeliError("Telegram bot token missing. Run: keli auth add telegram", "secret_unavailable");
  }
  const source = options.credentials ?? defaultCredentialSource();
  const token = await source.get(resolved.credentialRef);
  if (!token) throw new KeliError("Telegram bot token could not be read. Run: keli auth add telegram", "secret_unavailable");
  return new RestTelegramBackend(token, resolved.settings.baseUrl);
}
