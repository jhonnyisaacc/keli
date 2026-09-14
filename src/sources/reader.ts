import type { Database } from "bun:sqlite";
import { createHash } from "node:crypto";

export type SourceHit = {
  sourceId: string;
  collection: string;
  title: string;
  author?: string;
  url?: string;
  path: string;
  publishedAt?: string;
  fetchedAt?: string;
  snippet: string;
};

export type SourcePassage = {
  hash?: string;
  sourceId: string;
  collection: string;
  title: string;
  author?: string;
  url?: string;
  path: string;
  publishedAt?: string;
  fetchedAt?: string;
  offset: number;
  length: number;
  totalLength: number;
  text: string;
};

export type CollectionSummary = {
  id: string;
  documents: number;
  authors: string[];
  latestPublishedAt?: string;
  latestFetchedAt?: string;
};

/**
 * Narrow read-only view over the source index. Adapters and domain modules receive this,
 * never the canonical database handle.
 */
export interface SourceReader {
  search(input: { query: string; collection?: string; limit?: number }): SourceHit[];
  read(input: { sourceId: string; offset?: number; chars?: number }): SourcePassage | null;
  collections(): CollectionSummary[];
  /**
   * Cheap content fingerprint of one collection (document ids + hashes). Watches compare this
   * before waking the model; unchanged collections cost zero model calls.
   */
  fingerprint(collection: string): { hash: string; documents: number; latestPublishedAt?: string };
}

const MAX_PASSAGE_CHARS = 6000;

/** FTS5 treats punctuation as syntax; quote each term so user text is always a safe query. */
export function toFtsQuery(query: string): string {
  const terms = query
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((t) => t.length > 1)
    .slice(0, 12);
  if (!terms.length) return '""';
  return terms.map((t) => `"${t.replace(/"/g, "")}"`).join(" OR ");
}

export function createSourceReader(db: Database): SourceReader {
  return {
    search({ query, collection, limit = 8 }) {
      const fts = toFtsQuery(query);
      const bounded = Math.min(Math.max(1, limit), 25);
      const rows = (collection
        ? db
            .query(
              `SELECT d.id, d.collection, d.title, d.author, d.url, d.path, d.published_at, d.fetched_at,
                      snippet(source_documents_fts, 3, '[', ']', '…', 24) AS snippet
               FROM source_documents_fts f JOIN source_documents d ON d.id = f.doc_id
               WHERE source_documents_fts MATCH ? AND d.collection = ?
               ORDER BY rank LIMIT ?`,
            )
            .all(fts, collection, bounded)
        : db
            .query(
              `SELECT d.id, d.collection, d.title, d.author, d.url, d.path, d.published_at, d.fetched_at,
                      snippet(source_documents_fts, 3, '[', ']', '…', 24) AS snippet
               FROM source_documents_fts f JOIN source_documents d ON d.id = f.doc_id
               WHERE source_documents_fts MATCH ?
               ORDER BY rank LIMIT ?`,
            )
            .all(fts, bounded)) as Array<Record<string, string | null>>;
      return rows.map((r) => ({
        sourceId: r.id!,
        collection: r.collection!,
        title: r.title ?? r.path!,
        author: r.author ?? undefined,
        url: r.url ?? undefined,
        path: r.path!,
        publishedAt: r.published_at ?? undefined,
        fetchedAt: r.fetched_at ?? undefined,
        snippet: (r.snippet ?? "").slice(0, 400),
      }));
    },
    read({ sourceId, offset = 0, chars = 2000 }) {
      const row = db.query("SELECT * FROM source_documents WHERE id = ?").get(sourceId) as Record<string, string | null> | null;
      if (!row) return null;
      const body = row.body ?? "";
      const start = Math.max(0, Math.min(offset, body.length));
      const length = Math.min(Math.max(1, chars), MAX_PASSAGE_CHARS);
      return {
        sourceId,
        hash: row.hash!,
        collection: row.collection!,
        title: row.title ?? row.path!,
        author: row.author ?? undefined,
        url: row.url ?? undefined,
        path: row.path!,
        publishedAt: row.published_at ?? undefined,
        fetchedAt: row.fetched_at ?? undefined,
        offset: start,
        length,
        totalLength: body.length,
        text: body.slice(start, start + length),
      };
    },
    collections() {
      const rows = db
        .query(
          `SELECT collection, COUNT(*) AS n, MAX(published_at) AS latest_pub, MAX(fetched_at) AS latest_fetch
           FROM source_documents GROUP BY collection ORDER BY collection`,
        )
        .all() as Array<{ collection: string; n: number; latest_pub: string | null; latest_fetch: string | null }>;
      return rows.map((r) => {
        const authors = (
          db
            .query("SELECT DISTINCT author FROM source_documents WHERE collection = ? AND author IS NOT NULL LIMIT 5")
            .all(r.collection) as Array<{ author: string }>
        ).map((a) => a.author);
        return {
          id: r.collection,
          documents: r.n,
          authors,
          latestPublishedAt: r.latest_pub ?? undefined,
          latestFetchedAt: r.latest_fetch ?? undefined,
        };
      });
    },
    fingerprint(collection) {
      const rows = db
        .query("SELECT id, hash, published_at FROM source_documents WHERE collection = ? ORDER BY id")
        .all(collection) as Array<{ id: string; hash: string; published_at: string | null }>;
      const hasher = createHash("sha256");
      let latest: string | undefined;
      for (const row of rows) {
        hasher.update(row.id).update("\0").update(row.hash).update("\n");
        if (row.published_at && (!latest || row.published_at > latest)) latest = row.published_at;
      }
      return { hash: hasher.digest("hex"), documents: rows.length, latestPublishedAt: latest };
    },
  };
}
