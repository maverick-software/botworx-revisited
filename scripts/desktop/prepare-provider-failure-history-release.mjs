import {cp,mkdir,readFile,writeFile,readdir,lstat,link,copyFile} from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createPackage,extractAll,extractFile} from '@electron/asar';
import {build} from 'vite';
import react from '@vitejs/plugin-react';
import {desktopOperation} from './operation-lock.mjs';

desktopOperation('freeze and package readable connection failures');
const root=path.resolve(import.meta.dirname,'../..'),version='0.44.37',base=path.join(root,'.supabase/desktop-platform-release/candidate-04435'),work=path.join(root,'.supabase/desktop-platform-release/candidate-04437'),source=path.join(work,'source/desktop'),resources=path.join(work,'resources'),stage=path.join(work,'staging'),exec=promisify(execFile);
const json=async file=>JSON.parse(await readFile(file,'utf8')),hashFile=async file=>{const hash=createHash('sha256');for await(const bytes of createReadStream(file))hash.update(bytes);return hash.digest('hex');};
const previous=await json(path.join(base,'package-proof.json')),qualified=await json(path.join(base,'qualification.json'));
assert(previous.success&&qualified.success&&qualified.imageSha256===previous.imageSha256);assert.equal(await hashFile(previous.image),previous.imageSha256);
const pointer=await json(path.join(root,'.supabase/desktop-provider-failure-ui/latest.json')),acceptance=await json(pointer.file);assert(acceptance.success&&acceptance.phase==='source-only-provider-failure-presentation'&&!acceptance.delivered&&acceptance.uiChecks===10&&acceptance.classificationChecks===20);assert.equal(await hashFile(pointer.file),pointer.sha256);assert.equal(await hashFile(acceptance.uiEvidence),acceptance.uiEvidenceSha256);assert.equal(await hashFile(acceptance.classificationEvidence),acceptance.classificationEvidenceSha256);
const desktopHashes=Object.fromEntries(acceptance.snapshots.filter(row=>row.file.startsWith('desktop/')).map(row=>[row.file,row.sha256]));assert.equal(Object.keys(desktopHashes).length,7);for(const [file,digest]of Object.entries(desktopHashes))assert.equal(await hashFile(path.join(root,file)),digest);
const proofs={sourceQualification:{path:pointer.file,sha256:await hashFile(pointer.file)}};
const qualifications={source:pointer.file,exactSourceSha256:await hashFile(pointer.file),proofs,predecessorPackage:path.join(base,'package-proof.json'),predecessorImageSha256:previous.imageSha256};
await mkdir(work,{recursive:true});await writeFile(path.join(work,'intent.json'),JSON.stringify({at:new Date().toISOString(),pid:process.pid,version,baseVersion:previous.version,installed:false,productionMigrated:false,providerRequests:0,qualifications},null,2),{flag:'wx'});
async function run(args){const result=await exec(process.execPath,args,{cwd:root,windowsHide:true,timeout:120000,maxBuffer:4*1024*1024});if(result.stdout.trim())console.log(result.stdout.trim());return result;}
for(const name of ['codex','chrome','code-tools','script-runtimes','artifact-runtime','computer'])await run(['scripts/desktop/prepare-'+name+'.mjs','--verify']);
async function inventory(directory){const result={};for(const name of (await readdir(directory,{recursive:true})).sort()){const target=path.join(directory,name),info=await lstat(target);assert(!info.isSymbolicLink());if(info.isFile())result[name.replaceAll('\\','/')]=await hashFile(target);}return result;}
await mkdir(source,{recursive:true});const sourceHashes={};
for(const name of ['src','ui','runtime','database','tests','package.json','tsconfig.json','vite.config.mjs','forge.config.cjs','artifact-runtime-pins.json']){
 const from=path.join(root,'desktop',name),to=path.join(source,name);await cp(from,to,{recursive:true,filter:file=>!file.replaceAll('\\','/').split('/').includes('__pycache__')});
 const info=await lstat(to);if(info.isDirectory())for(const [child,digest]of Object.entries(await inventory(to)))sourceHashes[name+'/'+child]=digest;else sourceHashes[name]=await hashFile(to);
}
const allowedChanges=new Set(Object.keys(desktopHashes).map(name=>name.replace(/^desktop\//,''))),baseSource=previous.sourceHashes;
const changes=[];for(const name of new Set([...Object.keys(baseSource),...Object.keys(sourceHashes)]))if(baseSource[name]!==sourceHashes[name]){assert(allowedChanges.has(name),'Unexpected source change while freezing37: '+name);changes.push(name);}
for(const [name,digest]of Object.entries(desktopHashes))assert.equal(sourceHashes[name.replace(/^desktop\//,'')],digest);assert.equal(changes.length,7);
await run(['node_modules/typescript/bin/tsc','-p',path.join(source,'tsconfig.json'),'--noEmitOnError']);await run(['node_modules/typescript/bin/tsc','-p',path.join(source,'ui/tsconfig.json')]);
await mkdir(resources,{recursive:true});let shared=0,copied=0;const resourceFiles={};
// Share only bytes already frozen in the preceding candidate. New resource
// bytes receive independent copies, so later preparation cannot mutate them.
for(const name of (await readdir(path.join(root,'desktop/resources'),{recursive:true})).sort()){
 if(['ui','runtime','database'].includes(name.replaceAll('\\','/').split('/')[0])||name==='version.json')continue;
 const from=path.join(root,'desktop/resources',name),info=await lstat(from);assert(!info.isSymbolicLink());if(!info.isFile())continue;
 const digest=await hashFile(from),old=path.join(base,'resources',name),to=path.join(resources,name);await mkdir(path.dirname(to),{recursive:true});
 let match=false;try{match=await hashFile(old)===digest;}catch(error){if(error.code!=='ENOENT')throw error;}
 if(match){await link(old,to);shared++;}else{await copyFile(from,to);copied++;}assert.equal(await hashFile(to),digest);resourceFiles[name.replaceAll('\\','/')]=digest;
}
await cp(path.join(source,'database'),path.join(resources,'database'),{recursive:true});
await mkdir(path.join(resources,'runtime'));for(const name of ['manage.py','secure-runtime.py','voice.py','relocate-native-profile.py','copy-desktop-profile.py','adopt-standalone.cjs','audit-owned-data.py','terminal.ps1','interactive.ps1','file-actions.ps1','native-patch-guard.cjs'])await copyFile(path.join(source,'runtime',name),path.join(resources,'runtime',name));
await copyFile(path.join(root,'scripts/desktop/import-backup.ps1'),path.join(resources,'runtime/Restore-Agentopia.ps1'));await copyFile(path.join(base,'resources/runtime/config.toml'),path.join(resources,'runtime/config.toml'));
await build({configFile:false,envDir:false,root:path.join(source,'ui'),plugins:[react()],base:'/',build:{outDir:path.join(resources,'ui'),emptyOutDir:true,assetsInlineLimit:0}});
const migrations=(await readdir(path.join(resources,'database'))).filter(name=>name.endsWith('.sql')).length;assert.equal(migrations,69);
await writeFile(path.join(resources,'version.json'),JSON.stringify({...await json(path.join(base,'resources/version.json')),version,schema:migrations}));
const archiveBase=path.join(work,'archive-base');extractAll(previous.image,archiveBase);
async function immutableClone(from,to,skip=new Set(),prefix=''){await mkdir(to,{recursive:true});for(const entry of await readdir(from,{withFileTypes:true})){const relative=prefix+entry.name;if(skip.has(relative))continue;assert(!entry.isSymbolicLink());if(entry.isDirectory())await immutableClone(path.join(from,entry.name),path.join(to,entry.name),skip,relative+'/');else await link(path.join(from,entry.name),path.join(to,entry.name));}}
await immutableClone(archiveBase,stage,new Set(['build','package.json']));await cp(path.join(source,'build'),path.join(stage,'build'),{recursive:true});
const manifest=JSON.parse(extractFile(previous.image,'package.json').toString());assert.equal(manifest.dependencies.croner,'9.1.0');manifest.version=version;await writeFile(path.join(stage,'package.json'),JSON.stringify(manifest,null,2));
const portableDirectory=path.join(work,'portable');await immutableClone(previous.portableDirectory,portableDirectory,new Set(['Agentopia.exe','resources/app.asar','resources/resources']));
await copyFile(path.join(previous.portableDirectory,'Agentopia.exe'),path.join(portableDirectory,'Agentopia.exe'));await exec(path.join(root,'node_modules/electron-winstaller/vendor/rcedit.exe'),[path.join(portableDirectory,'Agentopia.exe'),'--set-file-version',version,'--set-product-version',version],{windowsHide:true});
await immutableClone(resources,path.join(portableDirectory,'resources/resources'));const image=path.join(portableDirectory,'resources/app.asar');await createPackage(stage,image);
const runtimeChanges={};for(const folder of ['runtime','database','ui'])for(const [name,digest]of Object.entries(await inventory(path.join(resources,folder))))runtimeChanges[folder+'/'+name]=digest;
resourceFiles['version.json']=await hashFile(path.join(resources,'version.json'));Object.assign(resourceFiles,runtimeChanges);
for(const [name,digest]of Object.entries(sourceHashes))assert.equal(await hashFile(path.join(source,name)),digest);
assert.equal(await hashFile(previous.image),previous.imageSha256);
const proof={success:true,at:new Date().toISOString(),phase:'packaged-awaiting-exact-image-qualification',version,baseVersion:previous.version,source,sourceHashes,sourceChanges:changes,resources,resourceFiles,stage,portableDirectory,image,imageSha256:await hashFile(image),migrations,sharedFrozenResourceFiles:shared,copiedNewResourceFiles:copied,qualifications,imageConnectionEnabled:false,imageGenerationLiveVerified:false,baseImageSha256:previous.imageSha256,installed:false,productionMigrated:false,providerRequests:0,installerCreated:false,liveAcceptancePending:true};
await writeFile(path.join(work,'package-proof.json'),JSON.stringify(proof,null,2),{flag:'wx'});console.log(JSON.stringify({success:true,version,migrations,imageSha256:proof.imageSha256,sharedFrozenResourceFiles:shared,copiedNewResourceFiles:copied,installed:false},null,2));
