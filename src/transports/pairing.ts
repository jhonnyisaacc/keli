import { randomBytes } from "node:crypto";

export const PAIRING_PREFIX = "KELI-PAIR";
const TTL_MS = 15 * 60 * 1000;

export type PairingChallenge = {
  transport: "discord" | "telegram";
  externalId: string;
  code: string;
  expiresAt: string;
  pairedActorId?: string;
  verifiedAt?: string;
};

export function issuePairingCode(): string {
  return randomBytes(4).toString("hex");
}

export function pairingPhrase(code: string): string {
  return `${PAIRING_PREFIX} ${code}`;
}

export function pairingExpiresAt(now = Date.now()): string {
  return new Date(now + TTL_MS).toISOString();
}

export function extractPairingCode(text: string): string | undefined {
  const match = new RegExp(`${PAIRING_PREFIX}\\s+([a-f0-9]{8})`, "i").exec(text.trim());
  return match?.[1]?.toLowerCase();
}

export function pairingValid(challenge: PairingChallenge, text: string, now = Date.now()): boolean {
  if (Date.parse(challenge.expiresAt) <= now) return false;
  if (challenge.verifiedAt) return false;
  return extractPairingCode(text) === challenge.code.toLowerCase();
}

/** Discord threads are stored as `thread:<id>` on routes and `channel:thread` in setup. */
export function pairingRouteAliases(transport: string, externalId: string): string[] {
  const ids = new Set([externalId]);
  if (transport === "discord") {
    if (externalId.startsWith("thread:")) ids.add(externalId.slice("thread:".length));
    const parts = externalId.split(":");
    if (parts.length === 2 && parts[0] !== "thread") {
      ids.add(parts[1]!);
      ids.add(`thread:${parts[1]}`);
    }
  }
  return [...ids];
}

export function pairingMatchesRoute(
  challenge: PairingChallenge,
  transport: string,
  routeExternalId: string,
): boolean {
  if (challenge.transport !== transport) return false;
  const bound = new Set(pairingRouteAliases(transport, challenge.externalId));
  return pairingRouteAliases(transport, routeExternalId).some((id) => bound.has(id));
}

export function pairingAccepts(
  challenge: PairingChallenge,
  input: string,
  route?: { transport: string; externalId: string },
  now = Date.now(),
): boolean {
  if (route && !pairingMatchesRoute(challenge, route.transport, route.externalId)) return false;
  const text = extractPairingCode(input) ? input : pairingPhrase(input.trim());
  return pairingValid(challenge, text, now);
}

/** Marks the in-memory challenge used so a second actor cannot redeem the same object. */
export function consumePairing(challenge: PairingChallenge, actorId: string, now = Date.now()): PairingChallenge {
  if (challenge.verifiedAt) return challenge;
  const next = confirmPairing(challenge, actorId, now);
  challenge.pairedActorId = next.pairedActorId;
  challenge.verifiedAt = next.verifiedAt;
  return next;
}

export function confirmPairing(challenge: PairingChallenge, actorId: string, now = Date.now()): PairingChallenge {
  return {
    ...challenge,
    pairedActorId: actorId,
    verifiedAt: new Date(now).toISOString(),
  };
}
