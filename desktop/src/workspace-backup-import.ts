import path from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {createReadStream} from 'node:fs';
import {lstat,mkdir,rename,open,writeFile,readFile,statfs} from 'node:fs/promises';
import type {Secrets} from './secrets';
import type {WorkspaceFiles} from './workspace';
import type {RecoveredReference} from './public-file-recovery';
import {ScheduledWorkspaces,type ScheduledWorkspaceJournal} from './scheduled-workspaces';
import {ScheduledWorkspaceMaintenance} from './scheduled-workspace-maintenance';
import {verifyExtractedWorkspacePayload,type WorkspacePayloadBinding} from './workspace-backup-extract';
import {validateWorkspaceOwnerRecords,workspaceOwnerRecordsId,type WorkspaceOwnerRecords} from './workspace-backup-records';
import {backupDirectory} from './backup-archives';
import {storageUuid,storageWithin} from './storage-files';
import {workspaceRecoveryInventory,recoveryFile} from './workspace-recovery-files';

type Row=Record<string,any>;
type Store=Pick<Secrets,'get'|'set'|'setMany'>;
export type WorkspaceImportOptions={owner:string;extracted:string;binding:WorkspacePayloadBinding;profile:string;workspaces:string;secrets:Store;files:Pick<WorkspaceFiles,'list'|'checkPath'|'restoreWorkspaceReferences'>;guard:()=>Promise<void>;signal:AbortSignal;gitExecutable?:string;reserveBytes?:number};
type Options=WorkspaceImportOptions;
export type WorkspaceImportAlias={id:string;kind:'file'|'folder';path:string;formerPaths:string[];container:string;rootIdentity:string};
export type WorkspaceImportAttempt={id:string;root:string;phase:'preparing'|'publishing'|'complete'|'uncertain';at:string;error?:string};
export type WorkspaceImportReceipt={version:1;owner:string;id:string;indexSha256:string;workspaces:string;recovery:string;staging:string;phase:'preparing'|'prepared'|'complete'|'uncertain';at:string;stagingIdentity?:string;publication?:{preparedSha256:string;publicIdentity:string;privateIdentity:string;publicFingerprint:string;privateFingerprint:string};aliases?:WorkspaceImportAlias[];sourcePaths?:string[];error?:string;attempts?:WorkspaceImportAttempt[]};
export class WorkspaceImportPending extends Error{constructor(message:string){super(message);this.name='WorkspaceImportPending';}}
export const workspaceImportId=(binding:WorkspacePayloadBinding,owner:string,workspaces:string,recovery:string)=>digest([binding.descriptorSha256,owner,workspaces,recovery]);
const digest=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
function need(value:unknown,message:string):asserts value{if(!value)throw Error(message);}
const absent=async(file:string)=>{try{await lstat(file);return false;}catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')return true;throw error;}};
async function identity(root:string){await backupDirectory(root);const s=await lstat(root,{bigint:true});return digest([s.dev.toString(),s.ino.toString(),s.birthtimeNs.toString()]);}
const copyPath=(root:string,owner:string,id:string)=>path.join(root,owner,'restored-'+createHash('sha256').update(id).digest('hex').slice(0,24));
const opKey=(owner:string,id:string)=>'scheduled-workspace-recovery:'+owner+':'+id;
const journalKey=(owner:string,id:string)=>'scheduled-workspace:'+owner+':'+id;
function bindOperation(original:Row,recovery:string,workspaces:string,journal:ScheduledWorkspaceJournal){
 const value=structuredClone(original),directory=path.join(recovery,value.owner,value.id);value.journal=digest(journal);
 if(value.review)value.review.path=journal.path;
 if(value.artifact)value.artifact.path=path.join(directory,'workspace.tar.gz');
 if(value.git){value.git.metadata.path=path.join(directory,'git','git-state.tar.gz');for(const extra of value.git.extras)extra.path=path.join(directory,'git',extra.name);}
 // Raw interrupted registrations remain private bytes. They never become
 // active pointers into a former repository on this machine.
 delete value.staged;delete value.stagedGit;delete value.gitDirectory;delete value.gitIdentity;
 for(const copy of [...(value.restorations??[]),...(value.restoration?[value.restoration]:[])])copy.path=copyPath(workspaces,value.owner,copy.id);
 return value;
}
function bindJournal(original:ScheduledWorkspaceJournal,workspaces:string,oldPaths:string[]){
 const value=structuredClone(original),former=value.path;value.path=path.join(workspaces,value.owner,value.runId);value.phase='archived';
 value.sourcePaths=[...new Set([...(value.sourcePaths??[]),former,...oldPaths])];need(value.sourcePaths.length<=1000,'This workspace has too many former recovery locations.');
 delete value.rootIdentity;delete value.gitDirectory;delete value.gitIdentity;delete value.gitFileHash;
 if(value.resolution){value.resolution.resolved.path=value.path;for(const file of value.resolution.files)if(storageWithin(former,file.path))file.path=path.join(value.path,path.relative(former,file.path));}
 return value;
}

/** Import one database-authorized account into fresh destination owner folders.
 * The caller must hold the product recovery barrier. Source paths are metadata;
 * only sealed extracted bytes are read. No model/request/run is ever resumed.
 * A failed attempt is retained and held for inspection, never retried implicitly. */
export async function importWorkspacePayloadOwner(options:Options){
 const {owner,secrets,files,signal}=options,guard=async()=>{signal.throwIfAborted();await options.guard();signal.throwIfAborted();};
 await guard();need(storageUuid(owner)&&options.binding.owners.includes(owner),'Use the account from the verified restored database.');
 const recovery=path.join(options.profile,'scheduled-recovery'),workspaces=options.workspaces;
 for(const root of [options.profile,workspaces]){need(path.isAbsolute(root),'Use absolute workspace recovery destinations.');await backupDirectory(root);}
 files.checkPath(workspaces);need(!storageWithin(options.profile,workspaces)&&!storageWithin(workspaces,options.profile)&&!storageWithin(options.extracted,workspaces)&&!storageWithin(workspaces,options.extracted),'Restore public workspaces separately from the private profile and extracted backup.');
 const id=workspaceImportId(options.binding,owner,workspaces,recovery),key='scheduled-workspace-import:'+owner+':'+id,prior=secrets.get<WorkspaceImportReceipt>(key);
 if(prior){need(prior.version===1&&prior.owner===owner&&prior.id===id&&prior.workspaces===workspaces&&prior.recovery===recovery,'The workspace import receipt changed.');if(prior.phase!=='complete')throw new WorkspaceImportPending('An earlier workspace import is unfinished. Inspect its retained copies before continuing.');await guard();return prior;}
 const record=await verifyExtractedWorkspacePayload(options.extracted,options.binding,guard,signal,owner),account=record.records.accounts.find(row=>row.owner===owner)!;
 need(record.references!==undefined,'This older workspace backup has no current file-grant index. Inspect it before importing attachments.');
 const publicOwner=path.join(workspaces,owner),privateOwner=path.join(recovery,owner);
 need(await absent(publicOwner)&&await absent(privateOwner),'A workspace destination already contains account data. Preserve both copies before recovery.');
 const reserve=options.reserveBytes??1024**3;need(Number.isSafeInteger(reserve)&&reserve>=0,'Use a valid recovery disk reserve.');
 const refs=record.references.filter(row=>row.owner===owner),nodes=record.nodes.filter(row=>row.owner===owner),captures=record.captures.filter(row=>row.owner===owner);
 for(const node of nodes)if(node.kind==='primary')need(captures.some(row=>row.runId===node.runId),'This retained primary workspace needs an independent snapshot before automatic import. Its raw data remains preserved.');
 const originals=[...account.journals.map(j=>[journalKey(owner,j.runId),j] as const),...account.operations.map(op=>[opKey(owner,op.id),op] as const)];
 for(const captured of captures)need(secrets.get(opKey(owner,captured.operation.id))===undefined,'A different saved recovery already uses this snapshot identity. Preserve both profiles.');
 for(const [entry,value]of originals){const saved=secrets.get(entry);need(saved===undefined||digest(saved)===digest(value),'The destination has different saved workspace records. Preserve both profiles.');}
 const stateKeys=[...originals.map(([entry])=>entry),...captures.map(row=>opKey(owner,row.operation.id))],state=digest([stateKeys.map(entry=>[entry,secrets.get(entry)]),files.list(owner)]);
 const unchanged=async()=>{await guard();need(digest([stateKeys.map(entry=>[entry,secrets.get(entry)]),files.list(owner)])===state,'Saved workspace records or grants changed during import. Keep the retained copies.');};
 // Git for Windows cannot enter an overlong working directory even with
 // core.longpaths. Keep this private temporary shell short; ownership is
 // bound by the durable receipt and physical directory identities below.
 const staging=path.join(options.profile,'wi-'+randomUUID().replaceAll('-','').slice(0,16)),stagedWorkspaces=path.join(staging,'w'),stagedRecovery=path.join(staging,'r');
 let receipt:WorkspaceImportReceipt={version:1,owner,id,indexSha256:record.indexSha256,workspaces,recovery,staging,phase:'preparing',at:new Date().toISOString()};
 await unchanged();await secrets.set(key,receipt);await guard();
 try{
  await mkdir(staging);const stagingIdentity=await identity(staging);receipt={...receipt,stagingIdentity};await secrets.set(key,receipt);await guard();await mkdir(stagedWorkspaces);await mkdir(stagedRecovery);await mkdir(path.join(stagedWorkspaces,owner));await mkdir(path.join(stagedRecovery,owner));
  const check=async()=>{await unchanged();need(await identity(staging)===stagingIdentity,'The private import directory was replaced.');const free=await statfs(staging);need(free.bavail*free.bsize>=reserve,'Workspace import reached its disk-space reserve.');};
  const parent=async(target:string)=>{need(storageWithin(staging,target),'Workspace import left its private staging directory.');const parts=path.relative(staging,target).split(path.sep).filter(Boolean);let current=staging;for(const part of parts){current=path.join(current,part);if(await absent(current))await mkdir(current);await backupDirectory(current);}};
  const copyNode=async(node:typeof nodes[number],target:string)=>{
   await check();await parent(target);const prefix=node.relativePath+'/';
   for(const directory of record.manifest.directories.filter(name=>name.startsWith(prefix)).sort((a,b)=>a.split('/').length-b.split('/').length))await parent(path.join(target,...directory.slice(prefix.length).split('/')));
   for(const [name,expected]of Object.entries(record.manifest.files)){if(!name.startsWith(prefix))continue;await check();const source=path.join(options.extracted,...name.split('/')),destination=path.join(target,...name.slice(prefix.length).split('/'));await backupDirectory(path.dirname(source));const info=await lstat(source);need(info.isFile()&&!info.isSymbolicLink()&&info.nlink===1,'The extracted workspace file changed.');const free=await statfs(staging);need(free.bavail*free.bsize>=reserve+expected.bytes,'Workspace import cannot keep its disk reserve.');
    const output=await open(destination,'wx',0o600),hash=createHash('sha256');let size=0,last=Date.now();try{for await(const chunk of createReadStream(source,{signal})){size+=chunk.length;need(size<=expected.bytes,'The extracted workspace file grew.');hash.update(chunk);await output.writeFile(chunk);if(Date.now()-last>500){await check();last=Date.now();}}need(size===expected.bytes&&hash.digest('hex')===expected.sha256,'The extracted workspace bytes changed.');}finally{await output.close();}
   }
  };
  const copies=new Map<string,string>(),stageValues:Record<string,unknown>={};
  const journals=account.journals.map(j=>bindJournal(j,stagedWorkspaces,nodes.filter(n=>n.runId===j.runId&&['primary','staged','restoration'].includes(n.kind)).map(n=>n.source)));
  const operations=account.operations.map(op=>bindOperation(op,stagedRecovery,stagedWorkspaces,journals.find(j=>j.runId===op.runId)!));
  for(const captured of captures){const j=journals.find(j=>j.runId===captured.runId)!;j.maintenance=captured.operation.id;operations.push(bindOperation({...captured.operation,phase:'archived'},stagedRecovery,stagedWorkspaces,j));}
  for(const j of journals)stageValues[journalKey(owner,j.runId)]=j;for(const op of operations)stageValues[opKey(owner,op.id)]=op;
  const stageStore={get:<T>(key:string)=>structuredClone(stageValues[key]) as T|undefined,set:async(key:string,value:unknown)=>{stageValues[key]=structuredClone(value);},setMany:async(entries:readonly(readonly[string,unknown])[])=>{for(const [key,value]of entries)stageValues[key]=structuredClone(value);}};
  const stagePath=(file:string)=>need(storageWithin(staging,file),'Recovery attempted to leave its private staging directory.');
  const workspaceEngine=new ScheduledWorkspaces(stageStore,{list:()=>[],attach:async()=>{throw Error('No attachment picker during workspace import.');},checkPath:stagePath,checkBackupPath:stagePath},stagedWorkspaces,options.gitExecutable);
  for(const node of nodes.filter(n=>n.kind==='recovery'||n.kind==='snapshot'))await copyNode(node,path.join(stagedRecovery,owner,node.operationId!));
  for(const node of nodes.filter(n=>['primary','registration','staged','staged-git'].includes(n.kind))){const operation=node.operationId??captures.find(c=>c.runId===node.runId)?.operation.id??journals.find(j=>j.runId===node.runId)?.maintenance;need(operation,'Retained private workspace data has no owned recovery operation.');await copyNode(node,path.join(stagedRecovery,owner,operation,'imported-'+node.kind));}
  for(const node of nodes.filter(n=>n.kind==='restoration')){
   const target=copyPath(stagedWorkspaces,owner,node.restorationId!);await copyNode(node,target);copies.set(node.relativePath,target);
   const operation=operations.find(op=>op.id===node.operationId)!,copy=[...(operation.restorations??[]),...(operation.restoration?[operation.restoration]:[])].find(row=>row.id===node.restorationId)!;
   if(copy.phase==='complete')await workspaceEngine.verifyStandalone(owner,node.runId,target,check,signal);
   else if(!await absent(path.join(target,'.git'))){const privateTarget=path.join(stagedRecovery,owner,operation.id,'imported-partial-git-'+copy.id);await parent(path.dirname(privateTarget));await rename(path.join(target,'.git'),privateTarget);}
   copy.rootIdentity=await identity(target);
  }
  const maintenance=new ScheduledWorkspaceMaintenance(stageStore,workspaceEngine,stagedRecovery,{guard:async expected=>{need(expected===owner,'The recovery account changed.');await check();},busy:()=>false,exclusive:async work=>work(),withFiles:async(_owner,_paths,work)=>work(),state:async()=>({run:null,request:null}),references:()=>[],forget:async()=>{throw Error('Recovery cannot revoke current files.');},attach:async(_owner,folder)=>refs.find(ref=>ref.kind==='folder'&&!ref.relativePath&&copies.get(ref.node)===folder)?.id??randomUUID(),reveal:async()=>{throw Error('Recovery cannot open external applications.');}});
  for(const captured of captures){await check();const result=await maintenance.restore(owner,captured.operation.id);need(result.path,'The independent workspace was not restored.');const node=nodes.find(n=>n.kind==='primary'&&n.runId===captured.runId)!;copies.set(node.relativePath,result.path);const op=stageStore.get<Row>(opKey(owner,captured.operation.id))!,rootRef=refs.find(ref=>ref.node===node.relativePath&&ref.kind==='folder'&&!ref.relativePath);if(rootRef)op.restoration.referenceId=rootRef.id;else delete op.restoration.referenceId;await stageStore.set(opKey(owner,captured.operation.id),op);await workspaceEngine.verifyStandalone(owner,captured.runId,result.path,check,signal);}
  // A folder without its current root grant stays ungranted. Nested file
  // grants retain their IDs independently of that removed folder grant.
  const planned:RecoveredReference[]=[],aliases:WorkspaceImportAlias[]=[];
  for(const ref of refs){const container=copies.get(ref.node);need(container,'The current workspace file grant has no independent recovered copy.');const finalContainer=path.join(workspaces,path.relative(stagedWorkspaces,container)),target=path.join(finalContainer,...ref.relativePath.split('/')),formerPaths=[...new Set([...(ref.recoveryPaths??[]),ref.formerPath])];need(formerPaths.length<=256,'The workspace reference has too many former locations.');files.checkPath(target);planned.push({formerPath:ref.formerPath,reference:{id:ref.id,name:ref.name,kind:ref.kind,path:target,recoveryPaths:formerPaths}});aliases.push({id:ref.id,kind:ref.kind,path:target,formerPaths,container:finalContainer,rootIdentity:await identity(container)});}
  const finalJournals=journals.map(j=>bindJournal(j,workspaces,j.sourcePaths??[])),finalOperations=operations.map(op=>bindOperation(stageStore.get<Row>(opKey(owner,op.id))!,recovery,workspaces,finalJournals.find(j=>j.runId===op.runId)!));
  const graph={format:1 as const,kind:'sylvana-workspace-owner-records' as const,databaseManifestSha256:record.records.databaseManifestSha256,sourceWorkspaces:workspaces,sourceRecovery:recovery,accounts:[{owner,journals:finalJournals,operations:finalOperations}]};validateWorkspaceOwnerRecords({...graph,indexSha256:workspaceOwnerRecordsId(graph)});
  const publicIdentity=await identity(path.join(stagedWorkspaces,owner)),privateIdentity=await identity(path.join(stagedRecovery,owner)),publicFingerprint=(await workspaceRecoveryInventory(path.join(stagedWorkspaces,owner),check,signal,{includeGit:true})).fingerprint,privateFingerprint=(await workspaceRecoveryInventory(path.join(stagedRecovery,owner),check,signal,{includeGit:true})).fingerprint;
  receipt={...receipt,phase:'prepared',aliases,sourcePaths:[...new Set(finalJournals.flatMap(j=>j.sourcePaths??[]))]};await check();const preparedBytes=JSON.stringify({receipt,graph,planned,publicIdentity,privateIdentity,publicFingerprint,privateFingerprint,stateKeys,state},null,2);await writeFile(path.join(staging,'prepared.json'),preparedBytes,{flag:'wx',mode:0o600});receipt={...receipt,publication:{preparedSha256:createHash('sha256').update(preparedBytes).digest('hex'),publicIdentity,privateIdentity,publicFingerprint,privateFingerprint}};await secrets.set(key,receipt);await check();
  if(await absent(recovery))await mkdir(recovery);await backupDirectory(recovery);
  const device=await lstat(staging,{bigint:true});need((await lstat(workspaces,{bigint:true})).dev===device.dev&&(await lstat(recovery,{bigint:true})).dev===device.dev,'Workspace publication requires destinations on the private profile volume.');
  need(await absent(publicOwner)&&await absent(privateOwner),'A workspace publication destination became occupied.');await check();await rename(path.join(stagedRecovery,owner),privateOwner);await check();await rename(path.join(stagedWorkspaces,owner),publicOwner);await check();
  need(await identity(publicOwner)===publicIdentity&&await identity(privateOwner)===privateIdentity,'Published workspace folders were replaced.');need((await workspaceRecoveryInventory(publicOwner,check,signal,{includeGit:true})).fingerprint===publicFingerprint&&(await workspaceRecoveryInventory(privateOwner,check,signal,{includeGit:true})).fingerprint===privateFingerprint,'Published workspace bytes changed.');
  await verifyExtractedWorkspacePayload(options.extracted,options.binding,check,signal,owner);receipt={...receipt,phase:'complete'};
  const entries: (readonly[string,unknown])[]=[...finalJournals.map(j=>[journalKey(owner,j.runId),j] as const),...finalOperations.map(op=>[opKey(owner,op.id),op] as const),[key,receipt]];
  await files.restoreWorkspaceReferences(owner,id,planned,entries,async()=>{if(secrets.get<WorkspaceImportReceipt>(key)?.phase==='complete')await guard();else await check();});return receipt;
 }catch(error){
  // A transaction may have committed before its post-commit guard failed.
  // Never overwrite a durable completed receipt or replay its file grants.
  const committed=secrets.get<WorkspaceImportReceipt>(key);if(committed?.phase!=='complete'){receipt={...receipt,phase:'uncertain',error:(error as Error).message.slice(0,4000)};await secrets.set(key,receipt).catch(()=>{});}throw error;
 }
}

/** Recheck a sealed prepared publication. This reads retained bytes only;
 * inspection never rebuilds Git, attaches files or advances saved operations. */
export async function inspectWorkspaceImportPublication(options:Options){
 const {owner,secrets,files,signal}=options,guard=async()=>{signal.throwIfAborted();await options.guard();signal.throwIfAborted();},recovery=path.join(options.profile,'scheduled-recovery'),id=workspaceImportId(options.binding,owner,options.workspaces,recovery),key='scheduled-workspace-import:'+owner+':'+id;
 await guard();const receipt=secrets.get<WorkspaceImportReceipt>(key);need(receipt&&receipt.version===1&&receipt.owner===owner&&receipt.id===id&&receipt.workspaces===options.workspaces&&receipt.recovery===recovery&&receipt.phase!=='complete','This unfinished workspace recovery is unavailable.');need(path.dirname(receipt.staging)===options.profile&&/^wi-[a-f0-9]{16}$/.test(path.basename(receipt.staging))&&receipt.stagingIdentity===await identity(receipt.staging),'The private recovery staging directory changed. Preserve it before continuing.');
 const publication=receipt.publication;need(publication&&Object.values(publication).every(value=>/^[a-f0-9]{64}$/.test(value)),'This attempt did not reach a sealed publication. Keep its partial files and create a separate recovery copy.');
 const fingerprint=digest(receipt),checkReceipt=async()=>{await guard();need(digest(secrets.get(key))===fingerprint&&await identity(receipt.staging)===receipt.stagingIdentity,'The unfinished recovery changed during inspection.');};
 const preparedFile=path.join(receipt.staging,'prepared.json'),info=await lstat(preparedFile);need(info.isFile()&&!info.isSymbolicLink()&&info.nlink===1&&info.size<=64*1024**2,'The prepared recovery record is linked or too large.');need((await recoveryFile(preparedFile,checkReceipt,signal)).sha256===publication.preparedSha256,'The prepared recovery record changed. Keep its partial copies.');const bytes=await readFile(preparedFile);need(createHash('sha256').update(bytes).digest('hex')===publication.preparedSha256,'The prepared recovery record changed while reading.');
 const data=JSON.parse(bytes.toString('utf8')) as {receipt:WorkspaceImportReceipt;graph:Omit<WorkspaceOwnerRecords,'indexSha256'>;planned:RecoveredReference[];stateKeys:string[];state:string;publicIdentity:string;privateIdentity:string;publicFingerprint:string;privateFingerprint:string};
 const core=(value:WorkspaceImportReceipt)=>({version:value.version,owner:value.owner,id:value.id,indexSha256:value.indexSha256,workspaces:value.workspaces,recovery:value.recovery,staging:value.staging,stagingIdentity:value.stagingIdentity,at:value.at,aliases:value.aliases,sourcePaths:value.sourcePaths});need(digest(core(data.receipt))===digest(core(receipt))&&data.receipt.phase==='prepared','The sealed publication belongs to another recovery attempt.');for(const field of ['publicIdentity','privateIdentity','publicFingerprint','privateFingerprint'] as const)need(data[field]===publication[field],'The sealed publication directory proof changed.');
 const source=await verifyExtractedWorkspacePayload(options.extracted,options.binding,checkReceipt,signal,owner),account=source.records.accounts.find(row=>row.owner===owner);need(account&&receipt.indexSha256===source.indexSha256,'The workspace recovery does not match its source account.');const keys=[...account.journals.map(row=>journalKey(owner,row.runId)),...account.operations.map(row=>opKey(owner,row.id)),...source.captures.filter(row=>row.owner===owner).map(row=>opKey(owner,row.operation.id))];need(JSON.stringify(data.stateKeys)===JSON.stringify(keys)&&/^[a-f0-9]{64}$/.test(data.state),'The original saved-record scope changed.');
 const check=async()=>{await checkReceipt();need(digest([keys.map(entry=>[entry,secrets.get(entry)]),files.list(owner)])===data.state,'Saved workspace records or grants changed after this attempt. Preserve both copies before continuing.');};await check();
 const graph=validateWorkspaceOwnerRecords({...data.graph,indexSha256:workspaceOwnerRecordsId(data.graph)});need(graph.databaseManifestSha256===options.binding.databaseManifestSha256&&graph.sourceWorkspaces===options.workspaces&&graph.sourceRecovery===recovery&&graph.accounts.length===1&&graph.accounts[0].owner===owner&&graph.accounts[0].journals.every(row=>row.phase==='archived')&&Array.isArray(data.planned)&&data.planned.length<=100,'The prepared owner-record scope is invalid.');
 const locate=async(staged:string,published:string,expectedIdentity:string,expectedFingerprint:string)=>{const inStage=!await absent(staged),inPublic=!await absent(published);need(inStage!==inPublic,'A prepared recovery copy is missing or has conflicting locations. Preserve both folders.');const location=inStage?staged:published;need(await identity(location)===expectedIdentity,'A prepared recovery folder was replaced. Keep it for inspection.');const inventory=await workspaceRecoveryInventory(location,check,signal,{includeGit:true});need(inventory.fingerprint===expectedFingerprint,'Prepared recovery bytes changed. Keep the edits and create a separate recovery copy.');return {staged,published,location,identity:expectedIdentity,fingerprint:expectedFingerprint,files:inventory.files,bytes:inventory.bytes};};
 const publicCopy=await locate(path.join(receipt.staging,'w',owner),path.join(options.workspaces,owner),data.publicIdentity,data.publicFingerprint),privateCopy=await locate(path.join(receipt.staging,'r',owner),path.join(recovery,owner),data.privateIdentity,data.privateFingerprint);await check();return {receipt,key,data,graph,publicCopy,privateCopy,check};
}

/** Finish only the verified copies already prepared by this attempt. This
 * resumes filesystem publication and one credential transaction, never Git,
 * model inference, a former scheduled run or an external tool call. */
export async function finishWorkspaceImportPublication(options:Options){
 const plan=await inspectWorkspaceImportPublication(options);try{
  for(const copy of [plan.privateCopy,plan.publicCopy]){await plan.check();if(copy.location===copy.staged){const parent=path.dirname(copy.published);if(await absent(parent))await mkdir(parent);await backupDirectory(parent);need(await absent(copy.published),'The publication destination became occupied. Keep both copies.');await rename(copy.staged,copy.published);}need(await identity(copy.published)===copy.identity,'A recovered publication folder was replaced.');need((await workspaceRecoveryInventory(copy.published,plan.check,options.signal,{includeGit:true})).fingerprint===copy.fingerprint,'The recovered publication bytes changed.');}
  await plan.check();const receipt={...plan.receipt,phase:'complete' as const,error:undefined},account=plan.graph.accounts[0],entries:(readonly[string,unknown])[]=[...account.journals.map(row=>[journalKey(options.owner,row.runId),row] as const),...account.operations.map(row=>[opKey(options.owner,row.id),row] as const),[plan.key,receipt]];
  await options.files.restoreWorkspaceReferences(options.owner,receipt.id,plan.data.planned,entries,async()=>{if(options.secrets.get<WorkspaceImportReceipt>(plan.key)?.phase==='complete')await options.guard();else await plan.check();});return receipt;
 }catch(error){if(options.secrets.get<WorkspaceImportReceipt>(plan.key)?.phase!=='complete')await options.secrets.set(plan.key,{...plan.receipt,phase:'uncertain',error:(error as Error).message.slice(0,4000)}).catch(()=>{});throw error;}
}
