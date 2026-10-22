import {readFile,writeFile,cp,mkdir,readdir,lstat,symlink} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import assert from 'node:assert/strict';
import {build} from 'vite';
import {desktopOperation} from './operation-lock.mjs';
desktopOperation('freeze stable composer menu with current installed UI baseline');
const root=path.resolve(import.meta.dirname,'../..'),records=path.join(root,'.supabase/desktop-profile-location'),base=JSON.parse(await readFile(path.join(root,'.supabase/desktop-platform-release/candidate-04447/startup-reading-proof.json'),'utf8')),work=path.resolve('C:/Users/charl/AgentopiaQA/menu-stability-ui',String(Date.now())),source=path.join(work,'source/desktop'),ui=path.join(work,'ui'),sha=bytes=>createHash('sha256').update(bytes).digest('hex');
assert(base.success&&base.version==='0.44.47');await mkdir(work,{recursive:true});await cp(base.source,source,{recursive:true});await symlink(path.join(root,'node_modules'),path.join(work,'source/node_modules'),'junction');
await cp(path.join(root,'desktop/ui/ComposerAddMenu.tsx'),path.join(source,'ui/ComposerAddMenu.tsx'));
const sourceHashes={...base.sourceHashes,'ui/ComposerAddMenu.tsx':sha(await readFile(path.join(source,'ui/ComposerAddMenu.tsx')))};assert.notEqual(sourceHashes['ui/ComposerAddMenu.tsx'],base.sourceHashes['ui/ComposerAddMenu.tsx']);
for(const [name,digest]of Object.entries(sourceHashes))assert.equal(sha(await readFile(path.join(source,name))),digest);
await build({configFile:path.join(source,'vite.config.mjs'),build:{outDir:ui}});
const files={};for(const name of (await readdir(ui,{recursive:true})).sort()){const info=await lstat(path.join(ui,name));assert(!info.isSymbolicLink());if(info.isFile())files[name.replaceAll('\\','/')]=sha(await readFile(path.join(ui,name)));}
const proof={success:true,at:new Date().toISOString(),version:'0.44.47',work,source,ui,sourceHashes,uiFiles:files,baseline:base.work,installed:false,providerRequests:0,reason:'Prevent delayed catalog entries from moving composer actions under the pointer.'};await writeFile(path.join(work,'proof.json'),JSON.stringify(proof,null,2),{flag:'wx'});await writeFile(path.join(records,'menu-stability-ui-current.json'),JSON.stringify({success:true,proof:path.join(work,'proof.json'),work,source,ui},null,2));console.log(JSON.stringify({success:true,work,source,ui}));
