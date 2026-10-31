import {mkdir,writeFile,statfs,realpath,rm} from 'node:fs/promises';
import path from 'node:path';
import type {FileReference} from './contracts';
import {captureBackupArchive} from './backup-archives';
import {portableImage,clipboardRecordId,validateClipboardRecord,clipboardUuid,type ClipboardAccount,type ClipboardRecoveryRecord} from './clipboard-recovery';
export async function captureClipboardBackup(destination:string,accounts:{owner:string;references:FileReference[]}[],image:((owner:string,id:string)=>Promise<string>)|undefined,reserveBytes?:number){
 const stage=path.join(destination,'.clipboard-stage');await mkdir(stage,{mode:0o700});const index:ClipboardAccount[]=[];
 for(const account of accounts){const references:ClipboardAccount['references']=[],ids=new Set<string>();for(const reference of account.references.filter(row=>row.source==='clipboard')){
  if(!image)throw Error('Portable clipboard-image export is unavailable.');if(!clipboardUuid.test(account.owner)||!clipboardUuid.test(reference.id)||ids.has(reference.id.toLowerCase())||reference.kind!=='file')throw Error('Invalid clipboard image identity.');ids.add(reference.id.toLowerCase());
  const bytes=portableImage(await image(account.owner,reference.id)),space=await statfs(destination);if(space.bavail*space.bsize-bytes.length<(reserveBytes??1024**3))throw Error('The clipboard backup reached its reserved disk-space limit.');
  const relativePath=account.owner+'/'+reference.id+'.image';await mkdir(path.join(stage,account.owner),{recursive:true,mode:0o700});await writeFile(path.join(stage,relativePath),bytes,{flag:'wx',mode:0o600});references.push({id:reference.id,name:reference.name,bytes:bytes.length,relativePath});
 }index.push({owner:account.owner,references});}
 const captured=await captureBackupArchive(stage,path.join(destination,'clipboard-images.tar.gz'),{reserveBytes}),base={format:1 as const,kind:'sylvana-portable-clipboard' as const,accounts:index,manifest:captured.manifest,archiveSha256:captured.archiveSha256},record:ClipboardRecoveryRecord={...base,indexSha256:clipboardRecordId(base)};validateClipboardRecord(record);await writeFile(path.join(destination,'clipboard-images.json'),JSON.stringify(record,null,2),{flag:'wx',mode:0o600});
 // Only the freshly created, verified plaintext stage is removed. The archive
 // and original source images remain. Never follow a replacement directory.
 const actual=await realpath(stage),same=process.platform==='win32'?actual.toLowerCase()===stage.toLowerCase():actual===stage;if(path.dirname(stage)!==destination||path.basename(stage)!=='.clipboard-stage'||!same)throw Error('The clipboard backup stage moved before cleanup.');await rm(stage,{recursive:true});return record;
}
