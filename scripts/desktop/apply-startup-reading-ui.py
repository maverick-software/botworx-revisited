"""Apply qualified47 UI assets with a checked session capture and UI rollback."""
from pathlib import Path
import datetime,hashlib,json,os,shutil,subprocess,sys
root=Path('/mnt/d/Users/charl/software/Agentopia');candidate=root/'.supabase/desktop-platform-release/candidate-04447'
base=json.loads((candidate/'package-proof.json').read_text());proof=json.loads((candidate/'startup-reading-proof.json').read_text());q=json.loads((candidate/'startup-reading-qualification.json').read_text())
assert q['success'] and (q['startupChecks'],q['readingChecks'],q['uiChecks'],q['agentChecks'],q['agentFormChecks'])==(5,15,17,5,15)
assert proof['resourceManifestSha256']==q['resourceManifestSha256'] and proof['imageSha256']==base['imageSha256']
def mounted(value):
 assert len(value)>3 and value[1:3]==':\\'
 return Path('/mnt/'+value[0].lower()+value[2:].replace('\\','/'))
def sha(file):
 with file.open('rb') as f:return hashlib.file_digest(f,'sha256').hexdigest()
for key in ['startupEvidence','readingEvidence','uiEvidence','agentEvidence','agentFormEvidence']:assert sha(mounted(q[key]))==q[key+'Sha256']
def closed():
 p=subprocess.run(['/mnt/c/Windows/System32/WindowsPowerShell/v1.0/powershell.exe','-NoProfile','-NonInteractive','-Command',"@(Get-Process Agentopia,AgentopiaSetup -ErrorAction SilentlyContinue).Count"],text=True,capture_output=True,timeout=20)
 assert p.returncode==0 and p.stdout.strip()=='0','The ordinary app must be normally closed'
closed();work=mounted(proof['work']);source=mounted(proof['ui']);assert work.parent==Path('/mnt/c/Users/charl/AgentopiaQA/startup-reading-ui') and work.resolve()==work
before_data=json.loads((work/'data-before.json').read_text());assert before_data['success'] and sha(work/'database.dump')==before_data['backupSha256']
sys.path.insert(0,str(root/'scripts/desktop'));from profile_archive import capture
os.umask(0o077)
profile=Path('/mnt/c/Users/charl/AppData/Roaming/Agentopia');roots={'credentials.bin','Local State','Preferences','runtime-binding.json','schema-release.json','window.json','Local Storage','Session Storage','Network'}
session=capture(profile,work/'session-before-ui.tar',allow=lambda name:name.split('/')[0] in roots)
assert {'credentials.bin','Local State','runtime-binding.json'}<=set(session['manifest']['files'])
with (work/'session-before-ui.json').open('x') as f:json.dump(session,f,indent=2)
installed=Path('/mnt/c/Users/charl/AppData/Local/AgentopiaDesktop/app-0.44.47/resources');assert installed.resolve()==installed and sha(installed/'app.asar')==base['imageSha256']
resources=installed/'resources';current=resources/'ui';pending=resources/'ui-startup-reading-pending';before=work/'before-ui'
assert current.resolve()==current and not pending.exists() and not before.exists() and source.resolve()==source
for name,digest in base['resourceFiles'].items():
 if name.startswith('ui/'):assert sha(resources/name)==digest,'Installed UI differs from the verified47 baseline'
for file in source.rglob('*'):assert not file.is_symlink()
shutil.copytree(source,pending)
for name,digest in proof['resourceFiles'].items():
 if name.startswith('ui/'):assert sha(pending/name[3:])==digest,'Staged UI differs from frozen qualification'
failed=work/'failed-ui';assert not failed.exists()
closed();current.rename(before)
try:
 pending.rename(current)
 for name,digest in proof['resourceFiles'].items():assert sha(resources/name)==digest,'Installed resource differs: '+name
except BaseException:
 if current.exists():current.rename(failed)
 before.rename(current);raise
receipt={'success':True,'at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'version':'0.44.47','uiHotfixRevision':1,'scope':'UI assets only; backend, executable, runtime, schema and account data retained','beforeUi':str(before),'sessionArchive':str(work/'session-before-ui.tar'),'sessionFilesVerified':session['counts']['files'],'rollbackAvailable':True,'resourceFilesCompared':len(proof['resourceFiles']),'resourceManifestSha256':proof['resourceManifestSha256'],'imageSha256':base['imageSha256'],'providerRequests':0,'ordinaryAppClosed':True,'nativeReopeningPending':True}
with (candidate/'startup-reading-installed.json').open('x') as f:json.dump(receipt,f,indent=2)
print(json.dumps(receipt))
