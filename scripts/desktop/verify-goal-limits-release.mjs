import {readFile,writeFile,readdir,lstat,mkdir} from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {build} from 'esbuild';
import path from 'node:path';
import assert from 'node:assert/strict';
import {listPackage,statFile,extractFile} from '@electron/asar';

const root=path.resolve(import.meta.dirname,'../..'),work=path.join(root,'.supabase/desktop-goal-limits/candidate-0447'),base=path.join(root,'.supabase/desktop-native-goals/candidate-0446');
const json=async file=>JSON.parse(await readFile(file,'utf8')),hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const hashFile=async file=>{const h=createHash('sha256');for await(const bytes of createReadStream(file))h.update(bytes);return h.digest('hex');};
const packaged=await json(path.join(work,'package-proof.json')),prepared=await json(path.join(work,'preparation.json')),previous=await json(path.join(base,'package-proof.json'));
for(const record of [packaged,previous]){assert(record.success);assert.equal(await hashFile(record.image),record.imageSha256);}
assert.equal(JSON.parse(extractFile(packaged.image,'package.json')).version,'0.44.7');
const files=image=>listPackage(image).map(file=>file.replaceAll('\\','/').replace(/^\//,'')).filter(file=>!statFile(image,path.normalize(file)).files);
const current=files(packaged.image),past=files(previous.image),dependencies=current.filter(file=>file.startsWith('node_modules/'));
assert.deepEqual([...current.filter(file=>file!=='build/goal-settings.js')].sort(),[...past].sort());
assert.equal(dependencies.length,2232);for(const file of dependencies)assert.equal(hash(extractFile(packaged.image,path.normalize(file))),hash(extractFile(previous.image,path.normalize(file))));
const modules=current.filter(file=>file.startsWith('build/')&&/\.(js|json)$/.test(file)),changed=[],added=[];assert.equal(modules.length,1015);
for(const file of modules){
 const bytes=extractFile(packaged.image,path.normalize(file));assert(bytes.equals(await readFile(path.join(work,'staging',file))));assert(bytes.equals(await readFile(path.join(work,'units/archived',file))));
 if(!past.includes(file))added.push(file.slice(6));else if(hash(bytes)!==hash(extractFile(previous.image,path.normalize(file))))changed.push(file.slice(6));
}
assert.deepEqual(changed.sort(),['broker.js','codex-harness.js']);assert.deepEqual(added,['goal-settings.js']);
async function inventory(folder){const files=[];for(const relative of await readdir(folder,{recursive:true}))if((await lstat(path.join(folder,relative))).isFile())files.push(relative.replaceAll('\\','/'));return files.sort();}
const delivered=path.join(work,'staging/out/Agentopia-win32-x64/resources/resources'),resources=await inventory(path.join(work,'resources')),oldResources=await inventory(path.join(base,'resources'));
assert.equal(resources.length,6147);assert.deepEqual(await inventory(delivered),resources);
let unchanged=0;const allowed=file=>file.startsWith('ui/')||file==='version.json'||file==='database/0057-goal-limits.sql';
for(const file of resources){assert.equal(await hashFile(path.join(delivered,file)),await hashFile(path.join(work,'resources',file)));if(!allowed(file)){assert(oldResources.includes(file));assert.equal(await hashFile(path.join(delivered,file)),await hashFile(path.join(base,'resources',file)));unchanged++;}}
for(const file of oldResources.filter(file=>!file.startsWith('ui/')&&file!=='version.json'))assert(resources.includes(file));
const styles=resources.filter(file=>file.startsWith('ui/')&&file.endsWith('.css'));assert.deepEqual(styles,oldResources.filter(file=>file.startsWith('ui/')&&file.endsWith('.css')));
for(const file of styles)assert.equal(await hashFile(path.join(delivered,file)),await hashFile(path.join(base,'resources',file)));
assert.deepEqual(await json(path.join(delivered,'version.json')),{version:'0.44.7',supabase:'2.121.0',schema:57});assert.equal((await readdir(path.join(delivered,'database'))).filter(file=>file.endsWith('.sql')).length,57);
const units=await json(path.join(work,'units/evidence.json')),skillsUI=await json(path.join(work,'built-ui/evidence.json')),childUI=await json(path.join(work,'child-ui/evidence.json')),goalUI=await json(path.join(work,'goal-ui-settled/evidence.json'));
const routing=await json(path.join(work,'units/parent-stop-child-resume.json')),unlimited=await json(path.join(work,'units/unlimited-goal.json')),budget=await json(path.join(work,'units/token-budget.json')),source=await json(prepared.sourceQualification);
assert(units.success&&skillsUI.success&&childUI.success&&goalUI.success&&source.success);assert.equal(units.passed,124);assert.equal(units.failed,0);assert.equal(units.imageSha256,packaged.imageSha256);assert.equal(goalUI.imageSha256,packaged.imageSha256);
assert.equal(skillsUI.checks.length,5);assert.equal(childUI.checks.length,5);assert.equal(goalUI.checks.length,11);for(const ui of [skillsUI,childUI,goalUI])assert.equal(ui.version,'0.44.7');
assert.equal(skillsUI.backend.models+skillsUI.backend.tokens,0);assert.equal(goalUI.goalSettingsAppearance.opacity,'1');assert(/^rgb\(\d+,\s*\d+,\s*\d+\)$/.test(goalUI.goalSettingsAppearance.background));assert(childUI.compactInterruptionPresentation&&childUI.narrowChildContentWidth<=440);
assert(routing.success&&routing.independentChildResumed&&routing.resumedChildStopped&&routing.cancelledParentCannotBorrowChild);
assert(unlimited.success&&unlimited.nativeTurns===12&&budget.success&&budget.removalPreservedUsage&&budget.resumed.status==='paused');
assert.equal(hash(await readFile(prepared.sourceQualification)),prepared.sourceQualificationSha256);
const presentation=path.join(work,'presentation');await mkdir(presentation);const helper=path.join(presentation,'native-child-items.cjs');
await build({entryPoints:[path.join(prepared.source,'ui/native-child-items.ts')],outfile:helper,bundle:true,platform:'node',format:'cjs',logLevel:'silent'});
const result=spawnSync(process.execPath,['--test','--test-reporter=tap','desktop/tests/native-child-presentation.test.cjs'],{cwd:root,env:{...process.env,AGENTOPIA_CHILD_PRESENTATION_HELPER:helper,AGENTOPIA_CHILD_PRESENTATION_SAVED:path.join(work,'units/saved-child-view.json')},encoding:'utf8',windowsHide:true,maxBuffer:4*1024*1024});
await writeFile(path.join(presentation,'tests.log'),(result.stdout??'')+(result.stderr??''));assert.equal(result.status,0);assert.equal(Number(result.stdout.match(/^# pass (\d+)/m)?.[1]),3);
const proof={success:true,phase:'portable-controlled-checks-passed',at:new Date().toISOString(),version:'0.44.7',imageSha256:packaged.imageSha256,baseImageSha256:previous.imageSha256,
 compiledModules:1015,changedModules:changed,addedModules:added,unchangedModules:1012,dependencyFiles:2232,changedDependencyFiles:0,resourceFiles:resources.length,
 unchangedResourcesOutsideInterfaceAndVersion:unchanged,stylesUnchanged:true,earlierMigrationsAndRuntimesUnchanged:true,migrations:57,schemaManifest:57,
 unitChecks:124,presentationChecks:3,deliveredSkillUIChecks:5,deliveredChildUIChecks:5,deliveredGoalUIChecks:11,
 unlimitedNativeTurns:12,budgetResumptionPreservesUsage:true,budgetRemovalPreservesUsage:true,sourceQualificationSha256:prepared.sourceQualificationSha256,
 installed:false,productionMigrated:false,liveInferenceRequests:0,remaining:['installer generation and payload verification','fresh ChatGPT exact-image live acceptance',
 'fresh complete profile backup and coordinated installation/migration','ordinary installed workflows and native-session recovery','Windows reboot and clean-machine acceptance','broader desktop parity']};
await writeFile(path.join(work,'qualification.json'),JSON.stringify(proof,null,2),{flag:'wx'});console.log(JSON.stringify(proof,null,2));
