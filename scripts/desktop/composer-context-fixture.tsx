import React,{useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {Composer} from '../../desktop/ui/Composer';
import '../../desktop/ui/style.css';

const ownerChat='11111111-1111-4111-8111-111111111111',otherChat='22222222-2222-4222-8222-222222222222';
const agent={id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',name:'Mira',handle:'mira',role:'Research assistant',provider:'openai-oauth',model:'fixture-model',active:true};
const other={...agent,id:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',name:'Other helper'};
const tabs=[{id:'cccccccc-cccc-4ccc-8ccc-cccccccccccc',conversation:otherChat,conversationTitle:'Other owned task',title:'Live report',url:'https://example.invalid/report',status:'live'},{id:'dddddddd-dddd-4ddd-8ddd-dddddddddddd',conversation:ownerChat,title:'Saved report',url:'https://example.invalid/saved',status:'saved'}];
const fixture:any={calls:[],submits:0,steers:0,stops:0};(window as any).contextFixture=fixture;
(window as any).agentopia={onCommand:()=>()=>{},call:async(action:string,args:any)=>{
 fixture.calls.push({action,args});
 if(action==='tools.catalog')return [{id:'mcp:eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',name:'Search app',kind:'mcp',ready:true,enabled:true,detail:'Generated plugin fixture'}];
 if(action==='browser.context.list')return {tabs};
 if(action==='chrome.context.list'){if(fixture.chromeCatalogError)throw Error('Generated Chrome disconnect');if(fixture.deferChromeCatalog)return new Promise(resolve=>fixture.resolveChromeCatalog=resolve);return {tabs:[{id:'ffffffff-ffff-4fff-8fff-ffffffffffff',title:'Chrome research',url:'https://example.invalid/chrome',browser:'chrome',status:'live'}]};}
 if(action==='conversations.list')return [{conversation_id:otherChat,title:'Saved context chat',agent_id:agent.id}];
 if(action==='browser.context'||action==='chrome.context'||action==='context.chat')return new Promise((resolve,reject)=>{fixture.resolve=resolve;fixture.reject=(message:string)=>reject(new Error(message));});
 throw new Error('Unexpected fixture call: '+action);
}};
function Fixture(){
 const input=useRef<HTMLTextAreaElement>(null),[text,setText]=useState('Keep my draft'),[config,setConfig]=useState({scope:ownerChat,agent,request:null as string|null,disabled:false,visible:true,administrator:true}),[options,setOptions]=useState<any>({provider:'openai-oauth',model:'fixture-model',thinking:'high',permission:'full',mode:'chat',files:[]});
 fixture.configure=(next:any)=>setConfig(value=>({...value,...next,agent:next.otherAgent?other:value.agent}));fixture.edit=setText;fixture.sources=(sources:any[])=>setOptions((value:any)=>({...value,sources}));fixture.permission=(permission:string)=>setOptions((value:any)=>({...value,permission}));fixture.state={text,options,config};
 return <main style={{position:'fixed',bottom:30,left:30,width:'calc(100vw - 60px)'}}>{config.visible&&<Composer scope={config.scope} administrator={config.administrator} capabilitySettings={page=>{fixture.capabilityPages=[...(fixture.capabilityPages??[]),page];}} project={null} editProject={()=>{}} removeProject={()=>{}} terminal={()=>{}} agent={config.agent as any} agents={[agent,other] as any} selectAgent={async peer=>setConfig(value=>({...value,agent:peer as any}))} options={options} change={next=>setOptions((value:any)=>({...value,...next}))} value={text} setValue={setText} submit={async()=>{fixture.submits++;}} steer={async()=>{fixture.steers++;}} editGoal={()=>{}} expandGoal={()=>{}} input={input} preferences={{theme:'dark',textSize:'standard',sendWith:'enter',sidebarCollapsed:false}} disabled={config.disabled} request={config.request} cancel={()=>{fixture.stops++;}} files={[{id:'ffffffff-ffff-4fff-8fff-ffffffffffff',name:'Generated notes.md',path:'C:/fixture/Generated notes.md',kind:'file'}]} pick={async kind=>{fixture.picked=kind;}} forget={async()=>{}} goal={null} goals={[]} selectGoal={async()=>{}} setGoal={async()=>{}} runGoal={()=>{}} manageGoal={()=>{}} run={async task=>{try{return await task();}catch(error){fixture.error=String(error);}}} voice={{phase:'idle',open:false,setOpen:()=>{}} as any} connections={{openrouter:false,defaultModel:'fixture-model',chatgpt:{authorized:true}} as any} configure={()=>{}} configureAgent={()=>{}} paste={()=>{}} attaching={false}/>}</main>;
}
document.documentElement.dataset.theme='dark';createRoot(document.getElementById('root')!).render(<Fixture/>);
