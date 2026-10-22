import {lstat,readFile} from 'node:fs/promises';
import path from 'node:path';

export const legacyDistribution='AgentopiaRuntime';
export type RuntimeBinding={format:1;distribution:string;instanceId?:string};
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
export function privateDistribution(value:unknown):value is string{
 return typeof value==='string'&&(value.toLowerCase()===legacyDistribution.toLowerCase()||value.toLowerCase().startsWith(legacyDistribution.toLowerCase()+'-')&&uuid.test(value.slice(legacyDistribution.length+1).toLowerCase()));
}
export function parseRuntimeBinding(value:unknown):RuntimeBinding{
 if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('Invalid runtime binding.');
 const binding=value as Record<string,unknown>;
 if(binding.format!==1||typeof binding.instanceId!=='string'||!uuid.test(binding.instanceId)||binding.distribution!==legacyDistribution+'-'+binding.instanceId||Object.keys(binding).sort().join(',')!=='distribution,format,instanceId')throw new Error('Invalid runtime binding.');
 return {format:1,distribution:binding.distribution as string,instanceId:binding.instanceId};
}
export async function loadRuntimeBinding(directory:string):Promise<RuntimeBinding>{
 const file=path.join(directory,'runtime-binding.json');
 const failure=()=>new Error('Agentopia could not verify this installation’s runtime binding. Close the app, restore its runtime-binding.json from the migration record, and reopen it. The original backend has been left untouched.');
 let info;try{info=await lstat(file);}catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')return {format:1,distribution:legacyDistribution};throw failure();}
 try{
  if(!info.isFile()||info.isSymbolicLink()||info.nlink!==1||info.size>4096)throw new Error('Invalid runtime binding file.');
  return parseRuntimeBinding(JSON.parse(await readFile(file,'utf8')));
 }catch{throw failure();}
}
export function transferPrefix(distribution:string,user:'root'|'agentopia'){
 if(!privateDistribution(distribution))throw new Error('Invalid private runtime distribution.');
 return ['--distribution',distribution,'--user',user];
}
export function privateRuntimePath(value:string){
 const match=/^\\\\(?:wsl\$|wsl\.localhost)\\([^\\]+)(?:\\|$)/i.exec(value.replace(/^\\\\\?\\UNC\\/i,'\\\\'));
 return !!match&&privateStorageDistribution(match[1]);
}
// Recovery readers also contain private account data. This classification
// does not make them selectable as the application's runtime binding.
export function privateStorageDistribution(value:unknown):value is string{
 const prefix='AgentopiaBackupReader-';
 return privateDistribution(value)||typeof value==='string'&&value.toLowerCase().startsWith(prefix.toLowerCase())&&uuid.test(value.slice(prefix.length).toLowerCase());
}
