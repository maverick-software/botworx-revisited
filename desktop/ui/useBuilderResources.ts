import {useEffect,useRef,useState} from 'react';
import type {BuilderResources,BuilderResource} from '../src/agent-builder-resources';
import {creationToolScope,type CreationToolScope,type CreationPluginGrant} from '../src/creation-tool-scope';
import {draftPreviewId} from '../src/agent-draft-preview-contracts';
import type {PluginRecord} from '../src/plugin-contracts';
import type {SkillCatalog} from '../src/skill-contracts';
import {composioMcpPluginName} from '../src/composio-mcp-contracts';
import {chromePluginName} from '../src/chrome-contracts';
import type {CreationAppCatalog} from './CreationApps';
import {call} from './ui';

export type BuilderResourceTarget={owner:string;source:string|null;creationId?:string};
export type BuilderResourceApplication={requestId:string;basis:BuilderResources;apps?:string[];assignedSkills?:string[]};
type Snapshot={resources:BuilderResources;scope:CreationToolScope|null};
type ResourceCall=<T>(action:string,args?:Record<string,unknown>)=>Promise<T>;
const selected=(rows:BuilderResource[])=>rows.filter(row=>row.assigned).map(row=>row.id).sort();
const canonical=(resources:BuilderResources,assignments=true)=>JSON.stringify({revision:resources.revision,apps:resources.apps.map(row=>({...row,...(!assignments?{assigned:false}:{})})).sort((a,b)=>a.id.localeCompare(b.id)),skills:resources.skills.map(row=>({...row,...(!assignments?{assigned:false}:{})})).sort((a,b)=>a.id.localeCompare(b.id))});
const sameIds=(a:string[],b:string[])=>JSON.stringify([...a].sort())===JSON.stringify([...b].sort());
const stale=()=>Error('The app or skill selection changed while this response was being prepared. Review the current selection and ask again.');
const publicRow=(row:{name:string;displayName?:string;description:string;digest:string;enabled:boolean;configured:boolean},assigned:boolean):BuilderResource=>({id:row.name,name:(row.displayName||row.name).slice(0,100),description:row.description.slice(0,1000),digest:row.digest,enabled:row.enabled,configured:row.configured,assigned});
const digest=async(value:unknown)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(value))))).map(value=>value.toString(16).padStart(2,'0')).join('');

/** Reads only through the existing owned resource APIs; returned context excludes files, connections and credentials. */
export async function readBuilderResources(target:BuilderResourceTarget,rpc:ResourceCall=call):Promise<Snapshot>{
 if(!target.owner)throw Error('Sign in before choosing agent capabilities.');
 if(!target.source){
  const creationId=draftPreviewId(target.creationId),catalog=await rpc<CreationAppCatalog>('creationTools.catalog',{owner:target.owner,creationId});
  const scope=catalog.scope?creationToolScope(catalog.scope,target.owner,creationId):null;
  if(catalog.retirement||scope?.boundAgentId)throw Error('This creation is already saved or discarded. Open the current agent before changing capabilities.');
  const grants=scope?.grants??[],apps=catalog.plugins.filter(row=>row.name!==composioMcpPluginName&&(row.name!=='composio'||row.configured||grants.some(grant=>grant.name===row.name))).map(row=>publicRow(row,grants.some(grant=>grant.name===row.name))),skills=(catalog.skills??[]).map(row=>publicRow(row,grants.some(grant=>grant.name===row.name)));
  // Retained grants remain part of the exact selection, including when their package was removed.
  for(const grant of grants)if(![...apps,...skills].some(row=>row.id===grant.name))apps.push({id:grant.name,name:'Retained capability',description:'Previously selected capability whose package is unavailable.',digest:grant.digest,enabled:false,configured:false,assigned:true});
  // A replaced package cannot silently upgrade an existing reviewed grant.
  for(const row of [...apps,...skills]){const grant=grants.find(grant=>grant.name===row.id);if(grant&&grant.digest!==row.digest)row.configured=false;}
  return {resources:{revision:scope?.revision??null,apps,skills},scope};
 }
 const [plugins,catalog]=await Promise.all([rpc<PluginRecord[]>('plugins.list'),rpc<SkillCatalog>('skills.list')]);
 const apps=plugins.filter(row=>row.kind!=='skills'&&row.name!==composioMcpPluginName&&(row.name!=='composio'||row.configured||row.assignments.some(grant=>grant.agent_id===target.source&&grant.enabled))).map(row=>{const grant=row.assignments.find(grant=>grant.agent_id===target.source),value=publicRow(row,grant?.enabled===true);if(row.kind==='mcp'&&!row.package.mcp&&row.name!==chromePluginName&&!grant)value.configured=false;return value;});
 const skills=await Promise.all(catalog.skills.filter(row=>row.scope==='account').map(async row=>({id:row.id,name:row.name.slice(0,100),description:row.description.slice(0,1000),digest:await digest({revision:row.revision,files:row.files}),enabled:row.enabled,configured:true,assigned:row.assignments.some(grant=>grant.agent_id===target.source&&grant.enabled)})));
 return {resources:{revision:null,apps,skills},scope:null};
}

function validateDesired(snapshot:Snapshot,input:BuilderResourceApplication){
 for(const [kind,ids] of [['apps',input.apps],['skills',input.assignedSkills]] as const){
  if(ids===undefined)continue;
  if(!Array.isArray(ids)||new Set(ids).size!==ids.length)throw Error('Choose distinct app and skill identifiers.');
  for(const id of ids){const current=snapshot.resources[kind].find(row=>row.id===id),captured=input.basis[kind].find(row=>row.id===id);if(!current||!captured||current.digest!==captured.digest||(!current.enabled||!current.configured)&&!(current.assigned&&captured.assigned))throw Error('An app or skill is unavailable or changed. Refresh the selection before applying this response.');}
 }
}
const achieved=(resources:BuilderResources,input:BuilderResourceApplication)=>(input.apps===undefined||sameIds(selected(resources.apps),input.apps))&&(input.assignedSkills===undefined||sameIds(selected(resources.skills),input.assignedSkills));

/** One attempt only. Lost acknowledgements are inspected, and partially saved assignments remain visible. */
export async function applyBuilderResources(target:BuilderResourceTarget,input:BuilderResourceApplication,options:{rpc?:ResourceCall;beforeWrite?:()=>Promise<void>;current?:()=>boolean;changed?:(snapshot:Snapshot)=>void}={}):Promise<Snapshot>{
 const rpc=options.rpc??call,guard=()=>{if(options.current&&!options.current())throw Error('The account or agent changed. Open the current agent before applying this response.');};
 guard();const snapshot=await readBuilderResources(target,rpc);guard();validateDesired(snapshot,input);
 if(canonical(snapshot.resources)!==canonical(input.basis)){
  // The stable creation receipt proves a completed write; no write is repeated after remount.
  if(!target.source&&snapshot.scope?.writeId===input.requestId&&achieved(snapshot.resources,input)){options.changed?.(snapshot);return snapshot;}
  throw stale();
 }
 if(achieved(snapshot.resources,input)){options.changed?.(snapshot);return snapshot;}
 await options.beforeWrite?.();guard();
 if(!target.source){
  draftPreviewId(input.requestId);
  const rows=[...(input.apps===undefined?snapshot.resources.apps.filter(row=>row.assigned):snapshot.resources.apps.filter(row=>input.apps!.includes(row.id))),...(input.assignedSkills===undefined?snapshot.resources.skills.filter(row=>row.assigned):snapshot.resources.skills.filter(row=>input.assignedSkills!.includes(row.id)))];
  const grants:CreationPluginGrant[]=rows.map(row=>({name:row.id,digest:snapshot.scope?.grants.find(grant=>grant.name===row.id)?.digest??row.digest!})).sort((a,b)=>a.name.localeCompare(b.name));
  try{await rpc('creationTools.write',{owner:target.owner,input:{creationId:target.creationId,expectedRevision:snapshot.scope?.revision??0,writeId:input.requestId,grants}});guard();}
  catch(reason){guard();let actual:Snapshot;try{actual=await readBuilderResources(target,rpc);guard();options.changed?.(actual);}catch{throw Error((reason as Error).message+' The outcome could not be inspected. Refresh capabilities before another attempt.');}if(actual.scope?.writeId===input.requestId&&achieved(actual.resources,input))return actual;throw Error((reason as Error).message+' The current capability selection has been reloaded; review it before another attempt.');}
 }else{
  const operations=[...snapshot.resources.apps.filter(row=>input.apps!==undefined&&row.assigned!==input.apps.includes(row.id)).map(row=>({action:'plugins.assign',args:{name:row.id,agentId:target.source,enabled:input.apps!.includes(row.id)}})),...snapshot.resources.skills.filter(row=>input.assignedSkills!==undefined&&row.assigned!==input.assignedSkills.includes(row.id)).map(row=>({action:'skills.assign',args:{id:row.id,agentId:target.source,enabled:input.assignedSkills!.includes(row.id)}}))];
  for(const operation of operations){guard();try{await rpc(operation.action,operation.args);guard();}catch(reason){guard();let actual:Snapshot;try{actual=await readBuilderResources(target,rpc);guard();options.changed?.(actual);}catch{throw Error((reason as Error).message+' Some assignments may have saved. Refresh capabilities to inspect the result.');}if(achieved(actual.resources,input))return actual;throw Error((reason as Error).message+' Some capability changes may have saved. The actual selection has been reloaded; review it before another attempt.');}}
 }
 const actual=await readBuilderResources(target,rpc);guard();options.changed?.(actual);if(!achieved(actual.resources,input))throw Error('The actual capability selection differs from this response. Review the reloaded selection before another attempt.');return actual;
}

export function useBuilderResources({owner,source,creationId,revision=0,beforeWrite,changed}:BuilderResourceTarget&{revision?:number;beforeWrite?:()=>Promise<void>;changed?:(scope:CreationToolScope|null)=>void}){
 const [snapshot,setSnapshot]=useState<Snapshot|null>(null),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(''),[reload,setReload]=useState(0),generation=useRef(0),key=owner+':'+(source??creationId),currentKey=useRef(key),callbacks=useRef({beforeWrite,changed}),operation=useRef(false);currentKey.current=key;callbacks.current={beforeWrite,changed};
 const [loadedKey,setLoadedKey]=useState('');
 useEffect(()=>{setBusy(false);},[key]);
 useEffect(()=>{let live=true;const token=++generation.current;setLoading(true);setError('');void readBuilderResources({owner,source,creationId}).then(value=>{if(live&&generation.current===token&&currentKey.current===key){setSnapshot(value);setLoadedKey(key);}}).catch(reason=>{if(live&&generation.current===token){setSnapshot(null);setError((reason as Error).message);}}).finally(()=>{if(live&&generation.current===token)setLoading(false);});return()=>{live=false;generation.current++;};},[owner,source,creationId,revision,reload]);
 const apply=async(input:BuilderResourceApplication)=>{if(operation.current||loading||loadedKey!==key||!snapshot)throw Error('Wait for the current capability selection to load.');operation.current=true;setBusy(true);setError('');const token=generation.current;try{return await applyBuilderResources({owner,source,creationId},input,{current:()=>currentKey.current===key&&generation.current===token,beforeWrite:()=>callbacks.current.beforeWrite?.()??Promise.resolve(),changed:value=>{setSnapshot(value);callbacks.current.changed?.(value.scope);}});}catch(reason){if(currentKey.current===key)setError((reason as Error).message);throw reason;}finally{operation.current=false;if(currentKey.current===key)setBusy(false);}};
 return {resources:loadedKey===key?snapshot?.resources??null:null,loading,busy,error,apply,refresh:()=>setReload(value=>value+1)};
}
