"""Read pinned committed sources; write only a new evidence file in this research worktree."""
import ast
import hashlib
import json
import os
import pathlib
import re
import subprocess

ROOT = pathlib.Path(__file__).resolve().parents[2]
RECON = ROOT / 'docs/evidence/2026-fast-spike/recon.json'
FILES = {
 'hermes': ['run_agent.py','agent/conversation_loop.py','agent/prompt_builder.py','agent/context_compressor.py',
 'agent/memory_manager.py','hermes_state.py','hermes_state_search.py','hermes_state_messages.py',
 'tools/session_search_tool.py','tools/todo_tool.py','tools/skills_tool.py','tools/skill_manager_tool.py',
 'tools/delegate_tool.py','tools/approval.py','agent/turn_recovery.py','agent/verify/runner.py',
 'agent/trace_upload.py','cron/scheduler.py'],
 'nanobot': ['nanobot/agent/loop.py','nanobot/agent/runner.py','nanobot/agent/context.py','nanobot/agent/memory.py',
 'nanobot/agent/skills.py','nanobot/session/manager.py','nanobot/agent/tools/sessions.py','nanobot/webui/session_access.py',
 'nanobot/agent/tools/registry.py','nanobot/agent/tools/execution.py','nanobot/agent/tools/long_task.py',
 'nanobot/agent/subagent.py','nanobot/agent/hook.py','nanobot/agent/progress_hook.py','nanobot/cron/service.py',
 'nanobot/security/workspace_policy.py','nanobot/agent/tools/honcho.py'],
 'keli': ['src/model/loop.ts','src/model/provider.ts','src/model/delegate-service.ts','src/core/gate.ts',
 'src/core/behavior.ts','src/core/capability-gate.ts','src/core/run-control.ts','src/core/budgets.ts',
 'src/execution/dispatch.ts','src/memory/notes.ts','src/preservation/cursor.ts','src/skills/store.ts',
 'src/capabilities/registry.ts','src/jobs/scheduler.ts','src/jobs/dispatch.ts','src/adapters/helpers-spawn.ts',
 'src/state/migrate.ts','src/state/db.ts']}

def git(path, *args):
 return subprocess.check_output(['git','-C',str(path),*args])

recon=json.loads(RECON.read_text()); result={}
for name,files in FILES.items():
 env_name={'hermes':'KELI_HERMES_ROOT','nanobot':'KELI_NANOBOT_ROOT'}.get(name)
 repo=os.environ.get(env_name, '') if env_name else str(ROOT)
 if env_name and not repo:
  raise SystemExit(f'{env_name} must point at the pinned {name} checkout to regenerate the index')
 pin=recon[name]['head']['stdout'].strip(); rows=[]
 for filename in files:
  raw=git(repo,'show',pin+':'+filename); text=raw.decode(); symbols=[]
  if filename.endswith('.py'):
   def visit(node,prefix=''):
    for child in ast.iter_child_nodes(node):
     if isinstance(child,(ast.FunctionDef,ast.AsyncFunctionDef,ast.ClassDef)):
      symbols.append({'symbol':prefix+child.name,'line':child.lineno})
      visit(child,prefix+child.name+'.')
   visit(ast.parse(text))
  else:
   symbols=[{'line':i,'declaration':line.strip()} for i,line in enumerate(text.splitlines(),1)
     if re.match(r'(export (class|function|async function)|  (async )?\w+\()',line)]
  rows.append({'file':filename,'sha256':hashlib.sha256(raw).hexdigest(),'lines':len(text.splitlines()),'symbols':symbols})
 result[name]={'pin':pin,'files':rows}
out=ROOT/'docs/evidence/2026-fast-spike/reference-index.json'
with out.open('x') as f: json.dump(result,f,indent=2);f.write('\n')
print('Indexed',sum(len(x['files']) for x in result.values()),'committed files')
