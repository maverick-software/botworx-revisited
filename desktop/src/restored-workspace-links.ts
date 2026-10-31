import {currentFileHref} from './legacy-brand';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {lstat} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import type {Secrets} from './secrets';
import type {WorkspaceFiles} from './workspace';
import type {WorkspaceImportReceipt,WorkspaceImportAlias} from './workspace-backup-import';
import type {RecoveredChatLink} from './chat-files';
import {backupDirectory} from './backup-archives';
import {storageUuid,storageWithin} from './storage-files';
import {sourceLinkSuffix,workspaceSourceLink} from './source-locations';

const digest=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const same=(a:string,b:string)=>process.platform==='win32'?path.resolve(a).toLowerCase()===path.resolve(b).toLowerCase():path.resolve(a)===path.resolve(b);
function need(value:unknown,message:string):asserts value{if(!value)throw Error(message);}
async function identity(root:string){await backupDirectory(root);const s=await lstat(root,{bigint:true});return digest([s.dev.toString(),s.ino.toString(),s.birthtimeNs.toString()]);}
/** Viewer-only former-path aliases. Every click requires the still-current
 * imported file grant and physical copy identity. A revoked grant is never
 * replaced by another attachment or by the chat-output fallback. */
export class RestoredWorkspaceLinks{
 constructor(private secrets:Pick<Secrets,'get'|'workspaceImportIds'>,private files:Pick<WorkspaceFiles,'list'>,private workspaces:string,private recovery:string){}
 async resolve(owner:string,args:Record<string,unknown>,guard:()=>Promise<void>):Promise<RecoveredChatLink|undefined>{
  need(storageUuid(owner),'Use the current workspace account.');if(typeof args.href!=='string'||args.href.length>4000||/[\x00-\x1f\x7f]/.test(args.href))return;
  const href=currentFileHref(args.href.trim());if(!href||/^(?:https?:|sandbox:|#|\/\/)/i.test(href))return;let absolute:string|undefined,referenceId:string|undefined,relative='',fragment='';
  if(/^sylvana-file:/i.test(currentFileHref(href))){const url=new URL(currentFileHref(href));need(!url.username&&!url.password&&!url.port&&!url.search,'Use a valid recovered workspace link.');referenceId=url.hostname;relative=decodeURIComponent(url.pathname.replace(/^\//,''));fragment=url.hash;}
  else{const suffix=sourceLinkSuffix(href),hash=suffix.href.indexOf('#'),value=hash<0?suffix.href:suffix.href.slice(0,hash);fragment=hash>=0?suffix.href.slice(hash):suffix.fragment?'#'+suffix.fragment:'';if(/^file:/i.test(value)){const url=new URL(value);if(url.hostname&&url.hostname!=='localhost'||url.search)return;absolute=fileURLToPath(url);}else absolute=decodeURIComponent(value);if(!path.isAbsolute(absolute))return;absolute=path.resolve(absolute);}
  await guard();const receipts=this.secrets.workspaceImportIds(owner).map(id=>{const key='scheduled-workspace-import:'+owner+':'+id,receipt=this.secrets.get<WorkspaceImportReceipt>(key);need(receipt?.version===1&&receipt.owner===owner&&receipt.id===id,'The saved workspace recovery identity changed.');return {key,receipt};}).filter(({receipt})=>receipt.phase==='complete'&&same(receipt.workspaces,this.workspaces)&&same(receipt.recovery,this.recovery));
  const matches:{key:string;receipt:WorkspaceImportReceipt;alias:WorkspaceImportAlias;relative:string;specificity:number}[]=[];
  for(const {key,receipt}of receipts){need(Array.isArray(receipt.aliases)&&Array.isArray(receipt.sourcePaths),'Inspect the saved workspace recovery before opening its files.');for(const alias of receipt.aliases){need(storageUuid(alias.id)&&['file','folder'].includes(alias.kind)&&path.isAbsolute(alias.path)&&path.dirname(alias.container)===path.join(this.workspaces,owner)&&/^restored-[a-f0-9]{24}$/.test(path.basename(alias.container))&&storageWithin(alias.container,alias.path)&&/^[a-f0-9]{64}$/.test(alias.rootIdentity)&&Array.isArray(alias.formerPaths),'The recovered workspace file mapping changed.');
    if(referenceId){if(alias.id!==referenceId)continue;need(alias.kind==='folder'||!relative,'This recovered reference grants access to one file.');const target=path.resolve(alias.path,relative);need(storageWithin(alias.path,target),'The recovered workspace link leaves its current grant.');matches.push({key,receipt,alias,relative:path.relative(alias.path,target),specificity:alias.path.length});}
    else for(const former of alias.formerPaths){need(path.isAbsolute(former),'The former workspace path changed.');if(absolute&&(alias.kind==='file'?same(former,absolute):storageWithin(former,absolute)))matches.push({key,receipt,alias,relative:alias.kind==='file'?'':path.relative(former,absolute),specificity:former.length});}
   }}
  if(!matches.length){if(absolute&&receipts.some(({receipt})=>receipt.sourcePaths!.some(root=>path.isAbsolute(root)&&storageWithin(root,absolute!))))throw Error('This recovered workspace file is no longer attached. Select the file explicitly to open it.');return;}
  const current=this.files.list(owner),available=matches.filter(({alias})=>current.some(ref=>ref.id===alias.id&&ref.kind===alias.kind&&ref.source!=='clipboard'&&same(ref.path,alias.path))).sort((a,b)=>b.specificity-a.specificity);
  need(available.length,'This recovered workspace reference changed or was removed. Select the file explicitly to open it.');const chosen=available[0],ties=available.filter(row=>row.specificity===chosen.specificity);need(ties.every(row=>row.alias.id===chosen.alias.id&&same(row.alias.path,chosen.alias.path)&&row.relative===chosen.relative),'Several recovered copies match this link. Open the copy you want from the workspace.');
  const fingerprint=digest(chosen.receipt),check=async()=>{await guard();need(digest(this.secrets.get(chosen.key))===fingerprint&&this.files.list(owner).some(ref=>ref.id===chosen.alias.id&&ref.kind===chosen.alias.kind&&ref.source!=='clipboard'&&same(ref.path,chosen.alias.path)),'This recovered workspace reference changed or was removed.');need(await identity(chosen.alias.container)===chosen.alias.rootIdentity,'The recovered workspace folder was replaced. Select the copy you want to open.');await guard();};
  await check();return {args:{href:workspaceSourceLink(chosen.alias.id,chosen.relative)+fragment},check};
 }
}
