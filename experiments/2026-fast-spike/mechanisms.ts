/** Independent research adapters. Nothing imports these from src/. No canonical writes. */
import { Database } from "bun:sqlite";

export type Event = { seq: number; scope: string; session: string; tick: number; text: string };
export type SearchOptions = {
  scope: string; after?: number; before?: number; exclude?: string[];
  limit?: number; window?: number; fusion?: boolean;
};
export class History {
  private db: Database;
  constructor(path: string) {
    this.db = new Database(path);
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS events(seq INTEGER PRIMARY KEY AUTOINCREMENT, scope TEXT NOT NULL,
        session TEXT NOT NULL, tick INTEGER NOT NULL, text TEXT NOT NULL);
      CREATE VIRTUAL TABLE IF NOT EXISTS event_fts USING fts5(text, content='events', content_rowid='seq');
      CREATE TRIGGER IF NOT EXISTS event_insert AFTER INSERT ON events BEGIN
        INSERT INTO event_fts(rowid,text) VALUES(new.seq,new.text); END;
      CREATE TRIGGER IF NOT EXISTS no_replace BEFORE INSERT ON events WHEN EXISTS(SELECT 1 FROM events WHERE seq=new.seq) BEGIN SELECT RAISE(ABORT,'immutable'); END;
      CREATE TRIGGER IF NOT EXISTS no_update BEFORE UPDATE ON events BEGIN SELECT RAISE(ABORT,'immutable'); END;
      CREATE TRIGGER IF NOT EXISTS no_delete BEFORE DELETE ON events BEGIN SELECT RAISE(ABORT,'immutable'); END;
      CREATE TABLE IF NOT EXISTS working(scope TEXT, name TEXT, kind TEXT, value TEXT, source INTEGER,
        PRIMARY KEY(scope,name));`);
  }
  append(e: Omit<Event, "seq">): number {
    const row = this.db.query("INSERT INTO events(scope,session,tick,text) VALUES(?,?,?,?) RETURNING seq")
      .get(e.scope, e.session, e.tick, e.text) as { seq: number };
    return row.seq;
  }
  expand(seq: number, scope: string): Event | null {
    return this.db.query("SELECT * FROM events WHERE seq=? AND scope=?").get(seq, scope) as Event | null;
  }
  bind(scope: string, name: string, value: string | number | boolean, source: number) {
    if (!this.expand(source, scope)) throw new Error("source scope mismatch");
    this.db.run("INSERT OR REPLACE INTO working VALUES(?,?,?,?,?)", [scope,name,typeof value,JSON.stringify(value),source]);
  }
  project(scope: string, budget: number): string {
    const rows = this.db.query("SELECT name,kind,value,source FROM working WHERE scope=? ORDER BY name").all(scope);
    const encoded = JSON.stringify(rows);
    if (Buffer.byteLength(encoded) > budget) throw new Error("projection budget exceeded");
    return encoded;
  }
  search(query: string, o: SearchOptions): Event[] {
    const terms = query.match(/[\p{L}\p{N}_]+/gu) ?? [];
    if (!terms.length) return [];
    const match = terms.map(t => `"${t}"`).join(" OR ");
    const excluded = new Set(o.exclude ?? []);
    // Fixed snapshot FTS corpus statistics; time/scope filter before ranking results, not BM25 IDF recomputation.
    const rows = (this.db.query(`SELECT e.*, bm25(event_fts) AS score FROM event_fts
      JOIN events e ON e.seq=event_fts.rowid WHERE event_fts MATCH ? AND e.scope=?
      AND e.tick>=? AND e.tick<=? ORDER BY score,e.seq`).all(match,o.scope,o.after ?? 0,o.before ?? Number.MAX_SAFE_INTEGER) as (Event & {score:number})[]).filter(e=>!excluded.has(e.session));
    const sums = new Map<string,number>();
    for (const e of rows) sums.set(e.session,(sums.get(e.session)??0)-e.score);
    const sessionOrder = [...sums].sort((a,b)=>b[1]-a[1] || a[0].localeCompare(b[0])).map(([s])=>s);
    const ranks = new Map(rows.map((e,i)=>[e.seq,1/(61+i)+1/(61+sessionOrder.indexOf(e.session))]));
    if (o.fusion) rows.sort((a,b)=>ranks.get(b.seq)!-ranks.get(a.seq)! || a.seq-b.seq);
    const results = new Map<number,Event>();
    const w = Math.max(0, Math.min(20, o.window ?? 0));
    for (const hit of rows.slice(0,o.limit ?? 5)) {
      // Neighbors are positions within a session, not global row IDs: interleaved sessions stay isolated.
      const session = this.db.query("SELECT * FROM events WHERE scope=? AND session=? ORDER BY seq").all(o.scope,hit.session) as Event[];
      const pos = session.findIndex(e=>e.seq===hit.seq);
      for (const e of session.slice(Math.max(0,pos-w),pos+w+1)) {
        if (e.tick >= (o.after??0) && e.tick <= (o.before??Infinity)) results.set(e.seq,e);
      }
    }
    return [...results.values()];
  }
  mutationRejected(sql: string): boolean {
    try { this.db.exec(sql); return false; } catch { return true; }
  }
  close() { this.db.close(); }
}

export type Episode = { phase: string; revision: number; action: string; outcome: string; transient: boolean };
export class PhaseMemory {
  readonly episodes: Episode[] = [];
  record(e: Episode) { this.episodes.push({...e}); }
  retrieve(phase: string, revision: number) { return this.episodes.filter(e=>e.phase===phase && e.revision===revision); }
  shouldReplan(phase: string, revision: number, action: string): boolean {
    return this.retrieve(phase,revision).filter(e=>e.action===action && e.outcome!=="ok" && !e.transient).length >= 2;
  }
}

export type Transition = { scope: string; action: string; predicted: string; actual: string; confidence: number; transient: boolean };
export class TransitionCache {
  readonly observations: Transition[] = [];
  record(t: Transition) { this.observations.push({...t}); }
  predict(scope: string, action: string): string | null {
    const rows=this.observations.filter(t=>t.scope===scope && t.action===action && !t.transient && t.confidence>=0.8);
    if (rows.length<2) return null;
    const recent=rows.slice(-2);
    return recent[0]!.actual===recent[1]!.actual ? recent[0]!.actual : null;
  }
}
export type Skill = { id: string; needs: string[]; bytes: number; valid: boolean };
export function composeSkills(ids: string[], library: Skill[], budget: number): string[] {
  const visiting=new Set<string>(), done=new Set<string>(), order:string[]=[];
  let bytes=0;
  function visit(id:string) {
    if(done.has(id)) return;
    const s=library.find(x=>x.id===id);
    if(!s?.valid) throw new Error("missing or outdated skill");
    if(visiting.has(id)) throw new Error("cycle");
    visiting.add(id);
    for(const dep of s.needs) visit(dep);
    visiting.delete(id);done.add(id);order.push(id);bytes+=s.bytes;
    if(bytes>budget) throw new Error("skill budget exceeded");
  }
  for(const id of ids) visit(id);
  return order;
}
export type Uncertainty = {
  task: "known"|"missing"|"ambiguous"; world: "known"|"unknown";
  hypothesis: "supported"|"conflicting"; evidence: "known"|"missing";
  tool: "complete"|"partial"; plan: "progress"|"stuck"; completion: "verified"|"unverified";
};
export function nextStep(u: Uncertainty): string {
  if(u.task!=="known") return "clarify";
  if(u.world==="unknown") return "inspect";
  if(u.evidence==="missing") return "retrieve";
  if(u.tool==="partial") return "reconcile";
  if(u.hypothesis==="conflicting") return "discriminating_test";
  if(u.plan==="stuck") return "replan";
  if(u.completion==="unverified") return "verify";
  return "finish";
}
export type HookState = { scope: string; verified: boolean; repeated: boolean; revision: number };
export function procedure(s: HookState, proposal: string, enabled: boolean): string {
  if (!enabled) return proposal;
  if(proposal==="finish" && !s.verified) return "verify";
  if(proposal==="retry" && s.repeated) return "replan";
  return proposal;
}
