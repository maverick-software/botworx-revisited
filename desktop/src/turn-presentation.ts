import {diffLines} from 'diff';
import type {ToolActivity,ToolPreview} from './tool-contracts';
import type {NativeState} from './native-contracts';
import type {ResponseFileChange} from './response-file-contracts';
import {nativeChanges} from './native-change-presentation';

export type TurnTiming={requestId:string;startedAt:string;finishedAt?:string};
export type ChangedFile={key:string;path:string;referenceId:string;relativePath:string;before:string|null;after:string;tools:ToolActivity[];added:number|null;removed:number|null};
export const changedFileCount=(files:ChangedFile[])=>new Set(files.map(file=>file.path.replace(/\\/g,'/').toLowerCase())).size;

export function elapsedLabel(timing:TurnTiming|undefined,now:number):string|undefined{
 if(!timing)return;
 const start=Date.parse(timing.startedAt),finish=timing.finishedAt?Date.parse(timing.finishedAt):now;
 if(!Number.isFinite(start)||!Number.isFinite(finish)||finish<start)return;
 const seconds=Math.floor((finish-start)/1000),minutes=Math.floor(seconds/60),hours=Math.floor(minutes/60);
 return hours?`${hours}h ${minutes%60}m`:minutes?`${minutes}m ${seconds%60}s`:`${seconds}s`;
}

export function changedFiles(activities:ToolActivity[]):ChangedFile[]{
 const files=new Map<string,{preview:ToolPreview;tools:ToolActivity[];after:string}>();
 const latest=new Map<string,string>();
 for(const tool of activities){
  if(tool.name!=='write_file'||tool.status!=='completed'||!tool.preview)continue;
  const preview=tool.preview,key=preview.path.replace(/\\/g,'/').toLowerCase();
  const previous=files.get(latest.get(key)??key);
  // Only combine a consecutive, verified chain. A later independent edit needs its own review.
  const last=previous?.tools.at(-1)?.preview;
  if(previous&&last?.afterHash===preview.beforeHash){previous.tools.push(tool);previous.after=preview.after;}
  else {const unique=previous?key+':'+tool.id:key;files.set(unique,{preview,tools:[tool],after:preview.after});latest.set(key,unique);}
 }
 return [...files.entries()].filter(([,file])=>file.preview.before!==file.after).map(([key,{preview,tools,after}])=>{
  const diff=diffLines(preview.before??'',after,{timeout:100,maxEditLength:8000});
  return {key,path:preview.path,referenceId:preview.referenceId,relativePath:preview.relativePath,before:preview.before,after,tools,added:diff?diff.reduce((n,part)=>n+(part.added?part.count??0:0),0):null,removed:diff?diff.reduce((n,part)=>n+(part.removed?part.count??0:0),0):null};
 });
}

export function undoableEdits(activities:ToolActivity[]):ToolActivity[]{
 const visible=new Set(changedFiles(activities).flatMap(file=>file.tools.map(tool=>tool.id)));
 return activities.filter(tool=>visible.has(tool.id)||tool.name==='manage_file'&&tool.status==='completed'&&(tool.result as any)?.changed===true&&(tool.result as any)?.kind==='file'&&typeof (tool.result as any)?.operation_id==='string').slice().reverse();
}

/** Verified working-folder observations and durable file-operation receipts. */
export function observedFileChanges(state:NativeState|undefined,activities:ToolActivity[]):ResponseFileChange[]{
 const canonical=(value:string)=>value.replaceAll('\\','/').toLowerCase(),patched=new Set([...changedFiles(activities).map(f=>canonical(f.path)),...nativeChanges(state).flatMap(f=>[f.absoluteFrom,f.absoluteTo].filter((p):p is string=>!!p).map(canonical))]);
 const managed:ResponseFileChange[]=activities.flatMap(tool=>{
  const result=tool.result as any;if(tool.name!=='manage_file'||tool.status!=='completed'||!result?.changed||result.kind!=='file'||!['move','remove'].includes(result.action))return [];
  const relativePath=String(result.destination??result.path??tool.arguments.path??''),path=String(result.action==='move'?result.destination_absolute_path??relativePath:result.absolute_path??relativePath);
  return [{key:'operation:'+tool.id,path,relativePath,kind:result.action==='remove'?'deleted':'moved',before:null,after:null,beforeHash:null,afterHash:null,text:false,added:null,removed:null,referenceId:typeof tool.arguments.reference_id==='string'?tool.arguments.reference_id:undefined,operationId:result.operation_id,destination:result.destination}];
 });
 const reverted=new Set(activities.filter(t=>t.status==='reverted').flatMap(t=>t.preview?[canonical(t.preview.path)]:(t.result as any)?.absolute_path?[canonical((t.result as any).absolute_path)]:[]));
 const files=new Map<string,ResponseFileChange>();
 for(const current of [state,...(state?.reports??[]).map(r=>r.state)])for(const file of current?.workspaceChanges??[]){const key=canonical(file.path);if(!patched.has(key)&&!reverted.has(key))files.set(key,file);}
 for(const file of managed){const key=canonical(file.path);if(patched.has(key))continue;const observed=files.get(key);files.set(key,observed?{...observed,operationId:file.operationId,referenceId:file.referenceId}:file);}
 return [...files.values()];
}

export function turnLabel(status:string|undefined,elapsed:string|undefined,awaiting:boolean){
 // Recovery timestamps can include time while the app was closed.
 if(status==='interrupted')return 'Interrupted';
 const text=status==='running'?(awaiting?'Waiting for approval':'Working'):status==='cancelled'?'Stopped':status==='failed'?'Failed':status==='interrupted'?'Interrupted':'Worked';
 return text+(elapsed?(status==='running'?' · ':' for ')+elapsed:'');
}
