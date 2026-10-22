import glob,json,os,re,subprocess,sys
from pathlib import Path
from urllib.parse import urlparse,unquote
os.umask(0o077)
base=Path(sys.argv[1]).resolve();assert base.parent==Path('/mnt/c/Users/charl/AgentopiaQA/plugin-compatibility') and re.fullmatch(r'\d{13}',base.name)
cfg=json.loads((base/'intent.json').read_text());e=json.loads((base/'evidence.json').read_text());assert cfg['version']=='0.44.33' and not e['success'];assert Path('/opt/agentopia/runtime-instance').read_text().strip()==cfg['instanceId']
out=Path(sys.argv[2]).resolve();assert out.parent==base and out.name.startswith('background-diagnosis-')
os.chdir('/home/agentopia/app')
def command(args,label,timeout=240):
    result=subprocess.run(args,text=True,capture_output=True,timeout=timeout);(out/('private-'+label+'.log')).write_text(result.stdout+'\n'+result.stderr)
    assert result.returncode==0,label+' failed; inspect private log'
    return result.stdout
try:
    command(['supabase','start','--runtime','native','--eager','--exclude','analytics,pooler,studio'],'backend-start')
    state=json.loads(subprocess.check_output(['supabase','stack','status','--output-format','json'],text=True));url=urlparse(state['env']['DB_URL']);assert url.port==cfg['ports']['database']
    binary=glob.glob('/home/agentopia/.supabase/cache/stack/slim-services/postgres/*/linux-amd64/*/bin/psql')[0]
    owner=e['fixtureUser'];conversation=e['backgroundCommands']['A']['conversation'];assert all(re.fullmatch(r'[a-f0-9-]{36}',x) for x in [owner,conversation])
    statement="SELECT coalesce(json_agg(json_build_object('request_id',t.request_id,'status',r.status,'state',t.state)),'[]') FROM desktop_codex_turns t JOIN desktop_requests r ON r.id=t.request_id WHERE r.user_id='"+owner+"' AND r.conversation_id='"+conversation+"';"
    env=dict(os.environ,PGPASSWORD=unquote(url.password or ''),PGOPTIONS='-c default_transaction_read_only=on',PGAPPNAME='agentopia_background_failure_inspection')
    result=subprocess.run([binary,'-XqAt','-v','ON_ERROR_STOP=1','-h','127.0.0.1','-p',str(url.port),'-U','supabase_admin','-d','postgres'],input=statement,env=env,text=True,capture_output=True);assert result.returncode==0,'Read-only receipt query failed'
    rows=json.loads(result.stdout);(out/'private-native-turns.json').write_text(json.dumps(rows))
    summaries=[{'request':r['request_id'],'status':r['status'],'commands':[{'background':x.get('background'),'completed':x.get('completed'),'status':x['item'].get('status')} for x in r['state'].get('items',[]) if x['item'].get('type')=='commandExecution']} for r in rows]
    audit=json.loads(command(['python3',str(base/'audit-coordination-runtime.py'),str(base)],'preservation-audit',90));assert audit['success']
    answer={'success':True,'rows':summaries,'audit':audit,'sqlWrites':0,'applicationStarted':False,'modelRequests':0};(out/'query-evidence.json').write_text(json.dumps(answer));print(json.dumps(answer))
finally:
    command(['supabase','stop'],'backend-stop',120)
