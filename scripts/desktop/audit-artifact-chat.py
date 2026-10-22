"""Read-only observation of one generated ordinary-installed artifact chat."""
import glob, hashlib, json, os, subprocess
from pathlib import Path
from urllib.parse import urlparse, unquote

root=Path('/mnt/d/Users/charl/software/Agentopia')
out=root/'.supabase/desktop-artifact-authoring/chat-1792364219213'
assert (out/'submission-prepared.json').is_file()
assert Path('/opt/agentopia/runtime-instance').read_text().strip()=='a91a4800-e08f-4440-a4ec-588762d01bfd'
os.chdir('/home/agentopia/app')
state=json.loads(subprocess.check_output(['supabase','stack','status','--output-format','json'],text=True))
db=urlparse(state['env']['DB_URL'])
binary=Path(glob.glob('/home/agentopia/.supabase/cache/stack/slim-services/postgres/*/linux-amd64/*/bin/psql')[0]).parent
env=dict(os.environ,PGPASSWORD=unquote(db.password or ''),PGOPTIONS='-c default_transaction_read_only=on',PGAPPNAME='agentopia_generated_artifact_chat_audit')
query="""SELECT coalesce(json_agg(json_build_object(
 'request',to_jsonb(r),'userMessage',to_jsonb(u),'assistantMessage',to_jsonb(a),
 'native',to_jsonb(n),'threads',(SELECT json_agg(to_jsonb(t)) FROM desktop_codex_threads t WHERE t.conversation_id=r.conversation_id AND t.user_id=r.user_id))), '[]'::json)
 FROM desktop_requests r JOIN chat_messages_v2 u ON u.id=r.user_message_id
 LEFT JOIN chat_messages_v2 a ON a.id=r.assistant_message_id
 LEFT JOIN desktop_codex_turns n ON n.request_id=r.id
 WHERE r.user_id='9bf808b8-96a9-441d-b63c-eb835eb784c4'
 AND u.content->>'text' LIKE '%ARTIFACT-CHAT-1792364219213%';"""
p=subprocess.run([str(binary/'psql'),'-XqAt','-v','ON_ERROR_STOP=1','-h','127.0.0.1','-p',str(db.port),'-U','supabase_admin','-d','postgres','-c',query],text=True,capture_output=True,env=env)
assert p.returncode==0,'Read-only generated-chat observation failed'
rows=json.loads(p.stdout);assert len(rows)==1, 'Expected exactly one submitted generated request'
row=rows[0];assert row['request']['status'] in ('running','completed','failed','cancelled','interrupted')
from datetime import datetime,timezone
at=datetime.now(timezone.utc);name='observation-'+str(int(at.timestamp()*1000))+'.json'
record={'at':at.isoformat(),'readOnly':True,'scope':'One generated ordinary-installed request; no inference or credential mutation','data':row}
(out/name).write_text(json.dumps(record,indent=2),encoding='utf-8')
items=(row.get('native') or {}).get('state',{}).get('items',[])
print(json.dumps({'file':str(out/name),'requestId':row['request']['id'],'conversationId':row['request']['conversation_id'],'status':row['request']['status'],'error':row['request']['error'],'runtimeVersion':(row.get('native') or {}).get('runtime_version'),'items':[{'type':x.get('item',{}).get('type'),'status':x.get('item',{}).get('status')} for x in items]}))
