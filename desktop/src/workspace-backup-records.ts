import path from 'node:path';
import {createHash} from 'node:crypto';
import type {Secrets} from './secrets';
import type {ScheduledWorkspaces,ScheduledWorkspaceJournal} from './scheduled-workspaces';
import {taskWorkspace} from './scheduled-projects';
import {gitRecoveryPolicy,gitRecoveryPolicyId} from './workspace-git-policy';
import {storageUuid,storageWithin} from './storage-files';

type ObjectRecord=Record<string,any>;
export type WorkspaceOwnerRecords={
 format:1;kind:'agentopia-workspace-owner-records';databaseManifestSha256:string;
 sourceWorkspaces:string;sourceRecovery:string;
 accounts:{owner:string;journals:ScheduledWorkspaceJournal[];operations:ObjectRecord[]}[];
 indexSha256:string;
};
const hash=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const fail=()=>Error('The workspace backup ownership records are invalid, incomplete or changed.');
function need(value:unknown):asserts value{if(!value)throw fail();}
function object(value:unknown,keys:readonly string[]):asserts value is ObjectRecord{need(value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).every(key=>keys.includes(key)));}
const sha=(value:unknown)=>need(typeof value==='string'&&/^[a-f0-9]{64}$/.test(value));
const uuid=(value:unknown)=>need(storageUuid(value));
const date=(value:unknown)=>need(typeof value==='string'&&value.length<100&&Number.isFinite(Date.parse(value)));
const amount=(value:unknown,max=512*1024**3)=>need(Number.isSafeInteger(value)&&Number(value)>=0&&Number(value)<=max);
const same=(left:unknown,right:string)=>typeof left==='string'&&path.isAbsolute(left)&&(process.platform==='win32'?path.resolve(left).toLowerCase()===path.resolve(right).toLowerCase():path.resolve(left)===path.resolve(right));
const optional=(record:ObjectRecord,key:string,check:(value:any)=>void)=>{if(record[key]!==undefined)check(record[key]);};
const gitObject=(value:unknown)=>need(typeof value==='string'&&/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(value));
const reference=(owner:string,run:string,operation:string)=>'refs/agentopia/recovery/'+createHash('sha256').update([owner,run,operation].join(':')).digest('hex');
function roots(workspaces:unknown,recovery:unknown){for(const value of [workspaces,recovery])need(typeof value==='string'&&value.length<=32767&&path.isAbsolute(value)&&!/[\x00-\x1f\x7f]/.test(value)&&path.resolve(value)!==path.parse(path.resolve(value)).root);need(!storageWithin(workspaces as string,recovery as string)&&!storageWithin(recovery as string,workspaces as string));}
function artifact(value:unknown,file:string){object(value,['path','sha256','manifestSha256','bytes','files','expandedBytes']);need(same(value.path,file));sha(value.sha256);sha(value.manifestSha256);amount(value.bytes);amount(value.files,250000);amount(value.expandedBytes);}
function binding(value:unknown){object(value,['id','path','kind']);uuid(value.id);need(typeof value.path==='string'&&path.isAbsolute(value.path)&&value.path.length<=32767&&!/[\x00-\x1f\x7f]/.test(value.path)&&['file','folder'].includes(value.kind));}
function journal(value:unknown,owner:string,root:string){
 object(value,['version','owner','runId','taskId','requestId','snapshot','workspace','path','commit','phase','at','rootIdentity','gitDirectory','gitIdentity','gitFileHash','resolution','error','maintenance','reviewedRequest','sourcePaths']);
 need(value.version===1&&value.owner===owner);uuid(value.runId);uuid(value.taskId);optional(value,'requestId',uuid);sha(value.snapshot);gitObject(value.commit);date(value.at);
 need(['planned','checkout','ready','uncertain','archiving','archived'].includes(value.phase)&&same(value.path,path.join(root,owner,value.runId)));
 object(value.workspace,['mode','source','sourceFiles','commonDirectory','ref','sourceIdentity','commonIdentity']);binding(value.workspace.source);need(Array.isArray(value.workspace.sourceFiles));value.workspace.sourceFiles.forEach(binding);taskWorkspace(value.workspace,value.workspace.sourceFiles);
 for(const key of ['rootIdentity','gitIdentity','gitFileHash'])optional(value,key,sha);
 optional(value,'gitDirectory',directory=>need(typeof directory==='string'&&same(path.dirname(directory),path.join(value.workspace.commonDirectory,'worktrees'))));
 optional(value,'maintenance',uuid);optional(value,'reviewedRequest',text=>need(typeof text==='string'&&text.length<=4000));optional(value,'error',text=>need(typeof text==='string'&&text.length<=100000));
 optional(value,'sourcePaths',paths=>need(Array.isArray(paths)&&paths.length<=1000&&paths.every(file=>typeof file==='string'&&path.isAbsolute(file)&&file.length<=32767&&!/[\x00-\x1f\x7f]/.test(file))));
 if(value.resolution!==undefined){object(value.resolution,['files','resolved']);need(Array.isArray(value.resolution.files)&&value.resolution.files.length<=100);value.resolution.files.forEach(binding);object(value.resolution.resolved,['runId','path','commit']);need(value.resolution.resolved.runId===value.runId&&same(value.resolution.resolved.path,value.path)&&value.resolution.resolved.commit===value.commit);taskWorkspace({...value.workspace,resolved:value.resolution.resolved},value.resolution.files);}
 return value as ScheduledWorkspaceJournal;
}
function git(value:unknown,owner:string,run:string,operation:string,recovery:string,origin?:{runId:string;operationId:string}){
 object(value,['head','commit','reference','indexSha256','indexEntries','metadataFingerprint','metadata','extras','policy','validation']);gitObject(value.head);gitObject(value.commit);need(value.head.length===value.commit.length&&value.reference===reference(owner,origin?.runId??run,origin?.operationId??operation));amount(value.indexEntries,250000);sha(value.metadataFingerprint);optional(value,'indexSha256',sha);
 const directory=path.join(recovery,owner,operation,'git');artifact(value.metadata,path.join(directory,'git-state.tar.gz'));const policy=gitRecoveryPolicy(value.policy??{},value.head.length);
 need(Array.isArray(value.extras)&&value.extras.length>=2&&value.extras.length<=3);const names=new Set();for(const extra of value.extras){object(extra,['name','path','size','sha256']);need(['history.bundle','index.bin','git-state.tar.gz'].includes(extra.name)&&!names.has(extra.name)&&same(extra.path,path.join(directory,extra.name)));names.add(extra.name);sha(extra.sha256);amount(extra.size);}
 const history=value.extras.find((extra:ObjectRecord)=>extra.name==='history.bundle'),index=value.extras.find((extra:ObjectRecord)=>extra.name==='index.bin'),metadata=value.extras.find((extra:ObjectRecord)=>extra.name==='git-state.tar.gz');need(history&&metadata&&metadata.sha256===value.metadata.sha256&&metadata.size===value.metadata.bytes&&!!index===!!value.indexSha256&&(!index||index.sha256===value.indexSha256));
 if(value.validation!==undefined){const proof=value.validation;object(proof,['version','bundleSha256','head','commit','reference','packChecksum','policySha256','at']);need(proof.version===1&&proof.head===value.head&&proof.commit===value.commit&&proof.reference===value.reference&&proof.bundleSha256===history.sha256&&proof.policySha256===gitRecoveryPolicyId(policy));gitObject(proof.packChecksum);need(proof.packChecksum.length===value.head.length);date(proof.at);}
}
function restoration(value:unknown,owner:string,root:string){object(value,['id','phase','path','referenceId','rootIdentity']);uuid(value.id);need(['creating','complete','uncertain'].includes(value.phase)&&same(value.path,path.join(root,owner,'restored-'+createHash('sha256').update(value.id).digest('hex').slice(0,24))));optional(value,'referenceId',uuid);optional(value,'rootIdentity',sha);}
function operation(value:unknown,owner:string,saved:Map<string,ScheduledWorkspaceJournal>,roots:{workspaces:string;recovery:string}){
 object(value,['version','id','owner','runId','createdAt','phase','expiresAt','journal','review','artifact','rootFingerprint','git','gitProgress','gitDirectory','gitIdentity','staged','stagedGit','restoration','restorations','origin','privateHistory']);
 need(value.version===1&&value.owner===owner);uuid(value.id);uuid(value.runId);const source=saved.get(value.runId);need(source);date(value.createdAt);date(value.expiresAt);sha(value.journal);need(['creating','prepared','committing','archived','uncertain','acknowledged'].includes(value.phase));
 optional(value,'rootFingerprint',sha);optional(value,'gitIdentity',sha);optional(value,'artifact',entry=>artifact(entry,path.join(roots.recovery,owner,value.id,'workspace.tar.gz')));
 if(value.review!==undefined){object(value.review,['id','runId','path','files','bytes','recoveryBytes','expiresAt','hasGit']);need(value.review.id===value.id&&value.review.runId===value.runId&&same(value.review.path,source.path)&&typeof value.review.hasGit==='boolean');for(const key of ['files','bytes','recoveryBytes'])amount(value.review[key]);date(value.review.expiresAt);}
 if(['prepared','committing','archived'].includes(value.phase))need(value.artifact&&value.review&&value.rootFingerprint);
 if(value.origin!==undefined){object(value.origin,['runId','operationId','indexSha256']);uuid(value.origin.runId);uuid(value.origin.operationId);sha(value.origin.indexSha256);need(value.phase==='archived');}
 if(value.privateHistory!==undefined)need(value.privateHistory===true&&value.phase==='archived'&&value.git===undefined&&value.restoration===undefined&&value.restorations===undefined);
 if(value.git!==undefined)git(value.git,owner,value.runId,value.id,roots.recovery,value.origin);
 optional(value,'gitDirectory',directory=>need(typeof directory==='string'&&same(path.dirname(directory),path.join(source.workspace.commonDirectory,'worktrees'))));
 if(value.gitProgress!==undefined){object(value.gitProgress,['phase','reference','commit']);need(['planned','reference','bundled','complete'].includes(value.gitProgress.phase)&&value.gitProgress.reference===reference(owner,value.runId,value.id));optional(value.gitProgress,'commit',gitObject);}
 optional(value,'staged',file=>need(same(file,path.join(path.dirname(source.path),'.agentopia-archive-'+value.id))));
 optional(value,'stagedGit',file=>need(value.gitDirectory&&same(file,path.join(path.dirname(value.gitDirectory),'.agentopia-archive-'+value.id))));
 optional(value,'restoration',entry=>restoration(entry,owner,roots.workspaces));if(value.restorations!==undefined){need(Array.isArray(value.restorations)&&value.restorations.length<=100);value.restorations.forEach((entry:unknown)=>restoration(entry,owner,roots.workspaces));}
 const copies=[...(value.restorations??[]),...(value.restoration?[value.restoration]:[])];need(new Set(copies.map(copy=>copy.id)).size===copies.length);
 return value;
}
export function workspaceOwnerRecordsId(record:Omit<WorkspaceOwnerRecords,'indexSha256'>|WorkspaceOwnerRecords){return hash({format:record.format,kind:record.kind,databaseManifestSha256:record.databaseManifestSha256,sourceWorkspaces:record.sourceWorkspaces,sourceRecovery:record.sourceRecovery,accounts:record.accounts});}
/** Metadata only. A complete portable backup must also seal the corresponding
 * private artifacts, live snapshots and retained copies. This record neither
 * grants file access nor makes an interrupted operation safe to replay. */
export function validateWorkspaceOwnerRecords(value:unknown):WorkspaceOwnerRecords{
 object(value,['format','kind','databaseManifestSha256','sourceWorkspaces','sourceRecovery','accounts','indexSha256']);need(value.format===1&&value.kind==='agentopia-workspace-owner-records');roots(value.sourceWorkspaces,value.sourceRecovery);sha(value.databaseManifestSha256);sha(value.indexSha256);
 need(Array.isArray(value.accounts)&&value.accounts.length<=10000&&Buffer.byteLength(JSON.stringify(value),'utf8')<=64*1024**2&&value.indexSha256===workspaceOwnerRecordsId(value as WorkspaceOwnerRecords));const owners=new Set<string>();let total=0;
 for(const account of value.accounts){object(account,['owner','journals','operations']);uuid(account.owner);need(!owners.has(account.owner.toLowerCase()));owners.add(account.owner.toLowerCase());need(Array.isArray(account.journals)&&Array.isArray(account.operations));total+=account.journals.length+account.operations.length;need(total<=25000);
  const saved=new Map<string,ScheduledWorkspaceJournal>();for(const item of account.journals){const entry=journal(item,account.owner,value.sourceWorkspaces);need(!saved.has(entry.runId));saved.set(entry.runId,entry);}
  const operations=new Map<string,ObjectRecord>();for(const item of account.operations){const entry=operation(item,account.owner,saved,{workspaces:value.sourceWorkspaces,recovery:value.sourceRecovery});need(!operations.has(entry.id));operations.set(entry.id,entry);}
  for(const entry of saved.values())if(entry.maintenance)need(operations.get(entry.maintenance)?.runId===entry.runId);
 }
 return value as WorkspaceOwnerRecords;
}
export function captureWorkspaceOwnerRecords(secrets:Pick<Secrets,'get'|'scheduledWorkspaceRecoveryIds'>,workspaces:Pick<ScheduledWorkspaces,'directory'|'retained'>,recovery:string,owners:string[],databaseManifestSha256:string){
 need(Array.isArray(owners)&&owners.length<=10000);owners.forEach(uuid);need(new Set(owners.map(owner=>owner.toLowerCase())).size===owners.length);sha(databaseManifestSha256);roots(workspaces.directory,recovery);
 const accounts=owners.map(owner=>({owner,journals:workspaces.retained(owner),operations:secrets.scheduledWorkspaceRecoveryIds(owner).map(id=>{uuid(id);const saved=secrets.get<ObjectRecord>('scheduled-workspace-recovery:'+owner+':'+id);need(saved&&saved.id===id);return structuredClone(saved);})}));
 const record={format:1 as const,kind:'agentopia-workspace-owner-records' as const,databaseManifestSha256,sourceWorkspaces:workspaces.directory,sourceRecovery:recovery,accounts};return validateWorkspaceOwnerRecords({...record,indexSha256:workspaceOwnerRecordsId(record)});
}
