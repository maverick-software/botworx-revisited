"""Activate only qualified UI assets, with the ordinary app closed and a rollback copy."""
from pathlib import Path
import datetime,hashlib,json,subprocess,os,shutil
root=Path('/mnt/d/Users/charl/software/Agentopia')
candidate=root/'.supabase/desktop-platform-release/candidate-04446'
base=json.loads((candidate/'package-proof.json').read_text());proof=json.loads((candidate/'ui-hotfix-proof.json').read_text());qualified=json.loads((candidate/'ui-hotfix-qualification.json').read_text())
assert qualified['success'] and qualified['uiChecks']==17 and qualified['readingChecks']==5
assert proof['resourceManifestSha256']==qualified['resourceManifestSha256'] and proof['imageSha256']==base['imageSha256']
def mounted(value):return Path(value.replace('C:\\','/mnt/c/').replace('\\','/'))
def sha(file):
 with file.open('rb') as stream:return hashlib.file_digest(stream,'sha256').hexdigest()
assert sha(Path(qualified['uiEvidence'].replace('D:\\','/mnt/d/').replace('\\','/')))==qualified['uiEvidenceSha256']
assert sha(Path(qualified['readingEvidence'].replace('D:\\','/mnt/d/').replace('\\','/')))==qualified['readingEvidenceSha256']
command="@(Get-Process Agentopia,AgentopiaSetup -ErrorAction SilentlyContinue).Count"
check=subprocess.run(['/mnt/c/Windows/System32/WindowsPowerShell/v1.0/powershell.exe','-NoProfile','-NonInteractive','-Command',command],capture_output=True,text=True,timeout=15)
assert check.returncode==0 and check.stdout.strip()=='0','Agentopia must be normally closed before replacing UI files'
installed=Path('/mnt/c/Users/charl/AppData/Local/AgentopiaDesktop/app-0.44.46/resources')
assert installed.resolve()==installed and sha(installed/'app.asar')==base['imageSha256']
resources=installed/'resources';current=resources/'ui';pending=resources/'ui-menu-dismiss-pending';source=mounted(proof['ui']);work=mounted(proof['work']);before=work/'before-ui'
assert source.resolve()==source and work.parent==Path('/mnt/c/Users/charl/AgentopiaQA/menu-viewer-ui-hotfix')
assert current.resolve()==current and current.parent==resources and not pending.exists() and not before.exists()
for name,digest in base['resourceFiles'].items():
 if name.startswith('ui/'):assert sha(resources/name)==digest,'Installed UI differs from the verified base'
for file in source.rglob('*'):assert not file.is_symlink()
shutil.copytree(source,pending)
for name,digest in proof['resourceFiles'].items():
 if name.startswith('ui/'):assert sha(pending/name[3:])==digest,'Staged UI differs from its frozen qualification'
current.rename(before)
try:pending.rename(current)
except BaseException:
 before.rename(current)
 raise
for name,digest in proof['resourceFiles'].items():assert sha(resources/name)==digest,'Installed resource differs from the final qualified manifest'
receipt={'success':True,'at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'version':'0.44.46','uiHotfixRevision':1,'scope':'UI assets only; backend archive, executable, runtime, schema and account data are retained','beforeUi':str(before),'rollbackAvailable':True,'resourceFilesCompared':len(proof['resourceFiles']),'resourceManifestSha256':proof['resourceManifestSha256'],'imageSha256':base['imageSha256'],'providerRequests':0,'ordinaryAppClosed':True,'nativeReopeningPending':True}
with (candidate/'ui-hotfix-installed.json').open('x') as stream:json.dump(receipt,stream,indent=2)
print(json.dumps(receipt))
