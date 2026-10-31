import {creationResourcePrincipal,type CreationResourcePrincipal,type RemotePrincipal} from './creation-resource-principal';
import {createHash} from 'node:crypto';
import type {ChatOptions} from './contracts';
import type {ToolDefinition,ToolSource} from './tool-contracts';
import type {RemoteTools,RemotePlan} from './remote-tools';
import {instructionAppId} from './instruction-app-references';
import {automaticComposioSource} from './composio-mcp-contracts';

export const previewRemoteToolNames=['web_search','mcp_search','mcp_call'];
type PreviewRemoteBody={owner:string;mode:'chat'|'plan';sources:ToolSource[];definitions:ToolDefinition[];bindings:Array<{id:string;signature:string}>;key:string};
export type PreviewRemoteTools=PreviewRemoteBody&({version:1;agentId:string;principal?:never}|{version:2;principal:CreationResourcePrincipal;agentId?:never});
const canonical=(value:unknown):string=>JSON.stringify(value,(_,item)=>item&&typeof item==='object'&&!Array.isArray(item)?Object.fromEntries(Object.keys(item).sort().map(key=>[key,item[key]])):item);
const key=(value:unknown)=>createHash('sha256').update(canonical(value)).digest('hex');
const changed=()=>Error('The preview connection or its agent grant changed. Select the current connection before sending a new preview.');
const uuid=(value:unknown)=>typeof value==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(value);

export function validatePreviewRemoteTools(value:PreviewRemoteTools){
 if(!value||![1,2].includes(value.version)||!uuid(value.owner)||value.version===1&&!uuid(value.agentId)||!['chat','plan'].includes(value.mode)||!Array.isArray(value.sources)||!value.sources.length||value.sources.length>1000||!Array.isArray(value.definitions)||!value.definitions.length||value.definitions.length>3||!Array.isArray(value.bindings)||value.bindings.length!==value.sources.length)throw changed();
 if(value.version===2){try{creationResourcePrincipal(value.principal);}catch{throw changed();}}
 const {key:digest,...body}=value;if(Object.keys(body).some(name=>!['version','owner',value.version===1?'agentId':'principal','mode','sources','definitions','bindings'].includes(name))||digest!==key(body))throw changed();
 const ids=new Set<string>();for(const source of value.sources){if(!instructionAppId(source.id)||ids.has(source.id)||source.kind!==(source.id==='web_search'?'web':'mcp')||!source.enabled||!source.ready||typeof source.name!=='string'||source.name.length>1000||typeof source.detail!=='string'||source.detail.length>4000||Object.keys(source).some(name=>!['id','name','kind','ready','enabled','detail','plugin','validation'].includes(name)))throw changed();ids.add(source.id);if(typeof source.plugin!=='undefined'&&(typeof source.plugin!=='string'||source.plugin.length>200)||typeof source.validation!=='undefined'&&(typeof source.validation!=='string'||source.validation.length>500))throw changed();}
 if(new Set(value.bindings.map(row=>row.id)).size!==ids.size||value.bindings.some(row=>!ids.has(row.id)||!/^([a-f0-9]{64})$/.test(row.signature)||Object.keys(row).some(name=>!['id','signature'].includes(name))))throw changed();
 if(new Set(value.definitions.map(row=>row.name)).size!==value.definitions.length||value.definitions.some(tool=>tool.namespace!=='tools'||!previewRemoteToolNames.includes(tool.name)||!tool.parameters||typeof tool.parameters!=='object'||(tool.name==='web_search'?!ids.has('web_search'):!value.sources.some(source=>source.kind==='mcp'))))throw changed();
}

export function previewRemotePrincipal(value:PreviewRemoteTools):RemotePrincipal{validatePreviewRemoteTools(value);return value.version===1?value.agentId:creationResourcePrincipal(value.principal);}

/** Accepted configuration fingerprints contain no endpoint, token or credential. */
export class PreviewRemoteToolBindings{
 constructor(private remote:RemoteTools){}
 async capture(owner:string,agentId:RemotePrincipal,options:ChatOptions,signal:AbortSignal,guard:()=>Promise<void>,acceptedSourceIds?:ReadonlySet<string>):Promise<PreviewRemoteTools|undefined>{
  const check=async()=>{signal.throwIfAborted();await guard();signal.throwIfAborted();};await check();if(!['ask','full'].includes(options.permission))return;
  const plan=await this.remote.plan(owner,agentId,options,[],acceptedSourceIds);await check();if(!plan.definitions.length)return;
  const sources=plan.sources.map(source=>({id:source.id,name:source.name,kind:source.kind,ready:source.ready,enabled:source.enabled,detail:source.detail,...(source.plugin!==undefined?{plugin:source.plugin}:{}),...(source.validation!==undefined?{validation:source.validation}:{})})).sort((a,b)=>a.id.localeCompare(b.id)),bindings=[];
  if(sources.length>1000)throw Error('Choose fewer preview connections.');
  for(const source of sources){await check();bindings.push({id:source.id,signature:await this.remote.fingerprint(owner,agentId,source.id,signal)});await check();}
  const body={...(typeof agentId==='string'?{version:1 as const,agentId}:{version:2 as const,principal:creationResourcePrincipal(agentId)}),owner,mode:options.mode,sources,definitions:structuredClone(plan.definitions),bindings},value={...body,key:key(body)};validatePreviewRemoteTools(value);return value;
 }
 async validate(owner:string,agentId:RemotePrincipal,options:ChatOptions,value:PreviewRemoteTools,signal:AbortSignal,guard:()=>Promise<void>){
  previewRemotePlan(owner,agentId,options,value);const current=await this.capture(owner,agentId,{...options,tools:value.sources.map(source=>source.id)},signal,guard,new Set(value.sources.map(source=>source.id)));if(!current||canonical(current)!==canonical(value))throw changed();
 }
}
export function previewRemotePlan(owner:string,agentId:RemotePrincipal,options:ChatOptions,value:PreviewRemoteTools):RemotePlan{
 validatePreviewRemoteTools(value);if(value.owner!==owner||canonical(previewRemotePrincipal(value))!==canonical(agentId)||value.mode!==options.mode||!['ask','full'].includes(options.permission)||value.sources.some(source=>!automaticComposioSource(source)&&options.tools!==undefined&&!options.tools.includes(source.id)))throw changed();
 return {mode:value.mode,sources:structuredClone(value.sources),definitions:structuredClone(value.definitions),denied:new Set()};
}
