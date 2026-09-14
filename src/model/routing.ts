import type { KeliConfig } from "../state/config.ts";

export type RoutingRole = "cheap" | "strong" | "task" | "agent" | "provider";

export type ProviderRouting = Partial<Record<RoutingRole, string>>;

export type TurnKind = "correction" | "action" | "override" | "blocked" | "error";

export function routingFromConfig(config: KeliConfig | null): ProviderRouting {
  return config?.routing ?? {};
}

export function selectProviderForTurn(
  routing: ProviderRouting,
  turnKind: TurnKind,
  fallback?: string,
): string {
  const resolved =
    turnKind === "action" || turnKind === "override"
      ? routing.task ?? routing.agent ?? routing.provider ?? fallback
      : turnKind === "correction"
        ? routing.strong ?? routing.provider ?? fallback
        : routing.cheap ?? routing.provider ?? fallback;
  if (!resolved) throw new Error("No provider configured. Run keli setup and choose Chat/Models.");
  return resolved;
}
