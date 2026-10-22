"""Accept the installed refresh update only after native behavior and saved-data proof."""
from pathlib import Path
import datetime,hashlib,json
root=Path('/mnt/d/Users/charl/software/Agentopia')
def load(p):return json.loads(Path(p).read_text(encoding='utf-8-sig'))
def mounted(p):return Path('/mnt/'+p[0].lower()+p[2:].replace('\\','/'))
def sha(p):
 with Path(p).open('rb') as f:return hashlib.file_digest(f,'sha256').hexdigest()
p=load(root/'.supabase/desktop-document-refresh/current.json');work=mounted(p['work']);assert work.parent==Path('/mnt/c/Users/charl/AgentopiaQA/document-refresh')
proof=load(mounted(p['proof']));layout=load(mounted(p['layoutProof']));applied=load(work/'layout-installed.json');native=load(work/'native-acceptance.json');recovery=load(work/'recovery.json');qualified=load(mounted(p['productionQualification']))
assert proof['success'] and layout['success'] and applied['success'] and recovery['success'] and qualified['success']
assert qualified['checks']==21 and qualified['totalUniqueWorkflowGroups']==39 and qualified['proofSha256']==sha(mounted(p['proof']))
for row in qualified['receipts']:assert sha(mounted(row['file']))==row['sha256']
assert sha(mounted(layout['receipt']))==layout['receiptSha256'] and load(mounted(layout['receipt']))['success'] and layout['checks']==12
assert proof['changedArchiveEntries']==['build/broker.js','build/workspace-monitor.js'] and layout['changedSourceFiles']==['ui/style.css']
required=['normalReopeningPassed','originalChatRestored','originalAttachmentPreserved','originalDraftEmpty','latestUserTestReplyPreserved','modelAndPermissionsRestored','requestEditsTargetsCurrentFile','nativeFileChangeNoticeObserved','nativeNoticeClearsToolbar','nativeRefreshedContentsVisible','referenceNativeRefreshCompared','sameOriginalDocumentBytesCompared','qaDraftRemoved','qaAttachmentRemoved','qaDocumentTabClosed','originalOfficeOutputHashesUnchanged','noRequestSentOrReplayed']
assert native['success'] and all(native[k] for k in required) and native['providerRequests']==0
assert native['core']=={'accounts':2,'chats':115,'messages':398,'requests':199,'runningRequests':0}
changed=load(mounted(native['nativeFileChange']));assert changed['success'] and changed['parts']==18 and changed['changedParts']==['word/document.xml'] and sha(mounted(changed['file']))==changed['afterSha256']
installed=Path('/mnt/c/Users/charl/AppData/Local/AgentopiaDesktop/app-0.44.47/resources');assert installed.resolve()==installed
assert sha(installed/'app.asar')==proof['imageSha256']==layout['imageSha256']==applied['imageSha256']==sha(mounted(proof['image']))
assert sha(mounted(recovery['beforeArchive']))==proof['baseImageSha256']
for name,digest in layout['uiHashes'].items():assert sha(installed/'resources/ui'/name)==digest==sha(mounted(layout['ui'])/name)
for name,digest in layout['sourceHashes'].items():
 assert sha(mounted(layout['source'])/name)==digest
 if name.startswith('src/') or name.startswith('ui/'):assert sha(root/'desktop'/name)==digest
assert sha(installed/'resources/runtime/Restore-Agentopia.ps1')==applied['resourceFiles']['runtime/Restore-Agentopia.ps1']
before=mounted(recovery['out']);assert sha(before/'active-profile.tar.gz')==recovery['profileArchiveSha256']
data_file=sorted(before.glob('data-after-ui-*.json'))[-1];data=load(data_file);assert data['success'] and data['tableCount']==126 and not data['mismatches']
assert datetime.datetime.now(datetime.timezone.utc)-datetime.datetime.fromisoformat(data['at'])<datetime.timedelta(minutes=10)
base=load(mounted(proof['baseReopened']));assert base['success'] and base['revision']=='office-pane-11' and base['imageSha256']==proof['baseImageSha256']
record={**applied,'at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'nativeAcceptancePending':False,'normalReopeningPassed':True,'tablesCompared':126,'allSavedDataPreserved':True,'nativeAcceptance':str(work/'native-acceptance.json'),'dataComparison':str(data_file),'priorAcceptedArchive':proof['baseReopened'],'executionHarnessAgentPolicyMemoryAndSchemaUnchanged':True,'providerAndAgentExecutionModulesUnchanged':True,'source':layout['source'],'ui':layout['ui'],'qualifiedWorkflowGroups':39,'referenceNativeRefreshCompared':True,'cleanMachineRestorationTested':False,'fullGoalComplete':False}
for file in [work/'reopened.json',root/'.supabase/desktop-document-refresh/reopened.json']:
 with file.open('x') as stream:json.dump(record,stream,indent=2)
print(json.dumps({k:v for k,v in record.items() if k!='resourceFiles'}))
