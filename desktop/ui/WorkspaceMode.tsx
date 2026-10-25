import React,{useContext,useEffect,useState,useRef} from 'react';
import {Bell,Check,ChevronDown,Gauge,Keyboard,LogOut,Settings,Users} from 'lucide-react';
import type {Conversation,Identity,Project} from '../src/contracts';
import type {SettingsPage} from './SettingsPanel';
import {ChatActivity} from './ChatActivity';
import {call,Menu,MenuItem,MenuSeparator} from './ui';
import './workspace-mode.css';

export type WorkspaceMode='chatgpt'|'codex';
type Modes={defaultMode:WorkspaceMode;projects:Record<string,WorkspaceMode>;chats:Record<string,WorkspaceMode>};
const valid=(value:unknown):value is WorkspaceMode=>value==='chatgpt'||value==='codex';
function read(key:string):Modes{
 try{const value=JSON.parse(localStorage.getItem(key)??'null');if(value){const clean=(rows:unknown)=>Object.fromEntries(Object.entries(rows&&typeof rows==='object'?rows:{}).filter(([,mode])=>valid(mode)).slice(-1000));return {defaultMode:valid(value.defaultMode)?value.defaultMode:'chatgpt',projects:clean(value.projects),chats:clean(value.chats)};}}catch{/* Display choices remain usable without browser storage. */}
 return {defaultMode:'chatgpt',projects:{},chats:{}};
}
// Presentation is scoped to the account and task. It never changes an agent, provider or permission.
export function useWorkspaceMode(owner:string|undefined,project:Project|null,conversation:string|null){
 const key='agentopia.workspace-modes.'+(owner??'signed-out'),[saved,setSaved]=useState(()=>({key,value:read(key)})),value=saved.key===key?saved.value:read(key);
 const mode=project?(value.projects[project.id]??(project.reference_id?'codex':'chatgpt')):conversation?(value.chats[conversation]??value.defaultMode):value.defaultMode;
 function save(next:Modes){if(!owner)return;setSaved({key,value:next});try{localStorage.setItem(key,JSON.stringify(next));}catch{/* The current session still retains its choices. */}}
 useEffect(()=>{if(owner&&conversation&&!project&&!value.chats[conversation])save({...value,chats:{...value.chats,[conversation]:mode}});},[key,conversation,project?.id]);
 return {mode,select:(next:WorkspaceMode)=>save({...value,defaultMode:next,...(project?{projects:{...value.projects,[project.id]:next}}:conversation?{chats:{...value.chats,[conversation]:next}}:{})})};
}
export function WorkspaceModePicker({mode,select,disabled}:{mode:WorkspaceMode;select:(mode:WorkspaceMode)=>void;disabled?:boolean}){
 const label=mode==='codex'?'Codex':'ChatGPT';
 return <Menu trigger={<button className="workspace-mode-trigger" aria-label={'Switch mode, current mode: '+label} disabled={disabled}><strong>{label}</strong><ChevronDown size={13}/></button>}>{(['chatgpt','codex'] as const).map(value=><MenuItem key={value} onSelect={()=>select(value)}><span className="workspace-mode-option"><strong>{value==='codex'?'Codex':'ChatGPT'}</strong><small>{value==='codex'?'Build, debug, and ship':'Create, learn, and explore'}</small></span>{mode===value&&<Check size={15}/>}</MenuItem>)}</Menu>;
}
export function WorkspaceActivity({chats,open,disabled}:{chats:Conversation[];open:(chat:Conversation)=>void;disabled:boolean}){
 const activity=useContext(ChatActivity),rows=chats.filter(chat=>activity.running.has(chat.conversation_id)||activity.completed.has(chat.conversation_id));
 return <Menu align="end" trigger={<button className="icon-button workspace-activity-trigger" aria-label="Notifications" title="Notifications"> <Bell size={17}/>{rows.some(chat=>activity.completed.has(chat.conversation_id))&&<i aria-label="Unread activity"/>}</button>}><div className="menu-label">Activity</div>{rows.slice(0,20).map(chat=><MenuItem key={chat.conversation_id} disabled={disabled} onSelect={()=>open(chat)}><span className="workspace-activity-row"><strong>{chat.title||'Untitled chat'}</strong><small>{activity.running.has(chat.conversation_id)?'Working':'Completed response'}</small></span>{activity.running.has(chat.conversation_id)?<i className="native-running-dot" aria-label="Working"/>:<i className="chat-completed-dot" aria-label="Completed response"/>}</MenuItem>)}{!rows.length&&<p className="workspace-activity-empty">No new activity</p>}</Menu>;
}
export function AccountMenu({identity,settings,logout,disabled=false}:{identity:Identity;settings:(page:SettingsPage)=>void;logout:()=>void;disabled?:boolean}){
 const name=identity.email.split('@')[0],trigger=useRef<HTMLButtonElement>(null),pending=useRef<(()=>void)|null>(null);
 const [version,setVersion]=useState<string>();
 useEffect(()=>{let live=true;void call<string>('app.version').then(value=>{if(live)setVersion(value);}).catch(()=>{});return()=>{live=false;};},[]);
 const navigate=(page:SettingsPage)=>{pending.current=()=>settings(page);};
 return <Menu onCloseAutoFocus={event=>{event.preventDefault();trigger.current?.focus();const action=pending.current;pending.current=null;if(action)requestAnimationFrame(action);}} trigger={<button ref={trigger} className="rail-account-button" aria-label="Account menu" title={identity.email}><span className="avatar small">{name[0]?.toUpperCase()}</span></button>}><div className="menu-label" aria-label="Agentopia version">Agentopia{version?' '+version:''}</div><MenuSeparator/><div className="menu-account"><strong>{name}</strong><span>{identity.email}</span></div><MenuSeparator/><MenuItem onSelect={()=>navigate('usage')}><Gauge size={17}/>Usage</MenuItem><MenuItem onSelect={()=>navigate('general')}><Settings size={17}/>Settings<kbd>Ctrl ,</kbd></MenuItem>{identity.admin&&<MenuItem onSelect={()=>navigate('users')}><Users size={17}/>Administration</MenuItem>}<MenuItem onSelect={()=>navigate('shortcuts')}><Keyboard size={17}/>Keyboard shortcuts</MenuItem><MenuSeparator/><MenuItem disabled={disabled} onSelect={logout}><LogOut size={17}/>Sign out</MenuItem></Menu>;
}
