import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {createReadStream} from 'node:fs';
import {pipeline} from 'node:stream/promises';
import {lstat,realpath,readFile,writeFile,mkdir,copyFile,rm,constants} from 'node:fs/promises';
import type {Secrets} from './secrets';
import type {WorkspaceFiles} from './workspace';
import type {ScheduledRun,TaskFileBinding,TaskSnapshot,TaskWorkspace} from './scheduled-task-contracts';
import {taskWorkspace} from './scheduled-projects';
import {storageDirectory} from './storage-files';
import type {GitRecoveryCommand,GitRecoveryValidationInput,GitRecoveryValidation} from './workspace-recovery-git';
import {recoveryFile,workspaceRecoveryInventory} from './workspace-recovery-files';
import {WorkspaceGitStorage} from './workspace-git-storage';
import {workspaceBundlePack} from './workspace-git-bundle';
import {installGitRecoveryPolicy,gitRecoveryPolicyId,type GitRecoveryPolicy} from './workspace-git-policy';

const execute=promisify(execFile),id=(value:string)=>{if(!/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(value))throw Error('Invalid scheduled workspace identity.');return value;};
const same=(a:string,b:string)=>process.platform==='win32'?path.normalize(a).toLowerCase()===path.normalize(b).toLowerCase():path.normalize(a)===path.normalize(b);
const within=(root:string,target:string)=>{const relative=path.relative(root,target);return relative===''||relative!=='..'&&!relative.startsWith('..'+path.sep)&&!path.isAbsolute(relative);};
const sha=(value:string|Buffer)=>createHash('sha256').update(value).digest('hex');
type FileHost=Pick<WorkspaceFiles,'list'|'attach'|'checkPath'|'checkBackupPath'>;
type Resolution={files:TaskFileBinding[];resolved:NonNullable<TaskWorkspace['resolved']>};
export type ScheduledWorkspaceJournal={version:1;owner:string;runId:string;taskId:string;requestId?:string;snapshot:string;workspace:TaskWorkspace;path:string;commit:string;phase:'planned'|'checkout'|'ready'|'uncertain'|'archiving'|'archived';at:string;rootIdentity?:string;gitDirectory?:string;gitIdentity?:string;gitFileHash?:string;resolution?:Resolution;error?:string;maintenance?:string;reviewedRequest?:string;sourcePaths?:string[]};
type Journal=ScheduledWorkspaceJournal;
export type RetainedWorkspace={journal:Journal;git?:{directory:string;identity:string;controlHash:string}};
type Guard=()=>Promise<void>;
type PackInput={file:string;start:number;end:number};
type BundleCommand=(args:string[],input?:PackInput)=>Promise<string>;

/** Keep new scheduled copies on the private profile's volume after relocation.
 * These are ordinary user workspaces; credentials/journals stay in Secrets. */
export function scheduledWorkspaceDirectory(profile:string,outputs:string){
 const windows=/^[a-z]:[\\/]/i.test(profile)&&/^[a-z]:[\\/]/i.test(outputs);
 if(windows&&path.win32.parse(profile).root.toLowerCase()!==path.win32.parse(outputs).root.toLowerCase())return path.win32.join(path.win32.parse(profile).root,'Sylvana-Chat','Scheduled workspaces',sha(path.win32.normalize(profile).toLowerCase()).slice(0,12));
 return path.join(outputs,'scheduled-workspaces');
}

/** Only the trusted scheduler supplies run scopes. Git output never grants file
 * access. Preparation uncertainty is retained, never deleted or replayed. */
export class ScheduledWorkspaces{
 private preparing=new Set<string>();
 constructor(private secrets:Pick<Secrets,'get'|'set'>&Partial<Pick<Secrets,'scheduledWorkspaceIds'>>,private files:FileHost,readonly directory:string,private executable?:string){}
 private key(owner:string,run:string){return 'scheduled-workspace:'+id(owner)+':'+id(run);}
 private bindings(owner:string,files:TaskFileBinding[]){const references=this.files.list(owner);for(const file of files)if(!references.some(ref=>ref.id===file.id&&ref.path===file.path&&ref.kind===file.kind&&ref.source!=='clipboard'))throw Error('A scheduled workspace grant was removed or changed.');}
 private async canonical(target:string,kind:'file'|'folder',metadata=false){
  if(!path.isAbsolute(target)||/[\0\r\n]/.test(target))throw Error('Invalid scheduled workspace path.');
  if(metadata)this.files.checkBackupPath(target);else this.files.checkPath(target);
  const stat=await lstat(target,{bigint:true});if(stat.isSymbolicLink()||!same(await realpath(target),target)||!(kind==='folder'?stat.isDirectory():stat.isFile()&&stat.nlink===1n))throw Error('A scheduled workspace path was linked or replaced.');
  return sha(JSON.stringify([path.normalize(target),stat.dev.toString(),stat.ino.toString(),stat.birthtimeNs.toString()]));
 }
 private async binary(source:string,context:TaskFileBinding[]){
  const candidates=this.executable?[this.executable]:(process.env.PATH??'').split(path.delimiter).filter(directory=>path.isAbsolute(directory)).map(directory=>path.join(directory,process.platform==='win32'?'git.exe':'git'));
  for(const candidate of candidates){
   if(!path.isAbsolute(candidate)||within(source,candidate)||context.some(file=>file.kind==='folder'&&within(file.path,candidate)))continue;
   try{const actual=await realpath(candidate),stat=await lstat(actual);if(!stat.isFile()||stat.isSymbolicLink()||within(source,actual)||context.some(file=>file.kind==='folder'&&within(file.path,actual)))continue;return actual;}catch(error){if(!['ENOENT','ENOTDIR'].includes((error as NodeJS.ErrnoException).code??''))throw Error('The installed Git executable could not be verified.');}
  }
  throw Error('Git is unavailable. Install Git or choose local project execution.');
 }
 private environment(){
  const env={...process.env};for(const key of Object.keys(env))if(/^GIT_/i.test(key)||/^(SSH_ASKPASS|EDITOR|VISUAL)$/i.test(key))delete env[key];
  return {...env,GIT_CONFIG_NOSYSTEM:'1',GIT_CONFIG_SYSTEM:process.platform==='win32'?'NUL':'/dev/null',GIT_CONFIG_GLOBAL:process.platform==='win32'?'NUL':'/dev/null',GIT_TERMINAL_PROMPT:'0',GIT_NO_LAZY_FETCH:'1',GIT_ALLOW_PROTOCOL:'',GIT_PROTOCOL_FROM_USER:'0',GIT_OPTIONAL_LOCKS:'0',GIT_LITERAL_PATHSPECS:'1',GIT_LFS_SKIP_SMUDGE:'1'};
 }
 private base(){return ['-c','core.longpaths=true','-c','core.hooksPath=/dev/null','-c','core.fsmonitor=false','-c','core.preferSymlinkRefs=false','-c','core.alternateRefsCommand=exit 0 #','-c','submodule.recurse=false','-c','protocol.allow=never','-c','maintenance.auto=false','-c','gc.auto=0','-c','core.symlinks=false','-c','core.sparseCheckout=false','-c','core.sparseCheckoutCone=false'];}
 private storage(common:string){return new WorkspaceGitStorage(common,file=>this.files.checkBackupPath(file),file=>{const absolute=path.resolve(file),root=path.parse(absolute).root,parts=absolute.slice(root.length).split(path.sep).filter(part=>part.toLowerCase()!=='.git');this.files.checkPath(path.join(root,...parts));});}
 private async git(binary:string,root:string,args:string[],signal?:AbortSignal,allowed=[0],filters:string[]=[],input?:{file:string;start:number;end:number}){
  signal?.throwIfAborted();
  const command=[...this.base(),...filters,'-C',root,...args],options={env:this.environment(),windowsHide:true,encoding:'utf8' as const,timeout:60000,maxBuffer:1024*1024,signal};
  try{
   if(!input)return (await execute(binary,command,options)).stdout;
   const stream=createReadStream(input.file,{start:input.start,end:input.end,signal});let child:ReturnType<typeof execFile>;
   const completed=new Promise<string>((resolve,reject)=>{child=execFile(binary,command,options,(error,stdout)=>error?reject(error):resolve(stdout));});
   try{const [output]=await Promise.all([completed,pipeline(stream,child!.stdin!,{signal})]);return output;}catch(error){stream.destroy();child!.kill();await completed.catch(()=>{});throw error;}
  }
  catch(error){signal?.throwIfAborted();const result=error as {code?:number;stdout?:string};if(typeof result.code==='number'&&allowed.includes(result.code))return result.stdout??'';const names=new Set(['init','config','bundle','index-pack','rev-parse','check-ref-format','symbolic-ref','worktree','status','reset','cat-file','update-ref']);throw Error('Git could not finish scheduled workspace '+(args.find(arg=>names.has(arg))??'operation')+'. Inspect the project or saved workspace before continuing.');}
 }
 private async ref(binary:string,root:string,ref:string,signal?:AbortSignal){
  if(ref!=='HEAD'){if(!/^refs\/(heads|remotes)\//.test(ref)||ref.length>1024||/[\0\r\n]/.test(ref))throw Error('Invalid saved Git reference.');await this.git(binary,root,['check-ref-format',ref],signal);}
  const commit=(await this.git(binary,root,['rev-parse','--verify','--end-of-options',ref+'^{commit}'],signal)).trim();if(!/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(commit))throw Error('The selected project has no available local commit.');return commit;
 }
 private async inspect(owner:string,source:TaskFileBinding,files:TaskFileBinding[],signal?:AbortSignal){
  this.bindings(owner,files);if(source.kind!=='folder'||files[0]?.id!==source.id)throw Error('Select the project root first for a scheduled worktree.');
  const sourceIdentity=await this.canonical(source.path,'folder'),binary=await this.binary(source.path,files);
  const root=(await this.git(binary,source.path,['rev-parse','--show-toplevel'],signal)).trim();if(!same(root,source.path))throw Error('Choose the repository root as the project folder before scheduling a worktree.');
  const commonDirectory=(await this.git(binary,source.path,['rev-parse','--path-format=absolute','--git-common-dir'],signal)).trim();
  this.files.checkPath(path.dirname(commonDirectory));const commonIdentity=await this.canonical(commonDirectory,'folder',true);
  const storage=this.storage(commonDirectory);await storage.verify(async()=>this.bindings(owner,files),signal);
  this.bindings(owner,files);if(await this.canonical(source.path,'folder')!==sourceIdentity)throw Error('The scheduled source folder changed while inspecting Git.');
  return {binary,commonDirectory,sourceIdentity,commonIdentity,storage};
 }
 async capture(owner:string,project:{reference_id:string|null},files:TaskFileBinding[],guard:Guard=async()=>{}):Promise<TaskWorkspace>{
  id(owner);await guard();const source=files[0];if(!source||source.id!==project.reference_id)throw Error('The selected project folder is unavailable.');const found=await this.inspect(owner,source,files);await guard();
  const remote=(await this.git(found.binary,source.path,['symbolic-ref','--quiet','refs/remotes/origin/HEAD'],undefined,[0,1])).trim(),branch=(await this.git(found.binary,source.path,['symbolic-ref','--quiet','HEAD'],undefined,[0,1])).trim(),ref=remote||branch||'HEAD';
  await this.ref(found.binary,source.path,ref);await guard();return taskWorkspace({mode:'worktree',source,sourceFiles:files,commonDirectory:found.commonDirectory,ref,sourceIdentity:found.sourceIdentity,commonIdentity:found.commonIdentity},files);
 }
 private async filters(binary:string,root:string,signal:AbortSignal){
  const keys=(await this.git(binary,root,['config','--null','--name-only','--get-regexp','^filter\..*\.(smudge|clean|process|required)$'],signal,[0,1])).split('\0').filter(Boolean),names=new Set<string>();
  for(const key of keys){const match=/^filter\.(.+)\.(smudge|clean|process|required)$/i.exec(key);if(!match||/[\0\r\n]/.test(key)||key.length>512||names.size>64)throw Error('The repository has unsupported checkout filter settings.');names.add(match[1]);}
  return [...names].flatMap(name=>['-c','filter.'+name+'.smudge=','-c','filter.'+name+'.clean=','-c','filter.'+name+'.process=','-c','filter.'+name+'.required=false']);
 }
 private async parent(target:string,guard:Guard,signal:AbortSignal){
  const absolute=path.resolve(target),parts=absolute.slice(path.parse(absolute).root.length).split(path.sep).filter(Boolean);let current=path.parse(absolute).root;
  for(const part of parts){signal.throwIfAborted();await guard();current=path.join(current,part);this.files.checkPath(current);try{await this.canonical(current,'folder');}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;await mkdir(current);await this.canonical(current,'folder');}}
 }
 private async identity(journal:Journal){
  const source=journal.workspace;
  try{if(await this.canonical(source.source.path,'folder')!==source.sourceIdentity||await this.canonical(source.commonDirectory,'folder',true)!==source.commonIdentity)throw Error('changed');}catch{throw Error('The original scheduled repository was removed, replaced or moved.');}
  if(!journal.rootIdentity||!journal.gitDirectory||!journal.gitIdentity||!journal.gitFileHash||await this.canonical(journal.path,'folder')!==journal.rootIdentity)throw Error('The prepared scheduled checkout was replaced.');
  const gitFile=path.join(journal.path,'.git');await this.canonical(gitFile,'file',true);if(sha(await readFile(gitFile))!==journal.gitFileHash||await this.canonical(journal.gitDirectory,'folder',true)!==journal.gitIdentity)throw Error('The prepared Git workspace metadata changed.');
 }
 async prepare(run:ScheduledRun,signal:AbortSignal,guard:Guard):Promise<Resolution>{
  const key=this.key(run.owner,run.id),workspace=run.snapshot.workspace;
  if(!workspace||run.status!=='starting'||run.requestCreatedAt||!run.workspaceStartedAt||workspace.resolved)throw Error('Start a new owned workspace reservation before Git preparation.');
  if(this.preparing.has(key))throw Error('This scheduled workspace is already being prepared. Inspect its saved run.');this.preparing.add(key);
  let journal:Journal|undefined;
  try{
   await guard();signal.throwIfAborted();taskWorkspace(workspace,run.snapshot.files);const source=workspace.source;
   const found=await this.inspect(run.owner,source,workspace.sourceFiles,signal);
   if(!workspace.sourceIdentity||!workspace.commonIdentity||!same(found.commonDirectory,workspace.commonDirectory)||found.sourceIdentity!==workspace.sourceIdentity||found.commonIdentity!==workspace.commonIdentity)throw Error('The saved repository was replaced or its Git metadata moved. Review the task.');
   const snapshot=sha(JSON.stringify(run.snapshot)),destination=path.join(this.directory,id(run.owner),id(run.id));
   if(within(source.path,destination)||within(destination,source.path))throw Error('A scheduled checkout cannot overlap its source folder.');
   journal=this.secrets.get<Journal>(key);
   if(journal){
    if(journal.version!==1||journal.owner!==run.owner||journal.runId!==run.id||journal.taskId!==run.taskId||journal.snapshot!==snapshot||!same(journal.path,destination)||journal.phase!=='ready'||!journal.resolution)throw Error('Earlier workspace preparation needs inspection; it was not repeated.');
    await this.identity(journal);this.bindings(run.owner,[...workspace.sourceFiles,...journal.resolution.files]);const filters=await this.filters(found.binary,destination,signal);
    if((await this.git(found.binary,destination,['rev-parse','HEAD'],signal)).trim()!==journal.commit||(await this.git(found.binary,destination,['status','--porcelain=v1','--untracked-files=normal'],signal,[0],filters)).trim())throw Error('The prepared workspace contains work. Inspect it before continuing.');
    await guard();signal.throwIfAborted();return structuredClone(journal.resolution);
   }
   const commit=await this.ref(found.binary,source.path,workspace.ref,signal),filters=await this.filters(found.binary,source.path,signal);
   try{await lstat(destination);throw Error('The scheduled checkout location is already occupied.');}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}
   journal={version:1,owner:run.owner,runId:run.id,taskId:run.taskId,...(run.requestId?{requestId:id(run.requestId)}:{}),snapshot,workspace:structuredClone(workspace),path:destination,commit,phase:'planned',at:new Date().toISOString()};
   await guard();signal.throwIfAborted();await this.secrets.set(key,journal);
   await this.parent(path.dirname(destination),guard,signal);await guard();signal.throwIfAborted();await mkdir(destination);
   journal={...journal,rootIdentity:await this.canonical(destination,'folder')};await this.secrets.set(key,journal);await guard();signal.throwIfAborted();
   await found.storage.verify(guard,signal);await this.git(found.binary,source.path,['worktree','add','--detach','--no-checkout','--lock','--reason','Sylvana scheduled run '+run.id,destination,commit],signal,[0],filters);
   journal={...journal,phase:'checkout'};await this.secrets.set(key,journal);await guard();signal.throwIfAborted();
   if(await this.canonical(destination,'folder')!==journal.rootIdentity||!same((await this.git(found.binary,destination,['rev-parse','--show-toplevel'],signal)).trim(),destination)||!same((await this.git(found.binary,destination,['rev-parse','--path-format=absolute','--git-common-dir'],signal)).trim(),workspace.commonDirectory))throw Error('Git did not bind the new checkout to its reserved folder.');
   const checkoutFilters=await this.filters(found.binary,destination,signal);
   await found.storage.verify(guard,signal);await this.git(found.binary,destination,['reset','--hard',commit],signal,[0],checkoutFilters);await guard();signal.throwIfAborted();
   const rootIdentity=await this.canonical(destination,'folder'),gitFile=path.join(destination,'.git');if(rootIdentity!==journal.rootIdentity)throw Error('The scheduled checkout was replaced during preparation.');await this.canonical(gitFile,'file',true);
   const gitFileHash=sha(await readFile(gitFile)),gitDirectory=(await this.git(found.binary,destination,['rev-parse','--absolute-git-dir'],signal)).trim(),common=(await this.git(found.binary,destination,['rev-parse','--path-format=absolute','--git-common-dir'],signal)).trim();
   if(!same(common,workspace.commonDirectory)||!within(path.join(common,'worktrees'),gitDirectory)||(await this.git(found.binary,destination,['rev-parse','HEAD'],signal)).trim()!==commit)throw Error('Git created a workspace with another identity.');
   const gitIdentity=await this.canonical(gitDirectory,'folder',true);const mapped:TaskFileBinding[]=[];
   for(const original of workspace.sourceFiles){
    if(!within(source.path,original.path)){mapped.push({...original});continue;}
    const target=path.join(destination,path.relative(source.path,original.path));await this.canonical(target,original.kind);await guard();signal.throwIfAborted();
    const attached=await this.files.attach(run.owner,[{path:target}],guard),selected=attached.references.find(ref=>attached.selected.includes(ref.id)&&same(ref.path,target)&&ref.kind===original.kind);if(!selected||workspace.sourceFiles.some(file=>file.id===selected.id))throw Error('The new checkout attachment could not be verified.');mapped.push({id:selected.id,path:selected.path,kind:selected.kind});
   }
   const resolution:Resolution={files:mapped,resolved:{runId:run.id,path:destination,commit}};taskWorkspace({...workspace,resolved:resolution.resolved},mapped);
   journal={...journal,rootIdentity,gitDirectory,gitIdentity,gitFileHash,resolution,phase:'ready'};await this.identity(journal);await found.storage.verify(guard,signal);this.bindings(run.owner,[...workspace.sourceFiles,...mapped]);await guard();signal.throwIfAborted();await this.secrets.set(key,journal);return structuredClone(resolution);
  }catch(error){
   // A durable journal is authoritative even if a later credential write failed.
   // Never erase the checkout or the earlier marker to make a retry appear safe.
   if(journal&&this.secrets.get<Journal>(key)){await this.secrets.set(key,{...journal,phase:'uncertain',error:'Workspace preparation stopped. Inspect the retained checkout and run before continuing.'}).catch(()=>{});}
   throw error;
  }finally{this.preparing.delete(key);}
 }
 async validate(owner:string,snapshot:TaskSnapshot){
  const resolved=snapshot.workspace?.resolved;if(!resolved)return;
  const journal=this.secrets.get<Journal>(this.key(owner,resolved.runId));if(!journal||journal.phase!=='ready'||!journal.resolution||journal.commit!==resolved.commit||!same(journal.path,resolved.path)||JSON.stringify(journal.resolution.files)!==JSON.stringify(snapshot.files)||JSON.stringify(journal.workspace)!==JSON.stringify({...snapshot.workspace,resolved:undefined}))throw Error('The scheduled checkout journal or file scope is unavailable.');
  this.bindings(owner,[...snapshot.workspace!.sourceFiles,...snapshot.files]);await this.identity(journal);
 }
 retainedJournal(owner:string,run:string):Journal{
  const journal=this.secrets.get<Journal>(this.key(owner,run));
  if(!journal||journal.version!==1||journal.owner!==owner||journal.runId!==run||!['planned','checkout','ready','uncertain','archiving','archived'].includes(journal.phase)||!same(journal.path,path.join(this.directory,id(owner),id(run)))||!(/^[a-f0-9]{64}$/).test(journal.snapshot))throw Error('This retained workspace is unavailable for your account.');
  id(journal.taskId);if(journal.requestId)id(journal.requestId);taskWorkspace(journal.workspace,journal.workspace.sourceFiles);
  return structuredClone(journal);
 }
 retained(owner:string){
  id(owner);if(!this.secrets.scheduledWorkspaceIds)throw Error('Retained workspace discovery is unavailable.');
  return this.secrets.scheduledWorkspaceIds(owner).map(run=>this.retainedJournal(owner,run));
 }
 /** Inspection does not attach files, run Git, or depend on a schedule that may
  * already have been deleted. Ownership comes from the encrypted journal and
  * exact managed path plus the directory identity saved before preparation. */
 async inspectRetained(owner:string,run:string,guard:Guard):Promise<RetainedWorkspace>{
  await guard();const journal=this.retainedJournal(owner,run);
  if(!journal.rootIdentity||await this.canonical(journal.path,'folder')!==journal.rootIdentity)throw Error('The retained workspace directory was replaced or its ownership is unconfirmed.');
  await storageDirectory(journal.path);const control=path.join(journal.path,'.git');
  try{await lstat(control);}catch(error){
   if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;
   if(journal.gitDirectory||journal.gitFileHash||journal.phase==='ready')throw Error('The retained workspace Git control file is missing. Keep it for inspection.');
   // A half-written registration must not be mistaken for a plain empty copy.
   const {readdir}=await import('node:fs/promises');
   const parent=path.join(journal.workspace.commonDirectory,'worktrees');
   try{await storageDirectory(parent);const names=await readdir(parent);if(names.length>10000)throw Error('Review the repository worktree registrations manually.');for(const name of names){const directory=path.join(parent,name);await this.canonical(directory,'folder',true);const pointer=path.join(directory,'gitdir');try{await this.canonical(pointer,'file',true);}catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')continue;throw error;}const info=await lstat(pointer);if(info.size>4096)throw Error('Invalid worktree registration.');if(same((await readFile(pointer,'utf8')).trim(),control))throw Error('A partial Git registration remains without its control file. Keep it for inspection.');}}
   catch(problem){if((problem as NodeJS.ErrnoException).code!=='ENOENT')throw problem;}
   await guard();return {journal};
  }
  await this.canonical(control,'file',true);if((await lstat(control)).size>4096)throw Error('The retained Git control file is invalid.');
  const contents=await readFile(control,'utf8'),match=/^gitdir: ([^\r\n]+)\r?\n?$/.exec(contents);
  if(!match)throw Error('The retained Git control file is invalid.');
  const directory=path.resolve(journal.path,match[1]),parent=path.join(journal.workspace.commonDirectory,'worktrees');
  if(!same(path.dirname(directory),parent)||journal.gitDirectory&&!same(journal.gitDirectory,directory))throw Error('The retained Git metadata left its owned worktree registration.');
  if(await this.canonical(journal.workspace.commonDirectory,'folder',true)!==journal.workspace.commonIdentity)throw Error('The retained repository metadata was replaced.');
  const identity=await this.canonical(directory,'folder',true),controlHash=sha(contents);
  if(journal.gitIdentity&&journal.gitIdentity!==identity||journal.gitFileHash&&journal.gitFileHash!==controlHash)throw Error('The retained Git registration was replaced.');
  for(const name of ['gitdir','commondir']){const file=path.join(directory,name);await this.canonical(file,'file',true);if((await lstat(file)).size>4096)throw Error('Invalid worktree metadata pointer.');}
  if(!same((await readFile(path.join(directory,'gitdir'),'utf8')).trim(),control)||!same(path.resolve(directory,(await readFile(path.join(directory,'commondir'),'utf8')).trim()),journal.workspace.commonDirectory))throw Error('The retained worktree has another Git registration.');
  await guard();if(await this.canonical(journal.path,'folder')!==journal.rootIdentity)throw Error('The retained workspace changed during inspection.');return {journal,git:{directory,identity,controlHash}};
 }
 /** Only internal maintenance supplies commands and the private copy location.
  * Every command revalidates the owned directory and Git registration. */
 async recoveryCommands(owner:string,run:string,copy:string,guard:Guard,signal:AbortSignal):Promise<GitRecoveryCommand>{
  const expected=await this.inspectRetained(owner,run,guard);if(!expected.git)throw Error('This partial workspace has no Git registration.');
  const storage=this.storage(expected.journal.workspace.commonDirectory);await storage.verify(guard,signal);
  const binary=await this.binary(expected.journal.path,[...expected.journal.workspace.sourceFiles,{id:run,path:copy,kind:'folder'}]);
  await storageDirectory(copy);const initial=await lstat(copy,{bigint:true}),copyIdentity=sha([initial.dev,initial.ino,initial.birthtimeNs].join(':'));
  return async(args,options={})=>{
   await guard();signal.throwIfAborted();const current=await this.inspectRetained(owner,run,guard);
   await storage.verify(guard,signal);
   if(JSON.stringify(current)!==JSON.stringify(expected))throw Error('The reviewed workspace identity changed.');
   await storageDirectory(copy);const info=await lstat(copy,{bigint:true});if(sha([info.dev,info.ino,info.birthtimeNs].join(':'))!==copyIdentity)throw Error('The private recovery directory changed.');
   const env:NodeJS.ProcessEnv={...this.environment(),GIT_AUTHOR_NAME:'Sylvana recovery',GIT_AUTHOR_EMAIL:'recovery@sylvana.invalid',GIT_COMMITTER_NAME:'Sylvana recovery',GIT_COMMITTER_EMAIL:'recovery@sylvana.invalid'};
   if(options.input&&Buffer.byteLength(options.input)>64*1024**2)throw Error('Git recovery input exceeds its bounded limit.');
   if(options.indexFile!==undefined){if(!same(options.indexFile,path.join(copy,'index.bin'))||!options.gitDirectory||!same(options.gitDirectory,copy))throw Error('Only the private recovery index can be inspected.');for(const name of ['HEAD','index.bin','commondir'])await recoveryFile(path.join(copy,name),guard,signal);if(!same((await readFile(path.join(copy,'commondir'),'utf8')).trim().replaceAll('/',path.sep),expected.journal.workspace.commonDirectory))throw Error('The private recovery common-directory pointer changed.');env.GIT_INDEX_FILE='index.bin';env.GIT_DIR='.';env.GIT_WORK_TREE=expected.journal.path;}
   else if(options.gitDirectory!==undefined)throw Error('Invalid private Git recovery directory.');
   const filters=await this.filters(binary,expected.journal.path,signal);
   const output=await new Promise<string>((resolve,reject)=>{
    const child=execFile(binary,['--no-replace-objects',...this.base(),'-c','core.longpaths=true','-c','commit.gpgSign=false',...filters,'-C',options.gitDirectory?copy:expected.journal.path,...args],{env,windowsHide:true,encoding:'utf8',timeout:60000,maxBuffer:64*1024**2,signal},(error,stdout)=>error?reject(Error('Git could not complete recovery '+(args[0]==='-c'?args[2]:args[0])+'. Keep the workspace and inspect its saved recovery.')):resolve(stdout));
    child.stdin?.on('error',error=>{if((error as NodeJS.ErrnoException).code!=='EPIPE')reject(error);});child.stdin?.end(options.input??'');
   });
   await guard();signal.throwIfAborted();return output;
  };
 }
 async verifyStorage(owner:string,run:string,guard:Guard,signal:AbortSignal){const retained=await this.inspectRetained(owner,run,guard);if(retained.git)await this.storage(retained.journal.workspace.commonDirectory).verify(guard,signal);}
 /** A completed restored copy must remain independent before a portable
  * backup can rely on copying its Git tree without its former source repo. */
 async verifyStandalone(owner:string,run:string,root:string,guard:Guard,signal:AbortSignal){
  const journal=this.retainedJournal(owner,run);if(path.dirname(root)!==path.join(this.directory,id(owner))||!/^restored-[a-f0-9]{24}$/i.test(path.basename(root)))throw Error('Use an owned restored workspace for independent Git verification.');
  const control=path.join(root,'.git');try{await lstat(control);}catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')return;throw error;}
  const identity=await this.canonical(root,'folder'),gitIdentity=await this.canonical(control,'folder',true),storage=new WorkspaceGitStorage(control,file=>{if(!within(control,file))throw Error('The restored repository uses an external Git object path. Keep it until independent recovery is verified.');},undefined,false),binary=await this.binary(root,journal.workspace.sourceFiles);
  const check=async()=>{await guard();signal.throwIfAborted();if(await this.canonical(root,'folder')!==identity||await this.canonical(control,'folder',true)!==gitIdentity)throw Error('The restored repository was replaced.');for(const name of ['commondir','gitdir'])try{await lstat(path.join(control,name));throw Error('The restored repository depends on external Git metadata. Keep it until its independent recovery is verified.');}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}await storage.verify(guard,signal);};
  await check();const top=(await this.git(binary,root,['rev-parse','--path-format=absolute','--show-toplevel'],signal)).trim(),common=(await this.git(binary,root,['rev-parse','--path-format=absolute','--git-common-dir'],signal)).trim();if(!same(top,root)||!same(common,control))throw Error('The restored repository depends on an external working or Git metadata directory. Keep it until independent recovery is verified.');await this.git(binary,root,['--no-replace-objects','fsck','--full','--no-dangling','--no-progress'],signal);await check();
 }
 private async importBundle(root:string,directory:''|'.git',bundle:string,head:string,command:BundleCommand,guard:Guard,signal:AbortSignal,expected?:GitRecoveryValidationInput){
  const before=await recoveryFile(bundle,guard,signal);if(expected&&expected.bundleSha256!==before.sha256)throw Error('The independent recovery bundle checksum changed.');
  // Stream the verified private file: Git for Windows 2.56 cannot open some
  // long bundle paths itself, even with core.longpaths enabled.
  const pack=await workspaceBundlePack(bundle,head.length===64?32:20,guard,signal),prefix=(directory?directory+'/':'')+'objects/pack/pack-'+pack.checksum;
  // bundle verify reads only the header. Supplying its exact range avoids a
  // broken pipe when Git finishes before a large pack has been streamed.
  await command(['bundle','verify','-'],{file:bundle,start:0,end:pack.start-1});
  if(expected&&(pack.commit!==expected.commit||pack.reference!==expected.reference||head!==expected.head))throw Error('The independent recovery bundle describes another workspace.');
  for(const suffix of ['.pack','.idx','.rev'])try{await lstat(path.join(root,prefix+suffix));throw Error('The recovery pack destination is occupied. Keep this partial copy for inspection.');}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}
  // Supplying explicit names avoids the observed long-path finalization bug
  // in Git for Windows 2.48, while Git verifies the streamed pack itself.
  const imported=await command(['index-pack','--stdin','--no-rev-index','--check-self-contained-and-connected','-o',prefix+'.idx',prefix+'.pack'],pack);
  if(imported.trim()!=='pack\t'+pack.checksum)throw Error('Git did not verify the expected independent recovery pack.');
  await command(['cat-file','-e',pack.commit+'^{commit}']);await command(['cat-file','-e',head+'^{commit}']);
  await command(['fsck','--connectivity-only','--no-reflogs','--no-dangling','--no-progress',pack.commit,head]);
  if((await recoveryFile(bundle,guard,signal)).sha256!==before.sha256)throw Error('The independent recovery bundle changed during verification.');return {pack,bundleSha256:before.sha256};
 }
 /** Verify in a new bare repository with no source/common-dir pointers or
  * alternates. The owned private scratch is removed only after success. */
 async verifyRecoveryBundle(owner:string,run:string,copy:string,proof:GitRecoveryValidationInput,guard:Guard,signal:AbortSignal):Promise<GitRecoveryValidation>{
  const expected=await this.inspectRetained(owner,run,guard);if(!expected.git||!same(proof.bundle,path.join(copy,'history.bundle'))||!/^([a-f0-9]{40}|[a-f0-9]{64})$/.test(proof.head))throw Error('Use the owned private Git recovery bundle.');
  const binary=await this.binary(expected.journal.path,[...expected.journal.workspace.sourceFiles,{id:run,path:copy,kind:'folder'}]);await storageDirectory(copy);
  const privateIdentity=async(root:string)=>{await storageDirectory(root);const info=await lstat(root,{bigint:true});return sha([info.dev,info.ino,info.birthtimeNs].join(':'));},copyIdentity=await privateIdentity(copy),directory=path.join(copy,'v');await guard();signal.throwIfAborted();await mkdir(directory);const identity=await privateIdentity(directory);let storage:WorkspaceGitStorage|undefined;
  const check=async()=>{
   await guard();signal.throwIfAborted();if(await privateIdentity(copy)!==copyIdentity||await privateIdentity(directory)!==identity)throw Error('The independent recovery directory changed.');
   if(JSON.stringify(await this.inspectRetained(owner,run,guard))!==JSON.stringify(expected))throw Error('The owned workspace changed during independent recovery verification.');
   for(const name of ['commondir','gitdir'])try{await lstat(path.join(directory,name));throw Error('The independent recovery repository gained an external pointer.');}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}
   await storage?.verify(guard,signal);
  };
  const command:BundleCommand=async(args,input)=>{await check();if(input&&(input.file!==proof.bundle||input.start<0||input.start>65536||input.end<input.start))throw Error('Invalid independent recovery pack range.');return this.git(binary,directory,['--git-dir=.','--bare','-c','core.longpaths=true',...args],signal,[0],[],input);};
  await command(['init','--bare','--template=','--object-format='+(proof.head.length===64?'sha256':'sha1')]);
  storage=new WorkspaceGitStorage(directory,file=>{if(!within(directory,file))throw Error('The independent Git path left its private repository.');},undefined,false);await command(['config','core.longpaths','true']);
  await check();const policy=await installGitRecoveryPolicy(directory,proof.policy,proof.head.length,guard,signal);
  const result=await this.importBundle(directory,'',proof.bundle,proof.head,command,guard,signal,proof);
  // Inventory rejects links/special files; only this exact, newly created
  // child with its original directory identity is eligible for cleanup.
  await workspaceRecoveryInventory(directory,guard,signal);await check();if(path.dirname(directory)!==copy||path.basename(directory)!=='v'||!within(copy,directory))throw Error('The independent scratch left its owned parent.');await guard();await rm(directory,{recursive:true,force:false});
  return {version:1,bundleSha256:result.bundleSha256,head:proof.head,commit:proof.commit,reference:proof.reference,packChecksum:result.pack.checksum,policySha256:gitRecoveryPolicyId(policy),at:new Date().toISOString()};
 }
 /** Restore into a new local repository without checking out over recovered
  * working files or copying hooks/configuration from the old Git directory. */
 async restoreRepository(owner:string,run:string,root:string,privateCopy:string,head:string,hasIndex:boolean,guard:Guard,signal:AbortSignal,policy:GitRecoveryPolicy={}){
  const journal=this.retainedJournal(owner,run);
  if(path.dirname(root)!==path.join(this.directory,id(owner))||!/^restored-[a-f0-9]{24}$/i.test(path.basename(root))||!/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(head))throw Error('Invalid restored workspace scope.');
  const identity=await this.canonical(root,'folder');await storageDirectory(root);await storageDirectory(privateCopy);
  try{await lstat(path.join(root,'.git'));throw Error('The restored repository destination is occupied.');}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}
  const binary=await this.binary(root,[...journal.workspace.sourceFiles,{id:run,path:privateCopy,kind:'folder'}]);
  const bundle=path.join(privateCopy,'history.bundle'),bundleIdentity=async()=>{await storageDirectory(privateCopy);const info=await lstat(bundle,{bigint:true});if(!info.isFile()||info.isSymbolicLink()||info.nlink!==1n||!same(await realpath(bundle),bundle))throw Error('The private recovery bundle was linked or replaced.');return sha([info.dev,info.ino,info.birthtimeNs,info.size,info.mtimeNs,info.ctimeNs].join(':'));},savedBundle=await bundleIdentity();
  let gitIdentity:string|undefined,storage:WorkspaceGitStorage|undefined;
  const command=async(args:string[],input?:{file:string;start:number;end:number})=>{await guard();signal.throwIfAborted();if(await this.canonical(root,'folder')!==identity)throw Error('The restored workspace was replaced.');if(await bundleIdentity()!==savedBundle)throw Error('The private recovery bundle changed.');if(input&&(input.file!==bundle||!Number.isSafeInteger(input.start)||input.start<0||input.start>65536||!Number.isSafeInteger(input.end)||input.end<input.start))throw Error('Invalid private recovery pack range.');if(gitIdentity){if(await this.canonical(path.join(root,'.git'),'folder',true)!==gitIdentity)throw Error('The restored Git directory was replaced.');for(const name of ['commondir','gitdir'])try{await lstat(path.join(root,'.git',name));throw Error('The restored Git directory gained an external pointer.');}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}await storage!.verify(guard,signal);}return this.git(binary,root,['--no-replace-objects','--git-dir=.git','--work-tree=.','-c','core.longpaths=true',...args],signal,[0],[],input);};
  await command(['init','--template=','--initial-branch=recovered','--object-format='+(head.length===64?'sha256':'sha1')]);gitIdentity=await this.canonical(path.join(root,'.git'),'folder',true);storage=new WorkspaceGitStorage(path.join(root,'.git'),file=>this.files.checkBackupPath(file),undefined,false);
  await command(['config','core.longpaths','true']);
  await guard();await installGitRecoveryPolicy(path.join(root,'.git'),policy,head.length,guard,signal);
  const {pack}=await this.importBundle(root,'.git',bundle,head,command,guard,signal);
  // Git for Windows can read this repository yet fail its loose-ref write at
  // longer paths even with core.longpaths. This is a new, independently owned
  // repository: create its verified recovery reference in the standard packed
  // file with exclusive creation, then require Git to resolve the exact object.
  await command(['cat-file','-e',pack.commit+'^{commit}']);await guard();signal.throwIfAborted();
  if(await this.canonical(path.join(root,'.git'),'folder',true)!==gitIdentity)throw Error('The restored Git directory changed.');
  await writeFile(path.join(root,'.git','packed-refs'),'# pack-refs with: peeled fully-peeled sorted\n'+pack.commit+' refs/sylvana/restored\n',{flag:'wx',mode:0o600});
  if((await command(['rev-parse','--verify','refs/sylvana/restored^{commit}'])).trim()!==pack.commit)throw Error('The restored recovery reference did not verify.');
  await command(['cat-file','-e',head+'^{commit}']);
  // The destination is a new, exclusively owned repository. Git 2.56 rejects
  // the null-old-value form while its initial symbolic HEAD is still dangling.
  if((await command(['symbolic-ref','HEAD'])).trim()!=='refs/heads/recovered')throw Error('The initial restored HEAD changed.');
  await command(['update-ref','--no-deref','HEAD',head]);
  if(hasIndex){await guard();await recoveryFile(path.join(privateCopy,'index.bin'),guard,signal);if(await this.canonical(path.join(root,'.git'),'folder',true)!==gitIdentity)throw Error('The restored Git directory changed.');await copyFile(path.join(privateCopy,'index.bin'),path.join(root,'.git','index'),constants.COPYFILE_EXCL);}
  await guard();signal.throwIfAborted();if(await this.canonical(root,'folder')!==identity)throw Error('The restored workspace changed.');
 }
}
