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

desktopOperation('freeze and package cross-chat inspection');
const root=path.resolve(import.meta.dirname,'../..'),base=path.join(root,'.supabase/desktop-goal-queue/candidate-04417'),work=path.join(root,'.supabase/desktop-chat-inspection/candidate-04418');
const source=path.join(work,'source/desktop'),stage=path.join(work,'staging'),resources=path.join(work,'resources'),verify=process.argv.includes('--verify-existing'),resumePackage=process.argv.includes('--resume-package');
const json=async file=>JSON.parse(await readFile(file,'utf8')),hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const hashFile=async file=>{const digest=createHash('sha256');for await(const bytes of createReadStream(file))digest.update(bytes);return digest.digest('hex');};
const changes=['src/agent-policy.ts','src/broker.ts','src/chat-inspection.ts','src/codex-harness.ts','src/project-memory.ts','src/tool-service.ts','ui/AgentDefinitionEditor.tsx','ui/ConversationTranscript.tsx','ui/DesktopApp.tsx','ui/WorkspaceViews.tsx','database/0060-chat-inspection.sql'];
const qualification=await json(path.join(root,'.supabase/desktop-chat-inspection/check-1792345003829/evidence.json')),storage=await json(path.join(root,'.supabase/desktop-chat-inspection/storage-1792344980162/evidence.json')),previous=await json(path.join(base,'release-proof.json'));
assert(qualification.success&&qualification.passed===59&&storage.success&&storage.disposableDatabaseRemoved&&previous.success&&previous.installed);
assert.equal(previous.version,'0.44.17');assert.equal(await hashFile(previous.image),previous.imageSha256);
for(const [file,digest]of Object.entries(qualification.sourceSha256))assert.equal(await hashFile(path.join(root,file)),digest,'Source changed after qualification: '+file);
assert.equal(storage.applied['0060-chat-inspection.sql'],qualification.sourceSha256['desktop/database/0060-chat-inspection.sql']);
const inventory=async directory=>{const output=[];for(const entry of await readdir(directory,{withFileTypes:true})){if(['build','node_modules','dist'].includes(entry.name))continue;const file=path.join(directory,entry.name);if(entry.isDirectory())output.push(...await inventory(file));else if(entry.isFile())output.push(file);}return output;};
const actual=[];
for(const folder of ['src','ui','database'])for(const file of await inventory(path.join(root,'desktop',folder))){const relative=path.relative(path.join(root,'desktop'),file).replaceAll('\\','/');let old;try{old=await hashFile(path.join(base,'source/desktop',relative));}catch(error){if(error.code!=='ENOENT')throw error;}if(old!==await hashFile(file))actual.push(relative);}
assert.deepEqual(actual.sort(),[...changes].sort(),'Inspect unexpected shared-source changes before packaging');
const run=args=>new Promise((resolve,reject)=>{const child=spawn(process.execPath,args,{cwd:root,windowsHide:true,stdio:'inherit'});child.once('error',reject);child.once('exit',code=>code===0?resolve():reject(Error('Preparation exited '+code)));});
const packageStage=async()=>{
 // The baseline is a delivered, already-pruned runtime dependency tree. Package
 // it directly with Forge's pinned underlying packager; automatic rebuild would
 // require development modules intentionally absent from that delivered tree.
 const {packager}=await import('@electron/packager'),{createRequire}=await import('node:module');
 const require=createRequire(import.meta.url),config=require(path.join(stage,'forge.config.cjs'));
 await packager({...config.packagerConfig,dir:stage,out:path.join(stage,'out'),platform:'win32',arch:'x64',electronVersion:'44.7.2',prune:false});
};

let intent;
if(!verify&&!resumePackage){
 try{await lstat(work);throw Error('Candidate exists. Inspect its recorded phase and running handle before recovery.');}catch(error){if(error.code!=='ENOENT')throw error;}
 await mkdir(work,{recursive:true});intent={at:new Date().toISOString(),pid:process.pid,phase:'freezing',version:'0.44.18',baseVersion:'0.44.17',baseImageSha256:previous.imageSha256,installed:false,productionMigrated:false};
 const mark=async phase=>{intent.phase=phase;await writeFile(path.join(work,'preparation.json'),JSON.stringify(intent,null,2));};await mark('freezing');
 console.log('Freezing qualified source onto the delivered 0.44.17 baseline.');
 await cp(path.join(base,'source/desktop'),source,{recursive:true,filter:file=>file!==path.join(base,'source/desktop/build')});
 for(const file of changes){await mkdir(path.dirname(path.join(source,file)),{recursive:true});await cp(path.join(root,'desktop',file),path.join(source,file));}
 for(const file of ['chat-inspection.test.cjs','native-inference-routing.test.cjs'])await cp(path.join(root,'desktop/tests',file),path.join(source,'tests',file));
 await mark('compiling');await run(['node_modules/typescript/bin/tsc','-p',path.join(source,'tsconfig.json'),'--noEmitOnError']);await run(['node_modules/typescript/bin/tsc','-p',path.join(source,'ui/tsconfig.json')]);
 await mark('staging');await cp(path.join(base,'staging'),stage,{recursive:true,filter:file=>file!==path.join(base,'staging/out')});await cp(path.join(source,'build'),path.join(stage,'build'),{recursive:true});
 const manifest=await json(path.join(stage,'package.json'));manifest.version='0.44.18';await writeFile(path.join(stage,'package.json'),JSON.stringify(manifest,null,2));
 console.log('Copying pinned resources and compiling the frozen renderer.');await cp(path.join(base,'resources'),resources,{recursive:true});await cp(path.join(source,'database/0060-chat-inspection.sql'),path.join(resources,'database/0060-chat-inspection.sql'));
 await build({configFile:false,envDir:false,root:path.join(source,'ui'),plugins:[react()],base:'/',build:{outDir:path.join(resources,'ui'),emptyOutDir:true,assetsInlineLimit:0}});
 await writeFile(path.join(resources,'version.json'),JSON.stringify({version:'0.44.18',supabase:'2.121.0',schema:60},null,2));
 await mark('packaging');await packageStage();await mark('verifying');
}else{
 intent=await json(path.join(work,'preparation.json'));assert.equal(intent.version,'0.44.18');assert.equal(intent.baseImageSha256,previous.imageSha256);assert(['packaging','verifying'].includes(intent.phase),'Inspect the terminal preparation state before verification');
 if(resumePackage){
  assert.equal(intent.phase,'packaging');
  for(const file of changes)assert.equal(await hashFile(path.join(source,file)),await hashFile(path.join(root,'desktop',file)));
  for(const relative of await readdir(path.join(source,'build'),{recursive:true}))if((await lstat(path.join(source,'build',relative))).isFile())assert.equal(await hashFile(path.join(source,'build',relative)),await hashFile(path.join(stage,'build',relative)));
  assert.equal((await json(path.join(resources,'version.json'))).version,'0.44.18');
  await packageStage();intent.phase='verifying';await writeFile(path.join(work,'preparation.json'),JSON.stringify(intent,null,2));
 }
}
const sourceHashes={};for(const file of changes){sourceHashes[file]=await hashFile(path.join(source,file));assert.equal(sourceHashes[file],await hashFile(path.join(root,'desktop',file)),'Source changed while freezing');}
const image=path.join(stage,'out/Agentopia-win32-x64/resources/app.asar'),delivered=path.join(stage,'out/Agentopia-win32-x64/resources/resources');
const files=archive=>listPackage(archive).map(file=>file.replaceAll('\\','/').replace(/^\//,'')).filter(file=>!statFile(archive,path.normalize(file)).files),before=files(previous.image),after=files(image);
assert(before.every(file=>after.includes(file)));const added=after.filter(file=>!before.includes(file));assert.deepEqual(added,['build/chat-inspection.js']);
const archiveChanges=[];for(const file of before)if(hash(extractFile(image,path.normalize(file)))!==hash(extractFile(previous.image,path.normalize(file))))archiveChanges.push(file);
assert.deepEqual(archiveChanges.sort(),['build/agent-policy.js','build/broker.js','build/codex-harness.js','build/project-memory.js','build/tool-service.js','package.json'].sort());
assert.deepEqual(JSON.parse(extractFile(image,'package.json')),{...JSON.parse(extractFile(previous.image,'package.json')),version:'0.44.18'});
let resourceFiles=0;const changedResources=[];
for(const relative of await readdir(resources,{recursive:true})){
 const file=path.join(resources,relative);if(!(await lstat(file)).isFile())continue;resourceFiles++;const name=relative.replaceAll('\\','/'),digest=await hashFile(file);assert.equal(await hashFile(path.join(delivered,relative)),digest,'Delivery mismatch: '+name);
 if(name.startsWith('ui/')||['version.json','database/0060-chat-inspection.sql'].includes(name))changedResources.push(name);else assert.equal(await hashFile(path.join(base,'resources',relative)),digest,'Unexpected resource change: '+name);
}
assert.equal((await readdir(path.join(delivered,'database'))).filter(file=>file.endsWith('.sql')).length,60);
const proof={...intent,success:true,phase:'packaged-awaiting-exact-image-qualification',source,sourceHashes,stage,image,imageSha256:await hashFile(image),portableDirectory:path.dirname(path.dirname(image)),archiveChanges,added,changedResources,resourceFiles,migrations:60,installerCreated:false,liveAcceptancePending:true,sourceQualification:path.join(root,'.supabase/desktop-chat-inspection/check-1792345003829/evidence.json'),storageQualification:path.join(root,'.supabase/desktop-chat-inspection/storage-1792344980162/evidence.json')};
await writeFile(path.join(work,'package-proof.json'),JSON.stringify(proof,null,2),{flag:'wx'});await writeFile(path.join(work,'preparation.json'),JSON.stringify(proof,null,2));console.log(JSON.stringify({success:true,version:proof.version,imageSha256:proof.imageSha256,resourceFiles,work},null,2));
