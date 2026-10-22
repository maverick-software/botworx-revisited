from pathlib import Path
import json, subprocess, sys, time
assert sys.argv[1]=='c8614862-e038-4d37-ad42-15306be60134'
assert Path('/opt/agentopia/runtime-instance').read_text().strip()==sys.argv[1]
assert Path('/opt/agentopia/runtime-identity').read_text().strip()=='local.agentopia.desktop-runtime.v1'
destination=Path(sys.argv[2]);assert destination.is_relative_to(Path('/mnt/f/Agentopia/.supabase/desktop-release-04450/1792541639365/capability8-restore/1792542915243'))
started=time.monotonic()
try:
    result=subprocess.run(['supabase','start','--runtime','native','--eager','--exclude','analytics,pooler,studio'],cwd='/home/agentopia/app',capture_output=True,text=True,timeout=245)
    record={'completed':True,'exit':result.returncode,'seconds':time.monotonic()-started,'stdout':result.stdout,'stderr':result.stderr,'startsOnlyOwnedTestServices':True,'productionChanged':False}
except subprocess.TimeoutExpired as error:
    record={'completed':False,'seconds':time.monotonic()-started,'stdout':(error.stdout or b'').decode(errors='replace') if isinstance(error.stdout,bytes) else error.stdout,'stderr':(error.stderr or b'').decode(errors='replace') if isinstance(error.stderr,bytes) else error.stderr,'startsOnlyOwnedTestServices':True,'productionChanged':False}
destination.write_text(json.dumps(record,indent=2))
print(json.dumps({key:record[key] for key in ['completed','seconds','startsOnlyOwnedTestServices','productionChanged']}|{'exit':record.get('exit')}),flush=True)
