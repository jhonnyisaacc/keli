import { KeliError } from "../core/errors.ts";

export type CredentialRef = {
  id: string;
  service: string;
};

export interface CredentialSource {
  readonly name: string;
  readonly available: boolean;
  get(ref: CredentialRef): Promise<string | null>;
}

export class LockedCredentialSource implements CredentialSource {
  readonly name = "locked";
  readonly available = false;

  async get(_ref: CredentialRef): Promise<string | null> {
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
}

export function defaultCredentialSource(): CredentialSource {
  const bun = new BunSecretsSource();
  return bun.available ? bun : new LockedCredentialSource();
}
