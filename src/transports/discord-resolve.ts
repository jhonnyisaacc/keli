import { defaultCredentialSource, type CredentialSource } from "../credentials/source.ts";
import { KeliError } from "../core/errors.ts";
import { fixtureUrlFor } from "../integrations/env.ts";
import { tryResolveIntegration } from "../integrations/resolve.ts";
import type { KeliConfig } from "../state/config.ts";
import { FixtureDiscordBackend, RestDiscordBackend, type DiscordBackend } from "./discord-backend.ts";

/**
 * Resolve the Discord backend from saved config and credentials. Fixture selection stays
 * explicit (env fixture URL or a fixture baseUrl); otherwise a bot token is required.
 */
export async function resolveDiscordBackend(
  config: KeliConfig | null | undefined,
  options: { credentials?: CredentialSource; fixtureUrl?: string } = {},
): Promise<DiscordBackend> {
  const fixture = options.fixtureUrl ?? fixtureUrlFor("discord");
  const resolved = tryResolveIntegration("transport", { explicitId: "discord", config });
  if (!resolved) {
    if (fixture) return new FixtureDiscordBackend(fixture);
    throw new KeliError("Discord is not configured. Run: keli setup transport --transport discord", "capability_unavailable");
  }
  if (!resolved.credentialRef) {
    if (fixture) return new FixtureDiscordBackend(fixture);
    throw new KeliError("Discord bot token missing. Run: keli auth add discord", "secret_unavailable");
  }
  const source = options.credentials ?? defaultCredentialSource();
  const token = await source.get(resolved.credentialRef);
  if (!token) throw new KeliError("Discord bot token could not be read. Run: keli auth add discord", "secret_unavailable");
  return new RestDiscordBackend(token, resolved.settings.baseUrl);
}
