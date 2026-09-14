"""Execute exact pinned reference units with explicit fixture boundaries, stdlib only.

No source rewrites, production imports, personal state or network calls. AST selection
omits unrelated module import/registration side effects; method bodies are unchanged.
This proves unit/API behavior, not end-to-end agent inability.
"""
from __future__ import annotations
import ast
import asyncio
import dataclasses
import hashlib
import inspect
import json
import os
import pathlib
import subprocess
import sys
import types
import typing
from copy import deepcopy

ROOT = pathlib.Path(__file__).resolve().parents[3]
EVIDENCE = ROOT / 'docs/evidence/2026-fast-spike/reference-probes'
PINS = {
 'hermes': '93e2525a0b60c4e3f581ddf0bdf5ffe1bd977544',
 'nanobot': 'f49965445152361b779b465e8a5111549ac934c4',
}
ENV_ROOTS = {
 'hermes': 'KELI_HERMES_ROOT',
 'nanobot': 'KELI_NANOBOT_ROOT',
}
def repo_root(project: str) -> str:
 env = ENV_ROOTS[project]
 value = os.environ.get(env)
 if not value:
  raise SystemExit(f'{env} must point at the pinned {project} checkout')
 return value
REPOS = {name: (f'${ENV_ROOTS[name]}', pin) for name, pin in PINS.items()}
TRACE: list[dict] = []
UNITS: list[dict] = []

def git(*args):
 return subprocess.check_output(['git', '-C', str(ROOT), *args], text=True).strip()

CHECK_ONLY = '--check' in sys.argv
if EVIDENCE.exists() and not CHECK_ONLY:
 raise SystemExit('evidence exists; preserve it, use --check for a read-only replay')
if CHECK_ONLY and not EVIDENCE.exists():
 raise SystemExit('no saved evidence to check')
if CHECK_ONLY and not (os.environ.get('KELI_HERMES_ROOT') and os.environ.get('KELI_NANOBOT_ROOT')):
 previous = json.loads((EVIDENCE/'summary.json').read_text())
 cases = previous.get('cases')
 passed = previous.get('passed')
 if not (EVIDENCE/'trace.jsonl').exists() or cases != passed:
  raise SystemExit('saved probe evidence is incomplete')
 print(json.dumps({'cases':cases,'passed':passed,'mode':'saved-evidence-only'}, indent=2))
 raise SystemExit(0)

def load(project, path, selected, constants=(), injected=None):
 repo, pin = repo_root(project), PINS[project]
 raw = subprocess.check_output(['git', '-C', repo, 'show', f'{pin}:{path}'])
 source = raw.decode(); tree = ast.parse(source)
 chosen = []
 for node in tree.body:
  if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)) and node.name in selected:
   chosen.append(node)
  elif isinstance(node, (ast.Assign, ast.AnnAssign)):
   targets = node.targets if isinstance(node, ast.Assign) else [node.target]
   if any(isinstance(t, ast.Name) and t.id in constants for t in targets):
    chosen.append(node)
 module_name = f'probe_{len(UNITS)}'
 module = types.ModuleType(module_name);sys.modules[module_name] = module
 ns = module.__dict__
 ns.update(vars(typing));ns.update(json=json, dataclass=dataclasses.dataclass,field=dataclasses.field,deepcopy=deepcopy)
 ns.update(injected or {})
 for node in chosen:
  UNITS.append({'project': project, 'pin': pin, 'path': path,
   'symbol': getattr(node, 'name', 'constants'), 'line': node.lineno,
   'source_sha256': hashlib.sha256(raw).hexdigest(),
   'ast_sha256': hashlib.sha256(ast.dump(node, include_attributes=False).encode()).hexdigest()})
 code = ast.Module(body=[ast.ImportFrom(module='__future__', names=[ast.alias(name='annotations')],level=0),*chosen],type_ignores=[])
 exec(compile(ast.fix_missing_locations(code),f'{project}@{pin}:{path}','exec'),ns)
 return ns

def method(project,path,cls,name, injected=None):
 repo,pin=repo_root(project),PINS[project];raw=subprocess.check_output(['git','-C',repo,'show',f'{pin}:{path}']);tree=ast.parse(raw)
 klass=next(n for n in tree.body if isinstance(n,ast.ClassDef) and n.name==cls)
 node=next(n for n in klass.body if isinstance(n,(ast.FunctionDef,ast.AsyncFunctionDef)) and n.name==name)
 UNITS.append({'project':project,'pin':pin,'path':path,'symbol':f'{cls}.{name}','line':node.lineno,
  'source_sha256':hashlib.sha256(raw).hexdigest(),'ast_sha256':hashlib.sha256(ast.dump(node,include_attributes=False).encode()).hexdigest()})
 ns={**vars(typing),**(injected or {})}
 exec(compile(ast.fix_missing_locations(ast.Module(body=[ast.ImportFrom(module='__future__',names=[ast.alias(name='annotations')],level=0),node],type_ignores=[])),f'{project}@{pin}:{path}','exec'),ns)
 return ns[name]

def record(id, finding, inputs, actual, expected, boundary):
 TRACE.append({'seq':len(TRACE)+1,'id':id,'finding':finding,'input':inputs,'actual':actual,'expected':expected,
  'contract_pass':actual==expected,'fixture_boundary':boundary})

# R1: Hermes API controls. Unsupported kwargs fail before any DB access.
h = load('hermes','tools/session_search_tool.py',{'session_search'})
sig = inspect.signature(h['session_search'])
for kw,value in [('after','2026-08-01'),('before','2026-09-01'),('exclude_session_ids',['seen'])]:
 try: h['session_search'](query='release',db=object(),**{kw:value});rejected=False
 except TypeError as exc: rejected='unexpected keyword argument' in str(exc)
 record('R1-'+kw,'missing explicit search control',{'keyword':kw,'value':value},rejected,True,'Exact public function; argument binding only, no database call.')
record('R1-positive','existing query/sort/anchor controls',{},all(k in sig.parameters for k in ['query','sort','session_id','around_message_id','window']),True,'Signature; not measured retrieval quality.')

# R2: Nanobot retrieval against known fixture history, exercising actual search/read/filter bodies.
rows=[{'key':f'noise-{i}','title':'release','updated_at':'2026-08-01'} for i in range(5)]
rows.append({'key':'answer','title':'Build incident','updated_at':'2026-08-02'})
messages={r['key']:[] for r in rows}
messages['answer']=[{'message_index':0,'role':'user','timestamp':1,'content':'release marker NEW-222'}]
access=load('nanobot','nanobot/webui/session_access.py',{'WebuiSessionAccess','_text','_row_title','_session_metadata','_visible_messages','_message_text'},
 constants={'_VISIBLE_ROLES'}, injected={'list_webui_sessions':lambda _:rows,'public_history_message':lambda m:dict(m),'is_hidden_history_message':lambda m:False})
a=object.__new__(access['WebuiSessionAccess']);a._sessions=object()
a._messages=lambda key:messages[key]
a._metadata=lambda key,exclude_session_key=None:None if key==exclude_session_key else {'metadata':{'title':key},'updated_at':'fixture'}
result=a.search('release',5)
record('R2-starvation','title matches consume all slots before body search',{'rows':rows,'messages':messages},[r['session_key'] for r in result],[f'noise-{i}' for i in range(5)],'Listing and visible-message storage are fixtures; exact search ranking/loop executes.')
result=a.search('release',6)
record('R2-positive','body evidence is searchable with a free result slot',{'limit':6},any(r['session_key']=='answer' for r in result),True,'Same corpus and method, only budget changed.')
record('R2-direct','direct read can recover starved evidence',{'key':'answer'},a.read('answer',query='release',limit=8)['messages'],messages['answer'],'Metadata and visible-message storage fixtures; exact read method.')
raw=[{'role':'user','content':'Investigate build'}, {'role':'tool','content':'exact exit=7 receipt=R-219'}, {'role':'assistant','content':'The check failed'}]
filtered=access['_visible_messages'](raw)
record('R2-tool','visible history excludes raw tool receipts',raw,[m['role'] for m in filtered],['user','assistant'],'Exact visibility function; identity public-history conversion and no hidden flags. Role filter is upstream.')
messages['answer']=[{'message_index':i,'role':'user','timestamp':i,'content':'release evidence '+str(i)} for i in range(12)]
record('R2-read-limit','filtered read returns latest matches, without earlier-page cursor',{'matching_messages':12,'limit':8},[m['message_index'] for m in a.read('answer',query='release',limit=8)['messages']],list(range(4,12)),'Exact read method; already-visible messages supplied.')

# R3: Hermes task-state substrate has useful persistence projection but no evidence-gated status.
todo=load('hermes','tools/todo_tool.py',{'TodoStore'},constants={'VALID_STATUSES','MAX_TODO_CONTENT_CHARS','MAX_TODO_ITEMS','_TRUNCATION_MARKER','TODO_INJECTION_HEADER','_STATUS_MARKERS','_ACTIVE_STATUSES'})
t=todo['TodoStore']();t.write([{'id':'fix','content':'Repair failing build','status':'in_progress'}])
record('R3-positive','active task survives context projection',{},'Repair failing build' in t.format_for_injection(),True,'Whole exact TodoStore class; no mocked internal method.')
t.write([{'id':'fix','status':'completed'}],merge=True)
record('R3-completed','advisory completed status needs no receipt',{'update':{'id':'fix','status':'completed'},'receipts':[]},t.snapshot()['todos'][0]['status'],'completed','Whole exact TodoStore; advisory list, not proof of agent-wide false completion.')
record('R3-projection','completed-only item leaves active context projection',{},t.format_for_injection(),None,'Whole exact TodoStore; row remains in store.')

# R4: Nanobot already has sustained goals and continuation; goal completion itself has no receipt check.
g=load('nanobot','nanobot/session/goal_state.py',{'_session_goal_raw','goal_state_raw','parse_goal_state','sustained_goal_active','explicit_goal_requested','sustained_goal_turn','goal_state_runtime_lines'},
 constants={'GOAL_STATE_KEY','GOAL_COMMAND','MAX_GOAL_OBJECTIVE_CHARS','_LEGACY_GOAL_STATE_SESSION_KEY'})
c=load('nanobot','nanobot/session/turn_continuation.py',{'_goal_continuation_available','_continuation_available'},constants={'_MAX_GOAL_CONTINUATION_ROUNDS','_GOAL_CONTINUATION_ROUNDS_KEY'},injected=g)
active={'goal_state':{'status':'active','objective':'Repair build and verify'}}
record('R4-goal','existing canonical goal context projection',active,g['goal_state_runtime_lines'](active),['Goal (active):','Repair build and verify'],'Exact goal helpers; fixture metadata.')
record('R4-continue','existing internal budget-boundary continuation',active,c['_continuation_available'](stop_reason='max_iterations',pending_queue_available=True,session_metadata=active),True,'Exact predicate; queue delivery not executed.')
record('R4-bound','existing continuation round cap',{},c['_goal_continuation_available']({**active,'_sustained_goal_continuation_rounds':12}),False,'Exact predicate; not evidence of missing overall budget handling.')
for evidence in ['progress','same failure repeated']:
 record('R4-progress-'+evidence,'this continuation predicate does not inspect progress evidence',{'trajectory':evidence},c['_goal_continuation_available']({**active,'episodes':[evidence]*3}),True,'Exact local predicate; other runtime progress paths not ruled out.')
session=types.SimpleNamespace(metadata=deepcopy(active));saved=[]
async def publish(metadata):pass
class ToolResult:
 @staticmethod
 def error(s):return s
update=method('nanobot','nanobot/agent/tools/long_task.py','UpdateGoalTool','execute',{
 **g,'ToolResult':ToolResult,'_GOAL_ACTIONS':('complete','cancel','block','replace'),
 '_iso_now':lambda:'2026-09-14T00:00:00','revoke_goal_mutation_permission':lambda:None})
obj=types.SimpleNamespace(_session=lambda:session,_goal_mutation_allowed=lambda:False,
 _save_goal_state=lambda sess,blob,**kw:(saved.append(deepcopy(blob)),sess.metadata.update(goal_state=blob)),_publish_goal_state_changed=publish)
response=asyncio.run(update(obj,action='complete',recap='Done'))
record('R4-completed','goal update proposes saved completed state without verification evidence',{'action':'complete','recap':'Done','receipts':[]},saved[-1]['status'],'completed','Exact execute body; save/publish/session boundaries are fixtures, not real persistence/transport. Complete path does not consult a verifier.')
record('R4-stops','completed goal no longer qualifies for continuation',{'response':response},c['_goal_continuation_available'](session.metadata),False,'Exact goal/continuation predicates after fixture applies saved state.')

# Positive counterevidence: Hermes does have an independent verifier result representation.
v=load('hermes','agent/verify/runner.py',{'PhaseResult','ReadinessResult','VerifyResult'})
for code in [0,1]:
 phase=v['PhaseResult']('test','fixture command',code,0.1,'fixture output')
 record('R5-verifier-'+str(code),'existing verifier respects execution failure',{'exit_code':code},v['VerifyResult']('fixture',[phase]).ok,code==0,'Exact dataclass result logic; no command executed and no claim about automatic invocation.')

encoded_trace = ''.join(json.dumps(row,sort_keys=True)+'\n' for row in TRACE)
summary={'kind':'pinned_reference_unit_probes','head':git('rev-parse','HEAD'),'repos':REPOS,'units':UNITS,'cases':len(TRACE),'passed':sum(r['contract_pass'] for r in TRACE),
 'interpretation':'Contract pass confirms an observed behavior, including gaps. Not end-to-end agent failure rate.',
 'method':'Exact AST-selected definitions loaded from git show at immutable pins. External listing/storage/session-save boundaries are fixtures. No model, imported agent runtime, network, production state or copied upstream source files.'}
if CHECK_ONLY:
 assert (EVIDENCE/'trace.jsonl').read_text() == encoded_trace, 'trace changed'
 previous = json.loads((EVIDENCE/'summary.json').read_text())
 assert previous['units'] == summary['units'], 'pinned source units changed'
else:
 EVIDENCE.mkdir(parents=True)
 (EVIDENCE/'trace.jsonl').write_text(encoded_trace)
 (EVIDENCE/'summary.json').write_text(json.dumps(summary,indent=2)+'\n')
print(json.dumps({'cases':summary['cases'],'passed':summary['passed'],'out':str(EVIDENCE)},indent=2))
if summary['passed']!=summary['cases']:raise SystemExit(1)
