import React,{useId,useState} from 'react';

// Save only a display preference, scoped to the signed-in account.
export function SidebarSection({name,owner,initiallyOpen=true,action,children,className=''}:{name:string;owner?:string;initiallyOpen?:boolean;action?:React.ReactNode;children:React.ReactNode;className?:string}){
 const id=useId(),key='agentopia.sidebar.'+(owner??'session')+'.'+name;
 const read=()=>{try{const value=localStorage.getItem(key);return value===null?initiallyOpen:value==='open';}catch{return initiallyOpen;}};
 const [state,setState]=useState(()=>({key,open:read()})),open=state.key===key?state.open:read();
 function toggle(){const next=!open;setState({key,open:next});try{localStorage.setItem(key,next?'open':'closed');}catch{/* The section still works when browser storage is unavailable. */}}
 return <section className={'sidebar-section sidebar-disclosure '+className} aria-label={name}><div className="section-label"><button type="button" className="sidebar-section-toggle" aria-expanded={open} aria-controls={id} onClick={toggle}><span>{name}</span></button>{action}</div><div id={id} hidden={!open}>{children}</div></section>;
}
