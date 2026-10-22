import {createHash} from 'node:crypto';
import type {SupabaseClient} from '@supabase/supabase-js';
import type {Secrets} from './secrets';
import {McpOAuth,type McpOAuthScope,type McpOAuthTarget} from './mcp-oauth';
import {Plugins} from './plugins';
import {mcpAddress} from './mcp-client';
import {mcpOAuthDeclaration} from './mcp-oauth-declaration';
const data=(result:any):any=>{if(result.error)throw Error('The MCP connection is unavailable for this account.');return result.data;};
export class McpOAuthConnections extends McpOAuth {
 constructor(db:SupabaseClient,secrets:Secrets,owner:()=>Promise<string>,open:(url:string)=>Promise<void>){
  const target=async(scope:McpOAuthScope):Promise<McpOAuthTarget>=>{
   data(await db.from('agents').select('id').eq('id',scope.agent).eq('user_id',scope.owner).eq('active',true).single());
   const row=data(await db.from('agent_mcp_connections').select('id,vault_server_url_id,is_active').eq('id',scope.connection).eq('agent_id',scope.agent).single());
   if(!row.is_active)throw Error('The MCP connection is disabled.');
   const values=data(await db.rpc('get_secret',{secret_id:row.vault_server_url_id})),address=mcpAddress(values?.[0]?.key).href;
   const plugin=await new Plugins(db).connection(scope.owner,scope.agent,scope.connection,address);
   const link=data(await db.from('desktop_plugin_connections').select('server_name').eq('user_id',scope.owner).eq('agent_id',scope.agent).eq('connection_id',scope.connection).single());
   const auth=mcpOAuthDeclaration(plugin.package.mcp?.mcpServers?.[link.server_name]?.extensions);
   return {address,auth,stamp:createHash('sha256').update(JSON.stringify([row.id,row.vault_server_url_id,address,plugin.digest,link.server_name])).digest('hex')};
  };
  super(secrets,target,owner,open);this.readTarget=target;
 }
 private readTarget:(scope:McpOAuthScope)=>Promise<McpOAuthTarget>;
 async status(scope:McpOAuthScope){try{return this.connected(scope,await this.readTarget(scope));}catch{return false;}}
}
