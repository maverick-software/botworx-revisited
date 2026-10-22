import {chromePluginName,chromeConnectionId} from './chrome-contracts';
import {imageGenerationPluginName} from './image-generation-contracts';
import type {SupabaseClient} from '@supabase/supabase-js';
import type {Identity} from './contracts';
import {pluginSchemaUrl,type PluginPackage,type PluginRecord} from './plugin-contracts';
import {validatePluginPackage,validateLegacyPlugin,pluginDigest,searchPlugins,bundledPlugins,examplePluginPackage} from './plugin-validation';
import type {SkillPackage} from './native-plugin-skills';
import {planPluginUpdate} from './plugin-update';
const data=(r:any):any=>{if(r.error)throw new Error('The plugin operation could not be completed.');return r.data;};
export class Plugins {
 constructor(private db:SupabaseClient,private imageConfigured:()=>boolean=()=>false){}
 private async owned(user:string,agent:string){data(await this.db.from('agents').select('id').eq('id',agent).eq('user_id',user).single());}
 async skillPackages(user:string,agent:string):Promise<SkillPackage[]>{
  data(await this.db.from('agents').select('id').eq('id',agent).eq('user_id',user).eq('active',true).single());
  const grants=data(await this.db.from('desktop_agent_plugins').select('plugin_name').eq('user_id',user).eq('agent_id',agent).eq('enabled',true));if(!grants.length)return [];
  const rows=data(await this.db.from('desktop_plugins').select('*').eq('user_id',user).eq('enabled',true).in('name',grants.map((grant:any)=>grant.plugin_name)));
  return rows.filter((row:any)=>row.package?.files).map((row:any)=>{this.checked(row);return {name:row.name,digest:row.digest,package:validatePluginPackage(row.package)};});
 }
 async ensure(user:string){
  for(const pkg of bundledPlugins)data(await this.db.from('desktop_plugins').upsert({user_id:user,name:pkg.manifest.name,package:pkg,digest:pluginDigest(pkg),source:'bundled'},{onConflict:'user_id,name',ignoreDuplicates:true}));
  const connections=data(await this.db.from('agent_mcp_connections').select('id,agent_id,connection_name,agents!inner(user_id)').eq('agents.user_id',user));
  const mapped=data(await this.db.from('desktop_plugin_connections').select('connection_id').eq('user_id',user));
  for(const row of connections.filter((c:any)=>!mapped.some((m:any)=>m.connection_id===c.id))){
   const pkg:PluginPackage={manifest:{$schema:pluginSchemaUrl,name:'mcp-'+row.id,version:'1.0.0',description:'Existing protected MCP connection: '+row.connection_name}};
   data(await this.db.from('desktop_plugins').upsert({user_id:user,name:pkg.manifest.name,package:pkg,digest:pluginDigest(pkg),source:'legacy'},{onConflict:'user_id,name',ignoreDuplicates:true}));
   data(await this.db.from('desktop_agent_plugins').upsert({user_id:user,plugin_name:pkg.manifest.name,agent_id:row.agent_id},{onConflict:'user_id,plugin_name,agent_id',ignoreDuplicates:true}));
   data(await this.db.from('desktop_plugin_connections').upsert({user_id:user,plugin_name:pkg.manifest.name,agent_id:row.agent_id,server_name:'existing',connection_id:row.id},{onConflict:'connection_id',ignoreDuplicates:true}));
  }
 }
 async list(user:Identity):Promise<PluginRecord[]>{
  await this.ensure(user.id);
  const [rows,grants,links,keys]=await Promise.all([
   this.db.from('desktop_plugins').select('*').eq('user_id',user.id).order('name').then(data),
   this.db.from('desktop_agent_plugins').select('*').eq('user_id',user.id).then(data),
   this.db.from('desktop_plugin_connections').select('plugin_name,agent_id,connection_id').eq('user_id',user.id).then(data),
   this.db.from('system_api_keys').select('provider_name,vault_secret_id,is_active').in('provider_name',['serper_api','tavily_api']).then(data)
  ]);
  return rows.map((row:any)=>{const adapter=row.package.manifest.extensions?.['com.agentopia']?.adapter;this.checked(row);return {name:row.name,version:row.package.manifest.version,description:row.package.manifest.description,enabled:row.enabled,bundled:row.source==='bundled',updatable:row.source==='imported',digest:row.digest,validation:'Schema validated',package:row.package,kind:row.package.manifest.extensions?.['com.agentopia']?.imageGeneration==='v1'?'images':adapter?'search':row.package.files&&!row.package.mcp?'skills':'mcp',configured:row.package.manifest.extensions?.['com.agentopia']?.imageGeneration==='v1'?this.imageConfigured():adapter?keys.some((key:any)=>key.provider_name===adapter+'_api'&&key.is_active&&key.vault_secret_id):true,assignments:grants.filter((g:any)=>g.plugin_name===row.name).map((g:any)=>({agent_id:g.agent_id,enabled:g.enabled,connection_ids:row.name===chromePluginName?[chromeConnectionId]:links.filter((l:any)=>l.plugin_name===row.name&&l.agent_id===g.agent_id).map((l:any)=>l.connection_id) }))};});
 }
 private checked(row:any){
  if(!row||row.name!==row.package?.manifest?.name||row.digest!==pluginDigest(row.package))throw new Error('Plugin integrity verification failed. Reinstall the reviewed package.');
  if(row.source==='legacy'){
   const expected={manifest:{$schema:pluginSchemaUrl,name:row.name,version:'1.0.0',description:row.package.manifest.description}};
   validateLegacyPlugin(row.package);if(pluginDigest(expected)!==pluginDigest(row.package))throw new Error('Invalid protected connection wrapper.');
  }else{validatePluginPackage(row.package,row.source==='bundled');if(row.source==='bundled'&&!bundledPlugins.some(pkg=>pkg.manifest.name===row.name&&pluginDigest(pkg)===row.digest))throw new Error('The bundled plugin differs from its packaged declaration.');}
  return row;
 }
 async connection(user:string,agent:string,id:string,address?:string):Promise<any>{
  const link=data(await this.db.from('desktop_plugin_connections').select('plugin_name,server_name').eq('user_id',user).eq('agent_id',agent).eq('connection_id',id).maybeSingle());
  // Existing agent settings can add a connection between catalog refreshes.
  if(!link){await this.ensure(user);const fresh=data(await this.db.from('desktop_plugin_connections').select('plugin_name,server_name').eq('user_id',user).eq('agent_id',agent).eq('connection_id',id).single());return this.connection(user,agent,id,address);}
  const row=await this.allowed(user,agent,link.plugin_name);if(address&&row.source==='imported'&&row.package.mcp?.mcpServers?.[link.server_name]?.url!==address)throw new Error('The connection address differs from its reviewed plugin manifest. Reinstall the updated package.');return row;
 }
 private async allowed(user:string,agent:string,name:string){
  const row=this.checked(data(await this.db.from('desktop_plugins').select('*').eq('user_id',user).eq('name',name).single()));
  const grant=data(await this.db.from('desktop_agent_plugins').select('enabled').eq('user_id',user).eq('agent_id',agent).eq('plugin_name',name).single());
  if(!row.enabled||!grant.enabled)throw new Error('This plugin is disabled or is not assigned to this agent.');return row;
 }
 async managedChrome(user:string,agent:string){await this.owned(user,agent);const row=await this.allowed(user,agent,chromePluginName);if(row.source!=='bundled'||row.package.manifest.extensions?.['com.agentopia']?.managedMcp!==chromePluginName)throw new Error('The Chrome plugin runtime is not its pinned declaration.');return row;}
 async imageGeneration(user:string,agent:string){await this.owned(user,agent);const row=await this.allowed(user,agent,imageGenerationPluginName);if(row.source!=='bundled'||row.package.manifest.extensions?.['com.agentopia']?.imageGeneration!=='v1')throw new Error('The image plugin differs from its pinned declaration.');return row;}
 async search(user:string,agent:string){
  await this.owned(user,agent);
  const grants=data(await this.db.from('desktop_agent_plugins').select('plugin_name,enabled').eq('user_id',user).eq('agent_id',agent));
  for(const g of grants){if(!g.enabled)continue;const row=data(await this.db.from('desktop_plugins').select('*').eq('user_id',user).eq('name',g.plugin_name).single());const adapter=row.package.manifest.extensions?.['com.agentopia']?.adapter;if(adapter){this.checked(row);return {name:row.name,adapter,enabled:row.enabled,digest:row.digest};}}
  const row=data(await this.db.from('desktop_plugins').select('*').eq('user_id',user).eq('name','serper-search').maybeSingle());
  if(row)this.checked(row);
  // Preserve an existing agent's Serper capability until explicitly assigned or disabled.
  if(!grants.some((g:any)=>['serper-search','tavily-search'].includes(g.plugin_name)))return {name:'serper-search',adapter:'serper',enabled:row?.enabled!==false,digest:row?.digest??pluginDigest(searchPlugins[0])};
  return {name:'serper-search',adapter:'serper',enabled:false,digest:''};
 }
 async call(action:string,args:Record<string,unknown>,user:Identity){
  if(action==='plugins.example')return examplePluginPackage;
  if(action==='plugins.list')return this.list(user);
  if(action==='plugins.validate'){const pkg=validatePluginPackage(args.package);return {package:pkg,digest:pluginDigest(pkg),validation:'Schema validated',notice:'Schema validation checks structure and host support. It does not certify the publisher or server.'};}
  await this.ensure(user.id);
  if(action==='plugins.install'){
   const pkg=validatePluginPackage(args.package),digest=pluginDigest(pkg);if(args.digest!==digest)throw new Error('Validate and review this exact package before installing.');
   if(bundledPlugins.some(p=>p.manifest.name===pkg.manifest.name)||pkg.manifest.name.startsWith('mcp-'))throw new Error('This plugin name is reserved.');
   const old=data(await this.db.from('desktop_plugins').select('name').eq('user_id',user.id).eq('name',pkg.manifest.name).maybeSingle());if(old)throw new Error('A plugin with this name is already installed. Open Manage plugin to review an update.');
   data(await this.db.from('desktop_plugins').insert({user_id:user.id,name:pkg.manifest.name,package:pkg,digest,source:'imported'}));return;
  }
  if(typeof args.name!=='string')throw new Error('Choose an installed plugin.');
  const row=this.checked(data(await this.db.from('desktop_plugins').select('*').eq('user_id',user.id).eq('name',args.name).single()));
  if(action==='plugins.reviewUpdate'||action==='plugins.update'){
   if(row.source!=='imported')throw new Error('Only imported plugins can be updated here.');
   if(args.previousDigest!==row.digest)throw new Error('The installed plugin changed. Refresh and review the update again.');
   const reviewed=planPluginUpdate(row.package,args.package);
   if(action==='plugins.reviewUpdate')return {...reviewed,digest:reviewed.update.digest,notice:'Review the new package and connection changes before updating. Active skill sessions will close and pending tool calls need a fresh review. Unchanged connections retain their protected credentials.'};
   if(args.digest!==reviewed.update.digest)throw new Error('Validate and review this exact update before applying it.');
   const result=await this.db.rpc('desktop_update_plugin',{p_user:user.id,p_name:row.name,p_expected_digest:row.digest,p_package:reviewed.package,p_digest:reviewed.update.digest});
   if(result.error)throw new Error('The plugin update could not be applied. Refresh and review it again.');
   return {digest:reviewed.update.digest};
  }
  if(action==='plugins.enable'){if(typeof args.enabled!=='boolean')throw new Error('Choose whether to enable this plugin.');data(await this.db.from('desktop_plugins').update({enabled:args.enabled}).eq('user_id',user.id).eq('name',row.name));return;}
  if(action==='plugins.assign'){if(typeof args.agentId!=='string'||typeof args.enabled!=='boolean')throw new Error('Choose an agent and assignment.');await this.owned(user.id,args.agentId);if(args.enabled&&!data(await this.db.from('agents').select('id').eq('id',args.agentId).eq('user_id',user.id).eq('active',true).maybeSingle()))throw new Error('A retired agent cannot receive a new plugin assignment.');return data(await this.db.rpc('desktop_assign_plugin',{p_user:user.id,p_name:row.name,p_agent:args.agentId,p_enabled:args.enabled}));}
  if(action==='plugins.remove'){
   if(row.source==='bundled')throw new Error('Bundled plugins can be disabled.');
   data(await this.db.rpc('desktop_remove_plugin',{p_user:user.id,p_name:row.name}));return;
  }
  if(action==='plugins.key.save'||action==='plugins.key.remove'){
   if(!user.admin)throw new Error('Administrator access is required.');const adapter=row.package.manifest.extensions?.['com.agentopia']?.adapter;if(row.source!=='bundled'||!['serper','tavily'].includes(adapter as string))throw new Error('Choose a bundled search connection.');
   const key=action.endsWith('remove')?null:args.key;if(key!==null&&(typeof key!=='string'||!key.trim()||key.length>4096))throw new Error('Enter a valid search API key.');
   data(await this.db.rpc('desktop_store_setting_secret',{p_user:user.id,p_scope:'api-key',p_id:adapter+'_api',p_secret:key,p_value:{name:adapter==='serper'?'Serper API':'Tavily API'}}));return;
  }
  throw new Error('Unsupported plugin operation.');
 }
}
