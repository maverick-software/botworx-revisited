import assert from 'node:assert/strict';
import path from 'node:path';
import {readFile,writeFile,mkdir,cp,symlink,readdir,lstat} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {build} from 'vite';
import {desktopOperation} from './operation-lock.mjs';
import {hash,json} from './phased-backup-control.mjs';

desktopOperation('prepare plugin display labels against the installed66 source');
const root=path.resolve(import.meta.dirname,'../..'),base=await json((await json(path.join(root,'.supabase/desktop-workspace-paths-release66/current.json'))).proof);
const records=path.join(root,'.supabase/desktop-plugin-labels66'),out=path.join(records,String(Date.now())),source=path.join(out,'source/desktop'),ui=path.join(out,'ui');
const changes=['ui/plugin-presentation.ts','ui/PluginManager.tsx','ui/CustomizeNavigation.tsx','ui/AgentTools.tsx','ui/ToolConnections.tsx','ui/ComposerContextMenu.tsx','ui/McpSettings.tsx'];
assert.equal(base.version,'0.44.66');assert.equal(await hash('C:/Users/charl/AppData/Local/AgentopiaDesktop/app-0.44.66/resources/app.asar'),base.imageSha256);
await mkdir(source,{recursive:true});
for(const name of ['ui','src','vite.config.mjs','presentation-renderer-patch.mjs'])await cp(path.join(base.source,name),path.join(source,name),{recursive:true});
await symlink(path.join(root,'node_modules'),path.join(out,'source/node_modules'),'junction');
const sourceHashes={};for(const [name,digest]of Object.entries(base.sourceHashes))if(name.startsWith('ui/')||name.startsWith('src/')){assert.equal(await hash(path.join(source,name)),digest,name);sourceHashes[name]=digest;}
for(const name of changes){await cp(path.join(root,'desktop',name),path.join(source,name));sourceHashes[name]=await hash(path.join(source,name));}
await promisify(execFile)(process.execPath,['node_modules/typescript/bin/tsc','-p',path.join(source,'ui/tsconfig.json')],{cwd:root,windowsHide:true,timeout:120000,maxBuffer:1024*1024});
await build({configFile:path.join(source,'vite.config.mjs'),build:{outDir:ui}});
const uiFiles={};for(const name of await readdir(ui,{recursive:true})){const file=path.join(ui,name),info=await lstat(file);assert(!info.isSymbolicLink());if(info.isFile())uiFiles[name.replaceAll('\\','/')]=await hash(file);}
const proof={success:true,at:new Date().toISOString(),out,source,sourceHashes,changes,ui,uiFiles,baseImageSha256:base.imageSha256,baseUiFiles:base.uiFiles,version:base.version,providerRequests:0,databaseWrites:0,backendChanges:[],installed:false};
await writeFile(path.join(out,'proof.json'),JSON.stringify(proof,null,2),{flag:'wx'});await writeFile(path.join(records,'current.json'),JSON.stringify({out,proof:path.join(out,'proof.json')},null,2));
console.log(JSON.stringify({success:true,out,source,ui,changes,backendChanges:[]}));
