"""Apply the qualified main-frame presentation permission and UI as one correction."""
from pathlib import Path
import json,hashlib,datetime,subprocess,shutil,os
root=Path('/mnt/d/Users/charl/software/Agentopia')
def load(p):return json.loads(Path(p).read_text(encoding='utf-8-sig'))
def mounted(value):return Path('/mnt/'+value[0].lower()+value[2:].replace('\\','/'))
def sha(p):
 with Path(p).open('rb') as f:return hashlib.file_digest(f,'sha256').hexdigest()
def closed():
 value=subprocess.check_output(['/mnt/c/Windows/System32/WindowsPowerShell/v1.0/powershell.exe','-NoProfile','-NonInteractive','-Command','@(Get-Process Agentopia,AgentopiaSetup -ErrorAction SilentlyContinue).Count'],text=True)
 assert value.strip()=='0','Agentopia must remain normally closed'
pointer=load(root/'.supabase/desktop-presentation-delivery/current.json');work=mounted(pointer['work']);assert work.parent==Path('/mnt/c/Users/charl/AgentopiaQA/presentation-delivery') and work.resolve()==work
proof=load(work/'proof.json');qualification=load(work/'qualification.json');recovery=load(work/'recovery.json');runtime=load(work/'electron-runtime/evidence.json')
assert proof['success'] and qualification['success'] and qualification['checks']==20 and recovery['success'] and runtime['success']
assert qualification['imageSha256']==recovery['updateImageSha256']==proof['imageSha256']
assert proof['changedArchiveEntries']==['build/main.js'] and proof['addedArchiveEntries']==['build/presentation-permission.js']
assert not proof['databaseSchemaChanged'] and proof['providerAndAgentModulesByteIdentical'] and not proof['installed']
assert sha(mounted(proof['sourceQualification']))==proof['sourceQualificationSha256']
source_q=load(mounted(proof['sourceQualification']));assert source_q['success'] and source_q['totalChecks']==50 and source_q['requiresMainProcessPermissionUpdate']
for record in source_q['receipts'].values():assert sha(mounted(record['file']))==record['sha256']
assert 'postgres' not in subprocess.check_output(['ps','-eo','comm='],text=True).splitlines()
critical=load('/mnt/c/Users/charl/AgentopiaRecovery/private-profile-current/1792459532573/private-runtime-files.json')
for name,digest in critical.items():
 if not name.endswith('/pg_control'):assert sha(name)==digest
closed();os.umask(0o077)
installed=Path('/mnt/c/Users/charl/AppData/Local/AgentopiaDesktop/app-0.44.47/resources');assert installed.resolve()==installed and sha(installed/'app.asar')==proof['baseImageSha256']
baseline=load(root/'.supabase/desktop-office-update/reopened.json');assert baseline['success'] and baseline['imageSha256']==proof['baseImageSha256']
for name,digest in baseline['resourceFiles'].items():
 if name.startswith('ui/') or name=='runtime/Restore-Agentopia.ps1':assert sha(installed/'resources'/name)==digest
source=mounted(proof['ui']);archive=mounted(proof['image']);assert sha(archive)==proof['imageSha256']
for name,digest in proof['uiHashes'].items():assert sha(source/name)==digest
backup=mounted(recovery['out']);assert backup.resolve()==backup and backup.parent==Path('/mnt/c/Users/charl/AgentopiaRecovery/presentation-4')
assert sha(backup/'before-app.asar')==proof['baseImageSha256']
budget=sum(f.stat().st_size for f in source.rglob('*') if f.is_file())*2+archive.stat().st_size
assert shutil.disk_usage(installed).free>budget+1536*1024**2,'Preserve recovery and filesystem headroom'
resources=installed/'resources';current=resources/'ui';pending=resources/'ui-presentation4-pending';old_ui=resources/'ui-before-presentation4';old_asar=installed/'app-before-presentation4.asar';new_asar=installed/'app-presentation4-pending.asar'
for target in [pending,old_ui,old_asar,new_asar,backup/'before-ui']:assert not target.exists()
shutil.copytree(current,backup/'before-ui')
for name,digest in baseline['resourceFiles'].items():
 if name.startswith('ui/'):assert sha(backup/'before-ui'/name[3:])==digest
shutil.copytree(source,pending);shutil.copyfile(archive,new_asar)
assert sha(new_asar)==proof['imageSha256']
for name,digest in proof['uiHashes'].items():assert sha(pending/name)==digest
closed();current.rename(old_ui);(installed/'app.asar').rename(old_asar)
try:
 pending.rename(current);new_asar.rename(installed/'app.asar')
 for name,digest in proof['uiHashes'].items():assert sha(current/name)==digest
 assert sha(installed/'app.asar')==proof['imageSha256'] and sha(resources/'runtime/Restore-Agentopia.ps1')==proof['restoreHelperSha256']
except BaseException:
 if current.exists():current.rename(resources/'ui-presentation4-failed')
 if (installed/'app.asar').exists():(installed/'app.asar').rename(installed/'app-presentation4-failed.asar')
 old_ui.rename(current);old_asar.rename(installed/'app.asar');raise
receipt={'success':True,'at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'version':'0.44.47','revision':'presentation-4','work':str(work),'recovery':str(backup),'imageSha256':proof['imageSha256'],'baseImageSha256':proof['baseImageSha256'],'uiFiles':len(proof['uiHashes']),'rollbackUi':str(old_ui),'rollbackArchive':str(old_asar),'providerAndAgentModulesByteIdentical':True,'databaseSchemaChanged':False,'immutableRuntimeFilesMatched':5,'currentColdImageCaptured':False,'providerRequests':0,'nativeAcceptancePending':True,'fullGoalComplete':False}
with (work/'installed.json').open('x') as f:json.dump(receipt,f,indent=2)
with (root/'.supabase/desktop-presentation-delivery/installed.json').open('x') as f:json.dump(receipt,f,indent=2)
print(json.dumps(receipt))
