"""Apply current additive goal controls to an owned snapshot copy only."""
import glob, hashlib, json, os, re, subprocess, sys, uuid
from pathlib import Path
from urllib.parse import urlparse, unquote

os.umask(0o077)
root=Path('/mnt/d/Users/charl/software/Agentopia')
out=Path(sys.argv[1]).resolve()
assert out.parent==root/'.supabase/desktop-goal-limits' and out.name.startswith('storage-')
out.mkdir(exist_ok=False)
checkpoint=json.loads((root/'.supabase/desktop-upgrade-rehearsal/latest.json').read_text())
old=json.loads(Path('/mnt/d/'+checkpoint['evidence'][3:].replace('\\','/')).read_text())
backup=Path(old['backupDirectory']);assert backup.parent==Path('/home/agentopia/backups')
manifest=json.loads((backup/'manifest.json').read_text())
for entry in manifest['files']:assert hashlib.sha256((backup/entry['name']).read_bytes()).hexdigest()==entry['sha256']
source=json.loads((backup/'private-snapshot-fingerprints.json').read_text())
os.chdir('/home/agentopia/app')
state=json.loads(subprocess.check_output(['supabase','stack','status','--output-format','json'],text=True));assert state['runtime']=='native'
url=urlparse(state['env']['DB_URL']);binary=Path(glob.glob('/home/agentopia/.supabase/cache/stack/slim-services/postgres/*/linux-amd64/*/bin/psql')[0]).parent
env=dict(os.environ,PGPASSWORD=unquote(url.password or ''),PGAPPNAME='agentopia_goal_limits_storage')
base=['-h','127.0.0.1','-p',str(url.port),'-U','supabase_admin']
database='agentopia_limits_'+uuid.uuid4().hex[:16];assert re.fullmatch(r'agentopia_limits_[a-f0-9]{16}',database)
evidence={'database':database,'checks':[],'productionMigrations':0,'providerRequests':0};created=False

def sql(statement,target=None,fail=False):
 target=target or database;query_env=dict(env)
 if target=='postgres':
  if statement not in ('CREATE DATABASE '+database+' TEMPLATE template0','DROP DATABASE '+database):query_env['PGOPTIONS']='-c default_transaction_read_only=on'
 result=subprocess.run([str(binary/'psql'),'-X','-qAt','-v','ON_ERROR_STOP=1',*base,'-d',target],input=statement+'\n',text=True,env=query_env,capture_output=True)
 if fail:assert result.returncode!=0;return
 if result.returncode:(out/'private-error.log').write_text(result.stderr);raise RuntimeError('Storage check failed; inspect private-error.log.')
 return result.stdout.strip()
def inventory():return json.loads(sql("SELECT json_build_object('users',(SELECT count(*) FROM auth.users),'conversations',(SELECT count(*) FROM public.conversation_sessions),'messages',(SELECT count(*) FROM public.chat_messages_v2),'migrations',(SELECT count(*) FROM agentopia_desktop.migrations))",'postgres'))
def check(label):evidence['checks'].append(label);print('PASS: '+label,flush=True)
def quote(value):return '"'+value.replace('"','""')+'"'
def fingerprints():
 queries=[]
 for item in source['tables']:
  label=item['schema']+'.'+item['table'];columns=','.join(map(quote,item['columns']));name=quote(item['schema'])+'.'+quote(item['table'])
  queries.append("SELECT json_build_object('table','"+label+"','rows',count(*),'digest',md5(coalesce(string_agg(to_jsonb(q)::text,E'\\n' ORDER BY to_jsonb(q)::text),'')))::text FROM (SELECT "+columns+' FROM '+name+') q')
 return [json.loads(row) for row in sql('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY; '+'; '.join(queries)+'; COMMIT').splitlines() if row]

try:
 evidence['before']=inventory();assert evidence['before']['migrations']==45
 assert not sql("SELECT 1 FROM pg_database WHERE datname='"+database+"'",'postgres')
 sql('CREATE DATABASE '+database+' TEMPLATE template0','postgres');created=True
 toc=subprocess.check_output([str(binary/'pg_restore'),'--list',str(backup/'database.dump')],text=True)
 retained=[line for line in toc.splitlines() if ' SCHEMA - public ' not in line and not re.search(r' (?:EXTENSION - pg_cron|COMMENT - EXTENSION pg_cron|ACL - SCHEMA cron |(?:ACL|DEFAULT ACL|TABLE DATA|SEQUENCE SET) cron )',line)]
 listing=out/'private-restore.list';listing.write_text('\n'.join(retained)+'\n')
 restored=subprocess.run([str(binary/'pg_restore'),'--exit-on-error','--single-transaction','--no-owner','--use-list',str(listing),*base,'-d',database,str(backup/'database.dump')],env=env,text=True,capture_output=True)
 (out/'private-restore.log').write_text(restored.stdout+'\n'+restored.stderr);assert restored.returncode==0
 applied={}
 for file in sorted((root/'desktop/database').glob('*.sql')):
  digest=hashlib.sha256(file.read_bytes()).hexdigest();existing=sql("SELECT checksum FROM agentopia_desktop.migrations WHERE version='"+file.name+"'")
  if existing:assert existing==digest;continue
  sql('BEGIN; '+file.read_text()+"\nINSERT INTO agentopia_desktop.migrations(version,checksum) VALUES('"+file.name+"','"+digest+"'); COMMIT;")
  applied[file.name]=digest
 assert len(json.loads(sql('SELECT json_object_agg(version,checksum) FROM agentopia_desktop.migrations')))==57
 assert fingerprints()==source['fingerprints'];evidence['applied']=applied
 check('The complete current schema upgrades from 45 to 57 and preserves all 20,134 existing values across 141 tables.')
 identity=json.loads(sql("SELECT json_build_object('user',user_id,'agent',id) FROM public.agents ORDER BY id LIMIT 1"));user,agent=identity['user'],identity['agent']
 def goal(maximum='NULL',budget='NULL'):
  identifier=str(uuid.uuid4());sql("INSERT INTO desktop_goals(id,user_id,agent_id,objective,max_turns,token_budget) VALUES('"+identifier+"','"+user+"','"+agent+"','Owned goal limits fixture',"+maximum+','+budget+')');return identifier
 unlimited=goal('NULL','40000');bounded=goal('1000');zero=goal();legacy=goal()
 assert sql("SELECT max_turns IS NULL AND token_budget=40000 FROM desktop_goals WHERE id='"+unlimited+"'")=='t'
 for maximum,budget in [('0','NULL'),('-1','NULL'),('1001','NULL'),('3','0'),('3','-1'),('3','9007199254740992')]:
  sql("INSERT INTO desktop_goals(user_id,agent_id,objective,max_turns,token_budget) VALUES('"+user+"','"+agent+"','Invalid fixture',"+maximum+','+budget+')',fail=True)
 check('Explicit unlimited goals and positive token budgets persist; invalid turn limits and unsafe budgets are refused by PostgreSQL.')
 def request(goal_id,turns):
  request_id=str(uuid.uuid4());options=json.dumps({'goalId':goal_id})
  sql("SELECT desktop_begin_chat_with_options('"+user+"','"+request_id+"','"+agent+"',NULL,'Controlled saved goal usage','"+options+"'::jsonb,'[]'::jsonb)")
  if turns is not None:sql("INSERT INTO desktop_codex_turns(request_id,user_id,thread_id,runtime_version,state,context) VALUES('"+request_id+"','"+user+"','"+str(uuid.uuid4())+"','0.163.0','"+json.dumps({'goalTurns':turns})+"'::jsonb,'{}'::jsonb)")
 request(unlimited,12);request(zero,0);request(legacy,None);sql('SELECT desktop_recover_goal_turns()')
 for identifier,expected in [(unlimited,12),(zero,0),(legacy,1)]:assert sql("SELECT turns_used FROM desktop_goals WHERE id='"+identifier+"'")==str(expected)
 check('Recovery counts twelve native turns, preserves a refused request with zero turns, and retains the one-turn legacy fallback.')
 sql("UPDATE desktop_goals SET turns_used=20 WHERE id='"+unlimited+"'; SELECT desktop_recover_goal_turns()")
 assert sql("SELECT turns_used FROM desktop_goals WHERE id='"+unlimited+"'")=='20'
 check('Repeated recovery never decreases previously saved usage.')
 evidence['checksPassed']=True
except Exception as error:evidence['error']=str(error)
finally:
 if created:sql('DROP DATABASE '+database,'postgres');evidence['disposableDatabaseRemoved']=True
 evidence['after']=inventory();evidence['productionUnchanged']=evidence['after']==evidence.get('before')
 evidence['success']=bool(evidence.get('checksPassed') and evidence.get('disposableDatabaseRemoved') and evidence['productionUnchanged'])
 (out/'evidence.json').write_text(json.dumps(evidence,indent=2))
print(json.dumps(evidence,indent=2));sys.exit(0 if evidence['success'] else 1)
