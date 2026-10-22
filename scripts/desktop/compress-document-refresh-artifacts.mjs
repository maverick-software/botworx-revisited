import {readFile,writeFile,readdir,lstat,statfs} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {createHash} from 'node:crypto';
import path from 'node:path';
import assert from 'node:assert/strict';
const root=path.resolve(import.meta.dirname,'../..'),pointer=JSON.parse(await readFile(path.join(root,'.supabase/desktop-office-pane/refresh-work.json'),'utf8')),scope=path.resolve(pointer.out),exec=promisify(execFile);
assert.equal(path.dirname(scope),path.resolve('C:/Users/charl/AgentopiaQA/document-refresh'));
const hash=async file=>createHash('sha256').update(await readFile(file)).digest('hex'),free=async()=>{const s=await statfs(scope);return s.bavail*s.bsize;},files=[];
async function visit(dir){for(const name of await readdir(dir)){const file=path.join(dir,name),s=await lstat(file);if(s.isSymbolicLink())continue;if(s.isDirectory())await visit(file);else if(s.isFile()&&s.nlink===1&&s.size>=4096&&/\.(js|css|cjs|mjs|ts|json|log|html|png|map|asar)$/.test(name))files.push({file,bytes:s.size,sha256:await hash(file)});}}
await visit(scope);const receipt={at:new Date().toISOString(),scope,operation:'NTFS compression of completed owned QA artifacts; paths and contents retained',beforeFree:await free(),files,failures:[]},out=path.join(scope,'compression-'+Date.now()+'.json');await writeFile(out,JSON.stringify(receipt,null,2),{flag:'wx'});
for(const row of files){try{await exec('compact.exe',['/C','/I','/Q',path.basename(row.file)],{cwd:path.dirname(row.file),windowsHide:true});}catch(error){receipt.failures.push({file:row.file,message:error.message});}assert.equal(await hash(row.file),row.sha256);}
receipt.afterFree=await free();receipt.success=true;await writeFile(out,JSON.stringify(receipt,null,2));console.log(JSON.stringify({success:true,files:files.length,failures:receipt.failures.length,observedFreeGain:receipt.afterFree-receipt.beforeFree,afterFree:receipt.afterFree,receipt:out}));
