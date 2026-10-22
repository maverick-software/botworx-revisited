"""Exercise old/fixed real RPC payloads in a disposable copy of the QA database."""
from pathlib import Path
from urllib.parse import urlparse,unquote
import glob,hashlib,json,os,re,subprocess,sys,uuid
os.umask(0o077)
out=Path(sys.argv[1]).resolve(strict=True);assert out.parent==Path('/mnt/f/Agentopia/.supabase/desktop-delivery-contract65') and re.fullmatch(r'\d{13}',out.name)
assert Path('/opt/agentopia/runtime-instance').read_text().strip()=='c0e548ce-f913-4746-9e2e-9a466362c900'
payloads=json.loads((out/'rpc-payloads.json').read_text());owner=payloads['old']['p_user'];delivery=payloads['old']['p_delivery'];assert owner=='810f3e3a-ea15-45a7-a8aa-a87d04ff7c32'
assert all(re.fullmatch(r'[a-f0-9-]{36}',value) for value in [owner,delivery]);assert payloads['new']['p_user']==owner and payloads['new']['p_delivery']==delivery
os.chdir('/home/agentopia/app');state=json.loads(subprocess.check_output(['supabase','stack','status','--output-format','json'],text=True));url=urlparse(state['env']['DB_URL']);assert url.hostname in ['127.0.0.1','localhost']
binary=Path(glob.glob('/home/agentopia/.supabase/cache/stack/slim-services/postgres/*/linux-amd64/*/bin/psql')[0]).parent;env=dict(os.environ,PGPASSWORD=unquote(url.password or ''),PGAPPNAME='agentopia_delivery65_disposable');base=['-h','127.0.0.1','-p',str(url.port),'-U','supabase_admin'];scratch='agentopia_delivery65_'+uuid.uuid4().hex[:16]
e={'success':False,'at':__import__('datetime').datetime.now(__import__('datetime').timezone.utc).isoformat(),'database':scratch,'sourceInstance':'c0e548ce-f913-4746-9e2e-9a466362c900','productionWrites':0,'sourceDatabaseWrites':0,'providerRequests':0,'checks':[]};created=False
def lit(value):return 'NULL' if value is None else "'"+str(value).replace("'","''")+"'"
def sql(statement,database='postgres',fail=False):
    query_env=dict(env)
    if database=='postgres' and statement not in ['CREATE DATABASE '+scratch+' TEMPLATE template0','DROP DATABASE '+scratch]:query_env['PGOPTIONS']='-c default_transaction_read_only=on'
    result=subprocess.run([str(binary/'psql'),'-XqAt','-v','ON_ERROR_STOP=1',*base,'-d',database],input=statement+'\n',text=True,env=query_env,capture_output=True)
    if fail:assert result.returncode!=0;return result.stderr
    if result.returncode:(out/'private-query-error.txt').write_text(result.stderr);raise RuntimeError('Disposable database check failed; private diagnostic retained')
    return result.stdout.strip()
def fingerprints():
    tables=json.loads(sql("SELECT json_agg(json_build_object('s',schemaname,'t',tablename) ORDER BY schemaname,tablename) FROM pg_tables WHERE schemaname IN('auth','public','vault')"));values={}
    for table in tables:
        name='"'+table['s']+'"."'+table['t']+'"';values[name]=json.loads(sql("SELECT json_build_object('rows',count(*),'hash',md5(coalesce(string_agg(to_jsonb(t)::text,E'\\n' ORDER BY to_jsonb(t)::text),''))) FROM "+name+' t'))
    return values
def begin(payload,fail=False):
    params=[lit(payload['p_user'])+'::uuid',lit(payload['p_delivery'])+'::uuid',lit(json.dumps(payload['p_options']))+'::jsonb',lit(json.dumps(payload['p_files']))+'::jsonb',lit(payload['p_plan'])+'::uuid',lit(payload['p_plan_revision'])+'::bigint'];return sql('SELECT public.desktop_begin_delivered_chat('+','.join(params)+')',scratch,fail)
try:
    before=fingerprints();original=json.loads(sql("SELECT to_jsonb(d) FROM desktop_chat_deliveries d WHERE user_id="+lit(owner)+" AND id="+lit(delivery)));assert original['status']=='held' and original['target_request'] is None and original['error']=='A coordination message cannot add execution options or a goal'
    dump=out/'private-qa.dump';result=subprocess.run([str(binary/'pg_dump'),*base,'-d','postgres','--format=custom','--no-owner','--file',str(dump)],env=env,text=True,capture_output=True);assert result.returncode==0
    sql('CREATE DATABASE '+scratch+' TEMPLATE template0');created=True;toc=subprocess.check_output([str(binary/'pg_restore'),'--list',str(dump)],text=True);retained=[line for line in toc.splitlines() if ' SCHEMA - public ' not in line and not re.search(r' (?:EXTENSION - pg_cron|COMMENT - EXTENSION pg_cron|ACL - SCHEMA cron |(?:ACL|DEFAULT ACL|TABLE DATA|SEQUENCE SET) cron )',line)];listing=out/'private-restore.list';listing.write_text('\n'.join(retained)+'\n');restore=subprocess.run([str(binary/'pg_restore'),'--exit-on-error','--single-transaction','--no-owner','--use-list',str(listing),*base,'-d',scratch,str(dump)],env=env,text=True,capture_output=True);(out/'private-restore.log').write_text(restore.stdout+'\n'+restore.stderr);assert restore.returncode==0,'Inspect the private restore log'
    # Reconstruct the already captured, authorized pre-dispatch state only in
    # the disposable copy. The original held message and revoked grant stay intact.
    sql("UPDATE desktop_chat_delivery_grants SET enabled=true,revision="+str(int(original['grant_revision']))+" WHERE id="+lit(original['grant_id'])+"; UPDATE desktop_chat_deliveries SET status='dispatching',error=NULL WHERE id="+lit(delivery),scratch)
    assert sql('SELECT count(*) FROM desktop_requests WHERE id='+lit(delivery),scratch)=='0';error=begin(payloads['old'],True);assert 'A coordination message cannot add execution options or a goal' in error;assert sql('SELECT count(*) FROM desktop_requests WHERE id='+lit(delivery),scratch)=='0';e['checks'].append('The exact64 payload reproduces the saved database refusal before a receiving request exists.')
    prepared=json.loads(begin(payloads['new']));assert prepared['id']==delivery and prepared['agent_id']==original['snapshot']['target_agent'];assert prepared['chat_delivery']['sourceConversationId']==original['source_chat'];instance=json.loads(sql('SELECT to_jsonb(i) FROM desktop_agent_instances i WHERE id='+lit(prepared['agent_instance_id']),scratch));assert instance['policy_ceiling']['tools']==[] and instance['policy_ceiling']['memoryWrite'] is False
    metadata=json.loads(sql('SELECT metadata FROM chat_messages_v2 WHERE id='+lit(prepared['user_message_id']),scratch));assert 'sources' not in metadata['options'] and 'goalId' not in metadata['options'];assert metadata['options']['files']==[] and metadata['options']['harness']=='codex';assert metadata['chat_delivery']['sourceMessageId']==original['snapshot']['source_message'];e['checks'].append('The fixed service payload prepares the real receiving turn, retaining its target identity, inherited zero-tool policy, source attribution, connection and empty file scope.')
    assert json.loads(begin(payloads['new']))['existing'] is True;assert sql('SELECT count(*) FROM desktop_requests WHERE id='+lit(delivery),scratch)=='1';e['checks'].append('Repeated receiver preparation returns the same saved request instead of creating another request.')
    after=fingerprints();assert after==before;e['sourceTablesCompared']=len(before);e['sourceRowsCompared']=sum(row['rows'] for row in before.values());e['originalHeldDeliveryUnchanged']=True;e['sourceDataUnchanged']=True;e['receivingRequest']=delivery;e['success']=True
except Exception:
    e['error']=__import__('traceback').format_exc();raise
finally:
    if created:sql('DROP DATABASE '+scratch);e['scratchDatabaseDropped']=True
    assert not sql('SELECT 1 FROM pg_database WHERE datname='+lit(scratch));(out/'database-evidence.json').write_text(json.dumps(e,indent=2));print(json.dumps({key:e.get(key) for key in ['success','checks','sourceTablesCompared','sourceRowsCompared','scratchDatabaseDropped','sourceDataUnchanged','providerRequests']}),flush=True)
