"""Single-variable diagnostic on the already imported, disposable backend."""
from pathlib import Path
import glob,json,os,subprocess,time
from urllib.parse import urlparse,unquote
out=Path('/mnt/f/Agentopia/.supabase/desktop-layout-fresh-runtime/1792524017111');assert Path('/opt/agentopia/runtime-instance').read_text().strip()=='bc0b49b6-9741-49b1-b42b-af2e6ce4ae99'
intent=json.loads((out/'intent.json').read_text());os.chdir('/home/agentopia/app');events=[]
with (out/'private-statistics-start.log').open('x') as log:
    process=subprocess.Popen(['supabase','start','--runtime','native','--eager','--exclude','analytics,pooler,studio'],stdout=log,stderr=log,text=True)
    deadline=time.monotonic()+240;analyzed=False
    while process.poll() is None and time.monotonic()<deadline:
        state=json.loads(subprocess.check_output(['supabase','stack','status','--output-format','json'],text=True))
        if not analyzed and state.get('env',{}).get('DB_URL') and any(r['service']=='database' and r['health']=='healthy' for r in state['services']):
            db=urlparse(state['env']['DB_URL']);assert db.port==intent['ports']['database'];binary=glob.glob('/home/agentopia/.supabase/cache/stack/slim-services/postgres/*/linux-amd64/*/bin/psql')[0]
            env=dict(os.environ,PGPASSWORD=unquote(db.password or ''));args=[binary,'-XqAt','-v','ON_ERROR_STOP=1','-h','127.0.0.1','-p',str(db.port),'-U','supabase_admin','-d','postgres']
            # Counts prove this is the committed restored copy before touching statistics.
            before=subprocess.run(args,input="SELECT json_build_object('accounts',(SELECT count(*) FROM auth.users),'importCommitted',(SELECT count(*) FROM agentopia_desktop.imports),'catalogStats',(SELECT count(*) FROM pg_stats WHERE schemaname='pg_catalog'));",text=True,env=env,capture_output=True,check=True,timeout=20)
            counts=json.loads(before.stdout);assert counts['accounts']==2 and counts['importCommitted']==1;events.append({'before':counts})
            start=time.monotonic();subprocess.run(args,input='ANALYZE;',text=True,env=env,capture_output=True,check=True,timeout=120);analyzed=True;events.append({'analyzeSeconds':round(time.monotonic()-start,3)});print(json.dumps(events[-1]),flush=True)
        time.sleep(1)
    if process.poll() is None:process.terminate();process.wait(timeout=15)
    state=json.loads(subprocess.check_output(['supabase','stack','status','--output-format','json'],text=True));services=[{k:r[k]for k in ('service','state','health')}for r in state['services']]
    report={'at':time.time(),'processExit':process.returncode,'analyzed':analyzed,'events':events,'services':services,'productionChanged':False,'providerRequests':0};(out/'statistics-probe.json').write_text(json.dumps(report,indent=2));print(json.dumps(report))
