import {cp,mkdir,readFile,writeFile,readdir,lstat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import path from 'node:path';
import assert from 'node:assert/strict';
import {build} from 'vite';
import react from '@vitejs/plugin-react';
import {desktopOperation} from './operation-lock.mjs';

desktopOperation('prepare installed schedule option and switch appearance repair');
const root=path.resolve(import.meta.dirname,'../..'),base=path.join(root,'.supabase/desktop-platform-release/candidate-04424'),out=path.join(root,'.supabase/desktop-scheduled-appearance','repair-'+Date.now()),source=path.join(out,'source/desktop'),exec=promisify(execFile),hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const frozen=JSON.parse(await readFile(path.join(base,'package-proof.json'),'utf8'));assert(frozen.success&&frozen.version==='0.44.24');
for(const [name,digest]of Object.entries(frozen.sourceHashes))if(name.startsWith('ui/')&&name!=='ui/scheduled-tasks.css')assert.equal(hash(await readFile(path.join(root,'desktop',name))),digest,'Unrelated UI change: '+name);
await mkdir(out,{recursive:true});await cp(path.join(base,'source/desktop'),source,{recursive:true,filter:file=>file!==path.join(base,'source/desktop/build')});
const file='ui/scheduled-tasks.css',before=await readFile(path.join(source,file)),after=await readFile(path.join(root,'desktop',file));assert.notEqual(hash(before),hash(after));await writeFile(path.join(source,file),after);
await exec(process.execPath,['node_modules/typescript/bin/tsc','-p',path.join(source,'ui/tsconfig.json')],{cwd:root,windowsHide:true,timeout:60000,maxBuffer:1024*1024});
await build({configFile:false,envDir:false,root:path.join(source,'ui'),plugins:[react()],base:'/',build:{outDir:path.join(out,'ui'),emptyOutDir:true,assetsInlineLimit:0}});
const files={};for(const name of await readdir(path.join(out,'ui'),{recursive:true})){const target=path.join(out,'ui',name);if((await lstat(target)).isFile())files[name.replaceAll('\\','/')]=hash(await readFile(target));}
const prepared={success:true,at:new Date().toISOString(),baseVersion:'0.44.24',schema:67,source,ui:path.join(out,'ui'),files,changed:[{file,beforeSha256:hash(before),afterSha256:hash(after)}],typecheck:true,backendChanged:false,databaseChanged:false,providerRequests:0,installed:false};
await writeFile(path.join(out,'prepared.json'),JSON.stringify(prepared,null,2));await writeFile(path.join(root,'.supabase/desktop-scheduled-appearance/latest.json'),JSON.stringify({out},null,2));console.log(JSON.stringify({success:true,out,changed:[file],backendChanged:false}));
