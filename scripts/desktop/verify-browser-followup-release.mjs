import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {listPackage,statFile,extractFile} from '@electron/asar';
const root=path.resolve(import.meta.dirname,'../..'),work=path.join(root,'.supabase/desktop-browser-followup/candidate-0441'),base=path.join(root,'.supabase/desktop-workspace-agents/candidate-0440');
const json=async file=>JSON.parse(await readFile(file,'utf8')),hash=b=>createHash('sha256').update(b).digest('hex'),packaged=await json(path.join(work,'package-proof.json')),original=await json(path.join(base,'package-proof.json'));
assert(packaged.success&&original.success);assert.equal(hash(await readFile(packaged.image)),packaged.imageSha256);assert.equal(hash(await readFile(original.image)),original.imageSha256);
const dependencies=image=>listPackage(image).map(file=>file.replaceAll('\\','/').replace(/^\//,'')).filter(file=>file.startsWith('node_modules/')&&!statFile(image,path.normalize(file)).files);
const next=dependencies(packaged.image),previous=dependencies(original.image),changed=[];assert.deepEqual([...next].sort(),[...previous].sort());
for(const file of next)if(hash(extractFile(packaged.image,path.normalize(file)))!==hash(extractFile(original.image,path.normalize(file))))changed.push(file);
assert(changed.every(file=>file==='node_modules/.package-lock.json'),'Dependency payload unexpectedly changed');
const directory=await json(path.join(work,'packaged-directory-presentation-qualified/evidence.json')),ui=await json(path.join(work,'built-ui/evidence.json')),preparation=await json(path.join(work,'preparation.json'));
assert(directory.success&&ui.success);assert.equal(directory.checks.length,21);assert.equal(ui.version,'0.44.1');assert.equal(ui.checks.length,6);
const proof={success:true,phase:'portable-controlled-checks-passed',at:new Date().toISOString(),version:'0.44.1',imageSha256:packaged.imageSha256,baseImageSha256:original.imageSha256,compiledModules:packaged.compiledModules,changedModules:preparation.changedModules,unchangedModules:preparation.unchangedModules,dependencyFiles:next.length,changedDependencyMetadata:changed,resourceFiles:packaged.resourceFiles,migrations:54,directoryChecks:21,minifiedUiChecks:6,sourceUiEvidence:'../../desktop-browser-results/ui-1792286481152/evidence.json',directoryEvidence:'packaged-directory-presentation-qualified/evidence.json',uiEvidence:'built-ui/evidence.json',productionMigrated:false,installed:false,installerCreated:false,liveInferenceRequests:0,frozen0440ImageVerified:true,remaining:['human ChatGPT reauthorization','database-backed tool receipt qualification','actual provider-driven browser/agent acceptance','fresh verified backup and installation/migration','installed history/startup/data preservation','clean-machine and Windows-reboot qualification']};
if(process.argv.includes('--inspect')){const saved=await json(path.join(work,'qualification.json'));assert.equal(saved.imageSha256,proof.imageSha256);assert.equal(saved.baseImageSha256,proof.baseImageSha256);}
else await writeFile(path.join(work,'qualification.json'),JSON.stringify(proof,null,2),{flag:'wx'});
console.log(JSON.stringify({success:true,version:proof.version,dependencyFiles:proof.dependencyFiles,changedDependencyMetadata:changed,directoryChecks:21,minifiedUiChecks:6,installed:false,liveInferenceRequests:0}));
