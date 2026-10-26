import {accountOAuthScope,creationOAuthScope,mcpOAuthScopeKey} from './mcp-oauth-scope';
import {CreationRemoteResources} from './creation-remote-resources';
import {createHash} from 'node:crypto';
import {composioMcpAuth,composioMcpUrl} from './composio-mcp-contracts';
import type {SupabaseClient} from '@supabase/supabase-js';
import type {Secrets} from './secrets';
import {McpOAuth,type McpOAuthScope,type McpOAuthTarget} from './mcp-oauth';
import {Plugins} from './plugins';
import {mcpAddress} from './mcp-client';
import {mcpOAuthDeclaration} from './mcp-oauth-declaration';
import {CreationOAuthHandoffs} from './creation-oauth-handoffs';
import type {CreationResourcePrincipal} from './creation-resource-principal';
import type {CreationConnection} from './creation-connection-contracts';
const data=(result:any):any=>{if(result.error)throw Error('The MCP connection is unavailable for this account.');return result.data;};
export class McpOAuthConnections extends McpOAuth {
 readonly handoffs:CreationOAuthHandoffs;
 private creations:CreationRemoteResources;private setups=new Map<string,{scope:McpOAuthScope;cancelled:boolean;phase:'preparing'|'registering';work:Promise<{connected:boolean}>}>();
 constructor(db:SupabaseClient,secrets:Secrets,owner:()=>Promise<string>,open:(url:string)=>Promise<void>){
  const creations=new CreationRemoteResources(db);const target=async(scope:McpOAuthScope):Promise<McpOAuthTarget>=>{
   if(accountOAuthScope(scope)){mcpOAuthScopeKey(scope);return {address:composioMcpUrl,auth:structuredClone(composioMcpAuth),stamp:createHash('sha256').update(JSON.stringify(['composio-account-v1',scope.owner,composioMcpUrl,composioMcpAuth])).digest('hex')};}
   if(creationOAuthScope(scope))return creations.oauthTarget(scope.owner,scope.creation,scope.connection);
   data(await db.from('agents').select('id').eq('id',scope.agent).eq('user_id',scope.owner).eq('active',true).single());
   const row=data(await db.from('agent_mcp_connections').select('id,vault_server_url_id,is_active').eq('id',scope.connection).eq('agent_id',scope.agent).single());
   if(!row.is_active)throw Error('The MCP connection is disabled.');
   const values=data(await db.rpc('get_secret',{secret_id:row.vault_server_url_id})),address=mcpAddress(values?.[0]?.key).href;
   const plugin=await new Plugins(db).connection(scope.owner,scope.agent,scope.connection,address);
   const link=data(await db.from('desktop_plugin_connections').select('server_name').eq('user_id',scope.owner).eq('agent_id',scope.agent).eq('connection_id',scope.connection).single());
   const auth=mcpOAuthDeclaration(plugin.package.mcp?.mcpServers?.[link.server_name]?.extensions);
   return {address,auth,stamp:createHash('sha256').update(JSON.stringify([row.id,row.vault_server_url_id,address,plugin.digest,link.server_name])).digest('hex')};
  };
  super(secrets,target,owner,open);this.creations=new CreationRemoteResources(db,this);this.handoffs=new CreationOAuthHandoffs(db,secrets,this,owner,scope=>this.checked(scope));
 }


 private async setup(scope:McpOAuthScope,browser:(check:()=>void)=>Promise<void>){
  if(!creationOAuthScope(scope))throw Error('Choose an owned creation connection.');const id=mcpOAuthScopeKey(scope);if(this.setups.has(id))throw Error('This creation connection setup is already running.');
  const entry={scope:structuredClone(scope),cancelled:false,phase:'preparing' as 'preparing'|'registering',work:undefined as unknown as Promise<{connected:boolean}>},check=()=>{if(entry.cancelled)throw Error('MCP sign-in cancelled. Resume the retained sign-in if needed.');};
  const work=Promise.resolve().then(()=>this.handoffs.mutate(scope.owner,scope.creation.creationId,()=>this.checkOwner(scope),async()=>{check();await browser(check);check();await this.creations.registerAuthorization(scope.owner,scope.creation,scope.connection,undefined,()=>{check();entry.phase='registering';});await this.checkOwner(scope);return {connected:true};},{interrupt:false}));entry.work=work;this.setups.set(id,entry);try{return await work;}finally{if(this.setups.get(id)===entry)this.setups.delete(id);}
 }
 override async connect(scope:McpOAuthScope,options:{clientId?:string;clientMetadataUrl?:string}={}){const snapshot=structuredClone(scope);if(accountOAuthScope(snapshot))return super.connect(snapshot,options);if(!creationOAuthScope(snapshot)){await this.handoffs.preserveSavedChoice(snapshot);return super.connect(snapshot,options);}return this.setup(snapshot,async check=>{check();await super.connect(snapshot,options);});}
 async resumeCreationAuthorization(scope:McpOAuthScope){const snapshot=structuredClone(scope);if(!creationOAuthScope(snapshot))throw Error('Choose an owned creation connection.');return this.setup(snapshot,async check=>{await this.checkOwner(snapshot);check();});}
 override cancelPending(scope:McpOAuthScope){const entry=this.setups.get(mcpOAuthScopeKey(scope));if(entry&&entry.scope.owner===scope.owner){this.cancel(scope);return;}super.cancelPending(scope);}
 override cancel(scope?:McpOAuthScope){super.cancel(scope);const id=scope?mcpOAuthScopeKey(scope):undefined;for(const[key,entry]of this.setups)if(!id||id===key)entry.cancelled=true;}
 override cancelCreation(owner:string,creationId:string){super.cancelCreation(owner,creationId);for(const entry of this.setups.values())if(creationOAuthScope(entry.scope)&&entry.scope.owner===owner&&entry.scope.creation.creationId===creationId)this.cancel(entry.scope);}
 override pendingCreations(owner:string){const all=[...super.pendingCreations(owner),...[...this.setups.values()].filter(entry=>entry.scope.owner===owner).map(entry=>structuredClone(entry.scope))];return [...new Map(all.map(scope=>[mcpOAuthScopeKey(scope),scope])).values()];}
 setupPhase(scope:McpOAuthScope){return this.setups.get(mcpOAuthScopeKey(scope))?.phase??null;}
 async creationConnections(owner:string,principal:CreationResourcePrincipal):Promise<CreationConnection[]>{const rows=await this.creations.configurations(owner,principal),result:CreationConnection[]=[];for(const row of rows){if(row.accountConnector==='composio'){const grant=await this.grant({owner,accountConnector:'composio'});result.push({...row,state:grant?'connected':'disconnected',hasCredential:!!grant,phase:null});continue;}const scope={owner,creation:principal,connection:row.id},hasCredential=this.hasStoredCredential(scope);let state:CreationConnection['state']='not-required';if(row.auth!=='none'){const grant=await this.grant(scope),receipt=await this.creations.authorization(owner,principal.creationId,row.id),ready=!!grant&&!!receipt&&receipt.enabled&&receipt.scopeId===principal.id&&receipt.plugin===row.plugin&&receipt.digest===row.digest&&receipt.server===row.server&&receipt.grant===grant.grant&&receipt.stamp===grant.stamp;state=ready?'connected':grant&&!(receipt&&!receipt.enabled&&receipt.grant===grant.grant)?'resume':hasCredential?'reconnect':'disconnected';}result.push({...row,state,hasCredential,phase:this.setupPhase(scope)});}await this.checkOwner({owner,creation:principal,connection:rows[0]?.id??principal.id});await this.creations.checked(owner,principal);return result;}
 override async cancelAndWait(match:(scope:McpOAuthScope)=>boolean){const selected=[...this.setups.values()].filter(value=>match(structuredClone(value.scope)));for(const entry of selected)this.cancel(entry.scope);await super.cancelAndWait(match);await Promise.allSettled(selected.map(value=>value.work));}
 override async disconnect(scope:McpOAuthScope){const snapshot=structuredClone(scope);if(accountOAuthScope(snapshot))return super.disconnect(snapshot);if(creationOAuthScope(snapshot))return this.handoffs.mutate(snapshot.owner,snapshot.creation.creationId,()=>this.checkOwner(snapshot),async()=>{await this.creations.revokeAuthorization(snapshot.owner,snapshot.creation,snapshot.connection);await super.disconnect(snapshot);},{allowBound:true,allowRetired:true,connectionId:snapshot.connection});await this.handoffs.preserveSavedChoice(snapshot);await super.disconnect(snapshot);}
}
