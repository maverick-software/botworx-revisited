import React from 'react';
import {Keyboard,MousePointer2,Move,ScrollText} from 'lucide-react';
import type {ToolApproval,ToolActivity} from '../src/tool-contracts';
import {ComputerApprovalPreview} from './ComputerApprovalPreview';

export function ComputerInputReview({approval,name,status,ready}:{approval:ToolApproval;name:string;status:ToolActivity['status'];ready:(value:boolean)=>void}){
 const awaiting=status==='awaiting_approval';
 const args=approval.arguments,kind=name.replace(/^computer_/,''),Icon=kind==='key'||kind==='type'?Keyboard:kind==='drag'?Move:kind==='scroll'?ScrollText:MousePointer2;
 const point=(x:unknown,y:unknown)=>typeof x==='number'&&typeof y==='number'&&Number.isFinite(x)&&Number.isFinite(y)?{x,y}:undefined;
 const start=point(args.x,args.y),end=kind==='drag'?point(args.to_x,args.to_y):undefined,points=start?[start,...(end?[end]:[])]:[];
 const button=args.button==='right'?'Right':args.button==='middle'?'Middle':'Left';
 const action=kind==='click'?(args.count===2?'Double click':button+' click'):kind==='type'?'Type text':kind==='key'?'Press keys':kind==='scroll'?'Scroll '+String(args.direction??''):kind==='drag'?'Drag':approval.tool;
 return <section className="computer-action-review" aria-label="Windows input review">
  <header><Icon size={17} aria-hidden="true"/><strong>{action}</strong><small>{approval.source}</small></header>
  <dl className="computer-review-context"><div><dt>Window</dt><dd title={String(args.window??'Shared window')}>{String(args.window??'Shared window')}</dd></div><div><dt>Target</dt><dd title={String(args.target??(start?'Marked location':'Current keyboard focus'))}>{String(args.target??(start?'Marked location':'Current keyboard focus'))}</dd></div></dl>
  {kind==='key'&&<div className="computer-review-key" aria-label="Keys to press"><kbd>{String(args.key??'')}</kbd></div>}
  {kind==='type'&&<div className="computer-review-text"><span>Exact text to type</span><pre tabIndex={0} aria-label="Exact text to type">{String(args.text??'')}</pre></div>}
  {(start||kind==='scroll'||kind==='click'&&args.count===2)&&<p className="computer-review-location">{start&&<span>{Math.round(start.x)}, {Math.round(start.y)}{end&&<> → {Math.round(end.x)}, {Math.round(end.y)}</>}</span>}{kind==='scroll'&&<span>{String(args.amount??'')} wheel {args.amount===1?'notch':'notches'}</span>}{kind==='click'&&args.count===2&&<span>{button} mouse button</span>}</p>}
  {awaiting&&approval.preview&&<ComputerApprovalPreview preview={approval.preview} points={points} ready={ready}/>}
  <p className="computer-review-consequence">{({awaiting_approval:'Sends input to this shared window. This can change or submit data.',running:'This input is in progress.',completed:'Recorded input for this turn. See the result below.',denied:'This input was declined.',interrupted:'This input was interrupted. Check the shared window before continuing.',failed:'This input did not finish. Check the shared window before continuing.',reverted:'This input is recorded as undone.'} as const)[status]}</p>
  <details className="computer-review-details"><summary>Technical details</summary><p>{approval.description}</p><pre className="tool-output" aria-label="Windows input arguments">{JSON.stringify(approval.arguments,null,2)}</pre></details>
 </section>;
}
