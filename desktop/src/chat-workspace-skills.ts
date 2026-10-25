import path from 'node:path';
import type {ChatOptions,Identity} from './contracts';
import type {WorkspaceFiles} from './workspace';
import type {AgentPolicy} from './agent-contracts';
import {capturePreviewWorkspaceSkills,validatePreviewWorkspaceSkillSnapshot,type PreviewWorkspaceSkills} from './preview-workspace-skills';
const inside=(root:string,file:string)=>{const relative=path.relative(root,file);return relative!==''&&!path.isAbsolute(relative)&&relative!=='..'&&!relative.startsWith('..'+path.sep);};
const equal=(a:string,b:string)=>process.platform==='win32'?path.resolve(a).toLowerCase()===path.resolve(b).toLowerCase():path.resolve(a)===path.resolve(b);
const canonical=(value:unknown)=>JSON.stringify(value,(_,item)=>item&&typeof item==='object'&&!Array.isArray(item)?Object.fromEntries(Object.keys(item).sort().map(key=>[key,item[key]])):item);

/** Ordinary requests keep their existing native cwd and capture local skill grants separately. */
export class ChatWorkspaceSkills{
 constructor(private files:WorkspaceFiles){}
 private references(owner:string,options:ChatOptions){return options.files.map(id=>{const row=this.files.list(owner).find(row=>row.id===id);if(!row)throw Error('An attached workspace reference is unavailable.');return structuredClone(row);});}
 async capture(user:Identity,options:ChatOptions,signal:AbortSignal,validate:()=>Promise<void>){
  if(!options.skills?.length)return;const references=this.references(user.id,options),selected=options.skills.filter(selection=>!selection.startsWith('agentopia-plugin:')&&path.isAbsolute(selection)&&references.some(ref=>ref.kind==='folder'&&ref.source!=='clipboard'&&inside(path.join(ref.path,'.agents','skills'),selection)));
  if(!selected.length)return;const guard=async()=>{signal.throwIfAborted();await validate();signal.throwIfAborted();};return capturePreviewWorkspaceSkills(user.id,references,selected,guard,file=>this.files.checkPath(file),{instructionsOnly:options.permission==='chat'});
 }
 async validate(user:Identity,options:ChatOptions,snapshot:PreviewWorkspaceSkills,signal:AbortSignal){
  signal.throwIfAborted();validatePreviewWorkspaceSkillSnapshot(snapshot);if(snapshot.owner!==user.id||!snapshot.skills.length||snapshot.skills.length>20||snapshot.skills.some(skill=>!options.skills?.includes(skill.selection)))throw Error('The accepted workspace skill account or selection changed.');
  const references=this.references(user.id,options);for(const skill of snapshot.skills){const reference=references.find(ref=>ref.id===skill.referenceId);if(!reference||reference.kind!=='folder'||reference.source==='clipboard'||!equal(reference.path,skill.referencePath))throw Error('The selected workspace skill attachment changed.');}
  const current=await capturePreviewWorkspaceSkills(user.id,references,snapshot.skills.map(skill=>skill.selection),async()=>signal.throwIfAborted(),file=>this.files.checkPath(file),{instructionsOnly:options.permission==='chat'});if(current.key!==snapshot.key)throw Error('A selected workspace skill changed. Refresh Skills before sending.');signal.throwIfAborted();
 }
}

export type ChatWorkspaceSkillScope={readonly kind:'chat-workspace-skills'};
type Scope={owner:string;request:string;conversation:string;assistant:string;agent:string;options:string;policy:AgentPolicy;workspaceSkills:PreviewWorkspaceSkills;validate:()=>Promise<void>};
const scopes=new WeakMap<ChatWorkspaceSkillScope,Scope>();
export function chatWorkspaceSkillScope(input:{owner:string;request:{id:string;conversation_id:string;assistant_message_id:string;agent_id:string};options:ChatOptions;policy:AgentPolicy;workspaceSkills:PreviewWorkspaceSkills;validate:()=>Promise<void>}):ChatWorkspaceSkillScope{
 const snapshot=input.workspaceSkills;validatePreviewWorkspaceSkillSnapshot(snapshot);if(snapshot.owner!==input.owner||!snapshot.skills.length||snapshot.skills.length>20||input.options.permission==='chat'||snapshot.skills.some(skill=>!input.options.files.includes(skill.referenceId)||!input.options.skills?.includes(skill.selection))||(['id','conversation_id','assistant_message_id','agent_id'] as const).some(key=>typeof input.request[key]!=='string'||!input.request[key])||typeof input.validate!=='function')throw Error('The ordinary workspace skill scope changed.');
 const token=Object.freeze({kind:'chat-workspace-skills' as const});scopes.set(token,{owner:input.owner,request:input.request.id,conversation:input.request.conversation_id,assistant:input.request.assistant_message_id,agent:input.request.agent_id,options:canonical(input.options),policy:structuredClone(input.policy),workspaceSkills:structuredClone(snapshot),validate:input.validate});return token;
}
export function resolveChatWorkspaceSkillScope(token:ChatWorkspaceSkillScope,user:Identity,request:any,options:ChatOptions){
 const saved=scopes.get(token);if(!saved)throw Error('This ordinary skill scope was not created by the broker.');const check=()=>{if(user.id!==saved.owner||request.id!==saved.request||request.conversation_id!==saved.conversation||request.assistant_message_id!==saved.assistant||request.agent_id!==saved.agent||canonical(options)!==saved.options)throw Error('The workspace skill account, request or permissions changed.');};check();return {workspaceSkills:structuredClone(saved.workspaceSkills),policy:structuredClone(saved.policy),validate:async()=>{check();await saved.validate();check();}};
}
