import type { Database } from "bun:sqlite";
import { createHash } from "node:crypto";
import { readdir, readFile, stat } from "node:fs/promises";
import { join, relative, resolve } from "node:path";
import { parseFrontmatter, scalar } from "./frontmatter.ts";

export type SourceCollectionConfig = {
  id: string;
  path: string;
  kind?: "notes" | "transcripts";
  author?: string;
};

export type IndexResult = {
  collection: string;
  scanned: number;
  indexed: number;
  unchanged: number;
  removed: number;
};

export type SourceDocumentRow = {
  id: string;
  collection: string;
  path: string;
  title: string | null;
  author: string | null;
  url: string | null;
  published_at: string | null;
  fetched_at: string | null;
  indexed_at: string;
  hash: string;
  meta_json: string | null;
  body: string;
};

const TEXT_EXTENSIONS = new Set([".md", ".markdown", ".txt"]);

async function walk(root: string, out: string[] = []): Promise<string[]> {
  const entries = await readdir(root, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;
    const full = join(root, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === "templates") continue;
      await walk(full, out);
    } else if (TEXT_EXTENSIONS.has(entry.name.slice(entry.name.lastIndexOf(".")).toLowerCase())) {
      out.push(full);
    }
  }
  return out;
}

export function sourceId(collection: string, relPath: string): string {
  return `${collection}:${relPath.replace(/\\/g, "/")}`;
}

/**
 * Index one read-only collection of markdown/plain-text documents. Frontmatter supplies title,
 * author/channel, url/source, and timestamps; the body is stored verbatim for `sources.read`.
 * Documents whose hash is unchanged are skipped, so re-indexing is cheap and idempotent.
 */
export async function indexCollection(db: Database, collection: SourceCollectionConfig): Promise<IndexResult> {
  const root = resolve(collection.path);
  const info = await stat(root).catch(() => null);
  if (!info?.isDirectory()) {
    throw new Error(`Source collection '${collection.id}' path is not a directory: ${root}`);
  }
  const files = await walk(root);
  const existing = new Map<string, string>(
    (db.query("SELECT path, hash FROM source_documents WHERE collection = ?").all(collection.id) as Array<{ path: string; hash: string }>).map(
      (r) => [r.path, r.hash],
    ),
  );
  let indexed = 0;
  let unchanged = 0;
  const seen = new Set<string>();

  const upsert = db.transaction((rows: Array<Omit<SourceDocumentRow, "indexed_at">>) => {
    const now = new Date().toISOString();
    for (const row of rows) {
      db.run("DELETE FROM source_documents_fts WHERE doc_id = ?", [row.id]);
      db.run(
        `INSERT OR REPLACE INTO source_documents(id, collection, path, title, author, url, published_at, fetched_at, indexed_at, hash, meta_json, body)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [row.id, row.collection, row.path, row.title, row.author, row.url, row.published_at, row.fetched_at, now, row.hash, row.meta_json, row.body],
      );
      db.run("INSERT INTO source_documents_fts(doc_id, collection, title, body) VALUES (?, ?, ?, ?)", [
        row.id,
        row.collection,
        row.title ?? "",
        row.body,
      ]);
    }
  });

  const pending: Array<Omit<SourceDocumentRow, "indexed_at">> = [];
  for (const file of files) {
    const rel = relative(root, file).replace(/\\/g, "/");
    seen.add(rel);
    const text = await readFile(file, "utf8");
    const hash = createHash("sha256").update(text).digest("hex");
    if (existing.get(rel) === hash) {
      unchanged += 1;
      continue;
    }
    const { meta, body } = parseFrontmatter(text);
    const title = scalar(meta, "title") ?? firstHeading(body) ?? rel;
    const author = scalar(meta, "author") ?? scalar(meta, "channel") ?? scalar(meta, "author_or_channel") ?? collection.author ?? null;
    const url = scalar(meta, "url") ?? scalar(meta, "source") ?? firstListItem(meta.sources) ?? null;
    const published = scalar(meta, "published_at") ?? scalar(meta, "date") ?? scalar(meta, "published") ?? null;
    const fetched = scalar(meta, "fetched_at") ?? null;
    pending.push({
      id: sourceId(collection.id, rel),
      collection: collection.id,
      path: rel,
      title,
      author,
      url,
      published_at: published,
      fetched_at: fetched,
      hash,
      meta_json: JSON.stringify({ ...meta, kind: collection.kind ?? "notes" }),
      body,
    });
    indexed += 1;
  }
  if (pending.length) upsert(pending);

  let removed = 0;
  for (const path of existing.keys()) {
    if (!seen.has(path)) {
      const id = sourceId(collection.id, path);
      db.run("DELETE FROM source_documents_fts WHERE doc_id = ?", [id]);
      db.run("DELETE FROM source_documents WHERE id = ?", [id]);
      removed += 1;
    }
  }

  return { collection: collection.id, scanned: files.length, indexed, unchanged, removed };
}

function firstHeading(body: string): string | undefined {
  const match = /^#\s+(.+)$/m.exec(body);
  return match?.[1]?.trim();
}

function firstListItem(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return undefined;
}
