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
  fallback = "fixture",
): string {
  if (turnKind === "action" || turnKind === "override") {
    return routing.task ?? routing.agent ?? routing.provider ?? fallback;
  }
  if (turnKind === "correction") {
    return routing.strong ?? routing.provider ?? fallback;
  }
  return routing.cheap ?? routing.provider ?? fallback;
}
