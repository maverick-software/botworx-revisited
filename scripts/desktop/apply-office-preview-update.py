"""Apply only the exact qualified Office archive/UI with a closed app and rollback."""
from pathlib import Path
import json,hashlib,datetime,subprocess,shutil,os,sys
root=Path('/mnt/d/Users/charl/software/Agentopia')
def load(p):return json.loads(Path(p).read_text(encoding='utf-8-sig'))
def mounted(value):
 assert len(value)>3 and value[1]==':'
 return Path('/mnt/'+value[0].lower()+value[2:].replace('\\','/'))
def sha(p):
 with Path(p).open('rb') as f:return hashlib.file_digest(f,'sha256').hexdigest()
def closed():
 value=subprocess.check_output(['/mnt/c/Windows/System32/WindowsPowerShell/v1.0/powershell.exe','-NoProfile','-NonInteractive','-Command','@(Get-Process Agentopia,AgentopiaSetup -ErrorAction SilentlyContinue).Count'],text=True)
 assert value.strip()=='0','Agentopia must remain normally closed'
pointer=load(root/'.supabase/desktop-office-update/current.json');work=mounted(pointer['work']);assert work.parent==Path('/mnt/c/Users/charl/AgentopiaQA/office-preview-update') and work.resolve()==work
proof=load(work/'proof.json');qualified=load(work/'qualification.json');recovery=load(work/'recovery.json');archive_runtime=load(work/'electron-runtime/evidence.json')
assert proof['success'] and qualified['success'] and qualified['checks']==19 and archive_runtime['success'] and recovery['success']
assert qualified['imageSha256']==recovery['updateImageSha256']==proof['imageSha256'] and not proof['installed']
assert not proof['databaseSchemaChanged'] and proof['providerAndAgentModulesByteIdentical']
assert not any(n not in ['build/document-worker.js','build/workspace.js','package.json'] for n in proof['changedArchiveEntries'])
assert 'postgres' not in subprocess.check_output(['ps','-eo','comm='],text=True).splitlines()
critical=load('/mnt/c/Users/charl/AgentopiaRecovery/private-profile-current/1792459532573/private-runtime-files.json')
for name,digest in critical.items():
 if not name.endswith('/pg_control'):assert sha(name)==digest,'Runtime identity, version, secrets or encryption root changed'
closed();os.umask(0o077)
installed=Path('/mnt/c/Users/charl/AppData/Local/AgentopiaDesktop/app-0.44.47/resources');assert installed.resolve()==installed and sha(installed/'app.asar')==proof['baseImageSha256']
baseline=load(root/'.supabase/desktop-profile-location/menu-stability-installed.json')
for name,digest in baseline['resourceFiles'].items():assert sha(installed/'resources'/name)==digest,'The installed resource baseline changed'
source=mounted(proof['ui'])
for name,digest in proof['uiHashes'].items():assert sha(source/name)==digest
assert sha(mounted(proof['image']))==proof['imageSha256']
backup=mounted(recovery['out']);assert backup.resolve()==backup and backup.parent==Path('/mnt/d/Users/charl/AgentopiaRecovery/office-preview-3')
assert sha(backup/'before-app.asar')==proof['baseImageSha256']
resources=installed/'resources';current=resources/'ui';pending=resources/'ui-office3-pending';old_ui=resources/'ui-before-office3';old_asar=installed/'app-before-office3.asar';new_asar=installed/'app-office3-pending.asar'
for target in [pending,old_ui,old_asar,new_asar,backup/'before-ui']:assert not target.exists()
shutil.copytree(current,backup/'before-ui')
for name,digest in baseline['resourceFiles'].items():
 if name.startswith('ui/'):assert sha(backup/'before-ui'/name[3:])==digest
shutil.copytree(source,pending);shutil.copyfile(mounted(proof['image']),new_asar)
assert sha(new_asar)==proof['imageSha256']
for name,digest in proof['uiHashes'].items():assert sha(pending/name)==digest
closed();current.rename(old_ui);(installed/'app.asar').rename(old_asar)
try:
 pending.rename(current);new_asar.rename(installed/'app.asar')
 license_source=work/'licenses'
 for file in license_source.rglob('*'):
  if not file.is_file():continue
  target=resources/'licenses'/file.relative_to(license_source);target.parent.mkdir(parents=True,exist_ok=True)
  if target.exists():assert sha(target)==sha(file),'An existing license changed unexpectedly'
  else:shutil.copyfile(file,target)
 for name,digest in proof['uiHashes'].items():assert sha(current/name)==digest
 assert sha(installed/'app.asar')==proof['imageSha256']
 assert sha(resources/'runtime/Restore-Agentopia.ps1')==proof['restoreHelperSha256']
except BaseException:
 if current.exists():current.rename(resources/'ui-office3-failed')
 if (installed/'app.asar').exists():(installed/'app.asar').rename(installed/'app-office3-failed.asar')
 old_ui.rename(current);old_asar.rename(installed/'app.asar');raise
receipt={'success':True,'at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'version':'0.44.47','revision':'office-preview-3','work':str(work),'recovery':str(backup),'imageSha256':proof['imageSha256'],'baseImageSha256':proof['baseImageSha256'],'uiFiles':len(proof['uiHashes']),'rollbackUi':str(old_ui),'rollbackArchive':str(old_asar),'providerAndAgentModulesByteIdentical':True,'databaseSchemaChanged':False,'immutableRuntimeFilesMatched':5,'currentColdImageCaptured':False,'providerRequests':0,'nativeAcceptancePending':True,'fullGoalComplete':False}
with (work/'installed.json').open('x') as f:json.dump(receipt,f,indent=2)
with (root/'.supabase/desktop-office-update/installed.json').open('x') as f:json.dump(receipt,f,indent=2)
print(json.dumps(receipt))
