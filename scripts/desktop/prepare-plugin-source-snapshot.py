"""Make a consistent private rehearsal snapshot; original application rows are read only."""
import glob,hashlib,json,os,re,subprocess,sys,uuid
from pathlib import Path
from urllib.parse import urlparse,unquote
os.umask(0o077)
out=Path(sys.argv[1]).resolve();assert out.parent==Path('/mnt/c/Users/charl/AgentopiaQA/plugin-compatibility') and re.fullmatch(r'\d{13}',out.name)
config=json.loads((out/'intent.json').read_text());assert config['version']=='0.44.34';assert config['sourceSchema']==67 and config['schema']==69;assert config['production']=='AgentopiaRuntime-a91a4800-e08f-4440-a4ec-588762d01bfd'
assert Path('/opt/agentopia/runtime-instance').read_text().strip()=='a91a4800-e08f-4440-a4ec-588762d01bfd'
os.chdir('/home/agentopia/app');state=json.loads(subprocess.check_output(['supabase','stack','status','--output-format','json'],text=True));assert state['runtime']=='native'
url=urlparse(state['env']['DB_URL']);binary=Path(glob.glob('/home/agentopia/.supabase/cache/stack/slim-services/postgres/*/linux-amd64/*/bin/psql')[0]).parent
env=dict(os.environ,PGPASSWORD=unquote(url.password or ''),PGAPPNAME='agentopia_coordination_snapshot');connection=['-h','127.0.0.1','-p',str(url.port),'-U','supabase_admin'];database='agentopia_coordination_'+uuid.uuid4().hex[:16]
def sql(statement,target='postgres'):
    options=dict(env)
    if target=='postgres' and statement not in ('CREATE DATABASE '+database+' TEMPLATE template0','DROP DATABASE '+database):options['PGOPTIONS']='-c default_transaction_read_only=on'
    result=subprocess.run([str(binary/'psql'),'-XqAt','-v','ON_ERROR_STOP=1',*connection,'-d',target],input=statement+'\n',env=options,text=True,capture_output=True)
    if result.returncode:(out/'private-snapshot-error.log').write_text(result.stderr);raise RuntimeError('Snapshot preparation failed; inspect private-snapshot-error.log')
    return result.stdout.strip()
def quote(value):return '"'+value.replace('"','""')+'"'
assert sql('SELECT count(*) FROM agentopia_desktop.migrations')=='67'
backup=Path('/home/agentopia/backups')/('coordination-rehearsal-'+config['instanceId']);assert not backup.exists()
result=subprocess.run(['python3','/opt/agentopia/manage.py','backup',str(backup)],text=True,capture_output=True);(out/'private-snapshot-export.log').write_text(result.stdout+'\n'+result.stderr);assert result.returncode==0
manifest=json.loads((backup/'manifest.json').read_text())
for entry in manifest['files']:
    with (backup/entry['name']).open('rb') as stream:assert hashlib.file_digest(stream,'sha256').hexdigest()==entry['sha256']
created=False
try:
    sql('CREATE DATABASE '+database+' TEMPLATE template0');created=True
    toc=subprocess.check_output([str(binary/'pg_restore'),'--list',str(backup/'database.dump')],text=True)
    retained=[line for line in toc.splitlines() if ' SCHEMA - public ' not in line and not re.search(r' (?:EXTENSION - pg_cron|COMMENT - EXTENSION pg_cron|ACL - SCHEMA cron |(?:ACL|DEFAULT ACL|TABLE DATA|SEQUENCE SET) cron )',line)]
    listing=out/'private-snapshot-restore.list';listing.write_text('\n'.join(retained)+'\n')
    restore=subprocess.run([str(binary/'pg_restore'),'--exit-on-error','--single-transaction','--no-owner','--use-list',str(listing),*connection,'-d',database,str(backup/'database.dump')],env=env,text=True,capture_output=True)
    (out/'private-snapshot-restore.log').write_text(restore.stdout+'\n'+restore.stderr);assert restore.returncode==0
    assert sql('SELECT count(*) FROM agentopia_desktop.migrations',database)=='67'
    tables=json.loads(sql("SELECT json_agg(json_build_object('schema',schemaname,'table',tablename) ORDER BY schemaname,tablename) FROM pg_tables WHERE schemaname IN('auth','public','vault','pgsodium')",database));baseline=[]
    for table in tables:
        schema,name=table['schema'],table['table'];columns=json.loads(sql("SELECT json_agg(column_name ORDER BY ordinal_position) FROM information_schema.columns WHERE table_schema='"+schema+"' AND table_name='"+name+"'",database))
        qualified=quote(schema)+'.'+quote(name);rows=json.loads(sql("SELECT coalesce(json_agg(md5(to_jsonb(q)::text) ORDER BY md5(to_jsonb(q)::text)),'[]') FROM (SELECT "+','.join(map(quote,columns))+' FROM '+qualified+') q',database));baseline.append(dict(table,columns=columns,rows=rows))
    (out/'private-original-row-hashes.json').write_text(json.dumps({'tables':baseline}))
    native_rows=json.loads(sql("SELECT coalesce(json_agg(to_jsonb(t)),'[]') FROM public.desktop_codex_turns t",database))
    (out/'private-original-native-turns.json').write_text(json.dumps(native_rows))
    counts=json.loads(sql("SELECT json_build_object('accounts',(SELECT count(*) FROM auth.users),'conversations',(SELECT count(*) FROM conversation_sessions),'messages',(SELECT count(*) FROM chat_messages_v2),'runningRequests',(SELECT count(*) FROM desktop_requests WHERE status='running'),'runningGoals',(SELECT count(*) FROM desktop_goals WHERE status='running'))",database))
    assert counts['runningRequests']==0 and counts['runningGoals']==0,'The snapshot contains active work; inspect recovery expectations before continuing'
finally:
    if created:sql('DROP DATABASE '+database)
assert sql('SELECT count(*) FROM agentopia_desktop.migrations')=='67'
root_entry=next(entry for entry in manifest['files'] if entry['name']=='pgsodium_root.key')
print(json.dumps({'success':True,'backupDirectory':str(backup),'rootKeySha256':root_entry['sha256'],'sourceSchema':67,'snapshotFiles':len(manifest['files']),'tables':len(baseline),'rows':sum(len(table['rows']) for table in baseline),'counts':counts,'temporaryDatabaseRemoved':True,'productionMigrations':0}))
