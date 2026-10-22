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
pointer=load(root/'.supabase/desktop-document-refresh/current.json');work=mounted(pointer['work'])
assert work.parent==Path('/mnt/c/Users/charl/AgentopiaQA/document-refresh') and work.resolve()==work
proof=load(mounted(pointer['proof']));recovery=load(work/'recovery.json')
q=load(mounted(pointer['productionQualification']))
assert proof['success'] and proof['backendWorkflowGroups']==6 and proof['interfaceWorkflowGroups']==12 and not proof['installed']
assert proof['changedArchiveEntries']==['build/broker.js','build/workspace-monitor.js']
assert q['success'] and q['checks']==21 and q['totalUniqueWorkflowGroups']==39 and sha(mounted(pointer['proof']))==q['proofSha256']
for receipt in q['receipts']:assert sha(mounted(receipt['file']))==receipt['sha256']
before=mounted(recovery['out']);assert before.parent==Path('/mnt/c/Users/charl/AgentopiaRecovery/document-refresh-12') and before.resolve()==before
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
base=load(mounted(proof['baseReopened']));assert base['success'] and base['normalReopeningPassed'] and base['revision']=='office-pane-11' and base['imageSha256']==proof['baseImageSha256']==recovery['beforeArchiveSha256']
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
current=installed/'app.asar';pending=installed/'app-refresh12-pending.asar';rollback=installed/'app-before-refresh12.asar';failed=installed/'app-refresh12-failed.asar'
current_ui=resources/'ui';pending_ui=resources/'ui-refresh12-pending';rollback_ui=resources/'ui-before-refresh12';failed_ui=resources/'ui-refresh12-failed'
for p in [pending,rollback,failed,pending_ui,rollback_ui,failed_ui]:assert not p.exists()
closed();budget=new_archive.stat().st_size+sum(p.stat().st_size for p in ui.rglob('*') if p.is_file());assert shutil.disk_usage(installed).free>budget+1024**3
shutil.copyfile(new_archive,pending);assert sha(pending)==proof['imageSha256'];shutil.copytree(ui,pending_ui)
for name,digest in proof['uiHashes'].items():assert sha(pending_ui/name)==digest
closed();moved_archive=False;moved_ui=False
try:
 current.rename(rollback);moved_archive=True;current_ui.rename(rollback_ui);moved_ui=True
 pending.rename(current);pending_ui.rename(current_ui)
 assert sha(current)==proof['imageSha256']
 for name,digest in proof['uiHashes'].items():assert sha(current_ui/name)==digest
except BaseException:
 if moved_archive:
  if current.exists():current.rename(failed)
  rollback.rename(current)
 if moved_ui:
  if current_ui.exists():current_ui.rename(failed_ui)
  rollback_ui.rename(current_ui)
 raise
resource_files={n:h for n,h in base['resourceFiles'].items() if not n.startswith('ui/')};resource_files.update({'ui/'+n:h for n,h in proof['uiHashes'].items()})
receipt={'success':True,'at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'version':'0.44.47','revision':proof['revision'],'imageSha256':proof['imageSha256'],'baseImageSha256':proof['baseImageSha256'],'resourceFiles':resource_files,'resourceManifestSha256':hashlib.sha256(json.dumps(resource_files,sort_keys=True,separators=(',',':')).encode()).hexdigest(),'uiFiles':len(proof['uiHashes']),'rollbackUi':str(rollback_ui),'rollbackArchive':str(rollback),'recovery':str(before),'profileFiles':len(files),'independentArchiveVerification':True,'providerRequests':0,'nativeAcceptancePending':True,'fullInstallerCreated':False,'currentColdImageCaptured':False,'fullGoalComplete':False}
with (work/'installed.json').open('x') as f:json.dump(receipt,f,indent=2)
print(json.dumps({k:v for k,v in receipt.items() if k!='resourceFiles'}))
