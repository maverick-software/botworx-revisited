import {recoveryAccount} from './recovery-owner';
import path from 'node:path';
import {lstat,realpath,readFile} from 'node:fs/promises';
import type {Secrets} from './secrets';
import type {WorkspaceFiles} from './workspace';
import {applyPortableLayouts,validatePortableLayouts,type PortableLayoutsRecord} from './portable-layouts';
export async function loadRestoredLayouts(profile:string){
 const file=path.join(profile,'restored-layouts.json'),marker=path.join(profile,'.agentopia-layouts-required.json');
 const read=async(file:string,maximum:number)=>{const info=await lstat(file);if(!info.isFile()||info.isSymbolicLink()||info.nlink!==1||info.size>maximum||(process.platform==='win32'?(await realpath(file)).toLowerCase()!==file.toLowerCase():await realpath(file)!==file))throw Error('A layout recovery resource is linked or invalid.');return JSON.parse(await readFile(file,'utf8'));};
 let record:PortableLayoutsRecord;try{record=validatePortableLayouts(await read(file,16*1024**2));}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;try{await lstat(marker);}catch(missing){if((missing as NodeJS.ErrnoException).code==='ENOENT')return;throw missing;}throw Error('Required workspace layout metadata is missing.');}
 const required=await read(marker,4096);if(required.format!==1||required.indexSha256!==record.indexSha256)throw Error('Workspace layout recovery ownership changed.');return record;
}
export class RestoredLayouts{
 private loading?:ReturnType<typeof loadRestoredLayouts>;private restoring=new Map<string,Promise<void>>();
 constructor(private profile:string,private secrets:Secrets,private files:WorkspaceFiles){}
 async restore(owner:string,guard:()=>Promise<void>){const record=await(this.loading??=loadRestoredLayouts(this.profile));if(!record)return;if(!recoveryAccount(record.accounts,owner)){await guard();return;}let work=this.restoring.get(owner);if(!work){work=applyPortableLayouts(this.secrets,record,owner,this.files.list(owner),guard);this.restoring.set(owner,work);void work.finally(()=>this.restoring.delete(owner)).catch(()=>{});}await work;}
}
