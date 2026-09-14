import { JsonRpcStdioClient } from "../execution/jsonrpc-stdio.ts";
import { KeliError } from "../core/errors.ts";
import type { CapabilityResult } from "../capabilities/types.ts";
import type { DelegateHandoff } from "./delegate.ts";

/**
 * Codex App Server JSON-RPC client for the coding *delegate* only.
 * Must be invoked after CapabilityGate authorizes delegate.run.
 * See docs/evidence/CODEX_APP_SERVER.md.
 */
export function codexAppServerCommand(env: NodeJS.ProcessEnv = process.env): { command: string; args: string[] } {
  const bin = env.KELI_CODEX_APP_SERVER_BIN ?? env.CODEX_BIN ?? "codex";
  if (bin.includes(" ") || bin.endsWith(".ts")) {
    return { command: process.execPath, args: [bin] };
  }
  return { command: bin, args: env.KELI_CODEX_APP_SERVER_ARGS?.split("\x1e") ?? ["app-server"] };
}

export async function runCodexAppServerTurn(
  input: DelegateHandoff,
  signal?: AbortSignal,
  env: NodeJS.ProcessEnv = process.env,
): Promise<CapabilityResult> {
  const { command, args } = codexAppServerCommand(env);
  const client = JsonRpcStdioClient.spawn(command, args, { cwd: input.workspace, abort: signal });
  try {
    const init = await client.request("initialize", {
      clientInfo: { name: "keli", version: "0.1.0" },
      capabilities: {},
    });
    if (init.error) throw new KeliError(init.error.message, "engine_error");
    client.notify("initialized");
    const thread = await client.request("thread/start", { model: env.KELI_CODEX_MODEL });
    if (thread.error) throw new KeliError(thread.error.message, "engine_error");
    const threadId =
      (thread.result as { thread?: { id?: string }; threadId?: string } | undefined)?.thread?.id ??
      (thread.result as { threadId?: string } | undefined)?.threadId;
    if (!threadId) throw new KeliError("Codex app-server thread/start returned no thread id", "engine_error");
    const turn = await client.request("turn/start", {
      threadId,
      input: [{ type: "text", text: input.goal }],
    });
    if (turn.error) throw new KeliError(turn.error.message, "engine_error");
    let completed = turn.result as { turn?: { status?: string }; status?: string } | undefined;
    if (completed?.turn?.status !== "completed" && completed?.status !== "completed") {
      const note = await client.waitNotification("turn/completed", 60_000);
      completed = note.params as { turn?: { status?: string } };
    }
    const status = (completed as { turn?: { status?: string } } | undefined)?.turn?.status ?? "completed";
    if (status !== "completed") {
      return {
        capabilityId: "delegate.run",
        ok: false,
        error: { code: "engine_error", message: `Codex turn ${status}` },
        output: { sessionId: threadId, status: "failed", artifacts: [], usageBytes: 0 },
      };
    }
    return {
      capabilityId: "delegate.run",
      ok: true,
      output: {
        sessionId: threadId,
        status: "completed",
        artifacts: [],
        usageBytes: 0,
        unverified: true,
        note: "Codex claimed completion; Keli still requires artifact/test evidence (A24)",
      },
    };
  } catch (e) {
    const keli = e instanceof KeliError ? e : null;
    return {
      capabilityId: "delegate.run",
      ok: false,
      error: { code: keli?.code ?? "engine_error", message: keli?.message ?? String(e) },
    };
  } finally {
    await client.close();
  }
}
