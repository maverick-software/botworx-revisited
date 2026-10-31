import {currentBrandKind} from './legacy-brand';
import {recoveryAccount} from './recovery-owner';
import path from 'node:path';
import {lstat,realpath,readFile} from 'node:fs/promises';
import type {Secrets} from './secrets';
import type {WorkspaceFiles} from './workspace';
import {validatePublicReferenceIndex,publicReferenceIndexId,verifyRecoveredPublicReferences,translateRecoveredPath,type PublicOutputInventory,type PublicReferenceIndex} from './public-file-recovery';
export type RestoredPublicFileRecord={format:1;kind:'sylvana-restored-public-files';index:PublicReferenceIndex;inventory:PublicOutputInventory;indexSha256:string;archiveSha256:string};
export class RestoredPublicFiles{
 private loading?:Promise<RestoredPublicFileRecord|undefined>;private record?:RestoredPublicFileRecord;
 private restoring=new Map<string,Promise<void>>();
 constructor(private profile:string,private publicRoot:string,private secrets:Secrets,private files:WorkspaceFiles){}
 private load(){return this.loading??=(async()=>{
  const file=path.join(this.profile,'restored-public-files.json');let info;try{info=await lstat(file);}catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')return;throw error;}
  const same=(a:string,b:string)=>process.platform==='win32'?a.toLowerCase()===b.toLowerCase():a===b;
  if(!info.isFile()||info.isSymbolicLink()||info.nlink!==1||info.size>4*1024**2||!same(await realpath(file),file))throw Error('The public-file recovery record is linked or invalid.');
  const record=JSON.parse(await readFile(file,'utf8')) as RestoredPublicFileRecord;
  if(record?.format!==1||currentBrandKind(record.kind)!=='sylvana-restored-public-files'||!/^[a-f0-9]{64}$/.test(record.archiveSha256))throw Error('Invalid public-file recovery record.');
  validatePublicReferenceIndex(record.index,record.inventory);if(publicReferenceIndexId(record.index)!==record.indexSha256)throw Error('The recovered attachment index changed.');
  return this.record=record;
 })();}
 async restore(owner:string,guard:()=>Promise<void>){
  const record=await this.load();if(!record)return;if(!recoveryAccount(record.index.accounts,owner)){await guard();return;}
  const applied=this.secrets.get<string[]>('public-file-recovery:'+owner)??[];if(applied.includes(record.indexSha256))return;
  let work=this.restoring.get(owner);if(!work){work=(async()=>{const planned=await verifyRecoveredPublicReferences(record.index,record.inventory,this.publicRoot,owner,guard);await this.files.restorePublicReferences(owner,record.indexSha256,planned,guard);})();this.restoring.set(owner,work);void work.finally(()=>this.restoring.delete(owner)).catch(()=>{});}await work;
 }
 translate(owner:string,raw:string){
  if(!this.record||!(this.secrets.get<string[]>('public-file-recovery:'+owner)??[]).includes(this.record.indexSha256))return raw;
  return translateRecoveredPath(this.record.index,owner,raw,this.publicRoot,this.profile);
 }
}
