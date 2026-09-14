import { rocketDescriptor } from "../tools/profiles.ts";
import type { CapabilityDescriptor } from "./types.ts";

const BUILTIN: CapabilityDescriptor[] = [
  {
    id: "files.read",
    version: "0.1.0",
    summary: "Read a file within project resource roots",
    actionClass: "read",
    resources: ["path"],
    schema: {
      type: "object",
      properties: { path: { type: "string" } },
      required: ["path"],
    },
  },
  {
    id: "files.write",
    version: "0.1.0",
    summary: "Write a file within allowed writable roots",
    actionClass: "mutate",
    resources: ["path"],
    schema: {
      type: "object",
      properties: { path: { type: "string" }, content: { type: "string" } },
      required: ["path", "content"],
    },
  },
  {
    id: "files.list",
    version: "0.1.0",
    summary: "List a directory within project resource roots",
    actionClass: "read",
    resources: ["path"],
    schema: {
      type: "object",
      properties: { path: { type: "string" } },
      required: ["path"],
    },
  },
  {
    id: "shell.exec",
    version: "0.1.0",
    summary: "Execute a command in a disposable workspace",
    actionClass: "mutate",
    resources: ["cwd", "command"],
    schema: {
      type: "object",
      properties: {
        command: { type: "string" },
        cwd: { type: "string" },
      },
      required: ["command"],
    },
  },
  {
    id: "http.fetch",
    version: "0.1.0",
    summary: "HTTP GET/HEAD against allowlisted hosts",
    actionClass: "read",
    resources: ["url"],
    schema: {
      type: "object",
      properties: { url: { type: "string" }, method: { type: "string" } },
      required: ["url"],
    },
  },
  {
    id: "web.fetch",
    version: "0.1.0",
    summary: "Fetch a web page and extract text",
    actionClass: "read",
    resources: ["url"],
    schema: {
      type: "object",
      properties: { url: { type: "string" } },
      required: ["url"],
    },
  },
  {
    id: "search.query",
    version: "0.1.0",
    summary: "Search via configured backend",
    actionClass: "read",
    resources: ["query"],
    schema: {
      type: "object",
      properties: { query: { type: "string" } },
      required: ["query"],
    },
  },
  {
    id: "sources.search",
    version: "0.1.0",
    summary: "Full-text search over indexed read-only source collections (notes, transcripts)",
    actionClass: "read",
    resources: ["query"],
    schema: {
      type: "object",
      properties: {
        query: { type: "string" },
        collection: { type: "string" },
        limit: { type: "number" },
      },
      required: ["query"],
    },
  },
  {
    id: "sources.read",
    version: "0.1.0",
    summary: "Read a bounded passage of one indexed source document by id",
    actionClass: "read",
    resources: ["sourceId"],
    schema: {
      type: "object",
      properties: {
        sourceId: { type: "string" },
        offset: { type: "number" },
        chars: { type: "number" },
      },
      required: ["sourceId"],
    },
  },
  {
    id: "sources.collections",
    version: "0.1.0",
    summary: "List indexed source collections with counts, authors, and latest timestamps",
    actionClass: "read",
    resources: [],
    schema: { type: "object", properties: {}, required: [] },
  },
  {
    id: "browser.navigate",
    version: "0.1.0",
    summary: "Navigate a JS browser session (pluggable backend); use web.fetch for static pages",
    actionClass: "read",
    resources: ["url"],
    schema: {
      type: "object",
      properties: { url: { type: "string" } },
      required: ["url"],
    },
  },
  {
    id: "browser.screenshot",
    version: "0.1.0",
    summary: "Capture a public-page screenshot artifact in an isolated browser session",
    actionClass: "read",
    resources: ["url"],
    schema: {
      type: "object",
      properties: { url: { type: "string" } },
      required: ["url"],
    },
  },
  {
    id: "browser.download",
    version: "0.1.0",
    summary: "Download a public URL as an artifact in an isolated browser session",
    actionClass: "read",
    resources: ["url"],
    schema: {
      type: "object",
      properties: { url: { type: "string" } },
      required: ["url"],
    },
  },
  {
    id: "mcp.tools/list",
    version: "0.1.0",
    summary: "List tools from a configured MCP server",
    actionClass: "read",
    resources: [],
    schema: { type: "object", properties: {}, required: [] },
  },
  {
    id: "mcp.tools/call",
    version: "0.1.0",
    summary: "Invoke an MCP tool by name",
    actionClass: "mutate",
    resources: ["name"],
    schema: {
      type: "object",
      properties: {
        name: { type: "string" },
        arguments: { type: "object" },
      },
      required: ["name"],
    },
  },
  {
    id: "jobs.observe",
    version: "0.1.0",
    summary: "Record a scheduled job observation without model calls",
    actionClass: "read",
    resources: ["jobId", "occurrenceId"],
    schema: {
      type: "object",
      properties: {
        jobId: { type: "string" },
        occurrenceId: { type: "string" },
        jobName: { type: "string" },
        missedSlots: { type: "number" },
        simulateChanged: { type: "boolean" },
      },
      required: ["jobId", "occurrenceId", "jobName"],
    },
  },
  {
    id: "browser.session",
    version: "0.1.0",
    summary: "Connect an authenticated browser session via credential reference",
    actionClass: "read",
    resources: ["url"],
    schema: {
      type: "object",
      properties: {
        url: { type: "string" },
        credentialRef: {
          type: "object",
          properties: { id: { type: "string" }, service: { type: "string" } },
        },
      },
      required: ["url"],
    },
  },
  {
    id: "helpers.spawn",
    version: "0.1.0",
    summary: "Spawn a bounded helper child run for one capability",
    actionClass: "read",
    resources: ["capabilityId"],
    schema: {
      type: "object",
      properties: {
        capabilityId: { type: "string" },
        input: { type: "object" },
      },
      required: ["capabilityId", "input"],
    },
  },
  {
    id: "delegate.run",
    version: "0.1.0",
    summary: "Run a coding delegate handoff (Codex/OpenCode)",
    actionClass: "effect",
    resources: ["delegate", "goal", "workspace"],
    schema: {
      type: "object",
      properties: {
        delegate: { type: "string" },
        goal: { type: "string" },
        workspace: { type: "string" },
        actionId: { type: "string" },
      },
      required: ["delegate", "goal", "workspace", "actionId"],
    },
  },
  rocketDescriptor(),
  {
    id: "capabilities.lookup",
    version: "0.1.0",
    summary: "Look up an approved capability schema by id or query without expanding authority",
    actionClass: "read",
    resources: ["query"],
    schema: {
      type: "object",
      properties: { query: { type: "string" }, id: { type: "string" } },
    },
  },
];

export class CapabilityRegistry {
  private readonly byId = new Map<string, CapabilityDescriptor>();

  constructor(seed: CapabilityDescriptor[] = BUILTIN) {
    for (const cap of seed) this.byId.set(cap.id, cap);
  }

  index(): { id: string; summary: string }[] {
    return [...this.byId.values()].map((c) => ({ id: c.id, summary: c.summary }));
  }

  get(id: string): CapabilityDescriptor | undefined {
    return this.byId.get(id);
  }

  schemaFor(id: string): Record<string, unknown> | undefined {
    return this.byId.get(id)?.schema;
  }

  register(descriptor: CapabilityDescriptor): void {
    this.byId.set(descriptor.id, descriptor);
  }

  discover(query: string): CapabilityDescriptor[] {
    const q = query.toLowerCase();
    return [...this.byId.values()].filter(
      (c) => c.id.includes(q) || c.summary.toLowerCase().includes(q),
    );
  }
}

export const defaultRegistry = new CapabilityRegistry();
