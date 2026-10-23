import React,{useEffect,useRef,useState} from 'react';
import {AgentAppearanceFields} from './AgentPresentationEditor';
import {isLocalAgentAvatar,type AgentAppearance} from '../src/agent-presentation-contracts';
import {call} from './ui';
export function NewAgentAppearance({owner,id,name,value,image,change,working}:{owner?:string;id:string;name:string;value:AgentAppearance;image:string|null;change:(value:AgentAppearance,image:string|null)=>void;working:(busy:boolean)=>void}){
 const [busy,setBusy]=useState(false),[error,setError]=useState('');const mounted=useRef(true),scope=useRef(owner);scope.current=owner;
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
 const pick=async()=>{if(!owner||busy)return;setBusy(true);working(true);setError('');try{const result=await call<{cancelled?:boolean;image?:string}>('agents.presentation.prepare',{owner});if(!mounted.current||scope.current!==owner||result.cancelled)return;if(!isLocalAgentAvatar(result.image))throw Error('The selected image could not be prepared.');change(value,result.image);}catch(error){if(mounted.current)setError((error as Error).message);}finally{if(mounted.current){setBusy(false);working(false);}}};
 return <section className="agent-presentation-editor" aria-label="New agent appearance and conversation starters"><h3>Appearance</h3><AgentAppearanceFields agent={{id,name}} owner={owner} draft={value} avatar={image??'remove'} busy={busy} editable update={next=>change(next,image)} pick={()=>void pick()} removeImage={()=>change(value,null)}/><p className="hint">Your image, icon, color and starters are saved when you create this agent.</p>{error&&<p role="alert">{error}</p>}</section>;
}
