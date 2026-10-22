import {readFile,writeFile,mkdir,cp,readdir,lstat,symlink} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import assert from 'node:assert/strict';
import {build} from 'vite';
import {desktopOperation} from './operation-lock.mjs';
desktopOperation('freeze observed subscription-limit UI correction');
const root=path.resolve(import.meta.dirname,'../..'),sha=b=>createHash('sha256').update(b).digest('hex');
const base=JSON.parse(await readFile(path.join(root,'.supabase/desktop-presentation-delivery/current.json'),'utf8'));
const proof=JSON.parse(await readFile(base.proof,'utf8')),accepted=JSON.parse(await readFile(path.join(root,'.supabase/desktop-presentation-delivery/reopened.json'),'utf8'));
assert(proof.success&&accepted.success&&accepted.revision==='presentation-4'&&accepted.imageSha256===proof.imageSha256);
const work=path.resolve('C:/Users/charl/AgentopiaQA/subscription-limit-ui',String(Date.now())),source=path.join(work,'source/desktop'),ui=path.join(work,'ui');
await mkdir(work,{recursive:true});await cp(proof.source,source,{recursive:true});await symlink(path.join(root,'node_modules'),path.join(work,'source/node_modules'),'junction');
const changed='ui/connection-failure.ts';assert.notEqual(sha(await readFile(path.join(source,changed))),sha(await readFile(path.join(root,'desktop',changed))));await cp(path.join(root,'desktop',changed),path.join(source,changed));
const sourceHashes={};for(const name of (await readdir(source,{recursive:true})).sort()){const file=path.join(source,name),info=await lstat(file);assert(!info.isSymbolicLink());if(info.isFile()){const relative=name.replaceAll('\\','/');sourceHashes[relative]=sha(await readFile(file));if(relative.startsWith('ui/'))assert.equal(sourceHashes[relative],sha(await readFile(path.join(root,'desktop',name))),'UI source differs from frozen correction: '+relative);}}
await build({configFile:path.join(source,'vite.config.mjs'),build:{outDir:ui}});
const uiHashes={};for(const name of (await readdir(ui,{recursive:true})).sort()){const file=path.join(ui,name),info=await lstat(file);assert(!info.isSymbolicLink());if(info.isFile())uiHashes[name.replaceAll('\\','/')]=sha(await readFile(file));}
const result={success:true,at:new Date().toISOString(),version:'0.44.47',revision:'subscription-limit-5',work,source,ui,sourceHashes,uiHashes,changedSourceFiles:[changed],baseImageSha256:accepted.imageSha256,baseUi:proof.ui,installed:false,providerRequests:0};
await writeFile(path.join(work,'proof.json'),JSON.stringify(result,null,2),{flag:'wx'});await writeFile(path.join(root,'.supabase/desktop-office-edit-live/subscription-ui-current.json'),JSON.stringify({work,proof:path.join(work,'proof.json'),source,ui},null,2));console.log(JSON.stringify({success:true,work,source,ui,changedSourceFiles:[changed],installed:false}));
