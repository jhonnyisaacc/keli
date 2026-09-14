import { describe, expect, test } from "bun:test";
import {
  confirmPairing,
  consumePairing,
  extractPairingCode,
  issuePairingCode,
  pairingAccepts,
  pairingExpiresAt,
  pairingMatchesRoute,
  pairingPhrase,
  pairingValid,
  type PairingChallenge,
} from "../../src/transports/pairing.ts";

describe("transport pairing challenge", () => {
  test("accepts the one-use code from the bound chat and rejects reuse or expiry", () => {
    const code = issuePairingCode();
    expect(code).toMatch(/^[a-f0-9]{8}$/);
    const challenge = {
      transport: "telegram" as const,
      externalId: "chat-1",
      code,
      expiresAt: pairingExpiresAt(),
    };
    expect(extractPairingCode(`please ${pairingPhrase(code)}`)).toBe(code);
    expect(pairingValid(challenge, pairingPhrase(code))).toBe(true);
    expect(pairingAccepts(challenge, code)).toBe(true);
    expect(pairingAccepts(challenge, "deadbeef")).toBe(false);
    const confirmed = confirmPairing(challenge, "actor-1");
    expect(confirmed.pairedActorId).toBe("actor-1");
    expect(pairingValid(confirmed, pairingPhrase(code))).toBe(false);
    const expired = { ...challenge, expiresAt: new Date(0).toISOString() };
    expect(pairingValid(expired, pairingPhrase(code))).toBe(false);
  });

  test("rejects the same code on the wrong transport or channel", () => {
    const code = issuePairingCode();
    const challenge = {
      transport: "telegram" as const,
      externalId: "chat-1",
      code,
      expiresAt: pairingExpiresAt(),
    };
    expect(pairingMatchesRoute(challenge, "discord", "chat-1")).toBe(false);
    expect(pairingMatchesRoute(challenge, "telegram", "other-chat")).toBe(false);
    expect(pairingMatchesRoute(challenge, "telegram", "chat-1")).toBe(true);
    expect(pairingAccepts(challenge, pairingPhrase(code), { transport: "discord", externalId: "chat-1" })).toBe(false);
    expect(pairingAccepts(challenge, pairingPhrase(code), { transport: "telegram", externalId: "other-chat" })).toBe(false);
    expect(pairingAccepts(challenge, pairingPhrase(code), { transport: "telegram", externalId: "chat-1" })).toBe(true);
  });

  test("consumePairing marks the in-memory challenge used", () => {
    const code = issuePairingCode();
    const challenge: PairingChallenge = {
      transport: "telegram",
      externalId: "chat-1",
      code,
      expiresAt: pairingExpiresAt(),
    };
    const first = consumePairing(challenge, "actor-1");
    expect(first.pairedActorId).toBe("actor-1");
    expect(challenge.verifiedAt).toBe(first.verifiedAt);
    expect(pairingAccepts(challenge, pairingPhrase(code), { transport: "telegram", externalId: "chat-1" })).toBe(false);
    const second = consumePairing(challenge, "actor-2");
    expect(challenge.pairedActorId).toBe("actor-1");
    expect(second.pairedActorId).toBe("actor-1");
  });
});
