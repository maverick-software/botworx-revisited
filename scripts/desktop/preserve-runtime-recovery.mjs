import {mkdir,readdir,lstat,stat,readFile,writeFile,copyFile} from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import path from 'node:path';
import assert from 'node:assert/strict';
import {desktopOperation} from './operation-lock.mjs';
desktopOperation('preserve the closed Windows profile before WSL recovery');
const exec=promisify(execFile),root=path.resolve(import.meta.dirname,'../..'),out=path.join(root,'.supabase/desktop-runtime-recovery','recovery-'+Date.now());
const closed=async()=>assert.equal((await exec('powershell.exe',['-NoProfile','-NonInteractive','-Command','@(Get-Process Agentopia -ErrorAction SilentlyContinue).Count'],{encoding:'utf8',windowsHide:true})).stdout.trim(),'0','Close Agentopia normally before preserving its profile.');
await closed();await mkdir(out,{recursive:true});
const sid=(await exec('powershell.exe',['-NoProfile','-NonInteractive','-Command','[Security.Principal.WindowsIdentity]::GetCurrent().User.Value'],{encoding:'utf8',windowsHide:true})).stdout.trim();assert(/^S-1-5-[0-9-]+$/.test(sid));await exec('icacls.exe',[out,'/inheritance:r','/grant:r','*'+sid+':(OI)(CI)F','*S-1-5-18:(OI)(CI)F','/Q'],{windowsHide:true});
const hash=async file=>{const h=createHash('sha256');for await(const bytes of createReadStream(file))h.update(bytes);return h.digest('hex');};
const roots={ordinary:'C:\\Users\\charl\\AppData\\Roaming\\Agentopia',overlay:'C:\\Users\\charl\\AppData\\Local\\Packages\\OpenAI.Codex_2p2nqsd0c76g0\\LocalCache\\Roaming\\Agentopia'},backupName='2026-10-18T17-58-48.425Z-manual',excluded=new Set(['wsl','test-profiles','Cache','Code Cache','GPUCache','DawnGraphiteCache','DawnWebGPUCache','GPUPersistentCache','GrShaderCache','ShaderCache','temporary-audio']);
const evidence={at:new Date().toISOString(),out,success:false,closedProfile:true,providerRequests:0,installed:false,productionMigrated:false,profiles:{},exclusions:[...excluded],olderBackupsExcluded:true,database:'The verified application-created logical backup is copied; the active WSL disk is retained in place and is not represented as a cold image.'};
try{
 for(const [label,source]of Object.entries(roots)){
  const manifest={};let bytes=0;
  async function walk(relative=''){
   for(const name of await readdir(path.join(source,relative))){const next=path.join(relative,name);if(!relative&&excluded.has(name)||relative==='backups'&&name!==backupName)continue;const from=path.join(source,next),entry=await lstat(from);assert(!entry.isSymbolicLink(),'A linked profile entry requires inspection.');if(entry.isDirectory()){await walk(next);continue;}assert(entry.isFile());const to=path.join(out,label,next);assert(to.toLowerCase().startsWith((path.join(out,label)+path.sep).toLowerCase()));await mkdir(path.dirname(to),{recursive:true});const fingerprint=await hash(from);await copyFile(from,to);assert.equal(await hash(to),fingerprint);const after=await stat(from);assert.equal(after.size,entry.size);assert.equal(after.mtimeMs,entry.mtimeMs);assert.equal(await hash(from),fingerprint);manifest[next.replaceAll('\\','/')]={bytes:entry.size,sha256:fingerprint,mtimeMs:entry.mtimeMs};bytes+=entry.size;}
  }
  await walk();await closed();assert(manifest['credentials.bin']);
  const backup=path.join(source,'backups',backupName),saved=JSON.parse(await readFile(path.join(backup,'manifest.json'),'utf8'));for(const file of saved.files){assert.equal(path.basename(file.name),file.name);assert.equal(await hash(path.join(backup,file.name)),file.sha256);assert(manifest['backups/'+backupName+'/'+file.name]);}
  await writeFile(path.join(out,'private-'+label+'-manifest.json'),JSON.stringify(manifest,null,2));evidence.profiles[label]={files:Object.keys(manifest).length,bytes,databaseFilesVerified:saved.files.length};console.log(JSON.stringify({profile:label,...evidence.profiles[label]}));
 }
 await closed();evidence.installedSha256=await hash('C:\\Users\\charl\\AppData\\Local\\AgentopiaDesktop\\app-0.44.17\\resources\\app.asar');assert.equal(evidence.installedSha256,'042d07287e8ce126a611ce8e7307c332c5b33f8a33459c32324b44ffcb5fc942');evidence.success=true;
}catch(error){evidence.error=error.message;throw error;}finally{await writeFile(path.join(out,'evidence.json'),JSON.stringify(evidence,null,2));}
await writeFile(path.join(root,'.supabase/desktop-runtime-recovery','latest-profile.json'),JSON.stringify({out,evidence:path.join(out,'evidence.json'),success:true},null,2));console.log(JSON.stringify({success:true,out}));
