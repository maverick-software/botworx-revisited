import {recoveryAccount} from './recovery-owner';
import path from 'node:path';
import {lstat,readFile,realpath} from 'node:fs/promises';
import type {Secrets} from './secrets';
import type {WorkspaceFiles} from './workspace';
import {validateExternalRecord,verifyExternalReferences,translateExternalPath,type ExternalRecord} from './external-backup';
export async function loadRestoredExternal(profile:string){
 const file=path.join(profile,'restored-external.json'),marker=path.join(profile,'.agentopia-external-required.json');
 const checked=async(file:string,maximum:number)=>{const info=await lstat(file);if(!info.isFile()||info.isSymbolicLink()||info.nlink!==1||info.size>maximum||(process.platform==='win32'?(await realpath(file)).toLowerCase()!==file.toLowerCase():await realpath(file)!==file))throw Error('An external recovery record is linked or invalid.');return JSON.parse(await readFile(file,'utf8'));};
 let record:ExternalRecord;try{record=validateExternalRecord(await checked(file,16*1024**2));}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;try{await lstat(marker);}catch(missing){if((missing as NodeJS.ErrnoException).code==='ENOENT')return;throw missing;}throw Error('Required external recovery metadata is missing.');}
 const required=await checked(marker,4096);if(required.format!==1||required.indexSha256!==record.indexSha256)throw Error('External recovery ownership changed.');return record;
}
export class RestoredExternal{
 private loading?:ReturnType<typeof loadRestoredExternal>;private record?:ExternalRecord;private restoring=new Map<string,Promise<void>>();
 constructor(private profile:string,private publicRoot:string,private secrets:Secrets,private files:WorkspaceFiles){}
 async restore(owner:string,guard:()=>Promise<void>){const record=await(this.loading??=loadRestoredExternal(this.profile));if(!record)return;if(!recoveryAccount(record.accounts,owner)){await guard();return;}this.record=record;if((this.secrets.get<string[]>('public-file-recovery:'+owner)??[]).includes(record.indexSha256))return;let work=this.restoring.get(owner);if(!work){work=(async()=>{const planned=await verifyExternalReferences(record,this.publicRoot,owner,guard);await this.files.restorePublicReferences(owner,record.indexSha256,planned,guard);})();this.restoring.set(owner,work);void work.finally(()=>this.restoring.delete(owner)).catch(()=>{});}await work;}
 translate(owner:string,raw:string){if(!this.record||!(this.secrets.get<string[]>('public-file-recovery:'+owner)??[]).includes(this.record.indexSha256))return raw;return translateExternalPath(this.record,owner,raw,this.publicRoot);}
}
