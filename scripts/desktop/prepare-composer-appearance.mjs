import {cp,mkdir,readFile,writeFile,readdir,lstat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import path from 'node:path';
import assert from 'node:assert/strict';
import {build} from 'vite';
import react from '@vitejs/plugin-react';
import {desktopOperation} from './operation-lock.mjs';
desktopOperation('prepare the installed-version composer appearance repair');
const root=path.resolve(import.meta.dirname,'../..'),base=path.join(root,'.supabase/desktop-goal-queue/candidate-04417'),out=path.join(root,'.supabase/desktop-composer-appearance','repair-'+Date.now()),source=path.join(out,'source/desktop'),exec=promisify(execFile);
let replacesRepair=null;try{const previous=JSON.parse(await readFile(path.join(root,'.supabase/desktop-composer-appearance/latest.json'),'utf8'));const applied=JSON.parse(await readFile(path.join(previous.out,'applied.json'),'utf8'));const verified=JSON.parse(await readFile(path.join(previous.out,'installed-verification.json'),'utf8'));assert(applied.success&&verified.success);replacesRepair=previous.out;}catch(error){if(error.code!=='ENOENT')throw error;}
await mkdir(out,{recursive:true});await cp(path.join(base,'source/desktop'),source,{recursive:true,filter:file=>file!==path.join(base,'source/desktop/build')});
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const changed=[];
const requireSource={agent:await readFile(path.join(root,'desktop/ui/agent-style.css'),'utf8'),style:await readFile(path.join(root,'desktop/ui/style.css'),'utf8')};
async function edit(file,operation){const target=path.join(source,file),before=await readFile(target,'utf8'),after=operation(before);assert.notEqual(before,after,file);await writeFile(target,after);changed.push({file,beforeSha256:hash(before),afterSha256:hash(after)});}
await edit('ui/Panels.tsx',text=>{for(const line of ['<small>Powered by PostgreSQL and Supabase</small>','<small>Account sign-in works locally. Connect an AI provider after signing in.</small>']){assert.equal(text.split(line).length,2);text=text.replace(line,'');}return text;});
await edit('ui/agent-style.css',text=>{const rule='.agent-context-chip{cursor:pointer}';assert(text.includes(rule));const current='.composer .agent-context{padding:0 0 6px}.composer .agent-context-chip{cursor:pointer;color:var(--text);font-size:12px;font-weight:450;max-width:min(100%,240px);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.composer .agent-context-chip:disabled{color:var(--muted);opacity:1}';for(const rule of current.split('}').filter(Boolean))assert(requireSource.agent.includes(rule+'}'));return text.replace(rule,current);});
await edit('ui/style.css',text=>{const before='.composer textarea::placeholder{color:var(--muted)}',after='.composer textarea::placeholder{color:var(--text);font-size:14px;font-weight:400;opacity:.55}';assert.equal(text.split(before).length,2);assert(requireSource.style.includes(after));for(const [oldRule,newRule] of [['.image-attachment .attachment-details{padding:6px 8px}','.image-attachment .attachment-details{display:none}'],['.message-files .message-image small{display:block;','.message-files .message-image small{display:none;']]){assert(text.includes(oldRule));assert(requireSource.style.includes(newRule));text=text.replace(oldRule,newRule);}return text.replace(before,after)+'\n:root[data-text-size=large] .composer textarea::placeholder{font-size:16px}\n';});
await edit('ui/Attachments.tsx',text=>{const before='title={failure||file.path}',after='title={failure||(isImage?file.name:file.path)}';assert.equal(text.split(before).length,2);return text.replace(before,after);});
await exec(process.execPath,['node_modules/typescript/bin/tsc','-p',path.join(source,'ui/tsconfig.json')],{cwd:root,windowsHide:true,timeout:60000,maxBuffer:1024*1024});
await build({configFile:false,envDir:false,root:path.join(source,'ui'),plugins:[react()],base:'/',build:{outDir:path.join(out,'ui'),emptyOutDir:true,assetsInlineLimit:0}});
const files={};for(const name of await readdir(path.join(out,'ui'),{recursive:true})){const file=path.join(out,'ui',name);if((await lstat(file)).isFile())files[name.replaceAll('\\','/')]=hash(await readFile(file));}
const evidence={success:true,at:new Date().toISOString(),baseVersion:'0.44.17',schema:59,source,changed,replacesRepair,ui:path.join(out,'ui'),files,typecheck:true,backendChanged:false,databaseChanged:false,providerRequests:0,installed:false};
await writeFile(path.join(out,'prepared.json'),JSON.stringify(evidence,null,2));await writeFile(path.join(root,'.supabase/desktop-composer-appearance/latest.json'),JSON.stringify({out},null,2));console.log(JSON.stringify({success:true,out,changed:changed.map(row=>row.file),backendChanged:false},null,2));

