"""Apply current additive goal controls to an owned snapshot copy only."""
import glob, hashlib, json, os, re, subprocess, sys, uuid, time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from urllib.parse import urlparse, unquote

os.umask(0o077)
root=Path('/mnt/d/Users/charl/software/Agentopia')
out=Path(sys.argv[1]).resolve()
assert out.parent==root/'.supabase/desktop-plugin-updates' and out.name.startswith('storage-')
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
env=dict(os.environ,PGPASSWORD=unquote(url.password or ''),PGAPPNAME='agentopia_plugin_updates_storage')
base=['-h','127.0.0.1','-p',str(url.port),'-U','supabase_admin']
database='agentopia_plugin_update_'+uuid.uuid4().hex[:16];assert re.fullmatch(r'agentopia_plugin_update_[a-f0-9]{16}',database)
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
 assert len(json.loads(sql('SELECT json_object_agg(version,checksum) FROM agentopia_desktop.migrations')))==58
 assert fingerprints()==source['fingerprints'];evidence['applied']=applied
 check('The complete current schema upgrades from 45 to 58 and preserves all 20,134 existing values across 141 tables.')
 users=json.loads(sql('SELECT json_agg(id ORDER BY id) FROM auth.users'));assert len(users)==2
 user,other=users
 name='update-storage-'+uuid.uuid4().hex[:10]
 def literal(value):return "'"+value.replace("'","''")+"'"
 def js(value):return literal(json.dumps(value))+'::jsonb'
 def package(version,servers):return {'manifest':{'$schema':'https://agent-plugins.org/schemas/1.0.0/plugin.schema.json','name':name,'version':version,'description':'Owned update fixture.'},'mcp':{'$schema':'https://agent-plugins.org/schemas/1.0.0/mcp.schema.json','mcpServers':servers}}
 def digest(value):return hashlib.sha256(json.dumps(value,sort_keys=True,separators=(',',':')).encode()).hexdigest()
 servers={key:{'type':'streamable-http','url':'https://'+key+'.example/mcp'} for key in ('same','changed','removed')}
 initial=package('1.0.0',servers);initial_digest=digest(initial)
 sql("INSERT INTO desktop_plugins(user_id,name,package,digest,source,enabled) VALUES("+literal(user)+','+literal(name)+','+js(initial)+','+literal(initial_digest)+",'imported',false)")
 agents=[]
 for label in ('active','disabled','retired'):
  agent=sql("SELECT desktop_save_agent("+literal(user)+",NULL,'Owned plugin update "+label+"','','','openai-oauth','fixture-model')")
  agents.append(agent);sql("SELECT desktop_assign_plugin("+literal(user)+','+literal(name)+','+literal(agent)+',true)')
 sql('UPDATE desktop_agent_plugins SET enabled=false WHERE user_id='+literal(user)+' AND plugin_name='+literal(name)+' AND agent_id='+literal(agents[1]))
 sql('UPDATE agents SET active=false WHERE id='+literal(agents[2]))
 def links():return json.loads(sql("SELECT coalesce(json_agg(json_build_object('agent',l.agent_id,'server',l.server_name,'id',l.connection_id,'url',c.vault_server_url_id,'auth',c.auth_config) ORDER BY l.agent_id,l.server_name),'[]'::json) FROM desktop_plugin_connections l JOIN agent_mcp_connections c ON c.id=l.connection_id WHERE l.user_id="+literal(user)+' AND l.plugin_name='+literal(name)))
 old_links=links();assert len(old_links)==9
 for item in old_links:sql('SELECT desktop_save_mcp_connection('+literal(user)+','+literal(item['id'])+','+literal(item['agent'])+','+literal(name+' · '+item['server'])+",NULL,'GENERATED-UPDATE-TOKEN')")
 old_links=links();old_by={(item['agent'],item['server']):item for item in old_links}
 expected_grants=sql('SELECT json_agg(json_build_array(agent_id,enabled) ORDER BY agent_id) FROM desktop_agent_plugins WHERE user_id='+literal(user)+' AND plugin_name='+literal(name))
 changed={'same':servers['same'],'changed':{'type':'sse','url':'https://replacement.example/mcp'},'added':{'type':'streamable-http','url':'https://added.example/mcp'}}
 next_package=package('2.0.0',changed);next_digest=digest(next_package)
 def update(value,expected=initial_digest,owner=user,fail=False):return sql('SELECT desktop_update_plugin('+literal(owner)+','+literal(name)+','+literal(expected)+','+js(value)+','+literal(digest(value))+')',fail=fail)
 update(next_package,owner=other,fail=True);update(next_package,expected='0'*64,fail=True)
 assert links()==old_links
 assert sql("SELECT has_function_privilege('authenticated','public.desktop_update_plugin(uuid,text,text,jsonb,text)','EXECUTE') OR has_function_privilege('anon','public.desktop_update_plugin(uuid,text,text,jsonb,text)','EXECUTE')")=='f'
 check('Another account, stale digests and public database roles cannot replace this owned package.')
 # Fail after old connections have been removed inside the update transaction.
 failure=package('2.0.0',{'fail':{'type':'streamable-http','url':'https://fail.example/mcp'}})
 sql("CREATE FUNCTION public.plugin_update_test_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.connection_name="+literal(name+' · fail')+" THEN RAISE EXCEPTION 'Generated insertion failure'; END IF; RETURN NEW; END $$; CREATE TRIGGER plugin_update_test_failure BEFORE INSERT ON agent_mcp_connections FOR EACH ROW EXECUTE FUNCTION public.plugin_update_test_failure()")
 update(failure,fail=True)
 assert links()==old_links
 assert sql('SELECT digest FROM desktop_plugins WHERE user_id='+literal(user)+' AND name='+literal(name))==initial_digest
 for item in old_links:assert sql('SELECT count(*) FROM vault.secrets WHERE id='+literal(item['url'])+' OR id='+literal(item['auth']['desktop_token_id']))=='2'
 sql('DROP TRIGGER plugin_update_test_failure ON agent_mcp_connections; DROP FUNCTION public.plugin_update_test_failure()')
 check('An insertion failure rolls back the package, connection removals and encrypted credentials together.')
 update(next_package)
 new_links=links();new_by={(item['agent'],item['server']):item for item in new_links}
 for agent in agents:assert new_by[(agent,'same')]==old_by[(agent,'same')]
 for item in old_links:
  if item['server']=='same':continue
  assert sql('SELECT count(*) FROM vault.secrets WHERE id='+literal(item['url'])+' OR id='+literal(item['auth']['desktop_token_id']))=='0'
 assert len(new_links)==5
 for server in ('changed','added'):
  current=new_by[(agents[0],server)];assert current['id'] not in [item['id'] for item in old_links]
  assert not current['auth'].get('desktop_token_id')
  assert sql('SELECT decrypted_secret='+literal(changed[server]['url'])+' FROM vault.decrypted_secrets WHERE id='+literal(current['url']))=='t'
 assert sql('SELECT enabled FROM desktop_plugins WHERE user_id='+literal(user)+' AND name='+literal(name))=='f'
 assert sql('SELECT json_agg(json_build_array(agent_id,enabled) ORDER BY agent_id) FROM desktop_agent_plugins WHERE user_id='+literal(user)+' AND plugin_name='+literal(name))==expected_grants
 check('Unchanged connections retain exact identifiers and encrypted credentials; replacements and additions start without tokens, and disabled or retired grants gain no new servers.')
 update(package('3.0.0',changed),fail=True)
 assert links()==new_links
 check('A second updater with the old review cannot overwrite the completed update.')
 # Two real database sessions begin with the same reviewed revision.
 race_name=name+'-race'
 def race_package(version):return {'manifest':{**initial['manifest'],'name':race_name,'version':version},'files':{'skills/update/SKILL.md':'LS0tCm5hbWU6IHVwZGF0ZQpkZXNjcmlwdGlvbjogVXBkYXRlLgotLS0K'}}
 race_initial=race_package('1.0.0');race_digest=digest(race_initial)
 sql('INSERT INTO desktop_plugins(user_id,name,package,digest,source) VALUES('+literal(user)+','+literal(race_name)+','+js(race_initial)+','+literal(race_digest)+",'imported')")
 def racing_query(version):
  value=race_package(version)
  return 'SELECT desktop_update_plugin('+literal(user)+','+literal(race_name)+','+literal(race_digest)+','+js(value)+','+literal(digest(value))+')'
 def racing_update(query):
  return subprocess.run([str(binary/'psql'),'-X','-qAt','-v','ON_ERROR_STOP=1',*base,'-d',database],input=query+'\n',env=dict(env,PGAPPNAME='agentopia_plugin_update_race'),text=True,capture_output=True,timeout=15)
 with ThreadPoolExecutor(max_workers=2) as pool:
  first=pool.submit(racing_update,'BEGIN; '+racing_query('2.0.0')+'; SELECT pg_sleep(1); COMMIT;')
  deadline=time.monotonic()+5
  while time.monotonic()<deadline:
   waiting=sql("SELECT count(*) FROM pg_stat_activity WHERE datname=current_database() AND application_name='agentopia_plugin_update_race' AND wait_event='PgSleep'")
   if waiting=='1':break
   assert not first.done(),'The first session ended before the overlap was observed.'
   time.sleep(0.02)
  assert waiting=='1','The test did not observe the first session holding its transaction.'
  second=pool.submit(racing_update,racing_query('3.0.0'))
  first_result,second_result=first.result(),second.result()
 assert first_result.returncode==0 and second_result.returncode!=0
 assert 'changed since review' in second_result.stderr
 assert sql('SELECT digest FROM desktop_plugins WHERE user_id='+literal(user)+' AND name='+literal(race_name))==digest(race_package('2.0.0'))
 sql('SELECT desktop_remove_plugin('+literal(user)+','+literal(race_name)+')')
 check('Two overlapping database sessions serialize their replacements and the stale contender cannot overwrite the winner.')
 # Converting to a skills-only release removes every remaining remote credential.
 skills={'manifest':{**next_package['manifest'],'version':'3.0.0'},'files':{'skills/update/SKILL.md':'LS0tCm5hbWU6IHVwZGF0ZQpkZXNjcmlwdGlvbjogVXBkYXRlLgotLS0K'}}
 update(skills,expected=next_digest);assert links()==[]
 for item in new_links:
  assert sql('SELECT count(*) FROM vault.secrets WHERE id='+literal(item['url']))=='0'
  if item['auth'].get('desktop_token_id'):assert sql('SELECT count(*) FROM vault.secrets WHERE id='+literal(item['auth']['desktop_token_id']))=='0'
 check('A skills-only update removes retired remote connections and their owned encrypted credentials.')
 sql('SELECT desktop_remove_plugin('+literal(user)+','+literal(name)+')')
 sql('DELETE FROM agents WHERE user_id='+literal(user)+' AND id IN ('+','.join(map(literal,agents))+')')
 assert fingerprints()==source['fingerprints']
 check('Removing all generated fixture records restores the complete original data fingerprint.')
 evidence['checksPassed']=True
except Exception as error:evidence['error']=str(error)
finally:
 if created:sql('DROP DATABASE '+database,'postgres');evidence['disposableDatabaseRemoved']=True
 evidence['after']=inventory();evidence['productionUnchanged']=evidence['after']==evidence.get('before')
 evidence['success']=bool(evidence.get('checksPassed') and evidence.get('disposableDatabaseRemoved') and evidence['productionUnchanged'])
 (out/'evidence.json').write_text(json.dumps(evidence,indent=2))
print(json.dumps(evidence,indent=2));sys.exit(0 if evidence['success'] else 1)
