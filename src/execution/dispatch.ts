import type { CapabilityRegistry } from "../capabilities/registry.ts";
import type { CapabilityProposal, CapabilityResult } from "../capabilities/types.ts";
import { validateCapabilityInput } from "../capabilities/validate.ts";
import { filesList, filesRead, filesWrite } from "../adapters/files.ts";
import { shellExec } from "../adapters/shell.ts";
import { httpFetch } from "../adapters/http.ts";
import { webFetch } from "../adapters/web.ts";
import { searchQuery } from "../adapters/search.ts";
import { browserNavigate, browserCapture } from "../adapters/browser.ts";
import { mcpCallTool, mcpListTools } from "../adapters/mcp.ts";
import { delegateRun } from "../adapters/delegate.ts";
import { jobsObserve } from "../adapters/jobs.ts";
import { browserSessionConnect } from "../adapters/browser-session.ts";
import { helpersSpawn } from "../adapters/helpers-spawn.ts";
import { sourcesCollections, sourcesRead, sourcesSearch } from "../adapters/sources.ts";
import { documentsExtract, ocrExtract } from "../adapters/documents.ts";
import { speechSynthesize, speechTranscribe } from "../adapters/speech.ts";
import { runStructuredTool } from "../tools/cli-adapter.ts";
import { profileFor } from "../tools/profiles.ts";
import { RESEARCH_CAPABILITIES } from "../conversation/context.ts";
import { KeliError } from "../core/errors.ts";
import { consumeToolCallBudget } from "../core/budgets.ts";
import { assertNotCancelled, consumeBudget } from "../core/run-control.ts";
import type { DispatchContext } from "./dispatch-context.ts";
import type { ResourcePolicy } from "./policy.ts";
import type { CodingDelegate } from "../core/types.ts";
import { fixtureUrlFor } from "../integrations/env.ts";

function descriptorNeedsToolBudget(capabilityId: string): boolean {
  return capabilityId === "mcp.tools/call" || capabilityId === "helpers.spawn";
}

function estimateResultBytes(result: CapabilityResult): number {
  if (!result.output) return 0;
  try {
    return Buffer.byteLength(JSON.stringify(result.output));
  } catch {
    return 0;
  }
}

function applyRunBudget(ctx: DispatchContext, result: CapabilityResult): CapabilityResult {
  if (!ctx.run) return result;
  const bytes = estimateResultBytes(result);
  if (bytes > 0) {
    try {
      consumeBudget(ctx.run.db, ctx.run.runId, bytes);
    } catch (e) {
      const keli = e instanceof KeliError ? e : null;
      return {
        capabilityId: result.capabilityId,
        ok: false,
        error: {
          code: keli?.code ?? "quota_exceeded",
          message: keli?.message ?? String(e),
        },
      };
    }
  }
  return result;
}

export async function dispatchCapability(
  registry: CapabilityRegistry,
  proposal: CapabilityProposal,
  ctx: DispatchContext,
): Promise<CapabilityResult> {
  if (ctx.run) {
    assertNotCancelled(ctx.run.db, ctx.run.runId, ctx.run.cancelEpoch);
    if (descriptorNeedsToolBudget(proposal.capabilityId)) {
      try {
        consumeToolCallBudget(ctx.run.db, ctx.run.runId);
      } catch (e) {
        const keli = e instanceof KeliError ? e : null;
        return {
          capabilityId: proposal.capabilityId,
          ok: false,
          error: {
            code: keli?.code ?? "quota_exceeded",
            message: keli?.message ?? String(e),
          },
        };
      }
    }
  }

  const descriptor = registry.get(proposal.capabilityId);
  if (!descriptor) {
    const suggestions = registry.discover(proposal.capabilityId).map((c) => c.id);
    return {
      capabilityId: proposal.capabilityId,
      ok: false,
      error: {
        code: "capability_denied",
        message: suggestions.length
          ? `Unknown capability: ${proposal.capabilityId}. Did you mean: ${suggestions.join(", ")}?`
          : `Unknown capability: ${proposal.capabilityId}. Run keli capabilities to discover.`,
      },
    };
  }

  try {
    validateCapabilityInput(descriptor, proposal.input);
  } catch (e) {
    const keli = e instanceof KeliError ? e : null;
    return {
      capabilityId: proposal.capabilityId,
      ok: false,
      error: {
        code: keli?.code ?? "invalid_request",
        message: keli?.message ?? String(e),
      },
    };
  }

  const policy = ctx.policy;
  const cwd = ctx.cwd;
  const fixtures = ctx.fixtures ?? {};

  let result: CapabilityResult;
  switch (proposal.capabilityId) {
    case "files.read":
      result = await filesRead(proposal.input as { path: string }, policy, cwd);
      break;
    case "files.list":
      result = await filesList(proposal.input as { path: string }, policy, cwd);
      break;
    case "files.write":
      result = await filesWrite(
        proposal.input as { path: string; content: string },
        policy,
        cwd,
      );
      break;
    case "shell.exec":
      result = await shellExec(proposal.input as { command: string; cwd?: string }, policy);
      break;
    case "http.fetch":
      result = await httpFetch(
        proposal.input as { url: string; method?: string },
        ctx.network,
      );
      break;
    case "web.fetch":
      result = await webFetch(proposal.input as { url: string }, ctx.network);
      break;
    case "search.query":
      result = await searchQuery(proposal.input as { query: string }, {
        fixtureUrl: fixtures.search,
        config: ctx.config,
      });
      break;
    case "browser.navigate":
      result = await browserNavigate(proposal.input as { url: string }, ctx.network, {
        ...ctx.browser,
        fixtureUrl: ctx.browser?.fixtureUrl ?? fixtures.browser,
      });
      break;
    case "browser.screenshot":
      result = await browserCapture(
        { url: String(proposal.input.url), kind: "screenshot" },
        ctx.network,
        { ...ctx.browser, fixtureUrl: ctx.browser?.fixtureUrl ?? fixtures.browser },
      );
      break;
    case "browser.download":
      result = await browserCapture(
        { url: String(proposal.input.url), kind: "download" },
        ctx.network,
        { ...ctx.browser, fixtureUrl: ctx.browser?.fixtureUrl ?? fixtures.browser },
      );
      break;
    case "browser.session":
      result = await browserSessionConnect(
        proposal.input as { url: string; credentialRef?: { id: string; service: string } },
        fixtures.browser ?? fixtureUrlFor("browser-session"),
      );
      break;
    case "helpers.spawn":
      result = await helpersSpawn(
        proposal.input as { capabilityId: string; input: Record<string, unknown> },
        ctx,
        registry,
      );
      break;
    case "sources.search":
      result = sourcesSearch(proposal.input as { query: string; collection?: string; limit?: number }, ctx.sources);
      break;
    case "sources.read":
      result = sourcesRead(proposal.input as { sourceId: string; offset?: number; chars?: number }, ctx.sources);
      break;
    case "sources.collections":
      result = sourcesCollections(ctx.sources);
      break;
    case "documents.extract":
      result = await documentsExtract(proposal.input as { path: string }, policy, {
        config: ctx.config,
        cwd,
      });
      break;
    case "ocr.extract":
      result = await ocrExtract(proposal.input as { path: string }, policy, {
        config: ctx.config,
        cwd,
      });
      break;
    case "speech.transcribe":
      result = await speechTranscribe(proposal.input as { path: string; model?: string }, policy, {
        config: ctx.config,
        cwd,
      });
      break;
    case "speech.synthesize":
      result = await speechSynthesize(proposal.input as { text: string; model?: string; voice?: string }, {
        config: ctx.config,
      });
      break;
    case "mcp.tools/list":
      result = await mcpListTools(fixtures.mcp, ctx.config);
      break;
    case "mcp.tools/call":
      result = await mcpCallTool(
        proposal.input as { name: string; arguments?: Record<string, unknown> },
        fixtures.mcp,
        ctx.config,
      );
      break;
    case "jobs.observe":
      result = await jobsObserve(
        proposal.input as {
          jobId: string;
          occurrenceId: string;
          jobName: string;
          missedSlots?: number;
          simulateChanged?: boolean;
        },
      );
      break;
    case "capabilities.lookup": {
      const query = String(proposal.input.query ?? proposal.input.id ?? "").toLowerCase();
      const allow = ctx.allowedCapabilities ?? [...RESEARCH_CAPABILITIES];
      const matches = allow
        .map((id) => registry.get(id))
        .filter((c): c is NonNullable<typeof c> => c != null)
        .filter((c) => !query || c.id.includes(query) || c.summary.toLowerCase().includes(query));
      result = {
        capabilityId: "capabilities.lookup",
        ok: true,
        output: {
          capabilities: matches.map((c) => ({
            id: c.id,
            version: c.version,
            summary: c.summary,
            actionClass: c.actionClass,
            schema: c.schema,
          })),
        },
      };
      break;
    }
    case "delegate.run":
      result = await delegateRun(
        {
          actionId: String(proposal.input.actionId),
          delegate: proposal.input.delegate as CodingDelegate,
          goal: String(proposal.input.goal),
          workspace: String(proposal.input.workspace),
          cancelEpoch: ctx.run?.cancelEpoch ?? 0,
        },
        fixtures.delegate,
      );
      break;
    default: {
      if (proposal.capabilityId.startsWith("tools.")) {
        const profile = profileFor(proposal.capabilityId, ctx.config);
        if (profile) {
          result = await runStructuredTool(profile, proposal.input, ctx);
          break;
        }
      }
      result = {
        capabilityId: proposal.capabilityId,
        ok: false,
        error: {
          code: "capability_unavailable",
          message: `Capability not wired: ${proposal.capabilityId}`,
        },
      };
    }
  }

  if (ctx.run) {
    try {
      assertNotCancelled(ctx.run.db, ctx.run.runId, ctx.run.cancelEpoch);
    } catch (e) {
      const keli = e instanceof KeliError ? e : null;
      return {
        capabilityId: proposal.capabilityId,
        ok: false,
        output: result.output,
        error: {
          code: keli?.code ?? "cancelled",
          message: keli?.message ?? String(e),
        },
      };
    }
  }

  return applyRunBudget(ctx, result);
}
