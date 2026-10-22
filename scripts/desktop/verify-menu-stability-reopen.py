"""Verify physical resource bytes and the latest complete SQL comparison after reopening."""
from pathlib import Path
import datetime,hashlib,json,glob
root=Path('/mnt/d/Users/charl/software/Agentopia');records=root/'.supabase/desktop-profile-location'
def load(p):return json.loads(Path(p).read_text(encoding='utf-8-sig'))
def sha(p):
    with Path(p).open('rb') as f:return hashlib.file_digest(f,'sha256').hexdigest()
def mounted(value):return Path('/mnt/'+value[0].lower()+value[2:].replace('\\','/'))
pointer=load(records/'menu-stability-ui-current.json');work=mounted(pointer['work']);proof=load(work/'proof.json');applied=load(work/'installed.json');recovery=Path(applied['recovery']);assert applied['success'] and applied['uiHotfixRevision']==2
comparisons=sorted(recovery.glob('data-after-ui-*.json'));assert comparisons;data=load(comparisons[-1]);assert data['success'] and not data['mismatches'] and data['tableCount']==126
installed=Path('/mnt/c/Users/charl/AppData/Local/AgentopiaDesktop/app-0.44.47/resources');assert sha(installed/'app.asar')==applied['imageSha256']
for name,digest in proof['uiFiles'].items():assert sha(installed/'resources/ui'/name)==digest
assert sha(installed/'resources/runtime/Restore-Agentopia.ps1')==applied['restoreHelperSha256']
helper=load(recovery/'installed-helper-refusal.json');assert helper['success'] and helper['existingProductionRuntimeRefused'] and helper['restoreFilesWritten']==0
native=load(work/'native-ui2.json');assert native['success'] and native['sameOriginalConversationRestored'] and native['menuActionsStayedInPlaceAfterCatalogLoaded'] and native['filesActionOpenedFilesView']
receipt={'success':True,'at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'version':'0.44.47','uiHotfixRevision':2,'work':str(work),'recovery':str(recovery),'dataComparison':str(comparisons[-1]),'tableCount':126,'uiFilesVerified':len(proof['uiFiles']),'imageSha256':applied['imageSha256'],'resourceManifestSha256':applied['resourceManifestSha256'],'restoreHelperSha256':applied['restoreHelperSha256'],'installedHelperRefusesExistingRuntime':True,'nativeUiPassed':True,'currentColdImageCaptured':False,'retainedColdBaseWithFreshLogicalAndProfileRecovery':True,'allRuntimeResourcesCompared':False,'providerRequests':0,'noRequestReplay':True,'fullGoalComplete':False}
with (work/'reopened.json').open('x') as stream:json.dump(receipt,stream,indent=2)
with (records/'menu-stability-reopened.json').open('x') as stream:json.dump(receipt,stream,indent=2)
print(json.dumps(receipt))
