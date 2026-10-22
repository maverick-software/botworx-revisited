import {readFile,writeFile,mkdir,cp,readdir,lstat,symlink} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import path from 'node:path';
import assert from 'node:assert/strict';
import {build} from 'vite';
import {desktopOperation} from './operation-lock.mjs';
desktopOperation('freeze chat details and sidebar parity');
const root=path.resolve(import.meta.dirname,'../..'),records=path.join(root,'.supabase/desktop-chat-details'),work=process.argv[2]?path.resolve(process.argv[2]):path.join(records,String(Date.now())),source=path.join(work,'source/desktop'),ui=path.join(work,'ui');
const json=async p=>JSON.parse(await readFile(p,'utf8')),sha=b=>createHash('sha256').update(b).digest('hex');
const priorPointer=await json(path.join(root,'.supabase/desktop-composer-mentions/current.json')),base=await json(priorPointer.proof),accepted=await json(path.join(root,'.supabase/desktop-composer-mentions/reopened.json'));
const installed='C:/Users/charl/AppData/Local/AgentopiaDesktop/app-0.44.47/resources/app.asar';
assert(accepted.success&&accepted.revision==='composer-mentions-8'&&accepted.normalReopeningPassed&&accepted.tablesCompared===126);
assert.equal(sha(await readFile(installed)),accepted.imageSha256);
assert.equal(path.dirname(work),records);
const changed=['ui/ChatContext.tsx','ui/chat-context.css','ui/DesktopApp.tsx','ui/WorkspacePane.tsx','ui/ProjectNavigation.tsx','ui/SidebarSection.tsx','ui/WorkspaceViews.tsx'];
if(!process.argv[2]){await mkdir(work,{recursive:true});await cp(base.source,source,{recursive:true});await symlink(path.join(root,'node_modules'),path.join(work,'source/node_modules'),'junction');await symlink(path.join(root,'node_modules'),path.join(work,'node_modules'),'junction');
for(const name of changed)await cp(path.join(root,'desktop',name),path.join(source,name));
const types=spawnSync(process.execPath,['node_modules/typescript/bin/tsc','-p',path.join(source,'ui/tsconfig.json')],{cwd:root,windowsHide:true,encoding:'utf8'});await writeFile(path.join(work,'ui-types.log'),types.stdout+types.stderr);assert.equal(types.status,0);
await build({configFile:path.join(source,'vite.config.mjs'),build:{outDir:ui}});}

async function hashes(dir){const result={};for(const name of(await readdir(dir,{recursive:true})).sort()){const info=await lstat(path.join(dir,name));assert(!info.isSymbolicLink());if(info.isFile())result[name.replaceAll('\\','/')]=sha(await readFile(path.join(dir,name)));}return result;}
const sourceHashes=await hashes(source),actual=[];for(const [name,digest] of Object.entries(sourceHashes)){if(name.startsWith('src/')||name.startsWith('ui/')){assert.equal(sha(await readFile(path.join(root,'desktop',name))),digest);if(base.sourceHashes[name]!==digest)actual.push(name);}}
assert.deepEqual(actual.sort(),changed.sort());
const proof={success:true,at:new Date().toISOString(),revision:'chat-context-9',version:'0.44.47',work,source,ui,sourceHashes,uiHashes:await hashes(ui),changedSourceFiles:actual,image:installed,imageSha256:accepted.imageSha256,baseImageSha256:accepted.imageSha256,baseProof:priorPointer.proof,baseReopened:path.join(root,'.supabase/desktop-composer-mentions/reopened.json'),backendUnchanged:true,installed:false,providerRequests:0,fullGoalComplete:false};
await writeFile(path.join(work,'proof.json'),JSON.stringify(proof,null,2),{flag:'wx'});await writeFile(path.join(records,'current.json'),JSON.stringify({work,proof:path.join(work,'proof.json'),source,ui},null,2));console.log(JSON.stringify({success:true,work,uiFiles:Object.keys(proof.uiHashes).length,backendUnchanged:true}));
