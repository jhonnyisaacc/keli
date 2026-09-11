import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import type { Database } from "bun:sqlite";
import { createHash } from "node:crypto";
import { statePaths, resolveStateDir } from "./paths.ts";

export type ArtifactRecord = {
  id: string;
  action_id: string | null;
  owner_id: string;
  scope: string;
  type: string;
  hash: string;
  path: string;
  retention: string;
  created_at: string;
};

export async function ensureArtifactDir(stateDir?: string): Promise<string> {
  const dir = join(statePaths(resolveStateDir(stateDir)).root, "artifacts");
  await mkdir(dir, { recursive: true });
  return dir;
}

export async function storeArtifact(
  db: Database,
  stateDir: string,
  input: {
    actionId?: string;
    ownerId: string;
    scope: string;
    type: string;
    content: string | Uint8Array;
    retention?: string;
  },
): Promise<ArtifactRecord> {
  const bytes =
    typeof input.content === "string"
      ? new TextEncoder().encode(input.content)
      : input.content;
  const hash = createHash("sha256").update(bytes).digest("hex");
  const artifactDir = await ensureArtifactDir(stateDir);
  const rel = `${hash.slice(0, 2)}/${hash}`;
  const path = join(artifactDir, rel);
  await mkdir(join(artifactDir, hash.slice(0, 2)), { recursive: true });
  await Bun.write(path, bytes);

  const record: ArtifactRecord = {
    id: crypto.randomUUID(),
    action_id: input.actionId ?? null,
    owner_id: input.ownerId,
    scope: input.scope,
    type: input.type,
    hash,
    path: rel,
    retention: input.retention ?? "deliverable",
    created_at: new Date().toISOString(),
  };

  db.run(
    `INSERT INTO artifacts(id, action_id, owner_id, scope, type, hash, path, retention, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      record.id,
      record.action_id,
      record.owner_id,
      record.scope,
      record.type,
      record.hash,
      record.path,
      record.retention,
      record.created_at,
    ],
  );

  return record;
}

export function listArtifacts(db: Database, scope?: string): ArtifactRecord[] {
  if (scope) {
    return db
      .query("SELECT * FROM artifacts WHERE scope = ? ORDER BY created_at DESC")
      .all(scope) as ArtifactRecord[];
  }
  return db.query("SELECT * FROM artifacts ORDER BY created_at DESC").all() as ArtifactRecord[];
}
