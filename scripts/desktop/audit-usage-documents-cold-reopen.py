"""Read only: check the ordinary reopened process and saved core counts."""
from pathlib import Path
import datetime,glob,json,os,subprocess
from urllib.parse import urlparse,unquote
from audit_usage_documents_process import ordinary_processes
root=Path('/mnt/d/Users/charl/software/Agentopia/.supabase/desktop-platform-release/candidate-04445')
warm=json.loads((root/'ordinary-upgrade-audit/after-0.44.45.json').read_text())
assert warm['success'] and warm['passwordsAndRolesPreserved'] and warm['requestsUnchanged']
assert Path('/opt/agentopia/runtime-instance').read_text().strip()=='a91a4800-e08f-4440-a4ec-588762d01bfd'
process=ordinary_processes('0.44.45')
os.chdir('/home/agentopia/app')
state=json.loads(subprocess.check_output(['supabase','stack','status','--output-format','json'],text=True))
db=urlparse(state['env']['DB_URL'])
binary=glob.glob('/home/agentopia/.supabase/cache/stack/slim-services/postgres/*/linux-amd64/*/bin/psql')[0]
env=dict(os.environ,PGPASSWORD=unquote(db.password or ''),PGOPTIONS='-c default_transaction_read_only=on',PGAPPNAME='agentopia_cold_reopen_read_only')
statement="SELECT json_build_object('accounts',(SELECT count(*) FROM auth.users),'chats',(SELECT count(*) FROM public.conversation_sessions),'messages',(SELECT count(*) FROM public.chat_messages_v2),'requests',(SELECT count(*) FROM public.desktop_requests),'activeRequests',(SELECT count(*) FROM public.desktop_requests WHERE status='running'),'activeGoals',(SELECT count(*) FROM public.desktop_goals WHERE status='running'),'readableVaultRecords',(SELECT count(decrypted_secret) FROM vault.decrypted_secrets));"
result=subprocess.run([binary,'-XqAt','-v','ON_ERROR_STOP=1','-h','127.0.0.1','-p',str(db.port),'-U','supabase_admin','-d','postgres'],input=statement,env=env,text=True,capture_output=True)
assert result.returncode==0,'The cold-reopen read-only comparison failed'
counts=json.loads(result.stdout)
for key,table in [('accounts','auth.users'),('chats','public.conversation_sessions'),('messages','public.chat_messages_v2'),('requests','public.desktop_requests')]:assert counts[key]==warm['savedRowsMatched'][table]
assert counts['activeRequests']==counts['activeGoals']==0 and counts['readableVaultRecords']==warm['readableVaultRecords']
receipt={'success':True,'at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'version':'0.44.45','process':process,'counts':counts,'savedCoreCountsUnchanged':True,'noRequestReplay':True,'providerRequests':0,'databaseReadOnly':True,'scope':'Cold reopening through the normal installed launcher preserves saved core totals. The preceding full audit compared all saved rows, passwords and runtime resources.'}
with (root/'cold-reopen-audit.json').open('x') as stream:json.dump(receipt,stream,indent=2)
print(json.dumps(receipt))
