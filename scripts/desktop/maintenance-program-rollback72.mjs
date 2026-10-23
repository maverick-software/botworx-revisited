import assert from 'node:assert/strict';
import path from 'node:path';
import {readFile,writeFile,mkdir,copyFile,link,realpath,lstat} from 'node:fs/promises';
import {hash} from './phased-backup-control.mjs';

export async function captureMaintenanceProgram({job,proof}){
 const root=path.resolve(import.meta.dirname,'../..');
 const source=path.resolve('C:/Users/charl/AppData/Local/AgentopiaDesktop/app-0.44.71');
 const base=JSON.parse(await readFile(proof.acceptedBase,'utf8'));
 assert(base.success&&base.version==='0.44.71'&&proof.version==='0.44.72');
 assert.equal(path.dirname(job),path.join(root,'.supabase/desktop-normal-maintenance'));assert(/^\d{13}$/.test(path.basename(job)));
 assert.equal((await realpath(job)).toLowerCase(),job.toLowerCase());assert.equal((await realpath(source)).toLowerCase(),source.toLowerCase());
 assert.equal(await hash(path.join(source,'resources/app.asar')),base.imageSha256);
 const expected={...base.programFiles,...Object.fromEntries(Object.entries(base.resourceFiles).map(([name,digest])=>['resources/resources/'+name,digest]))};
 const destination=path.join(job,'rollback/program'),files={};await mkdir(destination,{recursive:true});let reused=0,copied=0;
 for(const [name,digest]of Object.entries(expected)){
  assert(!path.isAbsolute(name)&&!name.includes('..')&&!name.includes('\\'));
  const from=path.join(source,name),info=await lstat(from);assert(info.isFile()&&!info.isSymbolicLink());
  assert.equal(await hash(from),digest,'The active program changed: '+name);
  const to=path.join(destination,name),candidate=path.join(proof.program,name);await mkdir(path.dirname(to),{recursive:true});
  let reusable=false;try{reusable=await hash(candidate)===digest;}catch(error){if(error.code!=='ENOENT')throw error;}
  if(reusable){await link(candidate,to);reused++;}else{await copyFile(from,to);copied++;}
  assert.equal(await hash(to),digest);files[name]=digest;
 }
 const priorInstaller=JSON.parse(await readFile(path.join(path.dirname(proof.acceptedBase),'installer-verification/evidence.json'),'utf8'));
 assert(priorInstaller.success&&priorInstaller.version==='0.44.71');
 const rootFiles={};for(const [name,expectedSha256]of [['Agentopia.exe',priorInstaller.generatedLauncher.launcherSha256],['Update.exe',base.programFiles['squirrel.exe']]]){
  const from=path.join(path.dirname(source),name),to=path.join(job,'rollback','root-'+name);
  assert.equal(await hash(from),expectedSha256);await copyFile(from,to);assert.equal(await hash(to),expectedSha256);
  rootFiles[name]={source:from,saved:to,sha256:expectedSha256};
 }
 const identityFiles={};for(const [name,from]of [['profile-location.json','C:/Users/charl/.agentopia/desktop/profile-location.json'],['runtime-binding.json','F:/Agentopia-Data/profiles/a91a4800-e08f-4440-a4ec-588762d01bfd/profile/runtime-binding.json']]){
  await copyFile(from,path.join(job,'rollback',name));identityFiles[name]=await hash(from);
 }
 const result={success:true,source,destination,files,rootFiles,identityFiles,reusedApplicableFiles:reused,copiedActiveFiles:copied,acceptedInstalledBase:proof.acceptedBase};
 await writeFile(path.join(job,'program-rollback.json'),JSON.stringify(result,null,2),{flag:'wx'});return result;
}
