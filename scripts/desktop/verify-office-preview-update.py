"""Verify installed Office update bytes after native reopening and read-only SQL acceptance."""
from pathlib import Path
import json,hashlib,datetime
root=Path('/mnt/d/Users/charl/software/Agentopia')
def load(p):return json.loads(Path(p).read_text(encoding='utf-8-sig'))
def sha(p):
 with Path(p).open('rb') as f:return hashlib.file_digest(f,'sha256').hexdigest()
def mounted(value):return Path('/mnt/'+value[0].lower()+value[2:].replace('\\','/'))
pointer=load(root/'.supabase/desktop-office-update/current.json');work=mounted(pointer['work']);proof=load(work/'proof.json');applied=load(work/'installed.json');native=load(work/'native-acceptance.json');assert applied['success'] and native['success'] and native['normalReopeningPassed']
installed=Path('/mnt/c/Users/charl/AppData/Local/AgentopiaDesktop/app-0.44.47/resources');assert sha(installed/'app.asar')==proof['imageSha256']==applied['imageSha256']
for name,digest in proof['uiHashes'].items():assert sha(installed/'resources/ui'/name)==digest
for file in (work/'licenses').rglob('*'):
 if file.is_file():assert sha(installed/'resources/licenses'/file.relative_to(work/'licenses'))==sha(file)
assert sha(installed/'resources/runtime/Restore-Agentopia.ps1')==proof['restoreHelperSha256']
recovery=load(work/'recovery.json');before=mounted(recovery['out']);assert sha(before/'before-app.asar')==proof['baseImageSha256'] and sha(Path(applied['rollbackArchive']))==proof['baseImageSha256']
comparisons=sorted(Path('/mnt/c/Users/charl/AgentopiaRecovery/private-profile-current/1792459532573').glob('data-after-ui-*.json'));data=load(comparisons[-1]);assert data['success'] and data['tableCount']==126 and not data['mismatches']
assert datetime.datetime.now(datetime.timezone.utc)-datetime.datetime.fromisoformat(data['at'])<datetime.timedelta(minutes=10)
baseline=load(root/'.supabase/desktop-profile-location/menu-stability-installed.json');files={name:digest for name,digest in baseline['resourceFiles'].items() if not name.startswith('ui/')};files.update({'ui/'+name:digest for name,digest in proof['uiHashes'].items()})
for file in (work/'licenses').rglob('*'):
 if file.is_file():files['licenses/'+str(file.relative_to(work/'licenses'))]=sha(file)
manifest_sha=hashlib.sha256(json.dumps(files,separators=(',',':'),ensure_ascii=False).encode()).hexdigest()
receipt={'success':True,'at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'version':'0.44.47','revision':'office-preview-3','work':str(work),'imageSha256':proof['imageSha256'],'baseImageSha256':proof['baseImageSha256'],'resourceManifestSha256':manifest_sha,'resourceFiles':files,'uiFilesVerified':len(proof['uiHashes']),'dataComparison':str(comparisons[-1]),'tablesCompared':126,'accountPasswordsAndAgentStatePreserved':True,'nativeAcceptance':str(work/'native-acceptance.json'),'normalReopeningPassed':True,'recovery':recovery['out'],'currentColdImageCaptured':False,'cleanMachineRestorationTested':False,'providerRequests':0,'fullInstallerCreated':False,'fullGoalComplete':False}
with (work/'reopened.json').open('x') as f:json.dump(receipt,f,indent=2)
with (root/'.supabase/desktop-office-update/reopened.json').open('x') as f:json.dump(receipt,f,indent=2)
print(json.dumps({k:v for k,v in receipt.items() if k!='resourceFiles'}))
