"""Verify the new in-app backup at the published private root, without restoring."""
from pathlib import Path
from native_index_reader import frozen_native_index
import datetime,glob,hashlib,json,ntpath,sqlite3,subprocess,sys,re
root=Path('/mnt/d/Users/charl/software/Agentopia');pointer=json.loads((root/'.supabase/desktop-profile-location/ordinary-agent-live47-current.json').read_text());out=Path(pointer['out'].replace('C:\\','/mnt/c/').replace('\\','/'));name=sys.argv[1];assert re.fullmatch(r'\d{4}-\d{2}-\d{2}T[\d-]+\.\d{3}Z-manual',name)
assert Path('/opt/agentopia/runtime-instance').read_text().strip()=='a91a4800-e08f-4440-a4ec-588762d01bfd'
base=Path('/mnt/c/Users/charl/.agentopia/desktop/profile/backups')/name;assert base.is_dir() and not base.is_symlink();manifest=json.loads((base/'manifest.json').read_text());files={}
for item in manifest['files']:
 assert item['name'] in ('auth.dump','application.dump','vault.dump','database.dump','recovery.dump','pgsodium_root.key') and item['name'] not in files
 file=base/item['name'];assert file.is_file() and not file.is_symlink()
 with file.open('rb') as f:digest=hashlib.file_digest(f,'sha256').hexdigest()
 assert digest==item['sha256'];files[item['name']]={'sha256':digest,'bytes':file.stat().st_size}
assert {'auth.dump','application.dump','vault.dump','pgsodium_root.key'}<=set(files)
binary=glob.glob('/home/agentopia/.supabase/cache/stack/slim-services/postgres/*/linux-amd64/*/bin/pg_restore')[0];dumps=0
for file in base.glob('*.dump'):
 result=subprocess.run([binary,'--list',str(file)],capture_output=True);assert result.returncode==0 and b'TABLE DATA' in result.stdout;dumps+=1
homes=threads=0
for file in (base/'codex').glob('*/*/*/state_5.sqlite'):
 with frozen_native_index(file) as connection:
  assert connection.execute('PRAGMA integrity_check').fetchone()==('ok',);rows=connection.execute('SELECT id,rollout_path FROM threads').fetchall()
 for identifier,path in rows:
  relative=ntpath.relpath(path.removeprefix(chr(92)*2+'?'+chr(92)),r'C:\Users\charl\.agentopia\desktop\profile');assert not relative.startswith('..');rollout=base.joinpath(*relative.split('\\'));assert rollout.is_file() and not rollout.is_symlink()
  with rollout.open(encoding='utf-8') as f:meta=json.loads(f.readline())
  assert meta['type']=='session_meta' and meta['payload']['id']==identifier;threads+=1
 homes+=1
assert homes>=114 and threads>=146
receipt={'success':True,'at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'backup':str(base),'logicalFiles':files,'logicalArchivesReadable':dumps,'nativeHomes':homes,'nativeThreads':threads,'providerRequests':0,'profileWindowsSessionFilesCopied':False,'fullColdRuntimeImageCopied':False,'scope':'In-app current SQL/key/native-state backup verified at the published private profile. A fresh closed full-profile/runtime checkpoint remains required before installation.'}
receipt['receipt']=str(out/('active-logical-backup-'+name+'.json'))
with Path(receipt['receipt']).open('x') as f:json.dump(receipt,f,indent=2)
print(json.dumps({k:v for k,v in receipt.items() if k!='logicalFiles'}))
