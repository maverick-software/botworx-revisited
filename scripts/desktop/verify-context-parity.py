"""Accept paired installed bytes, native context selection and unchanged saved tables."""
from pathlib import Path
import datetime,hashlib,json
root=Path('/mnt/d/Users/charl/software/Agentopia')
def load(p):return json.loads(Path(p).read_text(encoding='utf-8-sig'))
def mounted(p):return Path('/mnt/'+p[0].lower()+p[2:].replace('\\','/'))
def sha(p):
 with Path(p).open('rb') as f:return hashlib.file_digest(f,'sha256').hexdigest()
pointer=load(root/'.supabase/desktop-context-parity/current.json');work=mounted(pointer['work'])
proof,applied,native,recovery=[load(work/n) for n in ['proof.json','installed.json','native-acceptance.json','recovery.json']]
assert applied['success'] and native['success'] and native['normalReopeningPassed'] and native['manualPageContextAttached'] and native['privateInputValueOmitted'] and native['qaDraftCleared'] and native['originalPdfReturned'] and native['noRequestSentOrReplayed']
installed=Path('/mnt/c/Users/charl/AppData/Local/AgentopiaDesktop/app-0.44.47/resources')
assert sha(installed/'app.asar')==proof['imageSha256']==applied['imageSha256']
for name,digest in proof['uiHashes'].items():assert sha(installed/'resources/ui'/name)==digest
for name,digest in applied['resourceFiles'].items():
 if name=='runtime/Restore-Agentopia.ps1':assert sha(installed/'resources'/name)==digest
before=mounted(recovery['out']);assert sha(before/'active-profile.tar.gz')==recovery['profileArchiveSha256'] and sha(before/'before-app.asar')==proof['baseImageSha256']
files=sorted(before.glob('data-after-ui-*.json'));current=load(files[-1]);assert current['success'] and current['tableCount']==126 and not current['mismatches']
assert datetime.datetime.now(datetime.timezone.utc)-datetime.datetime.fromisoformat(current['at'])<datetime.timedelta(minutes=10)
base_input=load(work/'base-input.json');intermediate=load(mounted(base_input['baseInstallation']));assert intermediate['imageSha256']==proof['baseImageSha256'] and intermediate['revision']=='context-parity-6'
record={**applied,'at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'nativeAcceptancePending':False,'normalReopeningPassed':True,'tablesCompared':126,'allSavedDataPreserved':True,'nativeAcceptance':str(work/'native-acceptance.json'),'dataComparison':str(files[-1]),'preContextBaseImageSha256':intermediate['baseImageSha256'],'intermediateInstalled':base_input['baseInstallation'],'intermediateInstalledSha256':sha(mounted(base_input['baseInstallation'])),'providerAndAgentExecutionModulesUnchanged':True,'cleanMachineRestorationTested':False,'fullGoalComplete':False}
with (work/'reopened.json').open('x') as f:json.dump(record,f,indent=2)
with (root/'.supabase/desktop-context-parity/reopened.json').open('x') as f:json.dump(record,f,indent=2)
print(json.dumps({k:v for k,v in record.items() if k!='resourceFiles'}))
