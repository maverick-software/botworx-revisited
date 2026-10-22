import {createHash} from 'node:crypto';
import {maxImageBytes} from './image-limits';
import type {PublicOutputInventory} from './public-file-recovery';
export type ClipboardAccount={owner:string;references:{id:string;name:string;bytes:number;relativePath:string}[]};
export type ClipboardRecoveryRecord={format:1;kind:'agentopia-portable-clipboard';accounts:ClipboardAccount[];manifest:PublicOutputInventory;archiveSha256:string;indexSha256:string};
export const clipboardUuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
export const clipboardLimit=maxImageBytes;
const sha=(bytes:Buffer)=>createHash('sha256').update(bytes).digest('hex');
export function portableImage(value:string){
 const match=typeof value==='string'&&/^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(value);if(!match||match[2].length>Math.ceil(clipboardLimit/3)*4)throw Error('A portable clipboard image is invalid or too large.');
 const bytes=Buffer.from(match[2],'base64');if(!bytes.length||bytes.length>clipboardLimit||bytes.toString('base64')!==match[2])throw Error('A portable clipboard image is invalid or too large.');
 const kind=bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))?'png':bytes[0]===255&&bytes[1]===216?'jpeg':bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP'?'webp':undefined;if(kind!==match[1])throw Error('Portable image bytes do not match their declared format.');return bytes;
}
export function clipboardRecordId(record:Omit<ClipboardRecoveryRecord,'indexSha256'>|ClipboardRecoveryRecord){return sha(Buffer.from(JSON.stringify({format:record.format,kind:record.kind,accounts:record.accounts,manifest:record.manifest,archiveSha256:record.archiveSha256})));}
export function validateClipboardRecord(record:ClipboardRecoveryRecord){
 if(record?.format!==1||record.kind!=='agentopia-portable-clipboard'||!Array.isArray(record.accounts)||record.accounts.length>10000||!record.manifest?.files||!Array.isArray(record.manifest.directories)||!/^[a-f0-9]{64}$/.test(record.archiveSha256)||record.indexSha256!==clipboardRecordId(record)||Buffer.byteLength(JSON.stringify(record))>16*1024**2)throw Error('The portable clipboard record is invalid or changed.');
 const owners=new Set<string>(),files=new Set<string>(),directories=new Set<string>();for(const account of record.accounts){if(!clipboardUuid.test(account.owner)||owners.has(account.owner.toLowerCase())||!Array.isArray(account.references)||account.references.length>100)throw Error('Invalid clipboard recovery account.');owners.add(account.owner.toLowerCase());const ids=new Set<string>();let bytes=0;
  for(const reference of account.references){const name=account.owner+'/'+reference.id+'.image',file=record.manifest.files[name];if(!clipboardUuid.test(reference.id)||ids.has(reference.id.toLowerCase())||reference.relativePath!==name||typeof reference.name!=='string'||!reference.name.trim()||reference.name.length>240||/[\x00-\x1f\x7f]/.test(reference.name)||/[\uD800-\uDFFF]/u.test(reference.name)||!Number.isSafeInteger(reference.bytes)||reference.bytes<=0||reference.bytes>clipboardLimit||!file||file.bytes!==reference.bytes||!/^[a-f0-9]{64}$/.test(file.sha256))throw Error('Invalid or foreign portable clipboard reference.');ids.add(reference.id.toLowerCase());files.add(name);directories.add(account.owner);bytes+=reference.bytes;}
  if(bytes>40*1024**2)throw Error('Portable clipboard images exceed the per-account limit.');
 }
 if(Object.keys(record.manifest.files).length!==files.size||Object.keys(record.manifest.files).some(name=>!files.has(name))||record.manifest.directories.length!==directories.size||record.manifest.directories.some(name=>!directories.has(name)))throw Error('The clipboard inventory contains unowned or duplicate paths.');return record;
}
