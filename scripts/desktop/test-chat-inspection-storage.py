"""Qualify chat inspection against a restored disposable database, never production."""
import glob, hashlib, http.server, json, os, re, secrets, subprocess, sys, threading, traceback, uuid
from pathlib import Path
from urllib.parse import urlparse, unquote

os.umask(0o077)
root=Path('/mnt/d/Users/charl/software/Agentopia')
out=Path(sys.argv[1]).resolve()
assert out.parent==root/'.supabase/desktop-chat-inspection' and out.name.startswith('storage-')
assert Path('/opt/agentopia/runtime-instance').read_text().strip()=='a91a4800-e08f-4440-a4ec-588762d01bfd'
out.mkdir(exist_ok=False)
backup=root/'.supabase/desktop-goal-queue/upgrade-backup-1792341034014/current-database-backup'
manifest=json.loads((backup/'manifest.json').read_text())
for file in manifest['files']:
    with (backup/file['name']).open('rb') as stream: assert hashlib.file_digest(stream,'sha256').hexdigest()==file['sha256']
os.chdir('/home/agentopia/app')
state=json.loads(subprocess.check_output(['supabase','stack','status','--output-format','json'],text=True))
assert state['runtime']=='native'
url=urlparse(state['env']['DB_URL'])
binary=Path(glob.glob('/home/agentopia/.supabase/cache/stack/slim-services/postgres/*/linux-amd64/*/bin/psql')[0]).parent
env=dict(os.environ,PGPASSWORD=unquote(url.password or ''),PGAPPNAME='agentopia_chat_inspection_qualification')
base=['-h','127.0.0.1','-p',str(url.port),'-U','supabase_admin']
database='agentopia_inspection_'+uuid.uuid4().hex[:16]
assert re.fullmatch(r'agentopia_inspection_[a-f0-9]{16}',database)
evidence={'database':database,'checks':[],'productionMigrations':0,'providerRequests':0}
created=False

def sql(statement,target=None,fail=False):
    target=target or database
    query_env=dict(env)
    if target=='postgres' and statement not in ('CREATE DATABASE '+database+' TEMPLATE template0','DROP DATABASE '+database):
        query_env['PGOPTIONS']='-c default_transaction_read_only=on'
    result=subprocess.run([str(binary/'psql'),'-XqAt','-v','ON_ERROR_STOP=1',*base,'-d',target],input=statement+'\n',text=True,env=query_env,capture_output=True)
    if fail:
        assert result.returncode!=0,'A forbidden operation succeeded'
        return result.stderr
    if result.returncode:
        (out/'private-error.log').write_text(result.stderr)
        raise RuntimeError('Database qualification failed; inspect private-error.log')
    return result.stdout.strip()

def lit(value):
    if value is None:return 'NULL'
    return "'"+str(value).replace("'","''")+"'"
def uid():return str(uuid.uuid4())
def obj(value):return lit(json.dumps(value,ensure_ascii=False))+'::jsonb'
def rpc(name,*args,fail=False):return sql('SELECT '+name+'('+','.join(lit(v) for v in args)+')',fail=fail)
def jsonrpc(name,*args):return json.loads(rpc(name,*args))
def check(label):evidence['checks'].append(label);print('PASS: '+label,flush=True)
def inventory():return json.loads(sql("SELECT json_build_object('users',(SELECT count(*) FROM auth.users),'chats',(SELECT count(*) FROM conversation_sessions),'messages',(SELECT count(*) FROM chat_messages_v2),'migrations',(SELECT count(*) FROM agentopia_desktop.migrations),'inspectionFunctions',(SELECT count(*) FROM pg_proc WHERE proname LIKE 'desktop%chat_inspection%'))",'postgres'))
def fingerprints():
    rows=json.loads(sql("SELECT json_agg(json_build_object('schema',schemaname,'table',tablename) ORDER BY schemaname,tablename) FROM pg_tables WHERE schemaname IN('auth','public','vault')"))
    result=[]
    for row in rows:
        name='"'+row['schema']+'"."'+row['table']+'"'
        result.append(json.loads(sql("SELECT json_build_object('table',"+lit(name)+",'rows',count(*),'hash',md5(coalesce(string_agg(to_jsonb(t)::text,E'\\n' ORDER BY to_jsonb(t)::text),''))) FROM "+name+' t')))
    return result

try:
    evidence['productionBefore']=inventory()
    assert evidence['productionBefore']['migrations']==59
    assert not sql('SELECT 1 FROM pg_database WHERE datname='+lit(database),'postgres')
    sql('CREATE DATABASE '+database+' TEMPLATE template0','postgres');created=True
    toc=subprocess.check_output([str(binary/'pg_restore'),'--list',str(backup/'database.dump')],text=True)
    retained=[line for line in toc.splitlines() if ' SCHEMA - public ' not in line and not re.search(r' (?:EXTENSION - pg_cron|COMMENT - EXTENSION pg_cron|ACL - SCHEMA cron |(?:ACL|DEFAULT ACL|TABLE DATA|SEQUENCE SET) cron )',line)]
    listing=out/'private-restore.list';listing.write_text('\n'.join(retained)+'\n')
    restore=subprocess.run([str(binary/'pg_restore'),'--exit-on-error','--single-transaction','--no-owner','--use-list',str(listing),*base,'-d',database,str(backup/'database.dump')],env=env,text=True,capture_output=True)
    (out/'private-restore.log').write_text(restore.stdout+'\n'+restore.stderr)
    assert restore.returncode==0,'Snapshot restore failed; inspect private-restore.log'
    evidence['snapshotSchema']=int(sql('SELECT count(*) FROM agentopia_desktop.migrations'))
    baseline=None;applied={}
    for file in sorted((root/'desktop/database').glob('*.sql')):
        # This verifier establishes the migration-60 inspection boundary. Later
        # features have independent storage qualification and add their own tables.
        if file.name>'0060-chat-inspection.sql':continue
        digest=hashlib.sha256(file.read_bytes()).hexdigest()
        existing=sql('SELECT checksum FROM agentopia_desktop.migrations WHERE version='+lit(file.name))
        if existing:
            assert existing==digest,'A historical migration changed: '+file.name
            continue
        if file.name=='0060-chat-inspection.sql':
            assert int(sql('SELECT count(*) FROM agentopia_desktop.migrations'))==59
            baseline=fingerprints()
        sql('BEGIN; '+file.read_text()+"\nINSERT INTO agentopia_desktop.migrations(version,checksum) VALUES("+lit(file.name)+','+lit(digest)+'); COMMIT;')
        applied[file.name]=digest
    assert baseline is not None
    migrated=fingerprints()
    assert migrated==baseline,'Existing table fingerprints changed: '+','.join(row['table'] for row in migrated if row not in baseline)
    evidence['applied']=applied
    check('After bringing the restored snapshot to schema 59, migration 60 preserves every auth/application/vault table row.')
    identity=json.loads(sql("SELECT json_build_object('user',user_id,'agent',id) FROM agents WHERE active ORDER BY id LIMIT 1"))
    user,agent=identity['user'],identity['agent']
    other=sql('SELECT id FROM auth.users WHERE id<>'+lit(user)+' ORDER BY id LIMIT 1')
    assert other
    other_agent=uid()
    other_agent=rpc('desktop_save_agent',other,None,'Inspection foreign agent','','','openai-oauth','fixture-model')
    p_open,p_isolated=uid(),uid()
    sql('INSERT INTO desktop_projects(id,user_id,name,agent_memory_isolated) VALUES('+lit(p_open)+','+lit(user)+",'Inspection open',false),("+lit(p_isolated)+','+lit(user)+",'Inspection isolated',true)")

    def begin(title,owner=user,actor=agent,project=None,complete=False):
        request_id=uid()
        row=jsonrpc('desktop_begin_chat_with_options',owner,request_id,actor,None,title,'{}','[]')
        sql('UPDATE conversation_sessions SET title='+lit(title)+' WHERE conversation_id='+lit(row['conversation_id']))
        if project:sql('INSERT INTO desktop_project_chats(conversation_id,project_id,user_id) VALUES('+lit(row['conversation_id'])+','+lit(project)+','+lit(owner)+')')
        if complete:rpc('desktop_checkpoint_chat',owner,row['id'],'Saved answer','completed',None)
        return row

    source=begin('INSPECTION source',project=p_open)
    normal=begin('INSPECTION ordinary',project=p_open,complete=True)
    projectless=begin('INSPECTION projectless',complete=True)
    isolated=begin('INSPECTION isolated',project=p_isolated,complete=True)
    archived=begin('INSPECTION archived',complete=True)
    sql("UPDATE conversation_sessions SET session_state=session_state||'{\"desktop_archived\":true}' WHERE conversation_id="+lit(archived['conversation_id']))
    foreign=begin('INSPECTION foreign',owner=other,actor=other_agent,complete=True)
    listing=jsonrpc('desktop_inspect_chats',user,source['id'],p_open,None,'INSPECTION',50,0)
    assert {c['conversation_id'] for c in listing['chats']}=={normal['conversation_id'],projectless['conversation_id']}
    assert listing['total']==2
    first=jsonrpc('desktop_inspect_chats',user,source['id'],p_open,None,'INSPECTION',1,0)
    second=jsonrpc('desktop_inspect_chats',user,source['id'],p_open,None,'INSPECTION',1,first['next_offset'])
    assert first['total']==second['total']==2 and first['chats'][0]['conversation_id']!=second['chats'][0]['conversation_id'] and second['next_offset'] is None
    check('Listing and paging exclude the current, archived, foreign-account and isolated chats before counting results.')
    selected_name='Active inspection agent '+uid()
    selected_agent=rpc('desktop_save_agent',user,None,selected_name,'','','openai-oauth','fixture-model')
    sql('UPDATE conversation_sessions SET session_state=session_state||'+obj({'desktop_active_agent':selected_agent,'desktop_pinned':True})+' WHERE conversation_id='+lit(normal['conversation_id']))
    selected=jsonrpc('desktop_inspect_chats',user,source['id'],p_open,None,selected_name,50,0)
    assert len(selected['chats'])==1 and selected['chats'][0]['conversation_id']==normal['conversation_id'] and selected['chats'][0]['agent_id']==selected_agent and selected['chats'][0]['pinned']
    check('Search and summaries use the chat’s currently selected agent and retain pinned state.')
    for target in [isolated['conversation_id'],archived['conversation_id'],foreign['conversation_id'],uid(),source['conversation_id']]:
        rpc('desktop_inspect_chat',user,source['id'],p_open,None,target,0,0,6,6000,fail=True)
    rpc('desktop_inspect_chats',other,source['id'],p_open,None,'',20,0,fail=True)
    rpc('desktop_inspect_chats',user,source['id'],None,None,'',20,0,fail=True)
    check('Direct IDs cannot bypass account, archived-chat, project or source-request ownership checks.')
    isolated_source=begin('ISOLATED request',project=p_isolated)
    assert {c['conversation_id'] for c in jsonrpc('desktop_inspect_chats',user,isolated_source['id'],p_isolated,None,'INSPECTION',50,0)['chats']}=={isolated['conversation_id']}
    rpc('desktop_inspect_chat',user,isolated_source['id'],p_isolated,None,projectless['conversation_id'],0,0,6,6000,fail=True)
    check('An isolated requesting project can inspect only chats inside that same project.')

    text='A😀B𐐀C '+('long saved note '*1000)+'TAIL-MARKER'
    metadata={'native':{'items':[{'item':{'type':'reasoning','text':'PRIVATE-REASONING-MARKER'}}]},'agent':{'id':agent,'name':'Inspection author','role':'Researcher'},'status':'completed'}
    sql('UPDATE chat_messages_v2 SET content='+obj({'type':'text','text':text,'files':[{'text':'PRIVATE-ATTACHMENT-MARKER'}]})+',metadata='+obj(metadata)+' WHERE id='+lit(normal['assistant_message_id']))
    sql('INSERT INTO chat_messages_v2(conversation_id,session_id,role,content) SELECT conversation_id,id,\'system\','+obj({'type':'text','text':'PRIVATE-SYSTEM-MARKER'})+' FROM conversation_sessions WHERE conversation_id='+lit(normal['conversation_id']))
    activity=uid()
    sql('INSERT INTO desktop_tool_calls(id,user_id,request_id,conversation_id,assistant_message_id,name,label,status,arguments,result) VALUES('+','.join(map(lit,[activity,user,normal['id'],normal['conversation_id'],normal['assistant_message_id'],'read_file','Read requested file','completed']))+','+obj({'token':'PRIVATE-ARGUMENT-MARKER'})+','+obj({'text':'PRIVATE-TOOL-RESULT-MARKER'})+')')
    full=jsonrpc('desktop_inspect_chat',user,source['id'],p_open,None,normal['conversation_id'],0,0,12,12000)
    assert full['total_messages']==2 and len(full['messages'])==2
    serialized=json.dumps(full)
    assert not any(marker in serialized for marker in ['PRIVATE-REASONING','PRIVATE-ATTACHMENT','PRIVATE-SYSTEM','PRIVATE-ARGUMENT','PRIVATE-TOOL-RESULT'])
    assert full['activities'][0]['label']=='Read requested file'
    reconstructed='';offset=0
    for index in range(30):
        page=jsonrpc('desktop_inspect_chat',user,source['id'],p_open,None,normal['conversation_id'],1,offset,1,1000)
        message=page['messages'][0];assert message['id']==normal['assistant_message_id'];reconstructed+=message['text'];offset=message['character_offset']+len(message['text'])
        if offset==message['text_length']:break
    assert reconstructed==text
    check('Unicode paging reconstructs a long message exactly; private reasoning, attachments, system text and tool payloads are excluded.')

    root_thread,child_thread,report_thread=uid(),uid(),uid()
    native={'threadId':root_thread,'children':[{'threadId':child_thread,'status':'running','delivery':'waiting'}],'reports':[{'status':'running','state':{'threadId':report_thread}}]}
    sql('INSERT INTO desktop_codex_turns(request_id,user_id,thread_id,runtime_version,state) VALUES('+','.join(map(lit,[source['id'],user,root_thread,'0.163.0']))+','+obj(native)+')')
    rpc('desktop_checkpoint_chat',user,source['id'],'Parent finished','completed',None)
    for thread in [child_thread,report_thread]:
        assert jsonrpc('desktop_inspect_chat',user,source['id'],p_open,thread,normal['conversation_id'],0,0,1,10)['messages']
    for thread in [None,root_thread,uid()]:rpc('desktop_inspect_chats',user,source['id'],p_open,thread,'',20,0,fail=True)
    native['children'][0]['status']='cancelled'
    sql('UPDATE desktop_codex_turns SET state='+obj(native)+' WHERE request_id='+lit(source['id']))
    rpc('desktop_inspect_chats',user,source['id'],p_open,child_thread,'',20,0,fail=True)
    check('Independent running children and reports can inspect after parent completion; finished roots, stopped children and unrelated threads cannot.')

    sql('UPDATE desktop_projects SET memory_enabled=true WHERE id='+lit(p_open))
    sql('UPDATE chat_messages_v2 SET metadata=metadata||'+obj({'project':{'id':p_open,'memory_enabled':True},'options':{'permission':'ask'}})+' WHERE id='+lit(source['user_message_id']))
    assert rpc('desktop_project_memory_scope_access',user,source['id'],report_thread)==p_open
    assert rpc('desktop_validate_project_memory_scope',user,source['id'],report_thread,'{'+normal['assistant_message_id']+'}')=='t'
    for thread_id in [None,root_thread,child_thread,uid()]:rpc('desktop_project_memory_scope_access',user,source['id'],thread_id,fail=True)
    assert rpc('desktop_validate_project_memory_scope',user,source['id'],None,'{'+normal['assistant_message_id']+'}','false')=='t'
    rpc('desktop_validate_project_memory_scope',user,source['id'],None,'{'+normal['assistant_message_id']+'}','true',fail=True)
    sql('UPDATE desktop_projects SET memory_enabled=false WHERE id='+lit(p_open))
    rpc('desktop_validate_project_memory_scope',user,source['id'],report_thread,'{}',fail=True)
    check('Automatic project memory supports an active background scope after parent completion while retaining memory-off and source-scope checks.')

    inspection_receipt={'chat':{'conversation_id':normal['conversation_id']}}
    sql('INSERT INTO desktop_tool_calls(user_id,request_id,conversation_id,assistant_message_id,name,label,status,result,native_thread_id) VALUES('+','.join(map(lit,[user,source['id'],source['conversation_id'],source['assistant_message_id'],'read_chat','Read saved chat','completed']))+','+obj(inspection_receipt)+','+lit(report_thread)+')')
    rpc('desktop_validate_chat_inspection_receipts',user,source['id'],p_open,report_thread)
    sql('UPDATE desktop_project_chats SET project_id='+lit(p_isolated)+' WHERE conversation_id='+lit(normal['conversation_id']))
    rpc('desktop_validate_chat_inspection_receipts',user,source['id'],p_open,report_thread,fail=True)
    rpc('desktop_validate_chat_inspection',user,source['id'],p_open,report_thread,'{'+normal['conversation_id']+'}',fail=True)
    sql('UPDATE desktop_project_chats SET project_id='+lit(p_open)+' WHERE conversation_id='+lit(normal['conversation_id']))
    next_request=begin('INSPECTION later native turn',project=p_open)
    rpc('desktop_validate_chat_inspection_receipts',user,next_request['id'],p_open,root_thread)
    sql("UPDATE conversation_sessions SET session_state=session_state||'{\"desktop_archived\":true}' WHERE conversation_id="+lit(normal['conversation_id']))
    rpc('desktop_validate_chat_inspection_receipts',user,next_request['id'],p_open,root_thread,fail=True)
    assert json.loads(sql('SELECT result FROM desktop_tool_calls WHERE request_id='+lit(source['id'])))==inspection_receipt
    check('Saved receipts block later inference after a source is archived or isolated, including later requests in the same native branch; original receipts remain intact.')

    signatures=json.loads(sql("SELECT json_agg(p.oid::regprocedure::text) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname IN('desktop_chat_inspection_access','desktop_chat_inspection_summary','desktop_inspect_chats','desktop_inspect_chat','desktop_validate_chat_inspection','desktop_validate_chat_inspection_receipts','desktop_project_memory_scope_access','desktop_validate_project_memory_scope')"))
    assert len(signatures)==8
    for signature in signatures:
        for role in ['anon','authenticated']:assert sql('SELECT has_function_privilege('+lit(role)+','+lit(signature)+",'EXECUTE')")=='f'
        assert sql("SELECT has_function_privilege('service_role',"+lit(signature)+",'EXECUTE')")=='t'
    rpc_args=','.join(lit(v) for v in [user,next_request['id'],p_open,None,'',20,0])
    sql('SET ROLE authenticated; SELECT desktop_inspect_chats('+rpc_args+');',fail=True)
    check('Every new database function is denied to anonymous/authenticated clients and granted only to the trusted service role.')

    # Exercise the real desktop ToolService and bundled Codex against this copy.
    # The bridge has no production connection or arbitrary SQL operation.
    native_source=begin('Native transport source',project=p_open)
    native_target=begin('INSPECTION native transport '+uid(),project=p_open)
    rpc('desktop_checkpoint_chat',user,native_target['id'],'NATIVE-INSPECTION-RESULT','completed',None)
    native_title=sql('SELECT title FROM conversation_sessions WHERE conversation_id='+lit(native_target['conversation_id']))
    token=secrets.token_urlsafe(32)
    def bridge_value(value):
        if isinstance(value,dict):return obj(value)
        if isinstance(value,list):return lit('{'+','.join(str(uuid.UUID(v)) for v in value)+'}')
        return lit(value)
    class Bridge(http.server.BaseHTTPRequestHandler):
        def log_message(self,*args):pass
        def do_GET(self):
            if self.headers.get('Authorization')!='Bearer '+token:
                self.send_error(403);return
            self.send_response(200);self.send_header('Content-Length','5');self.end_headers();self.wfile.write(b'ready')
        def do_POST(self):
            if self.headers.get('Authorization')!='Bearer '+token:
                self.send_error(403);return
            try:
                length=int(self.headers.get('Content-Length','0'));assert 0<length<200000
                body=json.loads(self.rfile.read(length))
                if body['kind']=='rpc':
                    names={
                      'desktop_inspect_chats':{'p_user','p_request','p_project','p_thread','p_query','p_limit','p_offset'},
                      'desktop_inspect_chat':{'p_user','p_request','p_project','p_thread','p_chat','p_offset','p_message_offset','p_limit','p_characters'},
                      'desktop_validate_chat_inspection':{'p_user','p_request','p_project','p_thread','p_chats'},
                      'desktop_validate_chat_inspection_receipts':{'p_user','p_request','p_project','p_thread'}}
                    assert body['name'] in names and set(body['args'])==names[body['name']]
                    assert body['args']['p_user']==user and body['args']['p_request']==native_source['id']
                    value=sql('SELECT '+body['name']+'('+','.join(key+'=>'+bridge_value(value) for key,value in body['args'].items())+')')
                    data=json.loads(value) if value else None
                elif body['kind']=='table':
                    table=body['table'];operation=body['operation']
                    assert table in ['conversation_sessions','desktop_plans','desktop_tool_calls']
                    assert operation=='select' or table=='desktop_tool_calls' and operation in ['insert','update']
                    filters=body['filters'];assert all(re.fullmatch(r'[a-z_]+',key) for key,value in filters)
                    columns=body['columns'];assert columns=='*' or re.fullmatch(r'[a-z_,]+',columns)
                    conditions=' AND '.join('"'+key+'"='+lit(value) for key,value in filters) or 'true'
                    if operation=='select':
                        statement='SELECT coalesce(json_agg(t),\'[]\') FROM (SELECT '+columns+' FROM '+table+' WHERE '+conditions+') t'
                    else:
                        values=body['values'];assert all(re.fullmatch(r'[a-z_]+',key) for key in values)
                        if operation=='insert':
                            assert values['user_id']==user and values['request_id']==native_source['id']
                            change='INSERT INTO desktop_tool_calls('+','.join('"'+key+'"' for key in values)+') VALUES('+','.join(bridge_value(value) for value in values.values())+') RETURNING '+columns
                        else:
                            assert ['user_id',user] in filters
                            change='UPDATE desktop_tool_calls SET '+','.join('"'+key+'"='+bridge_value(value) for key,value in values.items())+' WHERE '+conditions+' RETURNING '+columns
                        statement='WITH changed AS ('+change+') SELECT coalesce(json_agg(t),\'[]\') FROM changed t'
                    rows=json.loads(sql(statement));data=rows[0] if body.get('single') and rows else None if body.get('single') else rows
                elif body['kind']=='control':
                    action=body['action'];thread=body.get('thread')
                    if action in ['bind_root','bind_child','stop_child']:str(uuid.UUID(thread))
                    if action=='bind_root':
                        sql('INSERT INTO desktop_codex_turns(request_id,user_id,thread_id,runtime_version,state) VALUES('+','.join(map(lit,[native_source['id'],user,thread,'0.163.0']))+','+obj({'threadId':thread})+')')
                    elif action=='bind_child':
                        rpc('desktop_checkpoint_chat',user,native_source['id'],'Parent finished','completed',None)
                        sql("UPDATE desktop_codex_turns SET state=state||"+obj({'children':[{'threadId':thread,'status':'running','delivery':'waiting'}]})+' WHERE request_id='+lit(native_source['id']))
                    elif action=='stop_child':
                        sql("UPDATE desktop_codex_turns SET state=state||"+obj({'children':[{'threadId':thread,'status':'cancelled','delivery':'failed'}]})+' WHERE request_id='+lit(native_source['id']))
                    elif action in ['archive','unarchive']:
                        sql('UPDATE conversation_sessions SET session_state=session_state||'+obj({'desktop_archived':action=='archive'})+' WHERE conversation_id='+lit(native_target['conversation_id']))
                    else:raise ValueError('Unknown fixture control')
                    data=None
                else:raise ValueError('Unknown fixture operation')
                reply={'data':data,'error':None}
            except Exception as error:
                if (out/'private-error.log').exists():
                    message=(out/'private-error.log').read_text().splitlines()[0]
                else:message=str(error)
                reply={'data':None,'error':{'message':message}}
            payload=json.dumps(reply,ensure_ascii=False).encode('utf-8')
            self.send_response(200);self.send_header('Content-Type','application/json');self.send_header('Content-Length',str(len(payload)));self.end_headers();self.wfile.write(payload)
    server=http.server.ThreadingHTTPServer(('127.0.0.1',0),Bridge)
    thread=threading.Thread(target=server.serve_forever,daemon=True);thread.start()
    windows=lambda value:'D:'+str(value)[6:].replace('/','\\') if str(value).startswith('/mnt/d/') else 'C:'+str(value)[6:].replace('/','\\')
    native_config=out/'private-native-config.json'
    native_config.write_text(json.dumps({'endpoint':'http://127.0.0.1:'+str(server.server_port),'token':token,'out':windows(out),'build':windows(root/'.supabase/desktop-chat-inspection/modules'),'resources':r'C:\Users\charl\AppData\Local\AgentopiaDesktop\app-0.44.17\resources\resources','user':user,'request':dict(native_source,project={'id':p_open,'memory_enabled':False}),'target':native_target['conversation_id'],'title':native_title}))
    try:
        native=subprocess.run([sys.argv[2],windows(root/'scripts/desktop/chat-inspection-native.cjs'),windows(native_config)],cwd=str(root),text=True,capture_output=True,timeout=90)
        (out/'private-native.log').write_text(native.stdout+'\n'+native.stderr)
        assert native.returncode==0,'Native transport failed; inspect private-native.log'
        native_evidence=json.loads(native.stdout.strip().splitlines()[-1]);assert native_evidence['success'] and native_evidence['liveInferenceRequests']==0
        evidence['native']=native_evidence
    finally:
        server.shutdown();server.server_close();thread.join(timeout=5)
        native_config.unlink()
    receipts=json.loads(sql('SELECT json_agg(json_build_object(\'name\',name,\'status\',status,\'native_thread_id\',native_thread_id)) FROM desktop_tool_calls WHERE request_id='+lit(native_source['id'])))
    assert sum(r['status']=='completed' for r in receipts)==3
    assert sum(r['status']=='failed' for r in receipts)==1
    check('Bundled Codex discovers and calls the real ToolService against PostgreSQL; receipts, source revocation, background-child and Chat only checks pass without inference.')
    evidence['checksPassed']=True
except Exception as error:
    evidence['error']=repr(error)
    (out/'private-traceback.log').write_text(traceback.format_exc())
finally:
    if created:
        sql('DROP DATABASE '+database,'postgres');evidence['disposableDatabaseRemoved']=True
    evidence['productionAfter']=inventory()
    evidence['productionInventoryUnchanged']=evidence['productionBefore']==evidence['productionAfter']
    evidence['success']=bool(evidence.get('checksPassed') and evidence.get('disposableDatabaseRemoved') and evidence['productionInventoryUnchanged'])
    (out/'evidence.json').write_text(json.dumps(evidence,indent=2))
print(json.dumps({'success':evidence['success'],'checks':len(evidence['checks']),'databaseRemoved':evidence.get('disposableDatabaseRemoved'),'productionInventoryUnchanged':evidence['productionInventoryUnchanged'],'providerRequests':0,'error':evidence.get('error')},indent=2));sys.exit(0 if evidence['success'] else 1)
