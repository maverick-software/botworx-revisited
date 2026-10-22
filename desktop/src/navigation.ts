import type {BrowserTabs} from './browser-tabs';
import type {SupabaseClient} from '@supabase/supabase-js';
import type {Secrets} from './secrets';
import type {WorkspaceFiles} from './workspace';
import {WorkspaceTools} from './workspace-tools';
import {reconcileWorkspaceLayout} from './workspace-layout-store';
import {validateTreeViews} from './workspace-organization';
import {WorkspaceDocumentLinks,documentFragment} from './workspace-links';
import {ProjectMemory} from './project-memory';
import type {PaneState,WorkspaceTab} from './contracts';
const id=(v:unknown)=>{if(typeof v!=='string'||!/^[a-f0-9-]{36}$/i.test(v))throw new Error('Invalid workspace identifier.');return v;};
const must=(r:any)=>{if(r.error)throw new Error(r.error.message);return r.data;};
export class WorkspaceNavigation{
 constructor(private db:SupabaseClient,private secrets:Secrets,private files:WorkspaceFiles,private browserTabs?:BrowserTabs){}
 async call(action:string,args:Record<string,unknown>,user:string){
  const generation=this.files.documents.generation(user);
  if(args.owner!==undefined&&args.owner!==user)throw new Error('This workspace belongs to another account.');
  const scope=typeof args.scope==='string'?args.scope:'home';if(scope!=='home'){
   const conversation=must(await this.db.from('conversation_sessions').select('user_id').eq('conversation_id',id(scope)).maybeSingle());
   if(!conversation&&action==='workspace.save'){await this.secrets.set('panes:'+user+':'+scope,undefined);return {discarded:true,reason:'conversation_removed'};}
   if(!conversation||conversation.user_id!==user)throw new Error('This conversation is unavailable for your account.');
  }
  if(action==='workspace.state'){let state=this.secrets.get<PaneState>('panes:'+user+':'+scope)??{open:false,width:620,treeWidth:220,tree:true,tabs:[],active:null,referenceId:null};const openTabs=state.tabs.filter(tab=>tab.kind!=='browser'||!this.browserTabs?.closed(user,tab.id));state={...state,tabs:openTabs,active:openTabs.some(tab=>tab.id===state.active)?state.active:openTabs.at(-1)?.id??null};const sourceTabs=state.tabs.filter(tab=>['conversation','changes'].includes(tab.kind));if(sourceTabs.length){const owned=must(await this.db.from('conversation_sessions').select('conversation_id').eq('user_id',user).in('conversation_id',sourceTabs.map(tab=>id(tab.conversationId))));const messages=owned.length?must(await this.db.from('chat_messages_v2').select('id,conversation_id').in('conversation_id',owned.map((row:any)=>row.conversation_id)).in('id',sourceTabs.map(tab=>id(tab.messageId)))):[];const tabs=state.tabs.filter(tab=>!['conversation','changes'].includes(tab.kind)||messages.some((row:any)=>row.id===tab.messageId&&row.conversation_id===tab.conversationId));state={...state,tabs,active:tabs.some(tab=>tab.id===state.active)?state.active:tabs.at(-1)?.id??null};}const treeViews=validateTreeViews(state.treeViews,this.files.list(user));return reconcileWorkspaceLayout(this.db,this.files,user,{...state,...(treeViews!==undefined?{treeViews}:{})});}
  if(action==='workspace.cancelRead'){this.files.documents.cancel(user,id(args.readId));return;}
  if(action==='workspace.link'||action==='workspace.image'||action==='workspace.location'){const links=new WorkspaceDocumentLinks(this.files);return action==='workspace.link'?links.resolve(user,args):action==='workspace.location'?links.location(user,args):links.image(user,args);}
  if(action==='workspace.save'){
   const s=args.state as PaneState;if(!s||typeof s.open!=='boolean'||typeof s.tree!=='boolean'||!Number.isFinite(s.width)||!Number.isFinite(s.treeWidth)||!Array.isArray(s.tabs)||s.tabs.length>16)throw new Error('Invalid workspace layout.');
   if(new Set(s.tabs.map(tab=>tab?.id)).size!==s.tabs.length)throw new Error('Workspace tabs must have distinct identifiers.');
   const parsedTabs:Array<WorkspaceTab|null>=await Promise.all(s.tabs.map(async t=>{id(t.id);if(t.kind==='browser'){const u=new URL(t.url??'');if(!['https:','http:'].includes(u.protocol)||u.username||u.password)throw new Error('Use an HTTP or HTTPS browser address.');return {id:t.id,kind:'browser',name:u.hostname,url:u.href.slice(0,4000)};}
    if(['conversation','changes'].includes(t.kind)){const conversationId=id(t.conversationId),messageId=id(t.messageId);const rows=await Promise.all([this.db.from('conversation_sessions').select('conversation_id').eq('conversation_id',conversationId).eq('user_id',user).maybeSingle().then(must),this.db.from('chat_messages_v2').select('id').eq('id',messageId).eq('conversation_id',conversationId).maybeSingle().then(must)]);if(rows.some(row=>!row)){const previous=this.secrets.get<PaneState>('panes:'+user+':'+scope);if(previous?.tabs.some(tab=>tab.id===t.id&&['conversation','changes'].includes(tab.kind)&&tab.conversationId===conversationId&&tab.messageId===messageId))return null;throw new Error('This conversation source is unavailable for your account.');}if(typeof t.name!=='string')throw new Error('Invalid conversation tab name.');return {id:t.id,kind:t.kind as 'conversation'|'changes',name:t.kind==='changes'?'Changes':t.name.slice(0,200),conversationId,messageId};}if(t.kind==='terminal'){if(t.sessionId)must(await this.db.from('desktop_terminal_sessions').select('id').eq('id',id(t.sessionId)).eq('user_id',user).single());if(t.runId)must(await this.db.from('desktop_terminal_runs').select('id').eq('id',id(t.runId)).eq('user_id',user).single());return {id:t.id,kind:'terminal',name:'Terminal',...(t.runId?{runId:t.runId}:{}),...(t.sessionId?{sessionId:t.sessionId}:{})};}if(t.kind==='goal'){must(await this.db.from('desktop_goals').select('id').eq('id',id(t.goalId)).eq('user_id',user).single());return {id:t.id,kind:'goal',name:'Goal',goalId:t.goalId,editing:t.editing===true};}if(t.kind==='plan'){must(await this.db.from('desktop_plans').select('id').eq('id',id(t.planId)).eq('user_id',user).single());return {id:t.id,kind:'plan',name:'Plan',planId:t.planId};}if(t.kind!=='file'&&t.kind!=='folder')throw new Error('Invalid workspace tab.');const ref=this.files.list(user).find(r=>r.id===t.referenceId);if(!ref)throw new Error('This file reference is unavailable.');if(typeof t.path!=='string'||t.path.length>500||typeof t.name!=='string')throw new Error('Invalid workspace path.');if(t.kind==='folder'&&ref.kind!=='folder')throw new Error('Choose a folder reference for directory navigation.');return {id:t.id,kind:t.kind,name:t.name.slice(0,200),referenceId:ref.id,path:t.path,...(t.fragment!==undefined?{fragment:documentFragment(t.fragment)}:{}),source:t.source===true,canvas:t.canvas===true,...(t.editing===true?{editing:true}:{})};}));
   const tabs=parsedTabs.filter((tab):tab is WorkspaceTab=>tab!==null&&(tab.kind!=='browser'||!this.browserTabs?.closed(user,tab.id)));
  const treeViews=validateTreeViews(s.treeViews,this.files.list(user));
   let state:PaneState={...(s.fileRevision!==undefined?{fileRevision:s.fileRevision}:{}),...(treeViews!==undefined?{treeViews}:{}),open:s.open,tree:s.tree,width:Math.max(320,Math.min(1600,s.width)),treeWidth:Math.max(150,Math.min(500,s.treeWidth)),tabs,active:tabs.some(t=>t.id===s.active)?s.active:tabs.at(-1)?.id??null,referenceId:this.files.list(user).some(r=>r.id===s.referenceId)?s.referenceId:null};
   if(state.fileRevision!==undefined&&(!Number.isSafeInteger(state.fileRevision)||state.fileRevision<0))throw new Error('Invalid workspace revision.');state=await reconcileWorkspaceLayout(this.db,this.files,user,state);
   await this.secrets.set('panes:'+user+':'+scope,state);return state;
  }
  if(action==='workspace.list'||action==='workspace.read'){
   const reference=id(args.referenceId),tools=new WorkspaceTools(this.files),options={permission:'files' as const,mode:'chat' as const,thinking:'default' as const,files:[reference]},values={reference_id:reference,path:args.path??''};
   return action==='workspace.list'?tools.list(user,options,values):tools.view(user,options,values,{id:args.readId?id(args.readId):undefined,generation});
  }
  if(action==='projects.list')return {projects:must(await this.db.from('desktop_projects').select('id,name,reference_id,instructions,file_ids,revision,memory_enabled,agent_memory_isolated').eq('user_id',user).order('created_at')),memberships:must(await this.db.from('desktop_project_chats').select('conversation_id,project_id').eq('user_id',user))};
  if(action==='projects.search'){return new ProjectMemory(this.db).search(user,id(args.projectId),args.query,null,args.limit??12);}
  if(action==='projects.save'){
   if(args.agentMemoryIsolated!==undefined&&typeof args.agentMemoryIsolated!=='boolean')throw new Error('Choose an agent memory isolation setting.');
   if(args.memoryEnabled!==undefined&&typeof args.memoryEnabled!=='boolean')throw new Error('Choose a valid project memory setting.');
   if(typeof args.name!=='string'||!args.name.trim()||args.name.trim().length>100)throw new Error('Enter a project name with up to 100 characters.');
   const previous=args.id?must(await this.db.from('desktop_projects').select('*').eq('id',id(args.id)).eq('user_id',user).single()):null;
   const referenceId=args.referenceId===undefined?previous?.reference_id:args.referenceId;
   const reference=referenceId?this.files.list(user).find(r=>r.id===referenceId&&r.kind==='folder'):null;if(referenceId&&!reference)throw new Error('Choose one of your workspace folders.');
   const instructions=args.instructions===undefined?previous?.instructions??'':args.instructions,files=args.fileIds===undefined?previous?.file_ids??[]:args.fileIds;
   if(typeof instructions!=='string'||instructions.length>8000)throw new Error('Use up to 8,000 characters for project instructions.');
   if(!Array.isArray(files)||files.length>20||files.some(file=>typeof file!=='string'||!this.files.list(user).some(r=>r.id===file)))throw new Error('Choose up to 20 of your available file or folder references.');
   return must(await this.db.rpc('desktop_save_workspace_project',{p_user:user,p_id:previous?.id??null,p_name:args.name.trim(),p_reference:reference?.id??null,p_instructions:instructions,p_files:[...new Set(files)],p_revision:args.revision??previous?.revision??null,p_memory:args.memoryEnabled??null,p_agent_isolated:args.agentMemoryIsolated??null}));
  }
  if(action==='projects.remove'){must(await this.db.from('desktop_projects').delete().eq('id',id(args.id)).eq('user_id',user));return;}
  if(action==='projects.move'){
   must(await this.db.rpc('desktop_move_project_chat',{p_user:user,p_conversation:id(args.conversationId),p_project:args.projectId?id(args.projectId):null}));return;
  }
  throw new Error('Unsupported workspace operation.');
 }
}
