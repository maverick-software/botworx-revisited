import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import {flushSync} from 'react-dom';
import {AgentHome} from '../../desktop/ui/AgentDirectory';
import {AgentEditor} from '../../desktop/ui/AgentSettings';
import {agentAppearance,defaultAgentAppearance,type AgentPresentation} from '../../desktop/src/agent-presentation-contracts';
import type {Agent} from '../../desktop/src/contracts';
import '../../desktop/ui/style.css';
const owner='11111111-1111-4111-8111-111111111111',id='22222222-2222-4222-8222-222222222222';
let revision=1,avatar='https://preserved.invalid/old-profile.png',record:Agent={id,name:'Mira',description:'Review approved source material.',system_instructions:'## Exact role\n\nKeep these original instruction bytes.\n',provider:'openai-oauth',model:'fixture-model',active:true,presentation:{...defaultAgentAppearance,revision:'1'.repeat(64),editable:true,avatar:{kind:'legacy'}}};
const calls:any[]=[],asks:string[]=[];let failed=false,cancelled=false,gate:Promise<void>|null=null,release:(()=>void)|null=null;
const thumbnail=()=>{const canvas=document.createElement('canvas');canvas.width=128;canvas.height=128;const context=canvas.getContext('2d')!;context.fillStyle='#367cca';context.fillRect(0,0,128,128);return canvas.toDataURL('image/png');};
(window as any).agentopia={onChat:()=>()=>{},call:async(action:string,args:any={})=>{
 calls.push({action,args:structuredClone(args)});
 if(action==='tasks.list')return {tasks:[],runs:[]};if(action==='agents.instances')return [];if(action==='tools.catalog')return [];if(action==='agents.profile')return {skills:[]};if(action==='providers.models')return [{id:'fixture-model',name:'Fixture model'}];
 if(action==='agentSettings.get')return {agent:{personality:'',settings:{}},documents:[],documentIds:[],datastores:[],datastoreIds:[],connections:[],connectionIds:[],teams:[],teamIds:[],contacts:[],contactMode:'no_access',contactIds:[],mcp:[],tasks:[]};
 if(action==='agents.presentation.get')return structuredClone(record.presentation);
 if(action==='agents.presentation.pick')return cancelled?{cancelled:true}:{image:thumbnail()};
 if(action==='agents.presentation.image'){if(args.owner!==owner||args.digest!==record.presentation?.avatar.digest)throw Error('Image changed');return {image:avatar};}
 if(action==='agents.presentation.save'){const value=agentAppearance(args.value);if(gate){await gate;gate=null;}if(failed)throw Error('The agent changed. Reload the saved appearance before saving again.');if(args.expected!==record.presentation?.revision)throw Error('Appearance changed');if(args.avatarChange==='remove')avatar='';else if(args.avatarChange!=='keep')avatar=args.avatarChange;record={...record,presentation:{...value,revision:(++revision).toString(16).padStart(64,'0'),editable:true,avatar:avatar.startsWith('data:')?{kind:'uploaded',digest:revision.toString(16).padStart(64,'b')}:avatar?{kind:'legacy'}:{kind:'default'}}};return structuredClone(record.presentation);}
 if(action==='agents.save'){record={...record,name:args.name,description:args.description,system_instructions:args.instructions,provider:args.provider,model:args.model};return id;}
 throw Error('Unexpected presentation fixture action '+action);
}};
(window as any).presentationFixture=()=>({record:structuredClone(record),calls:structuredClone(calls),asks:[...asks],avatar});
(window as any).presentationFailure=(value:boolean)=>failed=value;(window as any).presentationCancel=(value:boolean)=>cancelled=value;
(window as any).deferPresentationSave=()=>{gate=new Promise(resolve=>release=resolve);};(window as any).releasePresentationSave=()=>release?.();
function Fixture(){
 const [agent,setAgent]=useState(record),[editor,setEditor]=useState(false),[sendWith,setSendWith]=useState<'enter'|'ctrl-enter'>('enter');
 (window as any).setPresentationSendWith=(value:'enter'|'ctrl-enter')=>flushSync(()=>setSendWith(value));
 (window as any).replacePresentationStarters=(starters:any[])=>{record={...record,presentation:{...record.presentation!,starters}};setAgent(structuredClone(record));};
 const refresh=async()=>setAgent(structuredClone(record));
 return <><nav aria-label="Desktop navigation" style={{height:32}}>Owned agent presentation fixture</nav><AgentHome owner={owner} agent={agent} chats={[]} projects={[]} connections={null} administrator back={()=>{}} edit={()=>setEditor(true)} ask={async text=>{asks.push(text);}} openChat={async()=>{}} configure={()=>{}} permission="files" running={new Set()} sendWith={sendWith}/>{editor&&<AgentEditor owner={owner} agent={agent} defaultModel="fixture-model" connections={null} run={async task=>{await task();}} close={()=>{setEditor(false);void refresh();}} saved={refresh} preview={()=>{}}/>}</>;
}
createRoot(document.getElementById('root')!).render(<Fixture/>);
