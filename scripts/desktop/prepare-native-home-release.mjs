import {cp,mkdir,readFile,writeFile,readdir,lstat} from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import {createHash} from 'node:crypto';
import {spawn} from 'node:child_process';
import path from 'node:path';
import assert from 'node:assert/strict';
import {extractFile,listPackage,statFile} from '@electron/asar';
import {desktopOperation} from './operation-lock.mjs';
desktopOperation('prepare and package native history path correction');
const root=path.resolve(import.meta.dirname,'../..'),base=path.join(root,'.supabase/desktop-plugin-updates/candidate-0448'),work=path.join(root,'.supabase/desktop-native-home/candidate-0449'),stage=path.join(work,'staging'),source=path.join(work,'source/desktop'),resources=path.join(work,'resources');
const json=async file=>JSON.parse(await readFile(file,'utf8')),hash=bytes=>createHash('sha256').update(bytes).digest('hex'),hashFile=async file=>{const digest=createHash('sha256');for await(const bytes of createReadStream(file))digest.update(bytes);return digest.digest('hex');};
const previous=await json(path.join(base,'package-proof.json'));assert(previous.success);assert.equal(previous.version,'0.44.8');assert.equal(await hashFile(previous.image),previous.imageSha256);
const verifyExisting=process.argv.includes('--verify-existing'),files=['src/codex-harness.ts','src/native-home.ts','src/native-home-rebase.ts','tests/native-relocation.test.cjs','runtime/relocate-native-profile.py'];
let intent;
if(!verifyExisting){
try{await lstat(work);throw Error('Candidate output exists. Inspect its process and phase before proceeding.');}catch(error){if(error.code!=='ENOENT')throw error;}
await mkdir(work,{recursive:true});intent={phase:'preparing',at:new Date().toISOString(),pid:process.pid,version:'0.44.9',baseVersion:'0.44.8',baseImageSha256:previous.imageSha256,installed:false,productionMigrated:false};await writeFile(path.join(work,'preparation.json'),JSON.stringify(intent,null,2),{flag:'wx'});
console.log('Freezing the native history fix on the qualified 0.44.8 source and resources.');
await cp(path.join(base,'source/desktop'),source,{recursive:true,filter:file=>file!==path.join(base,'source/desktop/build')});
for(const file of files){await mkdir(path.dirname(path.join(source,file)),{recursive:true});await cp(path.join(root,'desktop',file),path.join(source,file));}
await mkdir(path.join(work,'test-source'));for(const name of ['test-native-home.mjs','test-native-relocation.py'])await cp(path.join(root,'scripts/desktop',name),path.join(work,'test-source',name));
const run=(args)=>new Promise((resolve,reject)=>{const process=spawn(globalThis.process.execPath,args,{cwd:root,stdio:'inherit',windowsHide:true});process.once('error',reject);process.once('exit',code=>code===0?resolve():reject(Error('Qualification command failed with exit '+code)));});
await run(['node_modules/typescript/bin/tsc','-p',path.join(source,'tsconfig.json'),'--noEmitOnError']);
await cp(path.join(base,'staging'),stage,{recursive:true,filter:file=>file!==path.join(base,'staging/out')});await cp(path.join(source,'build'),path.join(stage,'build'),{recursive:true});
const manifest=await json(path.join(stage,'package.json'));manifest.version='0.44.9';await writeFile(path.join(stage,'package.json'),JSON.stringify(manifest,null,2));
console.log('Copying pinned runtime resources; the UI, database migrations and provider adapters remain byte matched.');
await cp(path.join(base,'resources'),resources,{recursive:true});await cp(path.join(source,'runtime/relocate-native-profile.py'),path.join(resources,'runtime/relocate-native-profile.py'));await writeFile(path.join(resources,'version.json'),JSON.stringify({version:'0.44.9',supabase:'2.121.0',schema:58},null,2));
const forge=await json(path.join(root,'node_modules/@electron-forge/cli/package.json'));await run([path.join(root,'node_modules/@electron-forge/cli',forge.bin['electron-forge']),'package',stage]);
}else{intent=await json(path.join(work,'preparation.json'));assert.equal(intent.phase,'preparing');assert.equal(intent.version,'0.44.9');assert.equal(intent.baseImageSha256,previous.imageSha256);console.log('Verifying the existing terminal package output without rebuilding it.');}
const sourceHashes=Object.fromEntries(await Promise.all(files.map(async file=>[file,hash(await readFile(path.join(source,file)))]))),modules=(await readdir(path.join(stage,'build'),{recursive:true})).filter(file=>/\.(js|json)$/.test(file)),changed=[],added=[];
for(const file of modules){const bytes=await readFile(path.join(stage,'build',file));assert(bytes.equals(await readFile(path.join(source,'build',file))));try{if(hash(bytes)!==hash(await readFile(path.join(base,'staging/build',file))))changed.push(file.replaceAll('\\','/'));}catch(error){if(error.code!=='ENOENT')throw error;added.push(file.replaceAll('\\','/'));}}
assert.equal(modules.length,1018);assert.deepEqual(changed.sort(),['codex-harness.js']);assert.deepEqual(added.sort(),['native-home-rebase.js','native-home.js']);
const image=path.join(stage,'out/Agentopia-win32-x64/resources/app.asar'),delivered=path.join(stage,'out/Agentopia-win32-x64/resources/resources'),archiveFiles=listPackage(image).map(file=>file.replaceAll('\\','/').replace(/^\//,'')).filter(file=>!statFile(image,path.normalize(file)).files),oldFiles=listPackage(previous.image).map(file=>file.replaceAll('\\','/').replace(/^\//,'')).filter(file=>!statFile(previous.image,path.normalize(file)).files);
const deliveredManifest=JSON.parse(extractFile(image,'package.json')),oldManifest=JSON.parse(extractFile(previous.image,'package.json'));assert.deepEqual(deliveredManifest,{...oldManifest,version:'0.44.9'});const archiveChanges=[];for(const file of archiveFiles){const bytes=extractFile(image,path.normalize(file));if(file!=='package.json')assert(bytes.equals(await readFile(path.join(stage,file))),file);if(!oldFiles.includes(file)||hash(bytes)!==hash(extractFile(previous.image,path.normalize(file))))archiveChanges.push(file);}
assert.deepEqual(archiveChanges.sort(),['build/codex-harness.js','build/native-home-rebase.js','build/native-home.js','package.json']);assert(oldFiles.every(file=>archiveFiles.includes(file)));
let resourceFiles=0;for(const relative of await readdir(resources,{recursive:true})){if(!(await lstat(path.join(resources,relative))).isFile())continue;assert.equal(await hashFile(path.join(delivered,relative)),await hashFile(path.join(resources,relative)));if(!['version.json','runtime/relocate-native-profile.py'].includes(relative.replaceAll('\\','/')))assert.equal(await hashFile(path.join(delivered,relative)),await hashFile(path.join(base,'resources',relative)));resourceFiles++;}
assert.equal(resourceFiles,6148);assert.equal((await readdir(path.join(delivered,'database'))).filter(file=>file.endsWith('.sql')).length,58);
const proof={...intent,success:true,phase:'packaged-awaiting-qualification',image,imageSha256:await hashFile(image),compiledModules:modules.length,changedModules:changed,addedModules:added,archiveChanges,resourceFiles,changedResources:['runtime/relocate-native-profile.py','version.json'],migrations:58,source,stage,sourceHashes,portableDirectory:path.dirname(path.dirname(image)),installerCreated:false,liveAcceptancePending:true};await writeFile(path.join(work,'package-proof.json'),JSON.stringify(proof,null,2),{flag:'wx'});await writeFile(path.join(work,'preparation.json'),JSON.stringify({...proof,phase:'prepared'},null,2));console.log(JSON.stringify({success:true,version:proof.version,imageSha256:proof.imageSha256,work},null,2));
