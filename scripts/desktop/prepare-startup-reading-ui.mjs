import {readFile,writeFile,cp,mkdir,readdir,lstat,symlink} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import assert from 'node:assert/strict';
import {build} from 'vite';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {desktopOperation} from './operation-lock.mjs';
desktopOperation('freeze UI-only initial transcript mount correction');
const root=path.resolve(import.meta.dirname,'../..'),candidate=path.join(root,'.supabase/desktop-platform-release/candidate-04447'),base=JSON.parse(await readFile(path.join(candidate,'package-proof.json'),'utf8')),work=path.resolve('C:/Users/charl/AgentopiaQA/startup-reading-ui',String(Date.now())),source=path.join(work,'source/desktop'),ui=path.join(work,'ui'),sha=bytes=>createHash('sha256').update(bytes).digest('hex');
assert(base.success&&base.version==='0.44.47');await mkdir(work,{recursive:true});await cp(base.source,source,{recursive:true});await symlink(path.join(root,'node_modules'),path.join(work,'source/node_modules'),'junction');
for(const name of ['ui/DesktopApp.tsx'])await cp(path.join(root,'desktop',name),path.join(source,name));
const sourceHashes={...base.sourceHashes};for(const name of ['ui/DesktopApp.tsx']){sourceHashes[name]=sha(await readFile(path.join(source,name)));assert.notEqual(sourceHashes[name],base.sourceHashes[name]);}for(const [name,digest]of Object.entries(sourceHashes))assert.equal(sha(await readFile(path.join(source,name))),digest);
await promisify(execFile)(process.execPath,['node_modules/typescript/bin/tsc','-p',path.join(source,'ui/tsconfig.json')],{cwd:root,windowsHide:true});await build({configFile:path.join(source,'vite.config.mjs'),build:{outDir:ui}});
const resourceFiles=Object.fromEntries(Object.entries(base.resourceFiles).filter(([name])=>!name.startsWith('ui/')));for(const name of (await readdir(ui,{recursive:true})).sort()){const file=path.join(ui,name),info=await lstat(file);assert(!info.isSymbolicLink());if(info.isFile())resourceFiles['ui/'+name.replaceAll('\\','/')]=sha(await readFile(file));}
const proof={success:true,version:'0.44.47',uiHotfixRevision:1,at:new Date().toISOString(),work,source,sourceHashes,sourceChanges:['ui/DesktopApp.tsx'],ui,resourceFiles,imageSha256:base.imageSha256,baseInstallerPackage:path.join(candidate,'package-proof.json'),baseResourceManifestSha256:sha(Buffer.from(JSON.stringify(base.resourceFiles))),resourceManifestSha256:sha(Buffer.from(JSON.stringify(resourceFiles))),schema:69,qualified:false,installed:false,providerRequests:0,reason:'Initialize latest-follow and resize observation after the restored transcript mounts, including delayed account publication.'};await writeFile(path.join(candidate,'startup-reading-proof.json'),JSON.stringify(proof,null,2),{flag:'wx'});console.log(JSON.stringify({success:true,work,ui,source,resourceManifestSha256:proof.resourceManifestSha256}));
