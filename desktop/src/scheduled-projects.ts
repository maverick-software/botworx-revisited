import path from 'node:path';
import type {TaskFileBinding,TaskProjectTarget,TaskSnapshot,TaskWorkspace} from './scheduled-task-contracts';

const object=(value:unknown):Record<string,unknown>=>{if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Invalid scheduled workspace record.');return value as Record<string,unknown>;};
const identifier=(value:unknown)=>{if(typeof value!=='string'||!/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(value))throw Error('Invalid scheduled project identifier.');return value;};
const revision=(value:unknown)=>{if(typeof value!=='number'||!Number.isSafeInteger(value)||value<1)throw Error('Invalid scheduled project revision.');return value;};
const windowsPath=(value:string)=>/^[a-z]:[\\/]|^[\\/]{2}[^\\/]+[\\/][^\\/]+/i.test(value);
const location=(value:unknown)=>{if(typeof value!=='string'||!value.trim()||value.length>32767||/[\0\r\n]/.test(value)||!path.posix.isAbsolute(value)&&!windowsPath(value))throw Error('Invalid scheduled workspace path.');return value;};
const flavor=(root:string)=>windowsPath(root)?path.win32:path.posix;
const samePath=(root:string,candidate:string)=>{const p=flavor(root),a=p.normalize(root),b=p.normalize(candidate);return p===path.win32?a.toLowerCase()===b.toLowerCase():a===b;};
const inside=(root:string,candidate:string)=>{const p=flavor(root),relative=p.relative(root,candidate);return relative===''||relative!=='..'&&!relative.startsWith('..'+p.sep)&&!p.isAbsolute(relative);};
const sameBinding=(a:TaskFileBinding,b:TaskFileBinding)=>a.id===b.id&&a.path===b.path&&a.kind===b.kind;
function bindings(value:unknown):TaskFileBinding[]{
 if(!Array.isArray(value)||value.length>20)throw Error('Choose up to twenty files or folders for each scheduled project.');
 const result=value.map(item=>{const row=object(item);if(row.kind!=='file'&&row.kind!=='folder')throw Error('Invalid scheduled workspace file kind.');return {id:identifier(row.id),path:location(row.path),kind:row.kind} as TaskFileBinding;});
 if(new Set(result.map(file=>file.id)).size!==result.length||result.some((file,index)=>result.slice(0,index).some(previous=>samePath(previous.path,file.path))))throw Error('A scheduled project repeats a file grant or path.');return result;
}

/** Parses saved metadata only. The execution host must independently check
 * ownership, revisions, canonical paths and actual Git identity before use. */
export function taskWorkspace(value:unknown,files:TaskFileBinding[]):TaskWorkspace{
 bindings(files);
 const row=object(value);if(row.mode!=='worktree')throw Error('Choose a supported scheduled workspace execution mode.');
 if((row.sourceIdentity!==undefined||row.commonIdentity!==undefined)&&[row.sourceIdentity,row.commonIdentity].some(value=>typeof value!=='string'||!/^[a-f0-9]{64}$/.test(value)))throw Error('Invalid scheduled Git directory identity.');
 const source=bindings([row.source])[0],sourceFiles=bindings(row.sourceFiles),commonDirectory=location(row.commonDirectory);
 if(source.kind!=='folder'||!sourceFiles.length||!sameBinding(source,sourceFiles[0]))throw Error('The worktree source must be the first selected project folder.');
 if(typeof row.ref!=='string'||row.ref.length>1024||/[\x00-\x20\x7f]/.test(row.ref)||row.ref!=='HEAD'&&!row.ref.startsWith('refs/heads/')&&!row.ref.startsWith('refs/remotes/'))throw Error('Choose a valid saved Git reference for the scheduled worktree.');
 let resolved:TaskWorkspace['resolved'];
 if(row.resolved!==undefined){
  const saved=object(row.resolved),root=location(saved.path);if(typeof saved.commit!=='string'||!/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(saved.commit))throw Error('Invalid scheduled worktree commit.');
  resolved={runId:identifier(saved.runId),path:root,commit:saved.commit};
  if(inside(source.path,root)||inside(root,source.path))throw Error('A worktree checkout must not overlap the original project folder.');
  if(files.length!==sourceFiles.length||!files.length||files[0].kind!=='folder'||!samePath(root,files[0].path)||files[0].id===source.id)throw Error('The resolved worktree does not have its own first folder grant.');
  for(const original of sourceFiles){
   const contained=inside(source.path,original.path),expected=contained?flavor(root).join(root,flavor(source.path).relative(source.path,original.path)):original.path;
   if(!files.some(file=>file.kind===original.kind&&samePath(expected,file.path)&&(contained?!sourceFiles.some(source=>source.id===file.id):sameBinding(file,original))))throw Error('A scheduled workspace binding escaped its resolved checkout or changed external context.');
  }
 }else if(!files.length||!sameBinding(files[0],source)||files.length!==sourceFiles.length||sourceFiles.some(file=>!files.some(current=>sameBinding(file,current))))throw Error('The scheduled worktree source grants changed.');
 return {mode:'worktree',source,sourceFiles,commonDirectory,ref:row.ref,...(resolved?{resolved}:{}),...(row.sourceIdentity===undefined?{}:{sourceIdentity:row.sourceIdentity as string,commonIdentity:row.commonIdentity as string})};
}

export function taskProjectTargets(value:unknown,commonFiles:TaskFileBinding[],permission:TaskSnapshot['options']['permission']):TaskProjectTarget[]{
 if(!Array.isArray(value)||!value.length||value.length>20)throw Error('Choose between one and twenty scheduled projects.');
 const targets=value.map(item=>{const row=object(item),files=bindings(row.files);if(commonFiles.some(file=>!files.some(current=>sameBinding(file,current))))throw Error('A scheduled project changed the shared context grants.');
  if(permission==='chat'&&files.length)throw Error('Chat only does not share scheduled project files.');
  const workspace=row.workspace===undefined?undefined:taskWorkspace(row.workspace,files);if(workspace?.resolved)throw Error('A task cannot save a previously resolved run workspace.');if(workspace&&permission==='chat')throw Error('Choose file access before using a scheduled worktree.');
  return {projectId:identifier(row.projectId),projectRevision:revision(row.projectRevision),files,...(workspace?{workspace}:{})};});
 if(new Set(targets.map(target=>target.projectId)).size!==targets.length)throw Error('Choose each scheduled project once.');return targets;
}

/** A project run receives exactly one project's bindings. Shared model,
 * permission and notification choices remain unchanged. */
export function expandScheduledProjects(snapshot:TaskSnapshot):TaskSnapshot[]{
 if(!snapshot.targets)return [snapshot];
 const {targets,workspace:unused,...common}=snapshot;
 return targets.map(target=>({...common,projectId:target.projectId,projectRevision:target.projectRevision,files:target.files.map(file=>({...file})),options:{...structuredClone(snapshot.options),files:target.files.map(file=>file.id)},...(target.workspace?{workspace:structuredClone(target.workspace)}:{})}));
}
