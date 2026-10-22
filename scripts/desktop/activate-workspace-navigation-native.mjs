import {readFile,writeFile,cp,rename,readdir,lstat} from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {desktopOperation} from './operation-lock.mjs';
import {closed,hash} from './phased-backup-control.mjs';
desktopOperation('activate verified workspace navigation with native Windows backup and rollback');
await closed();
const candidate=path.resolve('.supabase/desktop-platform-release/candidate-04446'),json=async name=>JSON.parse(await readFile(path.join(candidate,name),'utf8'));
const base=await json('composer-buttons-proof.json'),proof=await json('workspace-navigation-proof.json'),qualified=await json('workspace-navigation-qualification.json');
assert(qualified.success&&qualified.uiChecks===17&&qualified.readingChecks===15&&qualified.agentChecks===5&&qualified.agentFormChecks===15);
assert.equal(proof.resourceManifestSha256,qualified.resourceManifestSha256);
assert.equal(await hash(qualified.uiEvidence),qualified.uiEvidenceSha256);assert.equal(await hash(qualified.readingEvidence),qualified.readingEvidenceSha256);assert.equal(await hash(qualified.agentEvidence),qualified.agentEvidenceSha256);assert.equal(await hash(qualified.agentFormEvidence),qualified.agentFormEvidenceSha256);
const installed='C:/Users/charl/AppData/Local/AgentopiaDesktop/app-0.44.46/resources',resources=path.join(installed,'resources'),current=path.join(resources,'ui'),pending=path.join(resources,'ui-workspace-navigation-pending'),before=path.join(proof.work,'before-ui'),profile='C:/Users/charl/AppData/Roaming/Agentopia',profileBackup=path.join(proof.work,'profile-before-native');
assert.equal(path.dirname(proof.work),'C:\\Users\\charl\\AgentopiaQA\\workspace-navigation-ui');assert.equal(await hash(path.join(installed,'app.asar')),proof.imageSha256);
async function parallel(items,fn){let next=0;await Promise.all(Array.from({length:16},async()=>{while(next<items.length){const item=items[next++];await fn(item);}}));}
for(const file of [current,proof.ui])assert(!(await lstat(file)).isSymbolicLink());
await parallel(Object.entries(base.resourceFiles).filter(([name])=>name.startsWith('ui/')),async([name,digest])=>assert.equal(await hash(path.join(resources,name)),digest));
for(const file of [pending,before]){let exists=false;try{await lstat(file);exists=true;}catch(e){if(e.code!=='ENOENT')throw e;}assert(!exists,'Refusing to overwrite '+file);}
const profileFiles={},names=[],roots=['credentials.bin','Local State','Preferences','runtime-binding.json','schema-release.json','window.json','Local Storage','Session Storage','Network'];
async function inventory(relative){const info=await lstat(path.join(profile,relative));assert(!info.isSymbolicLink());if(info.isFile()){names.push(relative);return;}for(const entry of await readdir(path.join(profile,relative),{withFileTypes:true})){const name=path.join(relative,entry.name);assert(!entry.isSymbolicLink());if(entry.isDirectory())await inventory(name);else if(entry.isFile())names.push(name);}}
for(const name of roots){await inventory(name);await cp(path.join(profile,name),path.join(profileBackup,name),{recursive:true});}
console.log('Checking '+names.length+' account, session and UI-state recovery files.');
await parallel(names,async name=>{const file=path.join(profile,name),info=await lstat(file);assert(!info.isSymbolicLink());if(info.isFile()){const digest=await hash(file);assert.equal(await hash(path.join(profileBackup,name)),digest);profileFiles[name]=digest;}});
await writeFile(path.join(proof.work,'profile-backup-manifest.json'),JSON.stringify(profileFiles,null,2),{flag:'wx'});console.log('Verified profile recovery: '+Object.keys(profileFiles).length+' files.');
await cp(proof.ui,pending,{recursive:true,errorOnExist:true,force:false});
await parallel(Object.entries(proof.resourceFiles).filter(([name])=>name.startsWith('ui/')),async([name,digest])=>assert.equal(await hash(path.join(pending,name.slice(3))),digest));
await closed();await rename(current,before);try{await rename(pending,current);}catch(e){await rename(before,current);throw e;}
await parallel(Object.entries(proof.resourceFiles),async([name,digest])=>assert.equal(await hash(path.join(resources,name)),digest));
const receipt={success:true,at:new Date().toISOString(),version:'0.44.46',uiHotfixRevision:3,beforeUi:before,profileBackup,profileFilesCompared:Object.keys(profileFiles).length,profileBackupScope:roots,excludedProfilePaths:['runtime and generated test data; unchanged by UI replacement'],rollbackAvailable:true,resourceFilesCompared:Object.keys(proof.resourceFiles).length,resourceManifestSha256:proof.resourceManifestSha256,imageSha256:proof.imageSha256,providerRequests:0,ordinaryAppClosed:true,nativeReopeningPending:true};
await writeFile(path.join(candidate,'workspace-navigation-installed.json'),JSON.stringify(receipt,null,2),{flag:'wx'});console.log(JSON.stringify(receipt));
