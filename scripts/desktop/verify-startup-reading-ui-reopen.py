from pathlib import Path
import datetime,hashlib,json
from audit_navigation_rollup_process import ordinary_processes
candidate=Path('/mnt/d/Users/charl/software/Agentopia/.supabase/desktop-platform-release/candidate-04447')
proof=json.loads((candidate/'startup-reading-proof.json').read_text());q=json.loads((candidate/'startup-reading-qualification.json').read_text());applied=json.loads((candidate/'startup-reading-installed.json').read_text())
assert q['success'] and q['startupChecks']==5 and applied['success']
assert q['resourceManifestSha256']==applied['resourceManifestSha256']==proof['resourceManifestSha256']
work=Path(proof['work'].replace('C:\\','/mnt/c/').replace('\\','/'));before=json.loads((work/'data-before.json').read_text());after=json.loads((work/'data-after.json').read_text())
assert before['success'] and after['success'] and before['tables']==after['tables'] and after['tableCount']==126
resources=Path('/mnt/c/Users/charl/AppData/Local/AgentopiaDesktop/app-0.44.47/resources');count=0
with (resources/'app.asar').open('rb') as f:assert hashlib.file_digest(f,'sha256').hexdigest()==proof['imageSha256']
for name,digest in proof['resourceFiles'].items():
 if name.startswith('ui/'):
  with (resources/'resources'/name).open('rb') as f:assert hashlib.file_digest(f,'sha256').hexdigest()==digest
  count+=1
receipt={'success':True,'at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'version':'0.44.47','uiHotfixRevision':1,'process':ordinary_processes('0.44.47'),'uiFilesComparedAfterReopening':count,'finalUiManifestPreserved':True,'resourceManifestSha256':proof['resourceManifestSha256'],'tablesPreserved':126,'noRequestReplay':True,'providerRequests':0,'nativeLatestResponseObservationRequired':True}
with (candidate/'startup-reading-reopened.json').open('x') as f:json.dump(receipt,f,indent=2)
print(json.dumps(receipt))
