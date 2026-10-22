import React,{useEffect,useState} from 'react';
import type {ToolApproval} from '../src/tool-contracts';
import {call} from './ui';

export function ComputerApprovalPreview({preview,points=[],ready}:{preview:NonNullable<ToolApproval['preview']>;points?:Array<{x:number;y:number}>;ready:(value:boolean)=>void}){
 const [image,setImage]=useState(''),[error,setError]=useState('');
 useEffect(()=>{let live=true;ready(false);setImage('');setError('');void call<{image:string}>('computer.preview',{id:preview.snapshotId}).then(value=>{if(live)setImage(value.image);}).catch(failure=>{if(live)setError(failure.message);});return()=>{live=false;};},[preview.snapshotId,ready]);
 const {target,width,height}=preview;
 return <figure className="computer-input-preview">{error?<p role="alert" className="computer-error">{error}</p>:image?<div style={{maxWidth:Math.min(560,360*width/height)}}><img src={image} alt="Window snapshot for this input" onLoad={()=>ready(true)} onError={()=>{ready(false);setError('The input preview could not be displayed. Take a fresh snapshot.');}}/>{target&&<span className="computer-input-target" aria-hidden="true" style={{left:target.x/width*100+'%',top:target.y/height*100+'%',width:target.width/width*100+'%',height:target.height/height*100+'%'}}/>}{points.length===2&&<svg className="computer-drag-path" viewBox={'0 0 '+width+' '+height} aria-hidden="true"><line x1={points[0].x} y1={points[0].y} x2={points[1].x} y2={points[1].y}/><circle cx={points[1].x} cy={points[1].y} r={Math.max(5,width/100)}/></svg>}</div>:<p role="status">Loading the input preview…</p>}<figcaption>{points.length===2?'The marked line shows the drag from start to end.':target?'The highlight marks the input target.':'Review this shared window before allowing input.'}</figcaption></figure>;
}
