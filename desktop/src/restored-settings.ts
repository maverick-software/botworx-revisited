import {recoveryAccount} from './recovery-owner';
import {lstat,readFile,realpath} from 'node:fs/promises';
import path from 'node:path';
import {applyPortableSettings,validatePortableSettings,type PortableSettingsRecord} from './portable-settings';
import type {Secrets} from './secrets';
export async function loadRestoredSettings(profile:string){
 const file=path.join(profile,'restored-settings.json'),marker=path.join(profile,'.agentopia-settings-required.json');
 const checked=async(file:string,maximum:number)=>{const info=await lstat(file);if(!info.isFile()||info.isSymbolicLink()||info.nlink!==1||info.size>maximum||(process.platform==='win32'?(await realpath(file)).toLowerCase()!==file.toLowerCase():await realpath(file)!==file))throw Error('A settings recovery file is linked or invalid.');return JSON.parse(await readFile(file,'utf8'));};
 let record:PortableSettingsRecord;try{record=validatePortableSettings(await checked(file,64*1024**2));}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;try{await lstat(marker);}catch(missing){if((missing as NodeJS.ErrnoException).code==='ENOENT')return;throw missing;}throw Error('Required portable settings metadata is missing.');}
 const required=await checked(marker,4096);if(required.format!==1||required.indexSha256!==record.indexSha256)throw Error('Portable settings recovery ownership changed.');return record;
}
export class RestoredSettings{
 private loading?:ReturnType<typeof loadRestoredSettings>;
 private restoring=new Map<string,Promise<void>>();
 constructor(private profile:string,private secrets:Secrets){}
 async restore(owner:string,guard:()=>Promise<void>){const record=await(this.loading??=loadRestoredSettings(this.profile));if(!record)return;if(!recoveryAccount(record.accounts,owner)){await guard();return;}let work=this.restoring.get(owner);if(!work){work=applyPortableSettings(this.secrets,record,owner,guard);this.restoring.set(owner,work);void work.finally(()=>this.restoring.delete(owner)).catch(()=>{});}await work;}
}
