"""Accept the export correction against installed bytes, native behavior and saved data."""
from pathlib import Path
import datetime,hashlib,json
root=Path('/mnt/d/Users/charl/software/Agentopia')
def load(p):return json.loads(Path(p).read_text(encoding='utf-8-sig'))
def mounted(p):return Path('/mnt/'+p[0].lower()+p[2:].replace('\\','/'))
def sha(p):
 with Path(p).open('rb') as f:return hashlib.file_digest(f,'sha256').hexdigest()
p=load(root/'.supabase/desktop-export-relocation/current.json');work=mounted(p['work']);assert work.parent==Path('/mnt/c/Users/charl/AgentopiaQA/export-relocation') and work.resolve()==work
proof=load(mounted(p['proof']));q=load(mounted(p['qualification']));applied=load(work/'installed.json');native=load(work/'native-acceptance.json');recovery=load(work/'recovery.json')
assert proof['success'] and proof['backendTests']==29 and proof['profileRelocationTested'] and proof['uiUnchanged'] and proof['changedArchiveEntries']==['build/chat-files.js'] and proof['changedSourceFiles']==['src/chat-files.ts']
assert q['success'] and q['checks']==29 and q['proofSha256']==sha(mounted(p['proof']))
assert sha(mounted(proof['testLog']))==proof['testLogSha256']
for name,digest in proof['tests'].items():assert sha(work/'candidate-tests'/name)==digest
required=['normalReopeningPassed','originalChatRestored','originalAttachmentPreserved','originalDraftEmpty','latestUserTestReplyPreserved','modelAndPermissionsRestored','legacyPrivateWordLinkOpened','sourceAndDownloadsUnchanged','sidebarAndDetailsPreserved','workspaceClosedAndLatestChatRestored','noRequestSentOrReplayed']
assert applied['success'] and applied['independentArchiveVerification'] and native['success'] and all(native[k] for k in required) and native['providerRequests']==0
assert native['core']=={'accounts':2,'chats':116,'messages':400,'requests':200,'runningRequests':0}
probe=load(work/'public-root-relocation-probe.json')
assert probe['acceptancePassed'] and probe['sameReference'] and probe['priorEditedCopyRetained'] and probe['reopenedContents']=='EDITED' and probe['providerRequests']==0
for file,digest in native['unchangedDocuments'].items():assert sha(mounted(file))==digest
assert sha(work/'candidate-build/exact-archive-chat-files.js')==proof['backendHashes']['chat-files.js']
installed=Path('/mnt/c/Users/charl/AppData/Local/AgentopiaDesktop/app-0.44.47/resources');assert installed.resolve()==installed
assert sha(installed/'app.asar')==proof['imageSha256']==applied['imageSha256']==sha(mounted(proof['image']))
for name,digest in proof['uiHashes'].items():assert sha(installed/'resources/ui'/name)==digest
for name,digest in proof['sourceHashes'].items():
 assert sha(mounted(proof['source'])/name)==digest
 if name.startswith('src/') or name.startswith('ui/'):assert sha(root/'desktop'/name)==digest
assert sha(installed/'resources/runtime/Restore-Agentopia.ps1')==applied['resourceFiles']['runtime/Restore-Agentopia.ps1']
assert sha(mounted(recovery['beforeArchive']))==proof['baseImageSha256']
before=mounted(recovery['out']);assert sha(before/'active-profile.tar.gz')==recovery['profileArchiveSha256']
data_file=sorted(before.glob('data-after-ui-*.json'))[-1];data=load(data_file);assert data['success'] and data['tableCount']==126 and not data['mismatches']
assert datetime.datetime.now(datetime.timezone.utc)-datetime.datetime.fromisoformat(data['at'])<datetime.timedelta(minutes=10)
base=load(mounted(proof['baseReopened']));assert base['success'] and base['normalReopeningPassed'] and base['revision']=='chat-output-edits-13' and base['imageSha256']==proof['baseImageSha256']
record={**applied,'at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'nativeAcceptancePending':False,'normalReopeningPassed':True,'tablesCompared':126,'allSavedDataPreserved':True,'nativeAcceptance':str(work/'native-acceptance.json'),'dataComparison':str(data_file),'priorAcceptedArchive':proof['baseReopened'],'executionHarnessAgentPolicyMemoryAndSchemaUnchanged':True,'providerAndAgentExecutionModulesUnchanged':True,'source':proof['source'],'ui':proof['ui'],'uiUnchanged':True,'qualifiedWorkflowGroups':29,'privateExportCopyTested':True,'profileRelocationTested':True,'combinedDefaultPublicRootRelocationTested':True,'cleanMachineRestorationTested':False,'fullGoalComplete':False}
for file in [work/'reopened.json',root/'.supabase/desktop-export-relocation/reopened.json']:
 with file.open('x') as stream:json.dump(record,stream,indent=2)
print(json.dumps({k:v for k,v in record.items() if k!='resourceFiles'}))
