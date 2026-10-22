"""Collect only saved records for the bounded live50 workflow; never send work."""
from pathlib import Path
import collections,datetime,glob,hashlib,json,os,re,subprocess,sys,time
from urllib.parse import urlparse,unquote
out=Path(sys.argv[1]);mode=sys.argv[2];assert mode in ('baseline','capture') and out.parent==Path('/mnt/f/Agentopia/.supabase/desktop-agent-live50') and re.fullmatch(r'\d{13}',out.name)
intent=json.loads((out/'intent.json').read_text());ids=list(intent['requestIds'].values());assert all(re.fullmatch('[a-f0-9-]{36}',v) for v in ids)
assert Path('/opt/agentopia/runtime-instance').read_text().strip()=='a91a4800-e08f-4440-a4ec-588762d01bfd'
os.umask(0o077);os.chdir('/home/agentopia/app');state=json.loads(subprocess.check_output(['supabase','stack','status','--output-format','json'],text=True));db=urlparse(state['env']['DB_URL']);assert db.port==57322
binary=glob.glob('/home/agentopia/.supabase/cache/stack/slim-services/postgres/*/linux-amd64/*/bin/psql')[0];env=dict(os.environ,PGPASSWORD=unquote(db.password or ''),PGOPTIONS='-c default_transaction_read_only=on',PGAPPNAME='agentopia_live50_readonly',PGTZ='UTC')
def sql(query):
    result=subprocess.run([binary,'-XqAt','-v','ON_ERROR_STOP=1','-h','127.0.0.1','-p',str(db.port),'-U','supabase_admin','-d','postgres'],input='BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;\n'+query+'\nCOMMIT;\n',env=env,text=True,capture_output=True)
    if result.returncode:
        (out/'private-sql-error.txt').write_text(result.stderr);raise RuntimeError('Read-only workflow inspection failed')
    return json.loads(result.stdout)
def quote(values):
    assert all(re.fullmatch('[a-f0-9-]{36}',v) for v in values)
    return ','.join("'"+v+"'" for v in values)
tables=['public.agents','public.desktop_agent_profiles','public.desktop_agent_definition_revisions','public.desktop_agent_memories','public.desktop_agent_memory_revisions','public.conversation_sessions','public.chat_messages_v2','public.desktop_requests','public.desktop_codex_turns','public.desktop_codex_threads','public.desktop_projects','public.desktop_project_chats','auth.users','vault.secrets']
def fingerprints():
    result={}
    for table in tables:
        expr="to_jsonb(t)-'last_sign_in_at'-'updated_at'" if table=='auth.users' else 'to_jsonb(t)'
        rows=sql('SELECT coalesce(jsonb_agg('+expr+"),'[]') FROM "+table+' t;')
        result[table]=dict(collections.Counter(hashlib.sha256(json.dumps(row,sort_keys=True,separators=(',',':')).encode()).hexdigest() for row in rows))
    return result
parents=sql("SELECT coalesce(jsonb_agg(to_jsonb(r)),'[]') FROM desktop_requests r WHERE id IN ("+quote(ids)+');')
if mode=='baseline':
    assert not parents,'Never replay a saved or uncertain request'
    history=sql("SELECT coalesce(jsonb_agg(jsonb_build_object('instance',i.id,'agent',i.agent_id,'createdAt',i.created_at,'request',r.id,'requestStatus',r.status,'error',r.error)),'[]') FROM desktop_agent_instances i LEFT JOIN desktop_requests r ON r.id=i.request_id WHERE i.status='failed';")
    result={'at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'readOnly':True,'fingerprints':fingerprints(),'historicalFailedAssignments':history,'parentRequestsAlreadyExist':0}
    with (out/'baseline.json').open('x') as stream:json.dump(result,stream,indent=2)
    print(json.dumps({'success':True,'readOnly':True,'baselineTables':len(tables),'existingFailedAssignments':len(history),'submittedRequests':0}));sys.exit(0)
baseline=json.loads((out/'baseline.json').read_text());current=fingerprints();missing={table:sum((collections.Counter(before)-collections.Counter(current[table])).values()) for table,before in baseline['fingerprints'].items()};missing={table:n for table,n in missing.items() if n}
invocations=sql("SELECT coalesce(jsonb_agg(to_jsonb(i)),'[]') FROM desktop_agent_invocations i WHERE origin_request_id IN ("+quote(ids)+');')
all_ids=list(set(ids+[r['request_id'] for r in invocations]));records={'at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'readOnly':True,'parents':parents,'invocations':invocations,'preExistingRowsChanged':missing,'providerRequestsFromCollector':0}
for table,key,column in [('desktop_requests','requests','id'),('desktop_codex_turns','native','request_id'),('desktop_tool_calls','tools','request_id'),('desktop_agent_instances','instances','request_id')]:records[key]=sql("SELECT coalesce(jsonb_agg(to_jsonb(t)),'[]') FROM "+table+' t WHERE '+column+' IN ('+quote(all_ids)+');')
chat_ids=list(set(r['conversation_id'] for r in records['requests']));records['messages']=sql("SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY created_at),'[]') FROM chat_messages_v2 t WHERE conversation_id IN ("+quote(chat_ids)+');') if chat_ids else []
records['memberships']=sql("SELECT coalesce(jsonb_agg(to_jsonb(t)),'[]') FROM desktop_project_chats t WHERE conversation_id IN ("+quote(chat_ids)+');') if chat_ids else []
records['conversations']=sql("SELECT coalesce(jsonb_agg(to_jsonb(t)),'[]') FROM conversation_sessions t WHERE conversation_id IN ("+quote(chat_ids)+');') if chat_ids else []
setup=json.loads((out/'setup.json').read_text()) if (out/'setup.json').exists() else None
if setup:
    agents=[setup['coordinator'],setup['specialist']];records['profiles']=sql("SELECT coalesce(jsonb_agg(to_jsonb(t)),'[]') FROM desktop_agent_profiles t WHERE agent_id IN ("+quote(agents)+');');records['memories']=sql("SELECT coalesce(jsonb_agg(to_jsonb(t)),'[]') FROM desktop_agent_memories t WHERE agent_id IN ("+quote(agents)+');')
file=out/('capture-'+str(time.time_ns()//1000000)+'.json');file.write_text(json.dumps(records,indent=2));(out/'latest-capture.json').write_text(json.dumps({'file':str(file)}))
print(json.dumps({'readOnly':True,'capture':str(file),'requests':[{'id':r['id'],'status':r['status']} for r in records['requests']],'preExistingRowsChanged':missing,'toolStatuses':dict(collections.Counter(r['status'] for r in records['tools']))}))
