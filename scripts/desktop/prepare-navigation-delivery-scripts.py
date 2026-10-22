"""Adapt the checked46 delivery scripts to the exact47 rollup evidence."""
from pathlib import Path
import json,hashlib,datetime
root=Path(__file__).resolve().parents[2]
e=Path('C:/Users/charl/AgentopiaQA/profile-controller/1792452502702/evidence.json')
d=json.loads(e.read_text(encoding='utf-8'))
assert d['success'] and d['version']=='0.44.47' and len(d['checks'])==6 and d['copiedActualNativeThreads']==1 and not d['productionProfileChanged']
p=root/'.supabase/desktop-profile-location/controller47-qualified.json'
with p.open('x',encoding='utf-8') as f:
 json.dump({'at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'success':True,'version':d['version'],'imageSha256':d['imageSha256'],'evidence':str(e),'evidenceSha256':hashlib.sha256(e.read_bytes()).hexdigest(),'groups':6,'copiedActualNativeThreads':1,'generatedProfileOnly':True,'productionProfileChanged':False,'realProviderRequests':0},f,indent=2)
s=(root/'scripts/desktop/make-menu-viewer-installer.mjs').read_text(encoding='utf-8').replace('04446','04447').replace('0.44.46','0.44.47').replace('menu-viewer-installer','navigation-rollup-installer')
before='assert.equal(qualified.backendChecks,63);assert.equal(qualified.uiChecks,16);assert.equal(await hash(qualified.uiEvidence),qualified.uiEvidenceSha256);'
after="""assert.equal(qualified.backendChecks,63);assert.equal(qualified.uiChecks,52);assert.equal(await hash(qualified.uiQualification.file),qualified.uiQualification.sha256);
const compatibilityFile=path.join(work,'private-backend-acceptance.json'),compatibility=await json(compatibilityFile),controllerFile=path.join(root,'.supabase/desktop-profile-location/controller47-qualified.json'),controller=await json(controllerFile);
assert(compatibility.success&&compatibility.version===version&&compatibility.imageSha256===proof.imageSha256&&compatibility.coldRecovery&&compatibility.legacyAbsoluteLinksCompatible);assert(controller.success&&controller.version===version&&controller.imageSha256===proof.imageSha256);assert.equal(await hash(controller.evidence),controller.evidenceSha256);"""
assert s.count(before)==1
s=s.replace(before,after)
with (root/'scripts/desktop/make-navigation-rollup-installer.mjs').open('x',encoding='utf-8') as f:f.write(s)
s=(root/'scripts/desktop/verify-menu-viewer-installer.mjs').read_text(encoding='utf-8').replace('04446','04447').replace('0.44.46','0.44.47').replace(r'0\.44\.46',r'0\.44\.47').replace('menu-viewer-installer','navigation-rollup-installer')
with (root/'scripts/desktop/verify-navigation-rollup-installer.mjs').open('x',encoding='utf-8') as f:f.write(s)
print(json.dumps({'success':True,'controllerGroups':6,'newBuilderRequiresPrivateCompatibility':True,'installed':False}))
