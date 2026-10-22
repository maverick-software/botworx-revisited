"""Apply the qualified resource-only correction with verified current-data rollback."""
from pathlib import Path
import datetime,hashlib,json,os,shutil,subprocess
root=Path('/mnt/d/Users/charl/software/Agentopia');records=root/'.supabase/desktop-profile-location'
def load(file):return json.loads(Path(file).read_text(encoding='utf-8-sig'))
def mounted(value):
    assert len(value)>3 and value[1:3]==':\\'
    return Path('/mnt/'+value[0].lower()+value[2:].replace('\\','/'))
def sha(file):
    with Path(file).open('rb') as stream:return hashlib.file_digest(stream,'sha256').hexdigest()
pointer=load(records/'menu-stability-ui-current.json');work=mounted(pointer['work']);assert work.parent==Path('/mnt/c/Users/charl/AgentopiaQA/menu-stability-ui') and work.resolve()==work
proof=load(work/'proof.json');qualified=load(work/'qualification.json');assert proof['success'] and qualified['success'] and qualified['checks']==56 and not proof['installed']
for row in qualified['receipts'].values():assert sha(mounted(row['file']))==row['sha256']
recovery_pointer=load(records/'current-ui-recovery.json');recovery=mounted(recovery_pointer['out']);receipt=load(recovery/'ui-recovery.json');offline=load(recovery/'offline-acceptance.json');before_data=load(recovery/'data-before-ui.json')
assert receipt['success'] and receipt['updateScope'].startswith('Qualified UI assets') and offline['success'] and before_data['success'] and before_data['tableCount']==126
assert offline['counts']=={'accounts':2,'chats':112,'messages':390,'requests':195,'runningRequests':0,'runningGoals':0} and offline['nativeThreads']==149
def closed():
    result=subprocess.run(['/mnt/c/Windows/System32/WindowsPowerShell/v1.0/powershell.exe','-NoProfile','-NonInteractive','-Command','@(Get-Process Agentopia,AgentopiaSetup -ErrorAction SilentlyContinue).Count'],text=True,capture_output=True,check=True);assert result.stdout.strip()=='0','Agentopia must remain normally closed'
closed();os.umask(0o077)
base=load(root/'.supabase/desktop-platform-release/candidate-04447/startup-reading-proof.json');installed=Path('/mnt/c/Users/charl/AppData/Local/AgentopiaDesktop/app-0.44.47/resources');assert installed.resolve()==installed and sha(installed/'app.asar')==base['imageSha256']==receipt['scope']['installedArchiveSha256']
for name,digest in base['resourceFiles'].items():
    if name.startswith('ui/'):assert sha(installed/'resources'/name)==digest,'Installed UI no longer matches UI1'
source=mounted(proof['ui']);assert source.resolve()==source
for name,digest in proof['uiFiles'].items():assert sha(source/name)==digest
helper_source=root/'scripts/desktop/import-backup.ps1';helper_q=load('/mnt/c/Users/charl/AgentopiaQA/recovery-preflight/1792457551832/evidence.json');assert helper_q['success'] and helper_q['groups']==18 and sha(helper_source)==helper_q['helperSha256']
resources=installed/'resources';helper=resources/'runtime/Restore-Agentopia.ps1';old_helper_sha=sha(helper);assert old_helper_sha=='629bd72826fcbefa26f0609a7ba150a0a536f4f0699268c8d94bf9d7ba225bad'
current=resources/'ui';pending=resources/'ui-menu-stability-pending';before=recovery/'before-ui2';helper_before=recovery/'before-ui2-Restore-Agentopia.ps1';helper_pending=helper.with_name('Restore-Agentopia.menu-stability-pending.ps1');failed=recovery/'failed-ui2'
for file in [pending,before,helper_before,helper_pending,failed]:assert not file.exists()
shutil.copyfile(helper,helper_before);assert sha(helper_before)==old_helper_sha
shutil.copytree(source,pending);shutil.copyfile(helper_source,helper_pending)
for name,digest in proof['uiFiles'].items():assert sha(pending/name)==digest
assert sha(helper_pending)==helper_q['helperSha256'];closed();current.rename(before)
try:
    pending.rename(current);helper_pending.replace(helper)
    for name,digest in proof['uiFiles'].items():assert sha(current/name)==digest
    assert sha(helper)==helper_q['helperSha256'] and sha(installed/'app.asar')==base['imageSha256']
except BaseException:
    if current.exists():current.rename(failed)
    before.rename(current);rollback=helper.with_name('Restore-Agentopia.ui2-rollback.ps1');shutil.copyfile(helper_before,rollback);rollback.replace(helper);assert sha(helper)==old_helper_sha
    raise
files={name:digest for name,digest in base['resourceFiles'].items() if not name.startswith('ui/')};files.update({'ui/'+name:digest for name,digest in proof['uiFiles'].items()});files['runtime/Restore-Agentopia.ps1']=helper_q['helperSha256']
manifest_sha=hashlib.sha256(json.dumps(files,separators=(',',':'),ensure_ascii=False).encode()).hexdigest()
applied={'success':True,'at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'version':'0.44.47','uiHotfixRevision':2,'work':str(work),'recovery':str(recovery),'resourceFiles':files,'resourceManifestSha256':manifest_sha,'imageSha256':base['imageSha256'],'uiFileCount':len(proof['uiFiles']),'restoreHelperSha256':helper_q['helperSha256'],'beforeUi':str(before),'beforeHelper':str(helper_before),'rollbackAvailable':True,'scope':'Qualified UI assets and checked fresh-restore helper. Executable/backend/runtime/schema retained.','providerRequests':0,'nativeReopeningPending':True,'currentColdImageCaptured':False,'retainedColdBaseAndFreshLogicalProfileRecovery':True,'fullGoalComplete':False}
with (work/'installed.json').open('x') as stream:json.dump(applied,stream,indent=2)
with (records/'menu-stability-installed.json').open('x') as stream:json.dump(applied,stream,indent=2)
print(json.dumps({k:v for k,v in applied.items() if k!='resourceFiles'}))
