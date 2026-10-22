"""Independently verify recoverable data, then publish a Office editing instructions without changing the UI."""
from pathlib import Path, PurePosixPath
import datetime,hashlib,json,shutil,subprocess,tarfile
root=Path('/mnt/d/Users/charl/software/Agentopia')
def load(p):return json.loads(Path(p).read_text(encoding='utf-8-sig'))
def mounted(p):
 assert len(p)>3 and p[1]==':'
 return Path('/mnt/'+p[0].lower()+p[2:].replace('\\','/'))
def sha(p):
 with Path(p).open('rb') as f:return hashlib.file_digest(f,'sha256').hexdigest()
def closed():
 result=subprocess.run(['/mnt/c/Windows/System32/WindowsPowerShell/v1.0/powershell.exe','-NoProfile','-NonInteractive','-Command','@(Get-Process Agentopia,AgentopiaSetup -ErrorAction SilentlyContinue).Count'],text=True,capture_output=True,check=True)
 assert result.stdout.strip()=='0','Agentopia must remain normally closed'
pointer=load(root/'.supabase/desktop-chat-output-edits/current.json');work=mounted(pointer['work'])
assert work.parent==Path('/mnt/c/Users/charl/AgentopiaQA/chat-output-edits') and work.resolve()==work
proof=load(mounted(pointer['proof']));recovery=load(work/'recovery.json')
assert proof['success'] and proof['backendTests']==22 and proof['uiUnchanged'] and not proof['installed']
assert proof['changedArchiveEntries']==['build/chat-files.js']
assert sha(mounted(proof['testLog']))==proof['testLogSha256']
for name,digest in proof['tests'].items():assert sha(work/'candidate-tests'/name)==digest
q=load(mounted(pointer['qualification']));assert q['success'] and q['checks']==22 and sha(mounted(pointer['proof']))==q['proofSha256']
for receipt in q['receipts']:assert sha(mounted(receipt['file']))==receipt['sha256']
before=mounted(recovery['out']);assert before.parent==Path('/mnt/c/Users/charl/AgentopiaRecovery/chat-output-edits-13') and before.resolve()==before
assert recovery['success'] and recovery['logicalBackupVerified'] and recovery['logicalDatabaseEqualityVerified'] and not recovery['currentColdImageCaptured']
manifest=load(before/'private-profile.json');archive=before/'active-profile.tar.gz';assert manifest['success'] and sha(archive)==manifest['archiveSha256']==recovery['profileArchiveSha256']
expected=manifest['manifest'];files={};directories=set();seen=set()
with tarfile.open(archive,mode='r|gz') as tar:
 for member in tar:
  name=member.name.rstrip('/');parsed=PurePosixPath(name)
  assert name and not parsed.is_absolute() and str(parsed)==name and '..' not in parsed.parts and '\\' not in name and ':' not in name and name.lower() not in seen
  seen.add(name.lower())
  if member.isdir():assert name in expected['directories'];directories.add(name)
  else:
   assert member.isfile() and name in expected['files']
   with tar.extractfile(member) as f:files[name]={'bytes':member.size,'sha256':hashlib.file_digest(f,'sha256').hexdigest()}
assert files=={n:{'bytes':f['bytes'],'sha256':f['sha256']} for n,f in expected['files'].items()} and directories==set(expected['directories'])
assert len(files)==recovery['profileFiles'] and {'Local State','credentials.bin','runtime-binding.json','profile-migration.json'}<=set(files)
logical=load(before/'current-database-backup/manifest.json');assert len(logical['files'])==5
for f in logical['files']:assert sha(before/'current-database-backup'/f['name'])==f['sha256']
data=load(mounted(recovery['dataComparison']));assert data['success'] and data['tableCount']==126 and not data['mismatches']
assert datetime.datetime.now(datetime.timezone.utc)-datetime.datetime.fromisoformat(data['at'])<datetime.timedelta(minutes=15)
base=load(mounted(proof['baseReopened']));assert base['success'] and base['normalReopeningPassed'] and base['revision']=='document-refresh-12' and base['imageSha256']==proof['baseImageSha256']==recovery['beforeArchiveSha256']
source=mounted(proof['source']);old=mounted(load(mounted(proof['baseProof']))['source']);changed=[]
for name,digest in proof['sourceHashes'].items():
 assert sha(source/name)==digest
 if (name.startswith('src/') or name.startswith('ui/')) and (not (old/name).exists() or sha(old/name)!=digest):changed.append(name)
assert sorted(changed)==sorted(proof['changedSourceFiles'])
installed=Path('/mnt/c/Users/charl/AppData/Local/AgentopiaDesktop/app-0.44.47/resources');assert installed.resolve()==installed
assert sha(installed/'app.asar')==proof['baseImageSha256']==sha(mounted(recovery['beforeArchive']))
resources=installed/'resources'
for name,digest in base['resourceFiles'].items():
 if name.startswith('ui/'):
  assert sha(resources/name)==digest==sha(mounted(recovery['beforeUi'])/name[3:])
 if name=='runtime/Restore-Agentopia.ps1':assert sha(resources/name)==digest
assert sha(mounted(recovery['scope']['locationFile']))==recovery['scope']['locationSha256']
ui=mounted(proof['ui']);new_archive=mounted(proof['image']);assert sha(new_archive)==proof['imageSha256']
for name,digest in proof['uiHashes'].items():assert sha(ui/name)==digest
current=installed/'app.asar';pending=installed/'app-exports13-pending.asar';rollback=installed/'app-before-exports13.asar';failed=installed/'app-exports13-failed.asar'
for p in [pending,rollback,failed]:assert not p.exists()
closed();assert shutil.disk_usage(installed).free>new_archive.stat().st_size+1024**3
shutil.copyfile(new_archive,pending);assert sha(pending)==proof['imageSha256']
closed();current.rename(rollback)
try:
 pending.rename(current);assert sha(current)==proof['imageSha256']
except BaseException:
 if current.exists():current.rename(failed)
 rollback.rename(current);raise
resource_files={n:h for n,h in base['resourceFiles'].items() if not n.startswith('ui/')};resource_files.update({'ui/'+n:h for n,h in proof['uiHashes'].items()})
receipt={'success':True,'at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'version':'0.44.47','revision':proof['revision'],'imageSha256':proof['imageSha256'],'baseImageSha256':proof['baseImageSha256'],'resourceFiles':resource_files,'resourceManifestSha256':hashlib.sha256(json.dumps(resource_files,sort_keys=True,separators=(',',':')).encode()).hexdigest(),'uiFiles':len(proof['uiHashes']),'rollbackUi':recovery['beforeUi'],'rollbackArchive':str(rollback),'recovery':str(before),'profileFiles':len(files),'independentArchiveVerification':True,'providerRequests':0,'nativeAcceptancePending':True,'fullInstallerCreated':False,'currentColdImageCaptured':False,'fullGoalComplete':False}
with (work/'installed.json').open('x') as f:json.dump(receipt,f,indent=2)
print(json.dumps({k:v for k,v in receipt.items() if k!='resourceFiles'}))
