import React,{useContext} from 'react';
import {CalendarClock} from 'lucide-react';
import cronstrue from 'cronstrue';
import type {ToolApproval} from '../src/tool-contracts';
import {WorkspaceLinks} from './WorkspaceLinks';
import './scheduled-task-review.css';

export function ScheduledTaskReview({approval}:{approval:ToolApproval}){
 const args=approval.arguments,value=(key:string)=>typeof args[key]==='string'?args[key] as string:'',cadence=args.cadence as {kind?:string;at?:string;minutes?:number;expression?:string;timezone?:string}|undefined;
 let when='';if(cadence?.kind==='once'&&cadence.at)when=new Date(cadence.at).toLocaleString();else if(cadence?.kind==='interval')when='Every '+cadence.minutes+' minutes after saving';else if(cadence?.kind==='cron'&&cadence.expression){try{when=cronstrue.toString(cadence.expression);}catch{when=cadence.expression;}when+=' · '+cadence.timezone;}
 const permission=({ask:'Default permissions',full:'Full access',files:'Selected files',chat:'Chat only'} as Record<string,string>)[value('permissions')]??value('permissions'),files=Array.isArray(args.context)?args.context as Array<{id:string;path:string;kind:string}>:[];
 const execution=value('execution')||'Local project';
 return <section className="scheduled-tool-review" aria-label="Scheduled task review"><dl><div><dt>When</dt><dd>{when}</dd></div><div><dt>Status after approval</dt><dd>{({active:'Enabled',paused:'Paused',deleted:'Deleted'} as Record<string,string>)[value('status')]??value('status')}</dd></div>{value('status')==='active'&&value('next_at')&&<div><dt>Next time (preview)</dt><dd>{new Date(value('next_at')).toLocaleString()}</dd></div>}<div><dt>Destination</dt><dd>{value('destination')}</dd></div><div><dt>Execution</dt><dd>{execution}{value('git_ref')?' · '+value('git_ref'):''}</dd></div><div><dt>AI service level</dt><dd>{value('model')==='advanced'?'Max':'Standard'}</dd></div><div><dt>Thinking</dt><dd>{value('thinking')}</dd></div><div><dt>Permissions</dt><dd>{permission}</dd></div><div><dt>Mode</dt><dd>{value('mode')==='plan'?'Plan':'Work'}</dd></div><div><dt>Missed runs</dt><dd>{value('missed')==='latest'?'Run the latest missed occurrence once':'Skip missed runs'}</dd></div></dl><div className="scheduled-review-instructions" role="region" aria-label="Scheduled instructions" tabIndex={0}>{value('instructions')}</div>{!!files.length&&<details><summary>{files.length} {files.length===1?'file or folder':'files or folders'} in scope</summary><ul>{files.map(file=><li key={file.id} title={file.path}>{file.path}</li>)}</ul></details>}{['tools','skills','shared_windows'].some(key=>Array.isArray(args[key])&&(args[key] as unknown[]).length>0)&&<details><summary>Saved tools, skills and shared windows</summary>{['tools','skills','shared_windows'].map(key=>Array.isArray(args[key])&&(args[key] as unknown[]).length>0?<p key={key}>{key.replaceAll('_',' ')}: {(args[key] as string[]).join(', ')}</p>:null)}</details>}<p className="hint">{approval.description}</p>{approval.schedule?.action==='delete'&&<p>Pending and running assignments for this task will stop. Saved chats remain available.</p>}</section>;
}

export function ScheduledTaskReceipt({result}:{result:any}){
 const workspace=useContext(WorkspaceLinks),task=result.task;
 return <div className="scheduled-tool-receipt"><strong>{task.name}</strong><p>{task.status}{task.next_at&&task.status==='active'?' · Next: '+new Date(task.next_at).toLocaleString():''}</p><p className="hint">{result.notice}</p>{workspace.scheduled&&<button type="button" className="subtle-link" onClick={()=>workspace.scheduled?.()}><CalendarClock size={14}/>Manage scheduled tasks</button>}</div>;
}
