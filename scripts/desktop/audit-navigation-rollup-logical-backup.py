"""Read-only physical verification of the ordinary app's new logical backup."""
from pathlib import Path
import datetime,glob,hashlib,json,subprocess
assert Path('/opt/agentopia/runtime-instance').read_text().strip()=='a91a4800-e08f-4440-a4ec-588762d01bfd'
base=Path('/mnt/c/Users/charl/AppData/Roaming/Agentopia/backups/2026-10-19T23-32-07.878Z-manual')
assert base.is_dir() and not base.is_symlink()
files={}
for file in sorted(base.rglob('*')):
 assert not file.is_symlink()
 if file.is_file():
  with file.open('rb') as f:digest=hashlib.file_digest(f,'sha256').hexdigest()
  files[str(file.relative_to(base))]={'bytes':file.stat().st_size,'sha256':digest}
assert files
binary=glob.glob('/home/agentopia/.supabase/cache/stack/slim-services/postgres/*/linux-amd64/*/bin/pg_restore')[0]
dumps=list(base.rglob('*.dump'));assert len(dumps)>=2
for file in dumps:
 p=subprocess.run([binary,'--list',str(file)],capture_output=True)
 assert p.returncode==0 and b'TABLE DATA' in p.stdout,'Logical archive cannot be read'
result={'success':True,'at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'backup':str(base),'files':files,'logicalArchivesReadable':len(dumps),'productionProfileMoved':False,'providerRequests':0,'scope':'Fresh logical database backup only; a stopped full profile/runtime recovery remains required before installation.'}
out=Path('/mnt/d/Users/charl/software/Agentopia/.supabase/desktop-platform-release/candidate-04447/fresh-logical-backup.json')
with out.open('x') as f:json.dump(result,f,indent=2)
print(json.dumps({k:v for k,v in result.items() if k!='files'}))
