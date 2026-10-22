import {readdir,mkdir,lstat,link,copyFile,readFile,realpath} from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import {createHash} from 'node:crypto';
import path from 'node:path';
import assert from 'node:assert/strict';
export async function cloneChatPolishProgram(root,proof,target){
 assert(proof.version==='0.44.43'&&proof.success);const source=proof.portableDirectory,hash=async file=>{const h=createHash('sha256');for await(const b of createReadStream(file))h.update(b);return h.digest('hex');};
 assert(path.resolve(source).startsWith(path.resolve('C:/Users/charl/AgentopiaQA/chat-polish-release')+path.sep));assert.equal(path.dirname(path.dirname(target)),path.resolve('C:/Users/charl/AgentopiaQA/plugin-compatibility'));assert.equal((await realpath(source)).toLowerCase(),source.toLowerCase());assert.notEqual(source,target);assert.equal(await hash(path.join(source,'resources/app.asar')),proof.imageSha256);await mkdir(target);let linked=0,copied=0;
 for(const name of (await readdir(source,{recursive:true})).sort()){const from=path.join(source,name),to=path.join(target,name),info=await lstat(from);assert(!info.isSymbolicLink());if(!info.isFile())continue;await mkdir(path.dirname(to),{recursive:true});const relative=name.replaceAll('\\','/'),resource=relative.startsWith('resources/resources/')?relative.slice('resources/resources/'.length):null;if(resource)assert.equal(await hash(from),proof.resourceFiles[resource]);if(resource==='runtime/config.toml'){await copyFile(from,to);copied++;}else{await link(from,to);linked++;}}
 return {source,target,linked,copied,resourceConfigIndependent:true,defaultConfigSha256:await hash(path.join(source,'resources/resources/runtime/config.toml'))};
}
