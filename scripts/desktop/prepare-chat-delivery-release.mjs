import {cp,mkdir,readFile,writeFile,readdir,lstat} from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import {createHash} from 'node:crypto';
import {spawn} from 'node:child_process';
import path from 'node:path';
import assert from 'node:assert/strict';
import {build} from 'vite';
import react from '@vitejs/plugin-react';
import {extractFile,listPackage,statFile} from '@electron/asar';
import {desktopOperation} from './operation-lock.mjs';

desktopOperation('freeze and package chat coordination and goal queue');
const root=path.resolve(import.meta.dirname,'../..'),base=path.join(root,'.supabase/desktop-chat-inspection/candidate-04418'),work=path.join(root,'.supabase/desktop-chat-delivery/candidate-04419'),source=path.join(work,'source/desktop'),stage=path.join(work,'staging'),resources=path.join(work,'resources');
const json=async file=>JSON.parse(await readFile(file,'utf8')),hash=bytes=>createHash('sha256').update(bytes).digest('hex'),hashFile=async file=>{const h=createHash('sha256');for await(const bytes of createReadStream(file))h.update(bytes);return h.digest('hex');};
const changes=['src/agent-policy.ts','src/broker.ts','src/chat-delivery-queue.ts','src/chat-delivery.ts','src/chat-origin.ts','src/chat-queue.ts','src/codex-harness.ts','src/composer.ts','src/contracts.ts','src/goal-queue.ts','src/native-contracts.ts','src/tool-contracts.ts','src/tool-service.ts','ui/agent-style.css','ui/chat-delivery.css','ui/ChatCoordinationSettings.tsx','ui/ChatDeliveryReview.tsx','ui/ChatOrigin.tsx','ui/ChatQueue.tsx','ui/NativeTurn.tsx','ui/SettingsPanel.tsx','ui/ToolActivity.tsx','ui/WorkspaceViews.tsx','database/0061-chat-delivery.sql','database/0062-chat-delivery-turns.sql','database/0063-chat-delivery-dispatch.sql'];
const qualificationFiles=['.supabase/desktop-goal-queue-ordering/check-1792351059862/evidence.json','.supabase/desktop-goal-queue/ui-1792351258484/evidence.json','.supabase/desktop-chat-delivery/controls-ui-1792351240184/evidence.json','.supabase/desktop-chat-delivery/check-1792350254411/evidence.json'],qualifications=await Promise.all(qualificationFiles.map(file=>json(path.join(root,file)))),storageFile='.supabase/desktop-chat-delivery/storage-1792349918241/evidence.json',storage=await json(path.join(root,storageFile)),previous=await json(path.join(base,'release-proof.json'));
assert(qualifications.every(value=>value.success)&&qualifications[0].passed===101&&storage.success&&storage.disposableDatabaseRemoved&&storage.productionInventoryUnchanged&&previous.success&&!previous.installed);
assert.equal(previous.version,'0.44.18');assert.equal(await hashFile(previous.image),previous.imageSha256);
for(const [file,digest] of Object.entries(previous.sourceHashes))assert.equal(await hashFile(path.join(previous.source,file)),digest,'Frozen 0.44.18 source changed: '+file);
for(const file of changes){const digest=await hashFile(path.join(root,'desktop',file));assert(qualifications.some(proof=>proof.sourceSha256?.['desktop/'+file]===digest),'Current file lacks matching passing qualification: '+file);}
for(const file of changes.filter(file=>file.startsWith('database/')))assert.equal(storage.applied[path.basename(file)],await hashFile(path.join(root,'desktop',file)));
const inventory=async directory=>{const output=[];for(const entry of await readdir(directory,{withFileTypes:true})){if(['build','node_modules','dist'].includes(entry.name))continue;const file=path.join(directory,entry.name);if(entry.isDirectory())output.push(...await inventory(file));else if(entry.isFile())output.push(file);}return output;};
const actual=[];for(const folder of ['src','ui','database'])for(const file of await inventory(path.join(root,'desktop',folder))){const relative=path.relative(path.join(root,'desktop'),file).replaceAll('\\','/');let old;try{old=await hashFile(path.join(base,'source/desktop',relative));}catch(error){if(error.code!=='ENOENT')throw error;}if(old!==await hashFile(file))actual.push(relative);}assert.deepEqual(actual.sort(),[...changes].sort(),'Inspect unexpected source changes before freezing');
try{await lstat(work);throw Error('Candidate already exists. Inspect its checkpoint and running process before recovery.');}catch(error){if(error.code!=='ENOENT')throw error;}
await mkdir(work,{recursive:true});const intent={at:new Date().toISOString(),pid:process.pid,phase:'freezing',version:'0.44.19',baseVersion:'0.44.18',baseImageSha256:previous.imageSha256,installed:false,productionMigrated:false};
const mark=async phase=>{intent.phase=phase;await writeFile(path.join(work,'preparation.json'),JSON.stringify(intent,null,2));};
const run=args=>new Promise((resolve,reject)=>{const child=spawn(process.execPath,args,{cwd:root,windowsHide:true,stdio:'inherit'});child.once('error',reject);child.once('exit',code=>code===0?resolve():reject(Error('Preparation command exited '+code)));});
try{
 await mark('freezing');console.log('Freezing 26 qualified changes onto the separate 0.44.18 baseline.');
 await cp(path.join(base,'source/desktop'),source,{recursive:true,filter:file=>file!==path.join(base,'source/desktop/build')});
 for(const file of changes){await mkdir(path.dirname(path.join(source,file)),{recursive:true});await cp(path.join(root,'desktop',file),path.join(source,file));}
 const tests=['goal-queue','goal-queue-native','native-goal-broker','native-goals','chat-queue','chat-delivery','chat-delivery-tools','chat-delivery-broker','chat-delivery-queue','native-inference-routing','chat-inspection','agent-policy','agent-native-policy','native-steering-context'];
 for(const name of tests)await cp(path.join(root,'desktop/tests',name+'.test.cjs'),path.join(source,'tests',name+'.test.cjs'));
 await mark('compiling');await run(['node_modules/typescript/bin/tsc','-p',path.join(source,'tsconfig.json'),'--noEmitOnError']);await run(['node_modules/typescript/bin/tsc','-p',path.join(source,'ui/tsconfig.json')]);
 await mark('staging');await cp(path.join(base,'staging'),stage,{recursive:true,filter:file=>file!==path.join(base,'staging/out')});await cp(path.join(source,'build'),path.join(stage,'build'),{recursive:true});
 const manifest=await json(path.join(stage,'package.json'));manifest.version=intent.version;await writeFile(path.join(stage,'package.json'),JSON.stringify(manifest,null,2));
 await cp(path.join(base,'resources'),resources,{recursive:true});for(const file of changes.filter(file=>file.startsWith('database/')))await cp(path.join(source,file),path.join(resources,file));
 await build({configFile:false,envDir:false,root:path.join(source,'ui'),plugins:[react()],base:'/',build:{outDir:path.join(resources,'ui'),emptyOutDir:true,assetsInlineLimit:0}});
 await writeFile(path.join(resources,'version.json'),JSON.stringify({version:intent.version,supabase:'2.121.0',schema:63},null,2));
 await mark('packaging');const {packager}=await import('@electron/packager'),{createRequire}=await import('node:module'),require=createRequire(import.meta.url),config=require(path.join(stage,'forge.config.cjs'));
 await packager({...config.packagerConfig,dir:stage,out:path.join(stage,'out'),platform:'win32',arch:'x64',electronVersion:'44.7.2',prune:false});
 await mark('verifying');const sourceHashes={};for(const file of changes){sourceHashes[file]=await hashFile(path.join(source,file));assert.equal(sourceHashes[file],await hashFile(path.join(root,'desktop',file)),'Source changed during preparation: '+file);}
 const image=path.join(stage,'out/Agentopia-win32-x64/resources/app.asar'),delivered=path.join(stage,'out/Agentopia-win32-x64/resources/resources'),files=archive=>listPackage(archive).map(file=>file.replaceAll('\\','/').replace(/^\//,'')).filter(file=>!statFile(archive,path.normalize(file)).files),before=files(previous.image),after=files(image);
 assert(before.every(file=>after.includes(file)),'An existing packaged module was removed');const added=after.filter(file=>!before.includes(file));assert.deepEqual(added.sort(),['build/chat-delivery-queue.js','build/chat-delivery.js','build/chat-origin.js','build/goal-queue.js'].sort());
 const archiveChanges=[];for(const file of before)if(hash(extractFile(image,path.normalize(file)))!==hash(extractFile(previous.image,path.normalize(file)))){archiveChanges.push(file);assert(file==='package.json'||changes.includes('src/'+file.replace(/^build\//,'').replace(/\.js$/,'.ts')),'Unexpected archive change: '+file);}
 assert.deepEqual(JSON.parse(extractFile(image,'package.json')),{...JSON.parse(extractFile(previous.image,'package.json')),version:intent.version});
 let resourceFiles=0;for(const relative of await readdir(resources,{recursive:true})){const file=path.join(resources,relative);if(!(await lstat(file)).isFile())continue;resourceFiles++;const name=relative.replaceAll('\\','/'),digest=await hashFile(file);assert.equal(await hashFile(path.join(delivered,relative)),digest,'Delivery mismatch: '+name);if(!name.startsWith('ui/')&&!['version.json','database/0061-chat-delivery.sql','database/0062-chat-delivery-turns.sql','database/0063-chat-delivery-dispatch.sql'].includes(name))assert.equal(await hashFile(path.join(base,'resources',relative)),digest,'Unexpected resource change: '+name);}
 assert.equal((await readdir(path.join(delivered,'database'))).filter(file=>file.endsWith('.sql')).length,63);assert.equal(await hashFile(previous.image),previous.imageSha256);
 const proof={...intent,success:true,phase:'packaged-awaiting-exact-image-qualification',source,sourceHashes,stage,image,imageSha256:await hashFile(image),portableDirectory:path.dirname(path.dirname(image)),archiveChanges,added,resourceFiles,migrations:63,installerCreated:false,liveAcceptancePending:true,qualificationFiles:qualificationFiles.map(file=>path.join(root,file)),storageQualification:path.join(root,storageFile)};
 await writeFile(path.join(work,'package-proof.json'),JSON.stringify(proof,null,2),{flag:'wx'});await writeFile(path.join(work,'preparation.json'),JSON.stringify(proof,null,2));console.log(JSON.stringify({success:true,version:proof.version,imageSha256:proof.imageSha256,resourceFiles,work},null,2));
}catch(error){intent.failedPhase=intent.phase;intent.error=error.message;await mark('failed');throw error;}
