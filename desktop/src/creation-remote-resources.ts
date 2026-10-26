import {composioMcpPluginName} from './composio-mcp-contracts';
import {creationAuthorization,type CreationAuthorization} from './creation-authorization';
import type {McpOAuth} from './mcp-oauth';
import {createHash,randomUUID} from 'node:crypto';
import type {SupabaseClient} from '@supabase/supabase-js';
import {CreationToolResources} from './creation-tool-resources';
import {creationPrincipal,creationResourcePrincipal,type CreationResourcePrincipal} from './creation-resource-principal';
import {Plugins} from './plugins';
import {mcpAddress} from './mcp-client';
import {mcpOAuthDeclaration} from './mcp-oauth-declaration';
import type {PluginPackage} from './plugin-contracts';
import type {ToolSource} from './tool-contracts';

const data=(result:any):any=>{if(result.error)throw Error('The creation connection configuration could not be read.');return result.data;};
const digest=(value:unknown)=>createHash('sha256').update(JSON.stringify(value,(_,item)=>item&&typeof item==='object'&&!Array.isArray(item)?Object.fromEntries(Object.keys(item).sort().map(key=>[key,item[key]])):item)).digest('hex');
type Package={name:string;digest:string;package:PluginPackage};
/** Deterministic version-8 UUIDs give each declared server a durable identity,
 * without making an executable connection or credential row while staging. */
export function creationConnectionId(principal:CreationResourcePrincipal,name:string,server:string){
 const hash=digest(['agentopia-creation-mcp-v1',principal.id,name,server]);
 return hash.slice(0,8)+'-'+hash.slice(8,12)+'-8'+hash.slice(13,16)+'-'+((parseInt(hash[16],16)&3)|8).toString(16)+hash.slice(17,20)+'-'+hash.slice(20,32);
}
export function creationAuthorizationSignature(owner:string,principal:CreationResourcePrincipal,plugin:string,packageDigest:string,server:string,grant:string,stamp:string){return digest(['creation-oauth-grant-v1',owner,principal.id,principal.creationId,principal.revision,plugin,packageDigest,server,grant,stamp]);}
export class CreationRemoteResources{
 private scopes:CreationToolResources;private plugins:Plugins;
 constructor(private db:SupabaseClient,private oauth?:McpOAuth){this.scopes=new CreationToolResources(db);this.plugins=new Plugins(db);}
 async principal(owner:string,creationId:string,revision:number){const scope=await this.scopes.read(owner,creationId);if(!scope||scope.revision!==revision)throw Error('Refresh the creation app selection before testing its connections.');const principal=creationPrincipal(scope);await this.checked(owner,principal);return principal;}
 async checked(owner:string,value:CreationResourcePrincipal){
  const principal=creationResourcePrincipal(value);await this.scopes.active(owner,principal.creationId);const scope=await this.scopes.read(owner,principal.creationId);
  if(!scope||scope.id!==principal.id||scope.revision!==principal.revision||scope.boundAgentId)throw Error('The creation app selection changed or was saved. Refresh it before another operation.');
  await this.scopes.validate(owner,scope.grants);
  const current=await this.scopes.read(owner,principal.creationId);if(!current||digest(current)!==digest(scope))throw Error('The creation app selection changed during validation. Refresh it before another operation.');
  return scope;
 }
 private async packages(owner:string,principal:CreationResourcePrincipal){
  const scope=await this.checked(owner,principal),packages:Package[]=[];
  for(const grant of scope.grants){const row=await this.plugins.reviewed(owner,grant.name);if(!row.enabled||row.digest!==grant.digest||row.source==='legacy')throw Error('A selected creation app changed or was revoked.');packages.push({name:row.name,digest:row.digest,package:row.package});}
  await this.checked(owner,principal);return packages;
 }
 private async secret(id:unknown){if(typeof id!=='string')return;const rows=data(await this.db.rpc('get_secret',{secret_id:id})),value=Array.isArray(rows)?rows[0]?.key:undefined;return typeof value==='string'?value:undefined;}
 async sources(owner:string,principal:CreationResourcePrincipal,serperProvider='serper_api'):Promise<ToolSource[]>{
  const packages=await this.packages(owner,principal),sources:ToolSource[]=[];
  for(const pkg of packages){
   const adapter=pkg.package.manifest.extensions?.['com.agentopia']?.adapter;
   if(adapter){const key=await this.plugins.searchCredential(owner,String(adapter),adapter==='serper'?serperProvider:'tavily_api');sources.push({id:'web_search',name:'Web search',kind:'web',plugin:pkg.name,enabled:true,ready:!!key?.is_active&&!!key.vault_secret_id,validation:'Schema validated',detail:'Use the explicitly selected '+adapter+' search app. External queries follow preview permissions.'});}
   for(const [server,declaration]of Object.entries(pkg.package.mcp?.mcpServers??{})){
    const auth=mcpOAuthDeclaration(declaration.extensions),id=creationConnectionId(principal,pkg.name,server);let ready=auth?.type!=='oauth'&&auth?.type!=='mixed';if(pkg.name===composioMcpPluginName)ready=!!await this.oauth?.grant({owner,accountConnector:'composio'});else if(!ready&&this.oauth){const grant=await this.oauth.grant({owner,creation:principal,connection:id}),receipt=await this.authorization(owner,principal.creationId,id);ready=!!grant&&!!receipt&&receipt.enabled&&receipt.scopeId===principal.id&&receipt.plugin===pkg.name&&receipt.digest===pkg.digest&&receipt.server===server&&receipt.grant===grant.grant&&receipt.stamp===grant.stamp;}
    sources.push({id:'mcp:'+creationConnectionId(principal,pkg.name,server),name:pkg.name+' · '+server,kind:'mcp',plugin:pkg.name,enabled:true,ready,validation:'Schema validated',detail:ready?'Use this reviewed MCP declaration. External calls follow preview permissions.':'Connect this creation’s reviewed server before testing it.'});
   }
  }
  await this.checked(owner,principal);return sources;
 }
 private async declared(owner:string,principal:CreationResourcePrincipal,id:string){
  const packages=await this.packages(owner,principal);
  for(const pkg of packages)for(const [server,declaration]of Object.entries(pkg.package.mcp?.mcpServers??{})){
   if(creationConnectionId(principal,pkg.name,server)!==id)continue;
   const auth=mcpOAuthDeclaration(declaration.extensions),address=mcpAddress(declaration.url);await this.checked(owner,principal);
   return {pkg,server,declaration,auth,address};
  }
  throw Error('This MCP connection is not selected for this creation.');
 }
 async configurations(owner:string,principal:CreationResourcePrincipal){const packages=await this.packages(owner,principal),rows=[];for(const pkg of packages)for(const[server,declaration]of Object.entries(pkg.package.mcp?.mcpServers??{})){const auth=mcpOAuthDeclaration(declaration.extensions);rows.push({...(pkg.name===composioMcpPluginName?{accountConnector:'composio' as const}:{}),id:creationConnectionId(principal,pkg.name,server),plugin:pkg.name,digest:pkg.digest,server,name:pkg.name+' · '+server,host:mcpAddress(declaration.url).hostname,auth:auth?.type??'none' as 'none'|'oauth'|'mixed',...(auth?.client?{client:{mode:auth.client.mode,...(auth.client.clientId?{clientId:auth.client.clientId}:{})}}:{})});}await this.checked(owner,principal);return rows;}
 async oauthTarget(owner:string,principal:CreationResourcePrincipal,id:string){
  const {pkg,server,declaration,auth,address}=await this.declared(owner,principal,id);
  if(pkg.name===composioMcpPluginName)throw Error('Connect your Composio account in Plugins. This draft uses its explicitly selected app access.');
  if(!auth||auth.type==='none')throw Error('This MCP creation declaration does not require browser sign-in.');
  return {address:address.href,auth,stamp:digest(['creation-oauth-v1',owner,principal.id,principal.creationId,pkg.name,pkg.digest,server,declaration])};
 }
 async connection(owner:string,principal:CreationResourcePrincipal,id:string,signal:AbortSignal=AbortSignal.timeout(30000)){
  signal.throwIfAborted();const {pkg,server,declaration,auth,address}=await this.declared(owner,principal,id);let token:string|undefined,authorization:{grant:string;stamp:string}|undefined;
  if(pkg.name===composioMcpPluginName){const current=await this.oauth?.authorization({owner,accountConnector:'composio'},signal);if(!current)throw Error('Connect Composio in Plugins before testing its apps.');token=current.token;authorization=current;}else if(auth&&auth.type!=='none'){const current=await this.oauth?.authorization({owner,creation:principal,connection:id},signal);if(!current)throw Error('This creation connection needs its own browser sign-in before use.');const receipt=await this.authorization(owner,principal.creationId,id);if(!receipt||!receipt.enabled||receipt.scopeId!==principal.id||receipt.plugin!==pkg.name||receipt.digest!==pkg.digest||receipt.server!==server||receipt.grant!==current.grant||receipt.stamp!==current.stamp)throw Error('Finish this creation’s owned connection setup before use.');token=current.token;authorization=current;}
  await this.checked(owner,principal);signal.throwIfAborted();
  return {managed:false as const,composio:false as const,row:{id,connection_name:pkg.name+' · '+server,vault_server_url_id:'',auth_config:{},is_active:true},address:address.href,token,host:address.hostname,signature:authorization?creationAuthorizationSignature(owner,principal,pkg.name,pkg.digest,server,authorization.grant,authorization.stamp):digest([principal,pkg.name,pkg.digest,server,declaration]),redactions:[] as string[]};
 }
 async authorization(owner:string,creationId:string,connectionId:string):Promise<CreationAuthorization|null>{const result=data(await this.db.rpc('desktop_creation_authorization',{p_user:owner,p_creation:creationId,p_connection:connectionId}));return result===null?null:creationAuthorization(result,owner,creationId,connectionId);}
 async registerAuthorization(owner:string,principal:CreationResourcePrincipal,id:string,writeId=randomUUID(),beforeCommit:()=>void=()=>{}){
  const {pkg,server}=await this.declared(owner,principal,id),grant=await this.oauth?.authorization({owner,creation:principal,connection:id},AbortSignal.timeout(30000)),target=await this.oauthTarget(owner,principal,id);if(!grant||grant.stamp!==target.stamp)throw Error('Complete this creation’s browser sign-in before authorizing it.');await this.checked(owner,principal);
  beforeCommit();const row=data(await this.db.rpc('desktop_set_creation_authorization',{p_user:owner,p_creation:principal.creationId,p_scope:principal.id,p_revision:principal.revision,p_connection:id,p_plugin:pkg.name,p_digest:pkg.digest,p_server:server,p_grant:grant.grant,p_stamp:grant.stamp,p_write:writeId})),receipt=creationAuthorization(row,owner,principal.creationId,id);await this.checked(owner,principal);const current=await this.oauth?.grant({owner,creation:principal,connection:id});if(!current||current.grant!==grant.grant||current.stamp!==grant.stamp)throw Error('The creation authorization changed while setup was being saved.');return receipt;
 }
 async revokeAuthorization(owner:string,principal:CreationResourcePrincipal,id:string){data(await this.db.rpc('desktop_revoke_creation_authorization',{p_user:owner,p_creation:principal.creationId,p_scope:principal.id,p_connection:id}));}
 async searchConfig(owner:string,principal:CreationResourcePrincipal,serperProvider:string){
  const packages=await this.packages(owner,principal),selected=packages.filter(pkg=>!!pkg.package.manifest.extensions?.['com.agentopia']?.adapter);
  if(selected.length!==1)throw Error('Explicitly select one search app for this creation.');const pkg=selected[0],adapter=pkg.package.manifest.extensions!['com.agentopia'].adapter as string;
  if(!['serper','tavily'].includes(adapter))throw Error('The selected search adapter is unsupported.');
  const row=await this.plugins.searchCredential(owner,String(adapter),adapter==='serper'?serperProvider:'tavily_api');
  if(!row?.is_active)throw Error('An administrator must configure the selected search app credential in Plugins.');const key=await this.secret(row.vault_secret_id);if(!key)throw Error('The selected search app credential is unavailable.');
  await this.checked(owner,principal);return {name:pkg.name,adapter,enabled:true,digest:pkg.digest,key,signature:digest([principal,pkg.name,pkg.digest,key])};
 }
}
