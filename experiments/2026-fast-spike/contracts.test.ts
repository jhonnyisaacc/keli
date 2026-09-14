import { test, expect } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { History, PhaseMemory, TransitionCache, composeSkills, nextStep } from "./mechanisms.ts";

function history(fn:(h:History)=>void) {
  const temp=mkdtempSync(join(tmpdir(),"keli-research-contract-"));
  const previous=process.env.KELI_STATE_DIR;
  process.env.KELI_STATE_DIR=temp;
  const h=new History(join(temp,"events.sqlite"));
  try{fn(h);}finally{h.close();rmSync(temp,{recursive:true,force:true});
    if(previous===undefined)delete process.env.KELI_STATE_DIR;else process.env.KELI_STATE_DIR=previous;}
}
test("interleaved sessions and duplicate session names cannot leak scope",()=>history(h=>{
  h.append({scope:"a",session:"s",tick:10,text:"needle"});
  h.append({scope:"b",session:"s",tick:11,text:"private"});
  h.append({scope:"a",session:"other",tick:12,text:"unrelated"});
  h.append({scope:"a",session:"s",tick:13,text:"answer"});
  expect(h.search("needle",{scope:"a",window:2}).map(e=>e.text)).toEqual(["needle","answer"]);
}));
test("time boundary also applies to expanded neighbors",()=>history(h=>{
  h.append({scope:"a",session:"s",tick:9,text:"old"});
  h.append({scope:"a",session:"s",tick:10,text:"needle"});
  h.append({scope:"a",session:"s",tick:11,text:"new"});
  expect(h.search("needle",{scope:"a",after:10,before:10,window:2}).map(e=>e.text)).toEqual(["needle"]);
}));
test("untrusted FTS syntax is treated as text and cannot select other scope",()=>history(h=>{
  h.append({scope:"b",session:"s",tick:1,text:"needle"});
  expect(h.search('" OR *; DELETE FROM events; --',{scope:"a"})).toEqual([]);
  expect(h.expand(1,"b")?.text).toBe("needle");
}));
test("derived state cannot cite a foreign source or exceed budget",()=>history(h=>{
  const id=h.append({scope:"b",session:"s",tick:1,text:"needle"});
  expect(()=>h.bind("a","rule","poison",id)).toThrow("source scope mismatch");
  h.bind("b","payload","x".repeat(2000),id);
  expect(()=>h.project("b",1024)).toThrow("projection budget exceeded");
}));
test("bound source and raw history remain independent",()=>history(h=>{
  const id=h.append({scope:"a",session:"s",tick:1,text:"original"});
  h.bind("a","derived","first",id);h.bind("a","derived","second",id);
  expect(h.expand(id,"a")?.text).toBe("original");
  expect(h.mutationRejected("DELETE FROM events")).toBe(true);
  expect(h.mutationRejected("INSERT OR REPLACE INTO events VALUES(1,'a','s',1,'poison')")).toBe(true);
  expect(h.expand(id,"a")?.text).toBe("original");
}));
test("deterministic failures do not contaminate other action or revision",()=>{
  const m=new PhaseMemory();for(let i=0;i<2;i++)m.record({phase:"test",revision:1,action:"bad",outcome:"fail",transient:false});
  expect(m.shouldReplan("test",1,"bad")).toBe(true);
  expect(m.shouldReplan("test",2,"bad")).toBe(false);
  expect(m.shouldReplan("test",1,"good")).toBe(false);
});
test("low confidence and transient evidence never create a cached prediction",()=>{
  const c=new TransitionCache();for(let i=0;i<3;i++)c.record({scope:"a",action:"x",predicted:"ok",actual:"fail",confidence:.2,transient:false});
  expect(c.predict("a","x")).toBeNull();
});
test("missing dependencies fail atomically rather than returning partial composition",()=>{
  expect(()=>composeSkills(["run"],[{id:"run",needs:["absent"],bytes:1,valid:true}],10)).toThrow();
  expect(composeSkills([],[],0)).toEqual([]);
});
test("missing authority-relevant intent takes precedence over completion",()=>{
  expect(nextStep({task:"missing",world:"known",hypothesis:"supported",evidence:"known",tool:"complete",plan:"progress",completion:"verified"})).toBe("clarify");
});
