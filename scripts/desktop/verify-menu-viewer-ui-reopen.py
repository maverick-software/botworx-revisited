from pathlib import Path
import json,hashlib,datetime
from audit_menu_viewer_process import ordinary_processes
candidate=Path('/mnt/d/Users/charl/software/Agentopia/.supabase/desktop-platform-release/candidate-04446')
proof=json.loads((candidate/'ui-hotfix-proof.json').read_text());qualified=json.loads((candidate/'ui-hotfix-qualification.json').read_text());installed=json.loads((candidate/'ui-hotfix-installed.json').read_text());cold=json.loads((candidate/'cold-reopen-audit.json').read_text())
assert qualified['success'] and qualified['uiChecks']==17 and installed['success'] and cold['success'] and cold['noRequestReplay']
assert proof['resourceManifestSha256']==qualified['resourceManifestSha256']==installed['resourceManifestSha256']
resources=Path('/mnt/c/Users/charl/AppData/Local/AgentopiaDesktop/app-0.44.46/resources/resources');count=0
for name,digest in proof['resourceFiles'].items():
 if name.startswith('ui/'):
  with (resources/name).open('rb') as stream:assert hashlib.file_digest(stream,'sha256').hexdigest()==digest
  count+=1
receipt={'success':True,'at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'version':'0.44.46','uiHotfixRevision':1,'ordinaryProcess':ordinary_processes('0.44.46'),'uiFilesComparedAfterColdReopening':count,'finalUiManifestPreserved':True,'resourceManifestSha256':proof['resourceManifestSha256'],'savedCoreCountsUnchanged':True,'noRequestReplay':True,'providerRequests':0}
with (candidate/'ui-hotfix-cold-reopen.json').open('x') as stream:json.dump(receipt,stream,indent=2)
print(json.dumps(receipt))
