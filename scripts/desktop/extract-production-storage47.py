"""Extract a checked storage slice from the fresh closed production recovery."""
from pathlib import Path,PurePosixPath
import hashlib,importlib.util,json,sys,tarfile
spec=importlib.util.spec_from_file_location('storage_extract_policy',Path(__file__).with_name('extract-storage-preflight.py'))
policy=importlib.util.module_from_spec(spec);spec.loader.exec_module(policy)
selected,counts,digest=policy.selected,policy.counts,policy.digest

root=Path(__file__).resolve().parents[2]
pointer=json.loads((root/'.supabase/desktop-platform-release/candidate-04447/profile-migration-backup.json').read_text(encoding='utf-8'))
assert pointer['success']
recovery=Path(pointer['out']).resolve()
assert recovery.parent==Path('C:/Users/charl/AgentopiaRecovery/before-private-profile-04447').resolve()
out=Path(sys.argv[1]).resolve();assert out.parent==Path('C:/Users/charl/AgentopiaQA/storage-preflight').resolve() and out.name.isdigit()
archive=recovery/'ordinary-current.tar';manifest=json.loads((recovery/'private-profile-ordinary.json').read_text(encoding='utf-8'))
assert manifest['success'] and digest(archive)==manifest['archiveSha256']
files={name:row for name,row in manifest['manifest']['files'].items() if selected(name)}
assert all(name in files for name in ('credentials.bin','Local State','Preferences'))
target=out/'profiles/recovery-source-production47';assert not target.exists();target.mkdir(parents=True)
# A persistent session with zero cookies still participates in the comparison.
for name in manifest['manifest']['files']:
 parts=PurePosixPath(name).parts
 if len(parts)>2 and parts[0]=='Partitions':
  assert __import__('re').fullmatch(r'[a-zA-Z0-9_.-]{1,200}',parts[1]);(target/'Partitions'/parts[1]).mkdir(parents=True,exist_ok=True)
found=set()
with tarfile.open(archive) as tar:
 for member in tar:
  if member.name not in files:continue
  name=PurePosixPath(member.name);assert member.isfile() and not member.issym() and not member.islnk() and not name.is_absolute() and all(x not in ('','.','..') for x in name.parts) and member.name not in found
  data=tar.extractfile(member).read();assert len(data)==member.size==files[member.name]['bytes'] and hashlib.sha256(data).hexdigest()==files[member.name]['sha256']
  file=target.joinpath(*name.parts);assert file.resolve().is_relative_to(target.resolve());file.parent.mkdir(parents=True,exist_ok=True)
  with file.open('xb') as stream:stream.write(data)
  found.add(member.name)
assert found==set(files)
receipt={'success':True,'recovery':str(recovery),'profile':str(target),'archiveSha256':manifest['archiveSha256'],'files':len(files),'cookieDatabases':counts(target),'nativeAuthConfigExcluded':True,'providerRequests':0}
with (out/'production47-extraction.json').open('x',encoding='utf-8') as f:json.dump(receipt,f,indent=2)
print(json.dumps({'success':True,'files':len(files),'cookieDatabases':len(receipt['cookieDatabases'])}))
