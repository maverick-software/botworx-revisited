import React,{useEffect,useRef,useState} from 'react';
import {Bot,BookOpen,Compass,PenLine,Briefcase,Code2,FlaskConical,Shield} from 'lucide-react';
import type {Agent} from '../src/contracts';
import {defaultAgentAppearance,isLocalAgentAvatar,type AgentAppearance} from '../src/agent-presentation-contracts';
import {call} from './ui';
import './agent-presentation.css';
const icons={bot:Bot,book:BookOpen,compass:Compass,pen:PenLine,briefcase:Briefcase,code:Code2,flask:FlaskConical,shield:Shield};
export function AgentAvatar({agent,owner,large=false,appearance,previewImage}:{agent:Pick<Agent,'id'|'name'|'presentation'>;owner?:string;large?:boolean;appearance?:AgentAppearance;previewImage?:string|null}){
 const presentation=appearance??agent.presentation??defaultAgentAppearance,Icon=Object.hasOwn(icons,presentation.icon)?icons[presentation.icon]:Bot,root=useRef<HTMLSpanElement>(null),[visible,setVisible]=useState(false),[loaded,setLoaded]=useState<{key:string;image:string}|null>(null),[failed,setFailed]=useState('');
 const digest=agent.presentation?.avatar.kind==='uploaded'?agent.presentation.avatar.digest:undefined,key=(owner??'')+':'+agent.id+':'+(digest??'');
 useEffect(()=>{const element=root.current;if(!element)return;const observer=new IntersectionObserver(rows=>{if(rows.some(row=>row.isIntersecting)){setVisible(true);observer.disconnect();}},{rootMargin:'100px'});observer.observe(element);return()=>observer.disconnect();},[]);
 useEffect(()=>{if(!visible||!owner||!digest||previewImage!==undefined)return;let live=true;void call<{image:string}>('agents.presentation.image',{owner,agentId:agent.id,digest}).then(result=>{if(live&&isLocalAgentAvatar(result.image))setLoaded({key,image:result.image});}).catch(()=>{if(live)setFailed(key);});return()=>{live=false;};},[visible,owner,agent.id,digest,previewImage]);
 const candidate=previewImage!==undefined?(isLocalAgentAvatar(previewImage)?previewImage:null):loaded?.key===key?loaded.image:null;const image=candidate&&failed!==candidate?candidate:null;
 return <span ref={root} className={'agent-avatar directory-avatar'+(large?' large':'')} data-color={presentation.color} aria-hidden="true">{image?<img src={image} alt="" onError={()=>setFailed(image)}/>:<Icon size={large?30:22}/>}</span>;
}
