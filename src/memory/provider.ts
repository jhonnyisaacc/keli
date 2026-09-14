import type { Database } from "bun:sqlite";
import type { SourceReader } from "../sources/reader.ts";
import { addNote, getNote, searchNotes } from "./notes.ts";
import { listConversations } from "./conversations.ts";
import { setNoteRetention } from "./retention.ts";
import {
  honchoQuery,
  honchoStore,
  isHonchoAvailable,
  type HonchoAdapterConfig,
} from "../adapters/honcho.ts";

/**
 * Advisory memory only. These records never authorize rules, permissions, or occurrence status.
 * SQLite notes, source collections, and conversation rows remain the v0.1 authority.
 */
export type MemoryKind = "note" | "conversation" | "source" | "honcho";

export type MemoryEvidence = {
  id: string;
  kind: MemoryKind;
  scope: string;
  title?: string;
  text: string;
  sourceRef?: string;
  createdAt?: string;
  /** Always true: memory suggests context and cannot become canonical behavior. */
  advisory: true;
};

export type MemoryImportRecord = {
  title: string;
  body: string;
  sourceRef?: string;
};

export type MemoryProvider = {
  import(input: { scope: string; records: MemoryImportRecord[] }): Promise<MemoryEvidence[]>;
  search(input: { scope: string; query: string; limit?: number }): Promise<MemoryEvidence[]>;
  read(input: { id: string; scope?: string }): Promise<MemoryEvidence | null>;
  retain(input: { id: string; retainedUntil: string }): Promise<MemoryEvidence | null>;
};

export type MemoryProviderOptions = {
  sources?: SourceReader;
  honcho?: HonchoAdapterConfig;
};

export function createMemoryProvider(db: Database, options: MemoryProviderOptions = {}): MemoryProvider {
  return {
    async import(input) {
      const out: MemoryEvidence[] = [];
      for (const record of input.records) {
        const note = addNote(db, {
          id: crypto.randomUUID(),
          scope: input.scope,
          title: record.title,
          body: record.body,
          sourceRef: record.sourceRef,
        });
        out.push(noteEvidence(note));
      }
      return out;
    },

    async search(input) {
      const limit = Math.min(Math.max(input.limit ?? 12, 1), 40);
      const notes = searchNotes(db, input.scope, ftsQuery(input.query), limit).map(noteEvidence);
      const conversations = searchConversations(db, input.scope, input.query, Math.max(2, Math.floor(limit / 4)));
      const sources = options.sources
        ? options.sources.search({ query: input.query, limit: Math.max(2, Math.floor(limit / 4)) }).map((hit) => ({
            id: hit.sourceId,
            kind: "source" as const,
            scope: input.scope,
            title: hit.title,
            text: hit.snippet,
            sourceRef: hit.path,
            advisory: true as const,
          }))
        : [];
      const honcho = await searchHoncho(input.scope, input.query, options.honcho);
      return [...notes, ...conversations, ...sources, ...honcho].slice(0, limit);
    },

    async read(input) {
      const note = getNote(db, input.id);
      if (note && (!input.scope || note.scope === input.scope)) return noteEvidence(note);
      const conversation = listConversations(db, 200).find((c) => c.id === input.id);
      if (conversation && (!input.scope || conversation.scope === input.scope)) {
        return {
          id: conversation.id,
          kind: "conversation",
          scope: conversation.scope,
          title: conversation.summary ?? conversation.externalId,
          text: conversation.summary ?? "",
          sourceRef: conversation.externalId,
          createdAt: conversation.createdAt,
          advisory: true,
        };
      }
      if (options.sources) {
        const passage = options.sources.read({ sourceId: input.id, chars: 2000 });
        if (passage) {
          return {
            id: passage.sourceId,
            kind: "source",
            scope: input.scope ?? passage.collection,
            title: passage.title,
            text: passage.text,
            sourceRef: passage.path,
            advisory: true,
          };
        }
      }
      return null;
    },

    async retain(input) {
      const note = getNote(db, input.id);
      if (!note) return null;
      setNoteRetention(db, input.id, input.retainedUntil);
      return noteEvidence(note);
    },
  };
}

function noteEvidence(note: {
  id: string;
  scope: string;
  title: string;
  body: string;
  sourceRef?: string;
  createdAt: string;
}): MemoryEvidence {
  return {
    id: note.id,
    kind: "note",
    scope: note.scope,
    title: note.title,
    text: note.body,
    sourceRef: note.sourceRef,
    createdAt: note.createdAt,
    advisory: true,
  };
}

function ftsQuery(query: string): string {
  const terms = query
    .split(/[^\p{L}\p{N}]+/u)
    .filter((t) => t.length > 1)
    .slice(0, 8);
  if (!terms.length) return '""';
  return terms.map((t) => `"${t.replace(/"/g, "")}"`).join(" OR ");
}

function searchConversations(db: Database, scope: string, query: string, limit: number): MemoryEvidence[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [];
  return listConversations(db, 80)
    .filter((c) => c.scope === scope && (c.summary ?? "").toLowerCase().includes(needle))
    .slice(0, limit)
    .map((c) => ({
      id: c.id,
      kind: "conversation" as const,
      scope: c.scope,
      title: c.summary ?? c.externalId,
      text: c.summary ?? "",
      sourceRef: c.externalId,
      createdAt: c.createdAt,
      advisory: true as const,
    }));
}

async function searchHoncho(
  scope: string,
  query: string,
  config?: HonchoAdapterConfig,
): Promise<MemoryEvidence[]> {
  if (!config || !isHonchoAvailable(config)) return [];
  try {
    const result = await honchoQuery({ scope, query }, config);
    if (!result.ok) return [];
    return (result.records ?? []).map((record) => ({
      id: `honcho:${record.key}`,
      kind: "honcho" as const,
      scope,
      title: record.key,
      text: record.content,
      advisory: true as const,
    }));
  } catch {
    return [];
  }
}

/** Honcho may store fixture records as advisory context. It never writes notes or rules. */
export async function importHonchoAdvisory(
  input: { scope: string; key: string; content: string },
  config?: HonchoAdapterConfig,
): Promise<{ ok: boolean; error?: { code: string; message: string } }> {
  if (!config || !isHonchoAvailable(config)) {
    return {
      ok: false,
      error: {
        code: "missing_access",
        message: "Honcho is fixture-only until a stable HTTP contract is verified. Local notes remain the memory authority.",
      },
    };
  }
  return honchoStore(input, config);
}
