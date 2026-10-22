import path from 'node:path';import {createHash} from 'node:crypto';import {lstat,readFile,writeFile,mkdir} from 'node:fs/promises';
import {recoveryFile} from './workspace-recovery-files';import {storageDirectory} from './storage-files';
export type GitRecoveryPolicy={shallow?:string;grafts?:string};
export function gitRecoveryPolicy(value:unknown,hashLength:number):GitRecoveryPolicy{
 if(!value||typeof value!=='object'||Array.isArray(value)||![40,64].includes(hashLength)||Object.keys(value).some(key=>!['shallow','grafts'].includes(key)))throw Error('The Git history policy is invalid.');
 const record=value as GitRecoveryPolicy,oid=new RegExp('^[a-fA-F0-9]{'+hashLength+'}$');let identifiers=0;
 for(const kind of ['shallow','grafts'] as const){const text=record[kind];if(text===undefined)continue;if(typeof text!=='string'||Buffer.byteLength(text)>1024*1024||/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(text))throw Error('The Git history policy is invalid or too large.');
  for(const raw of text.split(/\r?\n/)){const line=raw.trim();if(!line||kind==='grafts'&&line.startsWith('#'))continue;const fields=line.split(/[ \t]+/);if(kind==='shallow'&&fields.length!==1||fields.some(field=>!oid.test(field))||(identifiers+=fields.length)>25000)throw Error('The Git history policy contains invalid commit identities.');}
 }
 return {...(record.shallow!==undefined?{shallow:record.shallow}:{}),...(record.grafts!==undefined?{grafts:record.grafts}:{})};
}
export const gitRecoveryPolicyId=(policy:GitRecoveryPolicy)=>createHash('sha256').update(JSON.stringify({shallow:policy.shallow??null,grafts:policy.grafts??null})).digest('hex');
export async function readGitRecoveryPolicy(common:string,hashLength:number,guard:()=>Promise<void>,signal:AbortSignal){
 const result:GitRecoveryPolicy={};for(const [kind,relative]of [['shallow','shallow'],['grafts','info/grafts']] as const){await guard();signal.throwIfAborted();const file=path.join(common,relative);let info;try{info=await lstat(file);}catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')continue;throw error;}if(info.size>1024*1024)throw Error('The Git history policy is too large for automatic recovery.');const before=await recoveryFile(file,guard,signal),bytes=await readFile(file),text=new TextDecoder('utf8',{fatal:true}).decode(bytes);if(createHash('sha256').update(bytes).digest('hex')!==before.sha256||(await recoveryFile(file,guard,signal)).sha256!==before.sha256)throw Error('The Git history policy changed during capture.');result[kind]=text;}
 return gitRecoveryPolicy(result,hashLength);
}
/** Only a newly created independent repository receives these numeric Git
 * history rules. Original hooks, commands and configuration are not copied. */
export async function installGitRecoveryPolicy(directory:string,value:GitRecoveryPolicy,hashLength:number,guard:()=>Promise<void>,signal:AbortSignal){
 const policy=gitRecoveryPolicy(value,hashLength);await storageDirectory(directory);
 for(const [kind,relative]of [['shallow','shallow'],['grafts','info/grafts']] as const){const text=policy[kind];if(text===undefined)continue;await guard();signal.throwIfAborted();const file=path.join(directory,relative);if(kind==='grafts'){try{await mkdir(path.dirname(file));}catch(error){if((error as NodeJS.ErrnoException).code!=='EEXIST')throw error;}await storageDirectory(path.dirname(file));}await writeFile(file,text,{flag:'wx',mode:0o600});await recoveryFile(file,guard,signal);}
 return policy;
}
