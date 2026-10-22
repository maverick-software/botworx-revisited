import {readFile,writeFile,lstat,realpath,statfs} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import path from 'node:path';
import assert from 'node:assert/strict';
import {desktopOperation} from './operation-lock.mjs';
desktopOperation('compress inactive retained application archives in place');
const folder=path.resolve('C:/Users/charl/AppData/Local/AgentopiaDesktop/app-0.44.47/resources'),root=path.resolve(import.meta.dirname,'../..'),exec=promisify(execFile),sha=async file=>createHash('sha256').update(await readFile(file)).digest('hex'),free=async()=>{const s=await statfs(folder);return s.bavail*s.bsize;};
assert.equal((await realpath(folder)).toLowerCase(),folder.toLowerCase());
const names=['app-before-context6.asar','app-before-context7.asar','app-before-mentions8.asar','app-before-office10.asar','app-before-office3.asar','app-before-presentation4.asar','app-before-refresh12.asar','app-before-exports13.asar'],files=[];
for(const name of names){const file=path.join(folder,name),s=await lstat(file);assert(s.isFile()&&!s.isSymbolicLink());if(s.nlink!==1)continue;files.push({file,bytes:s.size,sha256:await sha(file)});}
const out=path.join(root,'.supabase/desktop-chat-output-edits',Date.now()+'-rollback-compression.json'),record={success:false,at:new Date().toISOString(),scope:'Explicit inactive rollback archives only; current app.asar excluded; no move or deletion',beforeFree:await free(),files,failures:[]};await writeFile(out,JSON.stringify(record,null,2),{flag:'wx'});
for(const row of files){try{await exec('compact.exe',['/C','/F','/EXE:LZX','/I','/Q',path.basename(row.file)],{cwd:folder,windowsHide:true});}catch(error){record.failures.push({file:row.file,error:error.message});}assert.equal(await sha(row.file),row.sha256);}
record.afterFree=await free();record.success=record.failures.length===0;record.pathsAndContentsPreserved=true;await writeFile(out,JSON.stringify(record,null,2));console.log(JSON.stringify({success:record.success,files:files.length,failures:record.failures.length,observedFreeGain:record.afterFree-record.beforeFree,afterFree:record.afterFree,receipt:out}));
