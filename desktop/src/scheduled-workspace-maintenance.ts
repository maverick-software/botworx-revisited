import path from 'node:path';
import {randomUUID,createHash} from 'node:crypto';
import {lstat,mkdir,rename,rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {sourceLinkSuffix,workspaceSourceLink} from './source-locations';
import type {RecoveredChatLink} from './chat-files';
import {gitRecoveryPolicy,gitRecoveryPolicyId} from './workspace-git-policy';
import type {Secrets} from './secrets';
import type {FileReference} from './contracts';
import {storageDirectory,storageWithin,storageUuid} from './storage-files';
import {ScheduledWorkspaces,type RetainedWorkspace,type ScheduledWorkspaceJournal} from './scheduled-workspaces';
import {type GitRecovery,type GitRecoveryProgress} from './workspace-recovery-git';
import {captureWorkspaceSnapshot} from './workspace-backup-snapshot';
import {workspaceRecoveryInventory,verifyWorkspaceRecovery,recoveryFile,type RecoveryArtifact,type WorkspaceRecoveryManifest} from './workspace-recovery-files';
import type {RetainedWorkspaceRow,ScheduledWorkspaceReview,ScheduledWorkspaceResult,WorkspaceInspection,WorkspaceRecoveryRow} from './scheduled-workspace-contracts';

type Restoration={id:string;phase:'creating'|'complete'|'uncertain';path:string;referenceId?:string;rootIdentity?:string};
type Operation={version:1;id:string;owner:string;runId:string;createdAt:string;phase:'creating'|'prepared'|'committing'|'archived'|'uncertain'|'acknowledged';expiresAt:string;journal:string;review?:ScheduledWorkspaceReview;artifact?:RecoveryArtifact;rootFingerprint?:string;git?:GitRecovery;gitProgress?:GitRecoveryProgress;gitDirectory?:string;gitIdentity?:string;staged?:string;stagedGit?:string;restoration?:Restoration;restorations?:Restoration[];origin?:{runId:string;operationId:string;indexSha256:string};privateHistory?:boolean};
type Store=Pick<Secrets,'get'|'set'|'setMany'>&Partial<Pick<Secrets,'scheduledWorkspaceRecoveryIds'>>;
type RunState={run:string|null;request:string|null;requestFingerprint?:string;conversationId?:string};
type Host={guard:(owner:string)=>Promise<void>;busy:()=>boolean;exclusive:<T>(work:()=>Promise<T>)=>Promise<T>;withFiles:<T>(owner:string,paths:string[],work:()=>Promise<T>)=>Promise<T>;state:(owner:string,journal:ScheduledWorkspaceJournal)=>Promise<RunState>;references:(owner:string)=>FileReference[];forget:(owner:string,root:string)=>Promise<void>;attach:(owner:string,root:string,guard:()=>Promise<void>)=>Promise<string>;reveal:(root:string)=>Promise<void>};
const digest=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const valid=(value:unknown):string=>{if(!storageUuid(value))throw Error('Choose a valid scheduled workspace.');return value;};
const absent=async(file:string)=>{try{await lstat(file);return false;}catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')return true;throw error;}};
const unchanged=()=>Error('This workspace or its Git state changed after review. Keep it and create a fresh review.');

/** Recovery and removal are separate durable operations. Unknown outcomes are
 * retained for inspection; neither model inference nor removal is replayed. */
export class ScheduledWorkspaceMaintenance{
 private pending=new Map<string,AbortController>();
 private inspections=new Map<string,{owner:string;view:WorkspaceInspection;fingerprint:string}>();
 constructor(private secrets:Store,private workspaces:ScheduledWorkspaces,private recoveryRoot:string,private host:Host){}
 private async restoredIdentity(root:string){await storageDirectory(root);const stat=await lstat(root,{bigint:true});return digest([stat.dev.toString(),stat.ino.toString(),stat.birthtimeNs.toString()]);}
 async recoveredLink(owner:string,args:Record<string,unknown>,guard:()=>Promise<void>):Promise<RecoveredChatLink|undefined>{
  if(typeof args.href!=='string'||args.href.length>4000||/[\x00-\x1f\x7f]/.test(args.href))return;
  const href=args.href.trim();if(!href||/^(?:https?:|sandbox:|#|\/\/)/i.test(href))return;
  let absolute:string|undefined,referenceId:string|undefined,relative='',fragment='';
  if(/^agentopia-file:/i.test(href)){
   const url=new URL(href);if(url.username||url.password||url.port||url.search)throw Error('Use a valid workspace file reference.');
   referenceId=url.hostname;relative=decodeURIComponent(url.pathname.replace(/^\//,''));fragment=url.hash;
  }else{
   const suffix=sourceLinkSuffix(href),hash=suffix.href.indexOf('#'),value=hash>=0?suffix.href.slice(0,hash):suffix.href;fragment=hash>=0?suffix.href.slice(hash):suffix.fragment?'#'+suffix.fragment:'';
   if(/^file:/i.test(value)){const url=new URL(value);if(url.hostname&&url.hostname!=='localhost'||url.search)return;absolute=fileURLToPath(url);}else absolute=decodeURIComponent(value);
   if(!path.isAbsolute(absolute))return;absolute=path.resolve(absolute);
  }
  await guard();await this.host.guard(owner);
  const matches=this.workspaces.retained(owner).filter(journal=>['archiving','archived'].includes(journal.phase)).flatMap(journal=>{
   let target=absolute;
   if(referenceId){const binding=journal.resolution?.files.find(file=>file.id===referenceId&&storageWithin(journal.path,file.path));if(!binding)return [];if(binding.kind==='file'&&relative)throw Error('This reference grants access to one file.');target=path.resolve(binding.path,relative);}
   if(!target||!storageWithin(journal.path,target))return [];
   return [{journal,relative:path.relative(journal.path,target)}];
  });
  if(!matches.length)return;if(matches.length!==1)throw Error('Several retained workspaces match this link. Open the restored copy from Saved workspaces.');
  const {journal,relative:tail}=matches[0];if(!journal.maintenance)throw Error('Inspect this archived workspace before opening its files.');
  const operation=this.read(owner,journal.maintenance),copies=[...(operation.restorations??[]),...(operation.restoration?[operation.restoration]:[])].filter(copy=>copy.phase==='complete');
  if(operation.runId!==journal.runId||copies.length!==1)throw Error('Restore this workspace from Saved workspaces before opening its files.');
  const copy=copies[0],expected=path.join(this.workspaces.directory,owner,'restored-'+createHash('sha256').update(valid(copy.id)).digest('hex').slice(0,24)),receipt=digest({journal,operation});
  if(copy.path!==expected||!copy.rootIdentity||!copy.referenceId||!storageUuid(copy.referenceId))throw Error('The restored workspace ownership is unconfirmed. Open it from Saved workspaces.');
  const check=async()=>{
   await guard();await this.host.guard(owner);
   if(digest({journal:this.workspaces.retainedJournal(owner,journal.runId),operation:this.read(owner,operation.id)})!==receipt||!this.host.references(owner).some(ref=>ref.id===copy.referenceId&&ref.path===expected&&ref.kind==='folder'&&ref.source!=='clipboard'))throw Error('This restored workspace reference changed or was removed. Open the restored copy from Saved workspaces.');
   if(await this.restoredIdentity(expected)!==copy.rootIdentity)throw Error('The restored workspace folder was replaced. Open the copy you want from Saved workspaces.');
   await guard();await this.host.guard(owner);
  };
  await check();return {args:{href:workspaceSourceLink(copy.referenceId,tail)+fragment},check};
 }
 private key(owner:string,id:string){return 'scheduled-workspace-recovery:'+valid(owner)+':'+valid(id);}
 private read(owner:string,id:string){const value=this.secrets.get<Operation>(this.key(owner,id));if(!value||value.version!==1||value.owner!==owner||value.id!==id||!storageUuid(value.runId)||!['creating','prepared','committing','archived','uncertain','acknowledged'].includes(value.phase))throw Error('This recovery belongs to another account or is unavailable.');return structuredClone(value);}
 private directory(owner:string,id:string){return path.join(this.recoveryRoot,valid(owner),valid(id));}
 private async parent(directory:string,guard:()=>Promise<void>){
  const parts=path.resolve(directory).slice(path.parse(path.resolve(directory)).root.length).split(path.sep).filter(Boolean);let current=path.parse(path.resolve(directory)).root;
  for(const part of parts){await guard();current=path.join(current,part);try{await mkdir(current);}catch(error){if((error as NodeJS.ErrnoException).code!=='EEXIST')throw error;}await storageDirectory(current);}
 }
 private async guard(owner:string,journal:ScheduledWorkspaceJournal,signal?:AbortSignal){
  signal?.throwIfAborted();
  await this.host.guard(owner);if(this.host.busy())throw Error('Finish or pause active chats, scheduled work and terminals before workspace maintenance.');
  const state=await this.host.state(owner,journal);
  if(state.run!==null&&!['completed','failed','cancelled','skipped'].includes(state.run)||state.request!==null&&!['completed','failed','cancelled'].includes(state.request)&&!(state.request==='interrupted'&&state.requestFingerprint&&journal.reviewedRequest===state.requestFingerprint))throw Error('Finish or dismiss the retained run and inspect its request before workspace maintenance.');
  await this.host.guard(owner);signal?.throwIfAborted();
 }
 async list(owner:string):Promise<RetainedWorkspaceRow[]>{
  await this.host.guard(owner);const operations=this.secrets.scheduledWorkspaceRecoveryIds?.(owner).map(id=>this.read(owner,id))??[];
  const view=(operation:Operation):WorkspaceRecoveryRow=>({id:operation.id,phase:operation.phase,createdAt:operation.createdAt,recoveryAvailable:!!operation.artifact,...(operation.privateHistory?{privateHistory:true}:{}),...(operation.review?{review:operation.review}:{}),...(operation.restoration?.phase==='complete'?{restoredPath:operation.restoration.path}:{}),interruptedRestoration:!!operation.restoration&&operation.restoration.phase!=='complete',restorations:[...(operation.restorations??[]),...(operation.restoration?[operation.restoration]:[])].map(({id,phase,path,referenceId})=>({id,phase,path,...(phase==='complete'&&referenceId&&this.host.references(owner).some(ref=>ref.id===referenceId&&ref.path===path&&ref.kind==='folder'&&ref.source!=='clipboard')?{referenceId}:{})}))});
  const journals=this.workspaces.retained(owner),rows=journals.map(journal=>{
   const row:RetainedWorkspaceRow={runId:journal.runId,taskId:journal.taskId,requestId:journal.requestId,path:journal.path,source:journal.workspace.source.path,ref:journal.workspace.ref,phase:journal.phase,at:journal.at};
   row.operations=operations.filter(operation=>operation.runId===journal.runId).sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).map(view);
   if(journal.maintenance)try{row.operation=view(this.read(owner,journal.maintenance));}catch(error){row.problem=(error as Error).message;}
   return row;
  });
  for(let offset=0;offset<rows.length;offset+=4)await Promise.all(rows.slice(offset,offset+4).map(async(row,index)=>{try{const state=await this.host.state(owner,journals[offset+index]);row.runStatus=state.run;row.requestStatus=state.request;row.requestAcknowledged=!!state.requestFingerprint&&journals[offset+index].reviewedRequest===state.requestFingerprint;}catch(error){row.problem=(error as Error).message;}}));
  await this.host.guard(owner);return rows.sort((a,b)=>b.at.localeCompare(a.at));
 }
 async open(owner:string,run:string){
  await this.host.guard(owner);const retained=await this.workspaces.inspectRetained(owner,valid(run),()=>this.host.guard(owner));
  if(['archiving','archived'].includes(retained.journal.phase))throw Error('This workspace was archived. Restore its verified recovery to open it.');
  const referenceId=await this.host.attach(owner,retained.journal.path,()=>this.host.guard(owner));return {referenceId,path:retained.journal.path};
 }
 private async capture(owner:string,run:string,signal:AbortSignal):Promise<ScheduledWorkspaceReview>{
  const journal=this.workspaces.retainedJournal(owner,run),guard=()=>this.guard(owner,journal,signal);await guard();
  if(['archiving','archived'].includes(journal.phase))throw Error('Inspect the existing archive operation before continuing.');
  if(journal.maintenance){const previous=this.read(owner,journal.maintenance);if(['creating','committing','uncertain'].includes(previous.phase))throw Error('A previous recovery has an uncertain outcome. Inspect it before starting another.');}
  const retained=await this.workspaces.inspectRetained(owner,run,guard),id=randomUUID(),directory=this.directory(owner,id),createdAt=new Date().toISOString();
  let operation:Operation={version:1,id,owner,runId:run,createdAt,phase:'creating',expiresAt:new Date(Date.now()+15*60000).toISOString(),journal:digest(journal)};
  const save=async()=>{await guard();await this.secrets.set(this.key(owner,id),structuredClone(operation));};
  await this.secrets.setMany([[this.key(owner,id),operation],['scheduled-workspace:'+owner+':'+run,{...journal,maintenance:id}]]);
  const currentJournal={...journal,maintenance:id};operation.journal=digest(currentJournal);await save();
  try{
   await this.parent(path.dirname(directory),guard);
   const captured=await captureWorkspaceSnapshot(this.workspaces,{owner,run,operation:id,destination:directory},guard,signal,async progress=>{if(progress.phase==='git'){operation.gitProgress=progress.value;await save();}});
   operation.git=captured.git;operation.gitDirectory=captured.gitDirectory;operation.gitIdentity=captured.gitIdentity;
   if(operation.git)this.validatedGit(operation.git);this.boundArchive(owner,operation,captured.manifest);
   const checked=await this.workspaces.inspectRetained(owner,run,guard);
   if(digest({...checked.journal,maintenance:undefined})!==digest({...retained.journal,maintenance:undefined})||checked.git?.identity!==retained.git?.identity||checked.git?.controlHash!==retained.git?.controlHash)throw unchanged();
   operation.expiresAt=new Date(Date.now()+15*60000).toISOString();operation={...operation,phase:'prepared',artifact:captured.artifact,rootFingerprint:captured.rootFingerprint,review:{id,runId:run,path:journal.path,files:captured.files,bytes:captured.bytes,recoveryBytes:captured.recoveryBytes,expiresAt:operation.expiresAt,hasGit:!!operation.git}};
   await save();return structuredClone(operation.review!);
  }catch(error){operation.phase='uncertain';await this.secrets.set(this.key(owner,id),operation).catch(()=>{});throw error;}
 }
 async prepare(owner:string,run:string){valid(owner);valid(run);const key=owner+':'+run;if(this.pending.has(key))throw Error('This workspace is already being reviewed.');const controller=new AbortController();this.pending.set(key,controller);try{return await this.host.exclusive(()=>this.capture(owner,run,AbortSignal.any([controller.signal,AbortSignal.timeout(15*60000)])));}finally{this.pending.delete(key);}}
 async cancel(owner:string,run:string){await this.host.guard(owner);const controller=this.pending.get(valid(owner)+':'+valid(run));controller?.abort(Error('Workspace review cancelled. Its retained files and any partial recovery remain available for inspection.'));return {cancelled:!!controller};}
 private artifact(owner:string,operation:Operation){const file=path.join(this.directory(owner,operation.id),'workspace.tar.gz');if(!operation.artifact||path.resolve(operation.artifact.path)!==path.resolve(file))throw Error('The owned recovery archive is unavailable.');return operation.artifact;}
 /** Internal administrator-backup reader. Its guard must bind the caller and
  * database-derived owner set; this performs no mutation or host review. */
 async verifyRecovery(owner:string,id:string,guard:()=>Promise<void>,signal:AbortSignal){
  await guard();signal.throwIfAborted();const operation=this.read(owner,valid(id));
  const record=await verifyWorkspaceRecovery(this.artifact(owner,operation),guard,signal,undefined,manifest=>this.boundArchive(owner,operation,manifest));
  await guard();signal.throwIfAborted();return record;
 }
 private validatedGit(git:GitRecovery){const proof=git.validation,bundle=git.extras.find(file=>file.name==='history.bundle'),policy=gitRecoveryPolicy(git.policy??{},git.head.length);if(!proof||proof.version!==1||!bundle||proof.bundleSha256!==bundle.sha256||proof.head!==git.head||proof.commit!==git.commit||proof.reference!==git.reference||proof.policySha256!==gitRecoveryPolicyId(policy)||!/^([a-f0-9]{40}|[a-f0-9]{64})$/.test(proof.packChecksum)||!Number.isFinite(Date.parse(proof.at)))throw Error('This Git recovery has no matching independent history validation. Create a new archive review before removing its workspace.');}
 private boundArchive(owner:string,operation:Operation,record:WorkspaceRecoveryManifest){
  if(operation.origin&&(!storageUuid(operation.origin.runId)||!storageUuid(operation.origin.operationId)||!/^[a-f0-9]{64}$/.test(operation.origin.indexSha256)||operation.phase!=='archived'))throw Error('The original archive scope is invalid.');
  if(!!record.metadata.privateHistory!==!!operation.privateHistory)throw Error('The private history archive kind changed.');
  if(record.metadata.owner!==owner||record.metadata.run!==(operation.origin?.runId??operation.runId)||record.metadata.operation!==(operation.origin?.operationId??operation.id))throw Error('The recovery archive identity does not match this account, workspace and saved operation. Keep the original and inspect its recovery.');
  const git=operation.git;
  if(!git){if(record.metadata.git!==null||record.extras.length)throw Error('The recovery archive Git state does not match this saved workspace.');return;}
  const saved=record.metadata.git as {head?:string;metadata?:Record<string,unknown>;policy?:unknown;validation?:Record<string,unknown>}|undefined;
  const bad=()=>Error('The archived Git history proof does not match its sealed bundle, index or saved state. Inspect this recovery before continuing.');
  if(!saved||!/^([a-f0-9]{40}|[a-f0-9]{64})$/.test(git.head)||saved.head!==git.head||gitRecoveryPolicyId(gitRecoveryPolicy(saved.policy??{},git.head.length))!==gitRecoveryPolicyId(gitRecoveryPolicy(git.policy??{},git.head.length)))throw bad();
  // Paths may be rebound by an owned portable restore; the sealed bytes and
  // sizes must still match every Git extra and its metadata archive.
  if(!saved.metadata||(['sha256','manifestSha256','bytes','files','expandedBytes'] as const).some(key=>saved.metadata?.[key]!==git.metadata[key])||record.extras.length!==git.extras.length||record.extras.some(entry=>{const expected=git.extras.find(file=>file.name===entry.name);return !expected||expected.sha256!==entry.sha256||expected.size!==entry.size;}))throw bad();
  const history=record.extras.find(file=>file.name==='history.bundle'),index=record.extras.find(file=>file.name==='index.bin'),metadata=record.extras.find(file=>file.name==='git-state.tar.gz');
  if(!history||!metadata||metadata.sha256!==git.metadata.sha256||metadata.size!==git.metadata.bytes||!!index!==!!git.indexSha256||index&&index.sha256!==git.indexSha256)throw bad();
  if(git.validation){const proof=git.validation;if(history.sha256!==proof.bundleSha256||(['version','bundleSha256','head','commit','reference','packChecksum','policySha256','at'] as const).some(key=>saved.validation?.[key]!==proof[key]))throw bad();}
  else if(saved.validation!==undefined)throw bad();
 }
 async reveal(owner:string,id:string){await this.host.guard(owner);const operation=this.read(owner,valid(id)),directory=this.directory(owner,operation.id);await storageDirectory(directory);await this.host.guard(owner);await this.host.reveal(directory);}
 async commit(owner:string,id:string):Promise<ScheduledWorkspaceResult>{
  return this.host.exclusive(async()=>{
   const operation=this.read(owner,valid(id)),journal=this.workspaces.retainedJournal(owner,operation.runId);
   return this.host.withFiles(owner,[journal.path],async()=>{const signal=AbortSignal.timeout(15*60000),guard=()=>this.guard(owner,journal,signal);
   await guard();if(operation.phase!=='prepared'||!operation.review||!operation.rootFingerprint||Date.parse(operation.expiresAt)<Date.now()||journal.maintenance!==operation.id||digest(journal)!==operation.journal)throw Error('This archive review expired, changed or was already used. Inspect the retained workspace again.');
   if(operation.git)this.validatedGit(operation.git);
   const retained=await this.workspaces.inspectRetained(owner,operation.runId,guard);
   await this.workspaces.verifyStorage(owner,operation.runId,guard,signal);
   await verifyWorkspaceRecovery(this.artifact(owner,operation),guard,signal,undefined,record=>this.boundArchive(owner,operation,record));
   const check=async(root:string,metadata?:string)=>{
    if((await workspaceRecoveryInventory(root,guard,new AbortController().signal)).fingerprint!==operation.rootFingerprint)throw unchanged();
    if(retained.git&&(await recoveryFile(path.join(root,'.git'),guard,new AbortController().signal)).sha256!==retained.git.controlHash)throw unchanged();
    if(operation.git){if(!metadata||(await workspaceRecoveryInventory(metadata,guard,new AbortController().signal)).fingerprint!==operation.git.metadataFingerprint)throw unchanged();}
   };
   if(retained.git?.directory!==operation.gitDirectory||retained.git?.identity!==operation.gitIdentity)throw unchanged();await check(journal.path,retained.git?.directory);
   const staged=path.join(path.dirname(journal.path),'.agentopia-archive-'+operation.id),stagedGit=retained.git?path.join(path.dirname(retained.git.directory),'.agentopia-archive-'+operation.id):undefined;
   if(!await absent(staged)||stagedGit&&!await absent(stagedGit))throw Error('An earlier archive staging folder needs inspection.');
   // The managed root and metadata paths have been checked against the owned
   // journal and complete inventories before any rename or recursive removal.
   if(path.dirname(staged)!==path.dirname(journal.path)||stagedGit&&(!retained.git||path.dirname(stagedGit)!==path.join(journal.workspace.commonDirectory,'worktrees')))throw Error('The archive staging path escaped its owned parent.');
   operation.phase='committing';operation.staged=staged;operation.stagedGit=stagedGit;
   await this.secrets.setMany([[this.key(owner,id),operation],['scheduled-workspace:'+owner+':'+operation.runId,{...journal,phase:'archiving'}]]);
   try{
    await guard();await rename(journal.path,staged);await check(staged,retained.git?.directory);
    if(retained.git&&stagedGit){await guard();await rename(retained.git.directory,stagedGit);await check(staged,stagedGit);}
    await verifyWorkspaceRecovery(this.artifact(owner,operation),guard,signal,undefined,record=>this.boundArchive(owner,operation,record));await check(staged,stagedGit);
    await guard();await storageDirectory(staged);await rm(staged,{recursive:true,force:false});
    if(stagedGit){await guard();await storageDirectory(stagedGit);await rm(stagedGit,{recursive:true,force:false});}
    await guard();operation.phase='archived';await this.host.forget(owner,journal.path);
    await this.secrets.setMany([[this.key(owner,id),operation],['scheduled-workspace:'+owner+':'+operation.runId,{...journal,phase:'archived'}]]);
    return {id,runId:operation.runId,phase:'archived',removedBytes:operation.review.bytes+(operation.git?.metadata.expandedBytes??0),recoveryBytes:operation.review.recoveryBytes};
   }catch(error){operation.phase='uncertain';await this.secrets.set(this.key(owner,id),operation).catch(()=>{});throw Error((error as Error).message+' The verified recovery and any remaining archive staging folders are retained. This operation will not be repeated automatically.');}
   });
  });
 }
 async restore(owner:string,id:string):Promise<ScheduledWorkspaceResult>{
  return this.host.exclusive(async()=>{
   const operation=this.read(owner,valid(id)),journal=this.workspaces.retainedJournal(owner,operation.runId),signal=AbortSignal.timeout(15*60000),guard=()=>this.guard(owner,journal,signal);await guard();
   if(operation.privateHistory)throw Error('This private import history is retained for inspection. Open its recovery folder.');
   if(!operation.artifact||!operation.review||!['prepared','archived','uncertain'].includes(operation.phase))throw Error('This operation has no completed verified workspace recovery.');
   if(operation.restoration)throw Error('Inspect the existing restoration before starting another copy.');
   const restoreId=randomUUID(),destination=path.join(this.workspaces.directory,owner,'restored-'+createHash('sha256').update(restoreId).digest('hex').slice(0,24)),privateDirectory=path.join(this.directory(owner,id),'restore-'+restoreId);
   if(!await absent(destination)||!await absent(privateDirectory))throw Error('The restoration destination is occupied.');
   operation.restoration={id:restoreId,phase:'creating',path:destination};await this.secrets.set(this.key(owner,id),operation);
   try{
    const artifact=this.artifact(owner,operation);await verifyWorkspaceRecovery(artifact,guard,signal,privateDirectory,record=>this.boundArchive(owner,operation,record));
    // Persist the private extraction folder's identity before moving it. The
    // identity excludes its path, so a crash on either side of rename retains
    // proof for the same folder without guessing which operation completed.
    operation.restoration.rootIdentity=await this.restoredIdentity(path.join(privateDirectory,'files'));await this.secrets.set(this.key(owner,id),operation);
    await this.parent(path.dirname(destination),guard);await guard();await rename(path.join(privateDirectory,'files'),destination);
    if(await this.restoredIdentity(destination)!==operation.restoration.rootIdentity)throw Error('The recovered folder was replaced while being published.');
    if(operation.git)await this.workspaces.restoreRepository(owner,operation.runId,destination,privateDirectory,operation.git.head,!!operation.git.indexSha256,guard,new AbortController().signal,operation.git.policy??{});
    const rootIdentity=operation.restoration.rootIdentity,referenceId=await this.host.attach(owner,destination,guard);await guard();if(await this.restoredIdentity(destination)!==rootIdentity)throw Error('The restored workspace folder changed before attachment.');operation.restoration={id:restoreId,phase:'complete',path:destination,referenceId,rootIdentity};await this.secrets.set(this.key(owner,id),operation);
    return {id,runId:operation.runId,phase:'restored',removedBytes:0,recoveryBytes:operation.review.recoveryBytes,path:destination,referenceId};
   }catch(error){operation.restoration.phase='uncertain';await this.secrets.set(this.key(owner,id),operation).catch(()=>{});throw Error((error as Error).message+' The partial restored copy is retained for inspection and will not be repeated.');}
  });
 }
 private async inspectionState(owner:string,kind:WorkspaceInspection['kind'],run:string,operationId?:string){
  await this.host.guard(owner);if(this.host.busy()||this.pending.has(owner+':'+run))throw Error('Wait for active work to finish before inspection.');
  const journal=this.workspaces.retainedJournal(owner,run),operation=operationId?this.read(owner,operationId):undefined,state=await this.host.state(owner,journal);
  if(operation&&operation.runId!==run)throw Error('This recovery belongs to another workspace.');
  if(state.run!==null&&!['completed','failed','cancelled','skipped'].includes(state.run)||state.request==='running')throw Error('Finish or dismiss the retained run before acknowledging its recovery.');
  let root:RetainedWorkspace|undefined;
  if(kind==='capture'){
   if(!operation||!['creating','uncertain'].includes(operation.phase)||operation.staged||operation.stagedGit||['archiving','archived'].includes(journal.phase))throw Error('A removal may have started. Keep its staging folders and restore the verified recovery instead.');
   root=await this.workspaces.inspectRetained(owner,run,()=>this.host.guard(owner));
  }else if(kind==='restoration'){
   if(!operation?.restoration||!['creating','uncertain'].includes(operation.restoration.phase))throw Error('This recovery has no interrupted restored copy to inspect.');
  }else if(state.request!=='interrupted'||!state.requestFingerprint)throw Error('The saved request is no longer an interrupted request.');
  await this.host.guard(owner);return {journal,operation,state,root};
 }
 async inspect(owner:string,kind:WorkspaceInspection['kind'],run:string,operationId?:string):Promise<WorkspaceInspection>{
  if(!['capture','restoration','request'].includes(kind))throw Error('Choose a supported workspace inspection.');valid(owner);valid(run);if(operationId)valid(operationId);
  return this.host.exclusive(async()=>{
   const current=await this.inspectionState(owner,kind,run,operationId),id=randomUUID(),view:WorkspaceInspection={id,kind,runId:run,...(operationId?{operationId}:{}),path:current.operation?.restoration?.path??current.journal.path,requestId:current.journal.requestId,...(current.state.conversationId?{conversationId:current.state.conversationId}:{}),expiresAt:new Date(Date.now()+15*60000).toISOString(),summary:kind==='capture'?'The original owned workspace is present and removal has not started. Existing recovery files and Git recovery references will be retained. Acknowledging this permits a new review.':kind==='restoration'?'The interrupted restored copy will be retained. Acknowledging this permits another restoration into a new folder.': 'The saved request was interrupted. Inspect its chat and any command results before acknowledging it. Acknowledgement permits storage maintenance and does not repeat the request.'};
   for(const [key,entry]of this.inspections)if(Date.parse(entry.view.expiresAt)<Date.now())this.inspections.delete(key);if(this.inspections.size>=100)throw Error('Close older inspection reviews before continuing.');this.inspections.set(id,{owner,view,fingerprint:digest(current)});return view;
  });
 }
 async acknowledge(owner:string,id:string){
  valid(id);const inspected=this.inspections.get(id);if(!inspected||inspected.owner!==owner||Date.parse(inspected.view.expiresAt)<Date.now())throw Error('Inspect the current recovery before acknowledging it.');this.inspections.delete(id);
  return this.host.exclusive(async()=>{
   const {kind,runId,operationId}=inspected.view,current=await this.inspectionState(owner,kind,runId,operationId);if(digest(current)!==inspected.fingerprint)throw Error('The inspected recovery changed. Inspect it again.');
   if(kind==='request')await this.secrets.set('scheduled-workspace:'+owner+':'+runId,{...current.journal,reviewedRequest:current.state.requestFingerprint});
   else if(kind==='capture'){current.operation!.phase='acknowledged';await this.secrets.set(this.key(owner,current.operation!.id),current.operation);}
   else{const operation=current.operation!;if((operation.restorations?.length??0)>=100)throw Error('The retained restored-copy history is full.');operation.restorations=[...(operation.restorations??[]),operation.restoration!];delete operation.restoration;await this.secrets.set(this.key(owner,operation.id),operation);}
   await this.host.guard(owner);return {acknowledged:true};
  });
 }
 async revealRestored(owner:string,id:string,restorationId:string){
  await this.host.guard(owner);const operation=this.read(owner,valid(id)),restoration=[...(operation.restorations??[]),...(operation.restoration?[operation.restoration]:[])].find(row=>row.id===valid(restorationId));
  if(!restoration||restoration.path!==path.join(this.workspaces.directory,owner,'restored-'+createHash('sha256').update(restorationId).digest('hex').slice(0,24)))throw Error('This restored copy is unavailable for your account.');
  await storageDirectory(restoration.path);await this.host.guard(owner);await this.host.reveal(restoration.path);
 }
}
