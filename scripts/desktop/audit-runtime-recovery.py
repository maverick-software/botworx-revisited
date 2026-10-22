import glob,hashlib,json,os,subprocess,sys
from pathlib import Path
from urllib.parse import urlparse,unquote
assert Path('/opt/agentopia/runtime-instance').read_text().strip()=='a91a4800-e08f-4440-a4ec-588762d01bfd'
os.chdir('/home/agentopia/app')
state=json.loads(subprocess.check_output(['supabase','stack','status','--output-format','json'],text=True));assert state['runtime']=='native'
url=urlparse(state['env']['DB_URL']);binary=glob.glob('/home/agentopia/.supabase/cache/stack/slim-services/postgres/*/linux-amd64/*/bin/psql')[0]
env=dict(os.environ,PGPASSWORD=unquote(url.password or ''),PGOPTIONS='-c default_transaction_read_only=on',PGAPPNAME='agentopia_runtime_recovery_read_only_audit')
def query(sql):
 result=subprocess.run([binary,'-XqAt','-v','ON_ERROR_STOP=1','-h','127.0.0.1','-p',str(url.port),'-U','supabase_admin','-d','postgres'],input=sql+';\n',text=True,env=env,capture_output=True)
 assert result.returncode==0,'Read-only database audit failed'
 return result.stdout.strip()
inventory={}
for label,sql in {
 'accounts':"SELECT id::text||':'||md5(encrypted_password) FROM auth.users ORDER BY id",
 'profiles':'SELECT md5(to_jsonb(p)::text) FROM profiles p ORDER BY id',
 'roles':'SELECT md5(to_jsonb(p)::text) FROM user_roles p ORDER BY user_id,role_id',
 'conversations':'SELECT md5(to_jsonb(p)::text) FROM conversation_sessions p ORDER BY conversation_id',
 'messages':'SELECT md5(to_jsonb(p)::text) FROM chat_messages_v2 p ORDER BY id'
}.items():
 rows=query(sql).splitlines();inventory[label]={'count':len(rows),'sha256':hashlib.sha256('\n'.join(rows).encode()).hexdigest()}
result={'success':True,'inventory':inventory,'schema':int(query('SELECT count(*) FROM agentopia_desktop.migrations')),'readableVaultRecords':int(query('SELECT count(decrypted_secret) FROM vault.decrypted_secrets')),'runningRequests':int(query("SELECT count(*) FROM desktop_requests WHERE status='running'")),'runningGoals':int(query("SELECT count(*) FROM desktop_goals WHERE status='running'")),'services':[{'name':service['service'],'health':service['health'],'state':service['state']} for service in state['services']]}
assert result['schema']==59 and inventory['accounts']['count']==2 and inventory['conversations']['count']==103 and inventory['messages']['count']==356 and result['readableVaultRecords']==190
Path(sys.argv[1]).write_text(json.dumps(result,indent=2))
print(json.dumps(result))
