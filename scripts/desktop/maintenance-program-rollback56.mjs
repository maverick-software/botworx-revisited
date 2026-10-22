// Retain the verified active53 program for this upgrade, using F-drive resources.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,copyFile,link,realpath,lstat} from 'node:fs/promises';
import path from 'node:path';
import {hash} from './phased-backup-control.mjs';
export async function captureMaintenanceProgram({job,proof}){
 const root=path.resolve(import.meta.dirname,'../..'),source=path.resolve('C:/Users/charl/AppData/Local/AgentopiaDesktop/app-0.44.55'),base=JSON.parse(await readFile(proof.acceptedBase,'utf8'));
 assert(base.success&&base.version==='0.44.55'&&proof.version==='0.44.56');assert.equal(path.dirname(job),path.join(root,'.supabase/desktop-normal-maintenance'));assert(/^\d{13}$/.test(path.basename(job)));assert.equal((await realpath(job)).toLowerCase(),job.toLowerCase());assert.equal((await realpath(source)).toLowerCase(),source.toLowerCase());assert.equal(await hash(path.join(source,'resources/app.asar')),base.imageSha256);
 const expected={...base.programFiles,...Object.fromEntries(Object.entries(base.resourceFiles).map(([name,digest])=>['resources/resources/'+name,digest]))},destination=path.join(job,'rollback/program'),files={};await mkdir(destination,{recursive:true});let reused=0,copied=0;
 for(const [name,digest]of Object.entries(expected)){
  assert(!path.isAbsolute(name)&&!name.includes('..')&&!name.includes('\\'));const from=path.join(source,name),info=await lstat(from);assert(info.isFile()&&!info.isSymbolicLink());assert.equal(await hash(from),digest,'The active program changed: '+name);const to=path.join(destination,name),candidate=path.join(proof.program,name);await mkdir(path.dirname(to),{recursive:true});
  let reusable=false;try{reusable=await hash(candidate)===digest;}catch(error){if(error.code!=='ENOENT')throw error;}if(reusable){await link(candidate,to);reused++;}else{await copyFile(from,to);copied++;}assert.equal(await hash(to),digest);files[name]=digest;
 }
 const identityFiles={};for(const [name,from]of [['profile-location.json','C:/Users/charl/.agentopia/desktop/profile-location.json'],['runtime-binding.json','F:/Agentopia-Data/profiles/a91a4800-e08f-4440-a4ec-588762d01bfd/profile/runtime-binding.json']]){await copyFile(from,path.join(job,'rollback',name));identityFiles[name]=await hash(from);}
 const result={success:true,source,destination,files,identityFiles,reusedApplicableFiles:reused,copiedActiveFiles:copied};await writeFile(path.join(job,'program-rollback.json'),JSON.stringify(result,null,2),{flag:'wx'});return result;
}
