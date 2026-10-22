import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,copyFile,link,realpath,lstat} from 'node:fs/promises';
import path from 'node:path';
import {hash} from './phased-backup-control.mjs';

export async function captureMaintenanceProgram({job,proof}) {
 const root=path.resolve(import.meta.dirname,'../..'),source='C:/Users/charl/AppData/Local/AgentopiaDesktop/app-0.44.48';
 assert.equal(path.dirname(job),path.join(root,'.supabase/desktop-normal-maintenance'));assert(/^\d{13}$/.test(path.basename(job)));
 assert.equal((await realpath(job)).toLowerCase(),job.toLowerCase());assert.equal((await realpath(source)).toLowerCase(),path.resolve(source).toLowerCase());
 const currentSha='d4779251528ccfe57dc9c7137615665b3daf809e916117a13f6b0b9cd4fe9dd7';
 const base=JSON.parse(await readFile(path.join(root,'.supabase/desktop-release-04448/1792527849453/package-proof.json'),'utf8'));assert.equal(base.imageSha256,currentSha);
 const expected=Object.fromEntries(Object.entries(base.resourceFiles).map(([k,v])=>['resources/resources/'+k,v]));
 for(const [name,digest]of Object.entries(base.programFiles))expected[name]=digest;
 const destination=path.join(job,'rollback/program');await mkdir(destination,{recursive:true});let reused=0,copied=0;const files={};
 for(const [name,digest]of Object.entries(expected)) {
  assert(!path.isAbsolute(name)&&!name.includes('..')&&!name.includes('\\'));
  const from=path.join(source,name),info=await lstat(from);assert(info.isFile()&&!info.isSymbolicLink());const sha=await hash(from);
  if(digest)assert.equal(sha,digest,'The active resource changed: '+name);
  const to=path.join(destination,name);await mkdir(path.dirname(to),{recursive:true});const staged=path.join(proof.program,name);
  let reusable=false;try{reusable=await hash(staged)===sha;}catch(error){if(error.code!=='ENOENT')throw error;}
  if(reusable){await link(staged,to);reused++;}else{await copyFile(from,to);copied++;}
  assert.equal(await hash(to),sha);files[name]=sha;
 }
 const identityFiles={};
 for(const [name,from]of [['profile-location.json','C:/Users/charl/.agentopia/desktop/profile-location.json'],['runtime-binding.json','C:/Users/charl/.agentopia/desktop/profile/runtime-binding.json']]) {
  await copyFile(from,path.join(job,'rollback',name));identityFiles[name]=await hash(from);
 }
 const receipt={success:true,source,destination,files,identityFiles,reusedApplicableFiles:reused,copiedActiveFiles:copied};
 await writeFile(path.join(job,'program-rollback.json'),JSON.stringify(receipt,null,2),{flag:'wx'});return receipt;
}
