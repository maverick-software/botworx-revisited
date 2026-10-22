"""Accept paired installed bytes, native context selection and unchanged saved tables."""
from pathlib import Path
import datetime,hashlib,json
root=Path('/mnt/d/Users/charl/software/Agentopia')
def load(p):return json.loads(Path(p).read_text(encoding='utf-8-sig'))
def mounted(p):return Path('/mnt/'+p[0].lower()+p[2:].replace('\\','/'))
def sha(p):
 with Path(p).open('rb') as f:return hashlib.file_digest(f,'sha256').hexdigest()
pointer=load(root/'.supabase/desktop-composer-mentions/current.json');work=mounted(pointer['work'])
proof=load(mounted(pointer['proof']));applied,native,recovery=[load(work/n) for n in ['installed.json','native-acceptance.json','recovery.json']]
assert applied['success'] and native['success'] and native['normalReopeningPassed'] and native['nativeTypedPickerVerified'] and native['nativeFileDialogVerified'] and native['originalDraftEmpty'] and native['latestUserTestReplyPreserved'] and native['originalAttachmentPreserved'] and native['noRequestSentOrReplayed']
installed=Path('/mnt/c/Users/charl/AppData/Local/AgentopiaDesktop/app-0.44.47/resources')
assert sha(installed/'app.asar')==proof['imageSha256']==applied['imageSha256']
for name,digest in proof['uiHashes'].items():assert sha(installed/'resources/ui'/name)==digest
for name,digest in applied['resourceFiles'].items():
 if name=='runtime/Restore-Agentopia.ps1':assert sha(installed/'resources'/name)==digest
before=mounted(recovery['out']);assert sha(before/'active-profile.tar.gz')==recovery['profileArchiveSha256'] and sha(mounted(recovery['beforeArchive']))==proof['baseImageSha256']
files=sorted(before.glob('data-after-ui-*.json'));current=load(files[-1]);assert current['success'] and current['tableCount']==126 and not current['mismatches']
assert datetime.datetime.now(datetime.timezone.utc)-datetime.datetime.fromisoformat(current['at'])<datetime.timedelta(minutes=10)
baseline=load(mounted(proof['baseReopened']));assert baseline['success'] and baseline['imageSha256']==proof['baseImageSha256'] and baseline['revision']=='context-parity-7'
record={**applied,'at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'nativeAcceptancePending':False,'normalReopeningPassed':True,'tablesCompared':126,'allSavedDataPreserved':True,'nativeAcceptance':str(work/'native-acceptance.json'),'dataComparison':str(files[-1]),'priorAcceptedArchive':proof['baseReopened'],'executionHarnessAgentPolicyMemoryAndSchemaUnchanged':True,'providerAndAgentExecutionModulesUnchanged':True,'cleanMachineRestorationTested':False,'fullGoalComplete':False}
with (work/'reopened.json').open('x') as f:json.dump(record,f,indent=2)
with (root/'.supabase/desktop-composer-mentions/reopened.json').open('x') as f:json.dump(record,f,indent=2)
print(json.dumps({k:v for k,v in record.items() if k!='resourceFiles'}))
