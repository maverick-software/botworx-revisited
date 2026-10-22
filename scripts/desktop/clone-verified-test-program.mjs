import {readFile,readdir,mkdir,lstat,link,copyFile,realpath} from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import {createHash} from 'node:crypto';
import path from 'node:path';
import assert from 'node:assert/strict';

// Reuse immutable C: test-program bytes, keeping the one mutable test config
// independent. This creates no links to user profiles, audio or database disks.
export async function cloneVerifiedTestProgram(root,proof,target){
 const hash=async file=>{const digest=createHash('sha256');for await(const bytes of createReadStream(file))digest.update(bytes);return digest.digest('hex');},json=async file=>JSON.parse(await readFile(file,'utf8'));
 const accepted=await json(path.join(root,'.supabase/desktop-platform-release/candidate-04437/voice-packaged-acceptance.json'));assert(accepted.success&&accepted.version===proof.version&&accepted.imageSha256===proof.imageSha256);assert.equal(await hash(accepted.evidence),accepted.evidenceSha256);
 const previous=await json(accepted.evidence),source=path.join(path.dirname(accepted.evidence),'program'),qa=path.resolve('C:/Users/charl/AgentopiaQA/plugin-compatibility');assert.equal(path.dirname(path.dirname(source)),qa);assert.equal(path.dirname(path.dirname(target)),qa);assert.notEqual(source,target);assert.equal((await realpath(source)).toLowerCase(),source.toLowerCase());
 let previousConfig=await readFile(path.join(proof.resources,'runtime/config.toml'),'utf8');for(let offset=0;offset<6;offset++)previousConfig=previousConfig.replaceAll(String(57320+offset),String(previous.ports.shadow+offset));
 let linked=0,copied=0;await mkdir(target);for(const name of (await readdir(source,{recursive:true})).sort()){const from=path.join(source,name),to=path.join(target,name),info=await lstat(from);assert(!info.isSymbolicLink());if(!info.isFile())continue;await mkdir(path.dirname(to),{recursive:true});const relative=name.replaceAll('\\','/'),resource=relative.startsWith('resources/resources/')?relative.slice('resources/resources/'.length):null;
  if(resource==='runtime/config.toml'){assert.equal(await hash(from),createHash('sha256').update(previousConfig).digest('hex'));await copyFile(path.join(proof.resources,'runtime/config.toml'),to);copied++;continue;}
  const expected=resource?proof.resourceFiles[resource]:relative==='resources/app.asar'?proof.imageSha256:await hash(path.join(proof.portableDirectory,name));assert(expected,'Unrecognized prior test resource: '+relative);assert.equal(await hash(from),expected,'Prior immutable bytes changed: '+relative);await link(from,to);linked++;
 }
 return {source,target,linked,copied,verifiedPreviousEvidence:accepted.evidence,resourceConfigIndependent:true};
}
