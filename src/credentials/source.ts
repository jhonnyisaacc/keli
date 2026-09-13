import { KeliError } from "../core/errors.ts";

export type CredentialRef = {
  id: string;
  service: string;
};

export interface CredentialSource {
  readonly name: string;
  readonly available: boolean;
  get(ref: CredentialRef): Promise<string | null>;
  set?(ref: CredentialRef, value: string): Promise<void>;
  delete?(ref: CredentialRef): Promise<void>;
}

export class LockedCredentialSource implements CredentialSource {
  readonly name = "locked";
  readonly available = false;

  async get(_ref: CredentialRef): Promise<string | null> {
    throw new KeliError("Credential store is locked or unavailable", "secret_unavailable");
  }

  async set(_ref: CredentialRef, _value: string): Promise<void> {
    throw new KeliError("Credential store is locked or unavailable", "secret_unavailable");
  }

  async delete(_ref: CredentialRef): Promise<void> {
    throw new KeliError("Credential store is locked or unavailable", "secret_unavailable");
  }
}

/** Bun.secrets adapter — experimental; fails closed when unavailable. */
export class BunSecretsSource implements CredentialSource {
  readonly name = "bun-secrets";
  readonly available: boolean;

  constructor() {
    this.available = typeof Bun.secrets !== "undefined";
  }

  async get(ref: CredentialRef): Promise<string | null> {
    if (!this.available) {
      throw new KeliError("Bun.secrets is unavailable on this host", "secret_unavailable");
    }
    try {
      const value = await Bun.secrets.get({
        service: ref.service,
        name: ref.id,
      });
      return value ?? null;
    } catch {
      throw new KeliError(`Credential '${ref.id}' unavailable`, "secret_unavailable");
    }
  }

  async set(ref: CredentialRef, value: string): Promise<void> {
    if (!this.available) {
      throw new KeliError("Bun.secrets is unavailable on this host", "secret_unavailable");
    }
    try {
      await Bun.secrets.set({
        service: ref.service,
        name: ref.id,
        value,
      });
    } catch {
      throw new KeliError(`Credential '${ref.id}' could not be stored`, "secret_unavailable");
    }
  }

  async delete(ref: CredentialRef): Promise<void> {
    if (!this.available) {
      throw new KeliError("Bun.secrets is unavailable on this host", "secret_unavailable");
    }
    try {
      await Bun.secrets.delete({
        service: ref.service,
        name: ref.id,
      });
    } catch {
      throw new KeliError(`Credential '${ref.id}' could not be removed`, "secret_unavailable");
    }
  }
}

/**
 * Read-only source for CI and headless hosts: `keli/<integration>` refs map to
 * `KELI_<INTEGRATION>_API_KEY` / `KELI_<INTEGRATION>_TOKEN` (plus the legacy
 * `KELI_PROVIDER_API_KEY` alias for openai-compatible). Values are never persisted or logged.
 */
export class EnvCredentialSource implements CredentialSource {
  readonly name = "env";
  readonly available = true;

  static candidates(ref: CredentialRef): string[] {
    const integration = ref.service.replace(/^keli\//, "").replace(/[^a-z0-9]+/gi, "_").toUpperCase();
    const names = [`KELI_${integration}_API_KEY`, `KELI_${integration}_TOKEN`, `KELI_${integration}_${ref.id.replace(/[^a-z0-9]+/gi, "_").toUpperCase()}`];
    if (integration === "OPENAI_COMPATIBLE") names.push("KELI_PROVIDER_API_KEY");
    return names;
  }

  static hasAny(): boolean {
    return Object.keys(process.env).some((k) => /^KELI_[A-Z0-9_]+_(API_KEY|TOKEN)$/.test(k));
  }

  async get(ref: CredentialRef): Promise<string | null> {
    for (const name of EnvCredentialSource.candidates(ref)) {
      const value = process.env[name];
      if (value) return value;
    }
    return null;
  }
}

export function defaultCredentialSource(): CredentialSource {
  const bun = new BunSecretsSource();
  if (bun.available) return bun;
  if (EnvCredentialSource.hasAny()) return new EnvCredentialSource();
  return new LockedCredentialSource();
}

export function credentialService(integrationId: string): string {
  return `keli/${integrationId}`;
}
