"""Publish a qualified external UI bundle to the exact closed installed app."""
from pathlib import Path
import datetime,hashlib,json,os,re,shutil,subprocess,sys

root=Path('/mnt/f/Agentopia')
job=Path(sys.argv[1]);assert job.parent==root/'.supabase/desktop-normal-maintenance' and re.fullmatch(r'\d{13}',job.name) and job.resolve()==job
intent=json.loads((job/'intent.json').read_text())
def mounted(value):
    assert len(value)>3 and value[1:3] in (':\\',':/')
    return Path('/mnt/'+value[0].lower()+value[2:].replace('\\','/'))
def sha(file):
    with file.open('rb') as stream:return hashlib.file_digest(stream,'sha256').hexdigest()
def closed():
    result=subprocess.run(['/mnt/c/Windows/System32/WindowsPowerShell/v1.0/powershell.exe','-NoProfile','-NonInteractive','-Command','@(Get-Process Agentopia,AgentopiaSetup -ErrorAction SilentlyContinue).Count'],capture_output=True,text=True,timeout=20)
    assert result.returncode==0 and result.stdout.strip()=='0','The ordinary application must be closed'
def manifest(directory):
    assert directory.resolve()==directory and not directory.is_symlink()
    result={}
    for file in directory.rglob('*'):
        assert not file.is_symlink()
        if file.is_file():result[file.relative_to(directory).as_posix()]=sha(file)
    return result
os.umask(0o077);closed()
proof_file=mounted(intent['uiProof']);proof=json.loads(proof_file.read_text());qualification=json.loads((proof_file.parent/'qualification.json').read_text());assert qualification['success'] and sha(proof_file)==qualification['proofSha256']
assert sha(mounted(qualification['evidence']))==qualification['evidenceSha256']
base=json.loads(mounted(proof['baseProof']).read_text());assert base['imageSha256']==intent['targetImageSha256']
source=mounted(proof['ui']);assert source.parent==proof_file.parent and source.name=='ui';assert manifest(source)==proof['uiFiles']
profile=Path('/mnt/c/Users/charl/.agentopia/desktop/profile');recovery=json.loads((job/'profile-recovery.json').read_text());assert recovery['success'] and recovery['sourceComparedAgain']
physical=json.loads((job/'physical-preflight.json').read_text());assert physical['success'] and physical['physicalWindowsProcess'] and physical['readOnly']
assert physical['profileManifestSha256']==sha(job/'profile-recovery.json') and physical['uiProofSha256']==sha(proof_file)
age=(datetime.datetime.now(datetime.timezone.utc)-datetime.datetime.fromisoformat(physical['at'].replace('Z','+00:00'))).total_seconds();assert 0<=age<180,'The physical comparison must be fresh'
for name in ['credentials.bin','Local State','runtime-binding.json']:
    assert sha(profile/name)==recovery['manifest']['files'][name]['sha256']
logical=json.loads((job/'logical-recovery.json').read_text());lm=json.loads((mounted(logical['snapshot'])/'manifest.json').read_text())
for row in lm['files']:assert sha(mounted(logical['snapshot'])/row['name'])==row['sha256']
program=Path('/mnt/c/Users/charl/AppData/Local/AgentopiaDesktop/app-0.44.52');assert program.resolve()==program and sha(program/'resources/app.asar')==base['imageSha256']
resources=program/'resources/resources';current=resources/'ui';pending=resources/'ui-composio-pending';old=resources/'ui-composio-previous';rollback=job/'before-ui'
assert current.resolve()==current and not pending.exists() and not old.exists() and not rollback.exists()
baseline={name[3:]:digest for name,digest in base['resourceFiles'].items() if name.startswith('ui/')};assert manifest(current)==baseline,'Installed UI differs from its accepted baseline'
assert physical['resourceFiles']==len(base['resourceFiles']) and physical['sourceUiBaselineUnchanged']
shutil.copytree(current,rollback);assert manifest(rollback)==baseline
shutil.copytree(source,pending);assert manifest(pending)==proof['uiFiles'];closed();current.rename(old)
try:
    pending.rename(current);assert manifest(current)==proof['uiFiles'];assert sha(program/'resources/app.asar')==base['imageSha256']
except BaseException:
    if current.exists():current.rename(resources/'ui-composio-failed')
    old.rename(current);raise
assert old==Path('/mnt/c/Users/charl/AppData/Local/AgentopiaDesktop/app-0.44.52/resources/resources/ui-composio-previous') and old.resolve()==old and manifest(old)==baseline and manifest(rollback)==baseline
shutil.rmtree(old)
receipt={'success':True,'installed':True,'at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'version':'0.44.52','uiRevision':proof['revision'],'uiFiles':len(proof['uiFiles']),'uiProof':intent['uiProof'],'imageSha256':base['imageSha256'],'rollback':str(rollback),'profileRecoveryVerified':len(recovery['manifest']['files']),'databaseRecoveryFilesVerified':len(lm['files']),'backendAndRuntimeUnchanged':True,'ordinaryApplicationClosed':True,'ordinaryReopeningPending':True,'providerRequests':0,'liveComposioRequests':0,'fullGoalComplete':False}
(job/'evidence.json').write_text(json.dumps(receipt,indent=2));print(json.dumps(receipt),flush=True)
