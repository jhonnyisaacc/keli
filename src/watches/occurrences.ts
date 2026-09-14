import type { Database } from "bun:sqlite";
import type { TurnOutcome } from "../conversation/types.ts";

export type ResearchOccurrence = {
  id: string; watch_id: string; version: number; fingerprint: string; observed_fingerprint: string; policy_key: string;
  status: "active" | "waiting_for_evidence" | "waiting_for_user" | "verified" | "failed" | "cancelled";
  contract_json: string; run_id: string; generation: number; dependency_key: string; input_text: string | null;
  input_ref: string | null; phase: string; result_json: string | null; token: string | null; pid: number | null;
};
export function listResearchOccurrences(db: Database, watchId: string): ResearchOccurrence[] {
  return db.query("SELECT * FROM watch_occurrences WHERE watch_id = ? ORDER BY rowid DESC").all(watchId) as ResearchOccurrence[];
}
export function getResearchOccurrence(db: Database, id: string): ResearchOccurrence | null {
  return db.query("SELECT * FROM watch_occurrences WHERE id = ?").get(id) as ResearchOccurrence | null;
}
export function occurrenceResult(o: ResearchOccurrence): TurnOutcome | undefined {
  return o.result_json ? JSON.parse(o.result_json) : undefined;
}
