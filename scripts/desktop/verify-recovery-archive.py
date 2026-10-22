import hashlib,json,sys,tarfile
from pathlib import Path,PurePosixPath
archive,source=Path(sys.argv[1]),Path(sys.argv[2])
files,critical,total,known=0,0,0,{}
with tarfile.open(archive,'r|') as stream:
 for member in stream:
  relative=PurePosixPath(member.name)
  assert not relative.is_absolute() and '..' not in relative.parts
  if relative.parts and relative.parts[0]=='codex':
   inner=relative.parts[4:]
   assert not inner or inner[0] not in ('tmp','.tmp')
   assert inner[:2]!=('skills','.system')
  if member.isdir(): continue
  assert member.isfile() or member.islnk(), 'Unexpected linked or special archive entry'
  if member.islnk():
   target=str(PurePosixPath(member.linkname));assert target in known
   size,digest=known[target]
  else:
   digest=hashlib.sha256();size=0
   with stream.extractfile(member) as data:
    for chunk in iter(lambda:data.read(1024*1024),b''): digest.update(chunk);size+=len(chunk)
   assert size==member.size
   digest=digest.hexdigest()
  known[str(relative)]=(size,digest);files+=1;total+=size
  name=relative.name
  if name in {'credentials.bin','Local State','Preferences','runtime-binding.json','window.json','.agentopia-native-relocation.json'} or '.sqlite' in name or name.endswith('.jsonl') or relative.parts[0]=='attachments':
   original=source.joinpath(*relative.parts)
   actual=hashlib.sha256()
   with original.open('rb') as data:
    for chunk in iter(lambda:data.read(1024*1024),b''): actual.update(chunk)
   assert original.stat().st_size==size and actual.hexdigest()==digest
   critical+=1
assert files>0 and critical>0
assert any(PurePosixPath(name).name=='credentials.bin' for name in known)
print(json.dumps({'success':True,'files':files,'bytes':total,'criticalFilesComparedToSource':critical,'archiveReadCompletely':True}))
