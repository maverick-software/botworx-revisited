import path from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {mkdir,writeFile} from 'node:fs/promises';
const root=path.resolve(import.meta.dirname,'../..'),out=path.join(root,'.supabase/desktop-scheduled-workspaces67','import-regression-'+Date.now()),run=promisify(execFile),steps=[];await mkdir(out,{recursive:true});
// Each child owns the shared desktop operation lock. Do not overlap builds,
// runtime tests or edits to hashed input while this sequence is running.
for(const script of ['qualify-scheduled-workspaces67-maintenance.mjs','qualify-scheduled-workspaces67-owner-records.mjs','qualify-scheduled-workspaces67-controls.mjs','qualify-scheduled-projects67-foundation.mjs','qualify-scheduled-workspaces67-links.mjs','qualify-scheduled-workspaces67-payload.mjs']){
 console.log('Starting '+script);const started=new Date().toISOString();try{const result=await run(process.execPath,[path.join('scripts/desktop',script)],{cwd:root,windowsHide:true,timeout:900000,maxBuffer:4*1024**2});await writeFile(path.join(out,script+'.log'),result.stdout+'\n'+result.stderr);steps.push({script,started,finished:new Date().toISOString(),success:true});console.log(result.stdout.trim());}catch(error){await writeFile(path.join(out,script+'.log'),(error.stdout??'')+'\n'+(error.stderr??String(error)));steps.push({script,started,finished:new Date().toISOString(),success:false});await writeFile(path.join(out,'evidence.json'),JSON.stringify({success:false,steps,out},null,2));throw error;}
 await writeFile(path.join(out,'evidence.json'),JSON.stringify({success:steps.length===6,steps,out},null,2));
}
console.log(JSON.stringify({success:true,out,steps:steps.length}));
