import {cp,mkdir,readFile,writeFile,readdir,lstat,link,copyFile,stat} from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import {createHash} from 'node:crypto';
import {spawn,execFileSync} from 'node:child_process';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createPackage,extractAll,extractFile,listPackage,statFile} from '@electron/asar';
import {desktopOperation} from './operation-lock.mjs';
desktopOperation('prepare corrected queue steering image');
const root=path.resolve(import.meta.dirname,'../..'),base=path.join(root,'.supabase/desktop-goal-queue/candidate-04415'),work=path.join(root,'.supabase/desktop-goal-queue/candidate-04416'),source=path.join(work,'source/desktop'),stage=path.join(work,'staging'),resources=path.join(work,'resources');
const json=async file=>JSON.parse(await readFile(file,'utf8')),hash=bytes=>createHash('sha256').update(bytes).digest('hex'),hashFile=async file=>{const h=createHash('sha256');for await(const bytes of createReadStream(file))h.update(bytes);return h.digest('hex');};
const previous=await json(path.join(base,'package-proof.json')),made=await json(path.join(base,'installer-proof.json')),regression=await json(path.join(root,'.supabase/desktop-goal-queue/steering-recovery-latest.json'));
assert(previous.success&&made.vendorHelpersRestored&&regression.success);assert.equal(await hashFile(previous.image),previous.imageSha256);await mkdir(work);
const intent={at:new Date().toISOString(),pid:process.pid,version:'0.44.16',baseVersion:'0.44.15',phase:'preparing',installed:false,productionMigrated:false};await writeFile(path.join(work,'preparation.json'),JSON.stringify(intent,null,2),{flag:'wx'});
await cp(previous.source,source,{recursive:true,filter:file=>file!==path.join(previous.source,'build')});
for(const name of ['src/chat-queue.ts','tests/chat-queue.test.cjs'])await copyFile(path.join(root,'desktop',name),path.join(source,name));
const sourceHashes={};for(const name of Object.keys(previous.sourceHashes))sourceHashes[name]=await hashFile(path.join(source,name));
for(const [name,digest]of Object.entries(previous.sourceHashes))if(!['src/chat-queue.ts','tests/chat-queue.test.cjs'].includes(name))assert.equal(sourceHashes[name],digest);
async function run(args){await new Promise((resolve,reject)=>{const child=spawn(process.execPath,args,{cwd:root,windowsHide:true,stdio:'inherit'});child.on('error',reject);child.on('close',code=>code===0?resolve():reject(Error('Compilation exited '+code)));});}
await run(['node_modules/typescript/bin/tsc','-p',path.join(source,'tsconfig.json'),'--noEmitOnError']);await run(['node_modules/typescript/bin/tsc','-p',path.join(source,'ui/tsconfig.json')]);
let shared=0;async function clone(from,to,skip=new Set(),prefix=''){await mkdir(to,{recursive:true});for(const entry of await readdir(from,{withFileTypes:true})){const relative=prefix+entry.name;if(skip.has(relative))continue;assert(!entry.isSymbolicLink());const a=path.join(from,entry.name),b=path.join(to,entry.name);if(entry.isDirectory())await clone(a,b,skip,relative+'/');else{assert(entry.isFile());await link(a,b);const [old,next]=await Promise.all([stat(a,{bigint:true}),stat(b,{bigint:true})]);assert.equal(next.ino,old.ino);assert.equal(next.dev,old.dev);shared++;}}}
// Immutable payloads are linked; all modified files receive independent copies.
const archiveBase=path.join(work,'archive-base');extractAll(previous.image,archiveBase);await clone(archiveBase,stage,new Set(['build','package.json']));await cp(path.join(source,'build'),path.join(stage,'build'),{recursive:true});
const manifest=JSON.parse(extractFile(previous.image,'package.json').toString());manifest.version=intent.version;await writeFile(path.join(stage,'package.json'),JSON.stringify(manifest,null,2),{flag:'wx'});
await clone(path.join(base,'resources'),resources,new Set(['version.json']));const version={...await json(path.join(base,'resources/version.json')),version:intent.version};await writeFile(path.join(resources,'version.json'),JSON.stringify(version,null,2),{flag:'wx'});
const preparedImage=path.join(work,'prepared.asar');await createPackage(stage,preparedImage);
const portableDirectory=path.join(stage,'out/Agentopia-win32-x64');await clone(previous.portableDirectory,portableDirectory,new Set(['Agentopia.exe','resources/app.asar','resources/resources/version.json']));
await copyFile(path.join(previous.portableDirectory,'Agentopia.exe'),path.join(portableDirectory,'Agentopia.exe'));await copyFile(path.join(resources,'version.json'),path.join(portableDirectory,'resources/resources/version.json'));
execFileSync(path.join(root,'node_modules/electron-winstaller/vendor/rcedit.exe'),[path.join(portableDirectory,'Agentopia.exe'),'--set-file-version',intent.version,'--set-product-version',intent.version],{windowsHide:true});
const image=path.join(portableDirectory,'resources/app.asar');await copyFile(preparedImage,image);
const files=archive=>listPackage(archive).map(file=>file.replaceAll('\\','/').replace(/^\//,'')).filter(file=>!statFile(archive,path.normalize(file)).files),before=files(previous.image),after=files(image);assert.deepEqual(after.sort(),before.sort());const archiveChanges=after.filter(file=>hash(extractFile(image,path.normalize(file)))!==hash(extractFile(previous.image,path.normalize(file))));assert.deepEqual(archiveChanges.sort(),['build/chat-queue.js','package.json']);
assert.equal(await hashFile(previous.image),previous.imageSha256);assert.equal((await json(path.join(base,'resources/version.json'))).version,'0.44.15');
const proof={...intent,success:true,phase:'packaged-awaiting-exact-image-qualification',source,sourceHashes,stage,portableDirectory,image,imageSha256:await hashFile(image),archiveChanges,added:[],resourceFiles:previous.resourceFiles,changedResources:['version.json'],migrations:59,sharedImmutableFiles:shared,baseImageSha256:previous.imageSha256,installerCreated:false,liveAcceptancePending:true};await writeFile(path.join(work,'package-proof.json'),JSON.stringify(proof,null,2),{flag:'wx'});console.log(JSON.stringify({success:true,version:intent.version,imageSha256:proof.imageSha256,sharedImmutableFiles:shared},null,2));
