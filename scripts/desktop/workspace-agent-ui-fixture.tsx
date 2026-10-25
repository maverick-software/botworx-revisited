import React,{useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {Composer} from '../../../../desktop/ui/Composer';
import {AgentEditor} from '../../../../desktop/ui/AgentSettings';
import {ProjectEditor} from '../../../../desktop/ui/ProjectNavigation';
import {DesktopApp} from '../../../../desktop/ui/DesktopApp';
import {defaultAgentPolicy} from '../../../../desktop/src/agent-contracts';
import '../../../../desktop/ui/style.css';
import '../../../../desktop/ui/agent-style.css';
const mira={id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',name:'Mira',handle:'mira',description:'Research specialist',system_instructions:'Use saved evidence.',provider:'openai-oauth' as const,model:'fixture-model',active:true},starter={...mira,id:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',name:'Starter',handle:'starter',description:'General helper'};
const projects=[{id:'11111111-1111-4111-8111-111111111111',name:'Shared project',instructions:'',reference_id:null,file_ids:[],revision:1,memory_enabled:false,agent_memory_isolated:false},{id:'22222222-2222-4222-8222-222222222222',name:'Private project',instructions:'',reference_id:null,file_ids:[],revision:1,memory_enabled:false,agent_memory_isolated:true}];
let profile={agent_id:mira.id,user_id:'88888888-8888-4888-8888-888888888888',handle:'mira',role:'Research specialist',sops:'Verify sources.',guardrails:'Cite saved results.',skills:[],policy:defaultAgentPolicy,revision:1,definition:{name:'Mira'},updated_at:new Date().toISOString()};
let memories=[{id:'cccccccc-cccc-4ccc-8ccc-cccccccccccc',agent_id:mira.id,project_id:null,instance_id:null,title:'Atlas release',content:'The approved release is ATLAS-731.',revision:1,source_message_id:null,source_conversation_id:null,authored_by:'agent',created_at:new Date().toISOString(),updated_at:new Date().toISOString()}];
let assignment={id:'dddddddd-dddd-4ddd-8ddd-dddddddddddd',user_id:'88888888-8888-4888-8888-888888888888',agent_id:mira.id,agent_revision:1,conversation_id:'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',project_id:null,parent_instance_id:null,assignment:'Independent Mira assignment',status:'running',checkpoint:'Saved actual work is available.',request_id:'ffffffff-ffff-4fff-8fff-ffffffffffff',depth:0,created_at:new Date().toISOString(),updated_at:new Date().toISOString()};
const transcript='START-OF-SAVED-WORK\n'+'Receipt output. '.repeat(800)+'\nEND-OF-SAVED-WORK';
const connection={openrouter:false,defaultModel:'fixture-model',selections:{'openai-oauth':{model:'fixture-model',thinking:'default'}},chatgpt:{email:'fixture@example.invalid',workspace:'Fixture',authorized:true}};
let appFixture=false;const chatListeners=new Set<(event:any)=>void>(),chatId='99999999-9999-4999-8999-999999999999',appOwner='88888888-8888-4888-8888-888888888888';
const appAgents=[starter,{...mira,provider:'openrouter',model:'different-default'},{...starter,id:'77777777-7777-4777-8777-777777777777',name:'Retired helper',active:false}],appOptions={thinking:'low',permission:'files',mode:'chat',files:[],provider:'openai-oauth',model:'fixture-model'},appDrafts=new Map<string,any>([['conversation:'+chatId,{text:'Keep this unsent draft',options:appOptions}]]),appCalls:any[]=[];
const appChat={conversation_id:chatId,title:'Shared fixture conversation',agent_id:starter.id,last_active:new Date().toISOString(),started_at:new Date().toISOString(),pinned:false,archived:false,options:appOptions};
let appMessages:any[]=[{id:'66666666-6666-4666-8666-666666666666',role:'user',content:{text:'Original user question'},metadata:{status:'completed'}},{id:'55555555-5555-4555-8555-555555555555',role:'assistant',sender_agent_id:starter.id,content:{text:'Starter historical answer'},metadata:{status:'completed',agent:{id:starter.id,name:starter.name,handle:'starter',role:'General helper',revision:1}}}];
const appApi=async(action:string,args:any)=>{
 appCalls.push({action,args:structuredClone(args)});(window as any).__agentAppCalls=appCalls;
 if(action==='tools.catalog'&&(window as any).__pluginContextTest)return [{id:'mcp:eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',name:'Search app',kind:'mcp',ready:true,enabled:true,detail:'Generated plugin fixture'}];
 if(action==='runtime.status')return {phase:'ready',ready:true,message:'Fixture ready'};
 if(action==='auth.state')return {identity:{id:appOwner,email:'fixture@example.invalid',admin:false},needsAdministrator:false,registrationEnabled:false};
 if(action==='agents.list')return structuredClone(appAgents);if(action==='providers.status')return {...connection,openrouter:true,preferChatGPT:true};
 if(action==='conversations.list')return [structuredClone(appChat)];if(action==='messages.list')return structuredClone(appMessages);
 if(action==='conversations.agent'){appChat.agent_id=args.agentId;return;}
 if(action==='preferences.get')return {theme:'light',textSize:'standard',sendWith:'enter',sidebarCollapsed:false};
 if(action==='composer.get'||action==='composer.new')return {...appOptions,...args.options};
 if(action==='composer.save'||action==='preferences.save'||action==='navigation.save'||action==='workspace.save'||action==='browser.hide'||action==='voice.stop')return;
 if(action==='tasks.list')return {tasks:[],runs:[],legacy:[],error:null};
 if(action==='files.list'||action==='goals.list'||action==='native.children'||action==='native.active'||action==='tools.catalog'||action==='tools.list')return [];
 if(action==='projects.list')return {projects:[],memberships:[]};
 if(action==='navigation.state')return {view:'chat',conversationId:chatId,agentId:starter.id};
 if(action==='drafts.get')return structuredClone(appDrafts.get(args.scope)??null);if(action==='drafts.save'){appDrafts.set(args.scope,structuredClone(args.draft));return;}
 if(action==='workspace.state')return {open:false,tree:false,tabs:[],active:null};if(action==='plans.get')return null;
 if(action==='providers.models')return [{id:args.provider==='openrouter'?'different-default':'fixture-model',name:'Fixture selected model',thinking:['low','medium','high'],supportsTools:true}];
 if(action==='chat.start'){const agent=appAgents.find(row=>row.id===args.agentId)!,attribution={id:agent.id,name:agent.name,handle:agent.handle,role:'Fixture',revision:1,instanceId:crypto.randomUUID()},user={id:crypto.randomUUID(),role:'user',content:{text:args.text},metadata:{options:args.options,agent:attribution}},answer={id:crypto.randomUUID(),role:'assistant',sender_agent_id:agent.id,content:{text:'Mira fixture answer'},metadata:{status:'completed',agent:attribution,timing:{requestId:args.requestId}}};appMessages.push(user,answer);appChat.agent_id=agent.id;setTimeout(()=>{for(const listener of chatListeners)listener({ownerId:appOwner,requestId:args.requestId,conversationId:chatId,status:'completed',delta:'Mira fixture answer'});},120);return {id:args.requestId,conversation_id:chatId,user_message_id:user.id,assistant_message_id:answer.id,agent:attribution};}
 throw Error('Unexpected DesktopApp fixture API: '+action);
};
const api=async(action:string,args:any={})=>{
 if(appFixture)return appApi(action,args);
 if(action==='agents.list')return [starter,mira];if(action==='agents.profile')return structuredClone(profile);if(action==='agents.profile.save'){profile={...profile,...structuredClone(args.value),skills:args.value.skills.map((row:any)=>({...row,sha256:'c'.repeat(64)})),revision:profile.revision+1,updated_at:new Date().toISOString()};return structuredClone(profile);}
 if(action==='providers.models')return [{id:'fixture-model',name:'Fixture model',thinking:[],supportsTools:true}];
 if(action==='agentSettings.get')return {agent:{...mira,personality:'',mbtiType:'',purpose:'',settings:{use_account_graph:false,context_history_size:null}},datastores:[],datastoreIds:[],documents:[],documentIds:[],connections:[],connectionIds:[],teams:[],teamIds:[],contacts:[],contactMode:'no_access',contactIds:[],mcp:[],tasks:[]};
 if(action==='projects.list')return {projects,memberships:[]};
 if(action==='agents.memory')return args.projectId===projects[1].id?[{...memories[0],id:'private-note',title:'Private project decision',content:'Visible only in the selected isolated scope.',revision:1,authored_by:'user',updated_at:new Date().toISOString()}]:structuredClone(memories);
 if(action==='agents.instances')return args.projectId===projects[1].id?[]:[structuredClone(assignment)];
 if(action==='agents.memory.save'){memories=memories.map(row=>row.id===args.id?{...row,...args,revision:row.revision+1,authored_by:'user',updated_at:new Date().toISOString()}:row);return memories[0];}
 if(action==='agents.memory.forget'){memories=memories.filter(row=>row.id!==args.id);return;}
 if(action==='agents.instance.read'){const end=Math.min(transcript.length,args.offset+args.characters);return {instance:assignment,transcript:transcript.slice(args.offset,end),next_offset:end<transcript.length?end:null};}
 if(action==='agents.instance.cancel'){assignment={...assignment,status:'cancelled',updated_at:new Date().toISOString()};return;}
 if(action==='projects.save'){if(args.agentMemoryIsolated!==true)throw Error('Isolation choice was not saved');return {...projects[0],agent_memory_isolated:true};}
 if(action==='tools.catalog')return [];
 throw Error('Unexpected fixture API: '+action);
};
window.agentopia={call:api,attach:async()=>({references:[],selected:[]}),onChat:(listener:any)=>{chatListeners.add(listener);return()=>chatListeners.delete(listener);},onRuntime:()=>()=>{},onBeforeClose:()=>()=>{},onCommand:()=>()=>{}} as any;
function Fixture(){
 const [view,setView]=useState('composer'),[agent,setAgent]=useState(starter),[text,setText]=useState(''),[closed,setClosed]=useState(false),[saved,setSaved]=useState(false),[options,setOptions]=useState<any>({provider:'openai-oauth',model:'fixture-model',thinking:'default',permission:'files',mode:'chat',files:[]}),input=useRef<HTMLTextAreaElement>(null);
 const open=(value:string)=>{setView(value);setClosed(false);setSaved(false);};const run=async(fn:()=>Promise<unknown>)=>fn();
 if(view==='app')return <DesktopApp/>;
 return <main style={{padding:20,maxWidth:960,margin:'0 auto'}}><nav style={{display:'flex',gap:12,marginBottom:30}}><button onClick={()=>open('composer')}>Composer fixture</button><button onClick={()=>open('definition')}>Definition fixture</button><button onClick={()=>open('project')}>Project fixture</button><button onClick={()=>{appFixture=true;history.replaceState(null,'','/conversations/'+chatId);open('app');}}>App fixture</button></nav>
 {view==='composer'&&<Composer administrator={false} terminal={()=>{}} project={null} editProject={()=>{}} removeProject={()=>{}} agent={agent} agents={[starter,mira]} selectAgent={async value=>setAgent(value as typeof starter)} options={options} change={value=>setOptions((current:any)=>({...current,...value}))} value={text} setValue={setText} submit={async event=>event?.preventDefault()} input={input} preferences={{theme:'light',textSize:'standard',sendWith:'enter',sidebarCollapsed:false} as any} disabled={false} request={null} cancel={()=>{}} files={[]} pick={async()=>{}} forget={async()=>{}} goal={null} goals={[]} selectGoal={async()=>{}} setGoal={async()=>{}} runGoal={()=>{}} manageGoal={()=>{}} run={run} voice={{phase:'idle',open:false,setOpen:()=>{}} as any} connections={connection as any} configure={()=>{}} configureAgent={()=>{}} paste={()=>{}} attaching={false}/>}
 {view==='definition'&&!closed&&<AgentEditor agent={mira} initialSection="behavior" defaultModel="fixture-model" connections={connection as any} run={run} close={()=>setClosed(true)} saved={async()=>setClosed(true)}/>}
 {view==='project'&&!closed&&<ProjectEditor project={projects[0]} files={[]} updated={async()=>setSaved(true)} close={()=>setClosed(true)}/>}{saved&&<p>Project saved with isolation</p>}
 </main>;
}
createRoot(document.getElementById('root')!).render(<Fixture/>);
