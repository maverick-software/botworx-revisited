import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import assert from 'node:assert/strict';

const root=path.resolve(import.meta.dirname,'../..'),candidate=path.join(root,'.supabase/desktop-platform-release/candidate-04434'),sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const proof=JSON.parse(await readFile(path.join(candidate,'package-proof.json'))),pointer=JSON.parse(await readFile(path.join(candidate,'qualification.json'))),qualification=pointer.evidence;
assert.equal(path.dirname(path.dirname(qualification)),candidate);
const bytes=await readFile(qualification),q=JSON.parse(bytes);
assert(q.success&&q.version==='0.44.34'&&q.exactArchivedBackend&&!q.installed&&!q.productionAccess&&q.liveProviderRequests===0);
assert.equal(q.imageSha256,proof.imageSha256);assert.equal(sha(await readFile(q.image)),q.imageSha256);
assert.equal(q.unitChecks,390);assert.equal(q.schemaChecks,2);
const ui={};
for(const [name,count] of [['reading',4],['goal-queue',10],['scheduled-shell',5],['image-shell',5],['native-tool-shell',7],['plugin-shell',5]]){
 const file=q[name].evidence,content=await readFile(file),e=JSON.parse(content);
 assert(e.success&&(e.rendererFromPackagedResources||e.delivered===path.join(proof.portableDirectory,'resources/resources/ui')||!!q.reusedFrontend&&e.delivered===q.reusedFrontend.previousResources));
 assert.equal(q[name].checks,count);assert.equal(e.checks.length,count);
 if(name==='plugin-shell')assert(e.actualDesktopApp&&e.realParser&&e.controlledNativePicker&&e.controlledInstallationStore&&!e.productionAccess&&!e.inference);
 ui[name]={evidence:file,sha256:sha(content),checks:count};
}
const nativeFile=path.join(path.dirname(qualification),'native-converted-delivered/evidence.json'),nativeBytes=await readFile(nativeFile),native=JSON.parse(nativeBytes);
assert(native.success&&native.exactArchivedBackend&&!native.productionAccess&&!native.ordinaryProfileChanged&&native.inferenceRequests===0&&native.privateStagingCleared);
assert.equal(native.imageSha256,q.imageSha256);assert.equal(native.qualificationSha256,sha(bytes));assert.equal(native.checks.length,2);
assert.deepEqual(native.checks.map(row=>row.format),['portable','codex']);for(const row of native.checks){assert.equal(row.review.length,1);assert.equal(row.review[0].files,3);assert.equal(row.helperExecuted,false);}
const base=JSON.parse(await readFile(path.join(root,'.supabase/desktop-platform-release/candidate-04433/package-proof.json')));
assert.equal(sha(await readFile(base.image)),base.imageSha256);assert.equal(base.imageSha256,proof.baseImageSha256);
const accepted={success:true,at:new Date().toISOString(),version:'0.44.34',schema:69,image:proof.image,imageSha256:q.imageSha256,status:'exact-image-controlled-qualified-uninstalled',backendChecks:392,deliveredUiChecks:36,convertedSkillFormats:2,qualification:{path:qualification,sha256:sha(bytes)},reusedFrontend:q.reusedFrontend,ui,native:{path:nativeFile,sha256:sha(nativeBytes)},previous33Unchanged:true,ordinaryProfileChanged:false,realProviderRequests:0,installed:false,productionMigrated:false,fullPackagedAcceptanceRequired:true,limitations:['The full restored-data Windows executable and cold reopening have not been qualified for this image.','The plugin picker and installation store are controlled fixtures; SQL persistence and actual agent assignment still require full executable verification.','No real model inference or live external service request is part of these checks.','Ordinary installation and current-image live acceptance remain open.']};
await writeFile(path.join(candidate,'controlled-acceptance.json'),JSON.stringify(accepted,null,2),{flag:'wx'});
console.log(JSON.stringify({success:true,version:accepted.version,backendChecks:392,deliveredUiChecks:36,convertedSkillFormats:2,installed:false,fullPackagedAcceptanceRequired:true}));
