import {readFile,writeFile,mkdir,copyFile,readdir} from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import path from 'node:path';
import assert from 'node:assert/strict';
import {desktopOperation} from './operation-lock.mjs';
desktopOperation('archive the closed profile for WSL recovery');
const exec=promisify(execFile),root=path.resolve(import.meta.dirname,'../..'),out=path.resolve(process.argv[2]);assert(out.startsWith(path.join(root,'.supabase/desktop-runtime-recovery')+path.sep));
const closed=async()=>assert.equal((await exec('powershell.exe',['-NoProfile','-NonInteractive','-Command','@(Get-Process Agentopia -ErrorAction SilentlyContinue).Count'],{windowsHide:true,encoding:'utf8'})).stdout.trim(),'0');await closed();
const hash=async file=>{const h=createHash('sha256');for await(const chunk of createReadStream(file))h.update(chunk);return h.digest('hex');},roots={ordinary:'C:\\Users\\charl\\AppData\\Roaming\\Agentopia',overlay:'C:\\Users\\charl\\AppData\\Local\\Packages\\OpenAI.Codex_2p2nqsd0c76g0\\LocalCache\\Roaming\\Agentopia'},excluded=['wsl','test-profiles','backups','Cache','Code Cache','GPUCache','DawnGraphiteCache','DawnWebGPUCache','GPUPersistentCache','GrShaderCache','ShaderCache','temporary-audio'];
const evidence={at:new Date().toISOString(),success:false,out,exclusions:excluded,profiles:{},providerRequests:0,productionMigrated:false,installed:false,scope:'Closed Windows profile archives, verified critical state and existing logical database backup. WSL disk and older backups remain in place; this is not a cold disk image.'};
async function nativeCaches(source){
 const result=[];let owners=[];try{owners=await readdir(path.join(source,'codex'),{withFileTypes:true});}catch(error){if(error.code==='ENOENT')return result;throw error;}
 for(const owner of owners.filter(entry=>entry.isDirectory()&&/^[a-f0-9-]{36}$/i.test(entry.name)))for(const provider of ['openai-oauth','openrouter']){
  let scopes=[];try{scopes=await readdir(path.join(source,'codex',owner.name,provider),{withFileTypes:true});}catch(error){if(error.code==='ENOENT')continue;throw error;}
  for(const scope of scopes.filter(entry=>entry.isDirectory()))for(const suffix of ['.tmp','tmp','skills/.system'])result.push('./'+['codex',owner.name,provider,scope.name,suffix].join('/'));
 }
 return result;
}
try{
 const captures=await Promise.allSettled(Object.entries(roots).map(async([label,source])=>{const archive=path.join(out,label+'-profile-core.tar'),caches=await nativeCaches(source);await writeFile(path.join(out,'private-'+label+'-cache-exclusions.json'),JSON.stringify(caches,null,2));const patterns=path.join(out,'private-'+label+'-exclusions.txt');await writeFile(patterns,[...excluded.map(name=>'./'+name),...caches].join('\n')+'\n');await exec('tar.exe',['-cf',archive,'-X',patterns,'-C',source,'.'],{windowsHide:true,timeout:600000,maxBuffer:1024*1024});console.log(label+' archive written');await closed();const result=await exec('python',['-X','utf8',path.join(root,'scripts/desktop/verify-recovery-archive.py'),archive,source],{windowsHide:true,timeout:120000,encoding:'utf8',maxBuffer:1024*1024}),checked=JSON.parse(result.stdout);assert(checked.success);return [label,{archive,sha256:await hash(archive),derivedNativeCacheExclusions:caches.length,...checked}];}));
 for(const result of captures){if(result.status==='rejected')throw result.reason;evidence.profiles[result.value[0]]=result.value[1];}
 const backupName='2026-10-18T17-58-48.425Z-manual',source=path.join(roots.ordinary,'backups',backupName),destination=path.join(out,'database-backup');await mkdir(destination);const manifest=JSON.parse(await readFile(path.join(source,'manifest.json'),'utf8'));for(const file of manifest.files){assert.equal(path.basename(file.name),file.name);assert.equal(await hash(path.join(source,file.name)),file.sha256);await copyFile(path.join(source,file.name),path.join(destination,file.name));assert.equal(await hash(path.join(destination,file.name)),file.sha256);}for(const name of ['manifest.json','RECOVERY.txt','NATIVE-RECOVERY.txt','Restore-Agentopia.ps1'])await copyFile(path.join(source,name),path.join(destination,name));evidence.database={directory:destination,backupName,verifiedFiles:manifest.files.length};
 await closed();evidence.installedSha256=await hash('C:\\Users\\charl\\AppData\\Local\\AgentopiaDesktop\\app-0.44.17\\resources\\app.asar');assert.equal(evidence.installedSha256,'042d07287e8ce126a611ce8e7307c332c5b33f8a33459c32324b44ffcb5fc942');evidence.success=true;
}catch(error){evidence.error=error.message;await writeFile(path.join(out,'archive-failure.log'),String(error.stderr??''));throw error;}finally{await writeFile(path.join(out,'profile-archives.json'),JSON.stringify(evidence,null,2));console.log(JSON.stringify({success:evidence.success,profiles:evidence.profiles,out,error:evidence.error}));}
await writeFile(path.join(root,'.supabase/desktop-runtime-recovery/latest-profile.json'),JSON.stringify({success:true,out,evidence:path.join(out,'profile-archives.json')},null,2));
