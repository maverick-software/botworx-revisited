import {Skills} from './skills';
import {hostPluginFamilies,hostPluginNames,type HostPluginFamily,ownHostTool} from './host-plugin-contracts';
import type {ToolDefinition} from './tool-contracts';
import {CreationToolResources} from './creation-tool-resources';
import {creationPrincipal} from './creation-resource-principal';
import {pluginPrincipalIdentity,type PluginPrincipal} from './plugin-resource-principal';
import {composioMcpPluginName,composioMcpConnectionId} from './composio-mcp-contracts';
import {composioServicePackage,composioServicePackageSlug,composioServiceConnectionId} from './composio-service-plugins';
import {chromePluginName,chromeConnectionId} from './chrome-contracts';
import {imageGenerationPluginName} from './image-generation-contracts';
import type {SupabaseClient} from '@supabase/supabase-js';
import type {Identity} from './contracts';
import {pluginSchemaUrl,type PluginPackage,type PluginRecord} from './plugin-contracts';
import {validatePluginPackage,validateLegacyPlugin,pluginDigest,searchPlugins,bundledPlugins,hostPlugins,examplePluginPackage} from './plugin-validation';
import type {SkillPackage} from './native-plugin-skills';
import {planPluginUpdate} from './plugin-update';
const data=(r:any):any=>{if(r.error)throw new Error('The plugin operation could not be completed.');return r.data;};
export class Plugins {
 constructor(private db:SupabaseClient,private imageConfigured:()=>boolean=()=>false,private serviceConfigured?:(owner:string,slug:string)=>Promise<boolean>,private legacyComposioConfigured:()=>boolean=()=>false){}
 async syncComposioServices(user:string,services:Array<{slug:string;name:string}>,completeConnectedInventory=false){
  const items=services.map(service=>{const pkg=composioServicePackage(service.slug,service.name);return {slug:service.slug,title:service.name,package:pkg,digest:pluginDigest(pkg)};});
  if(items.length>2000||new Set(items.map(item=>item.slug)).size!==items.length)throw Error('Invalid connected Composio service inventory.');
  data(await this.db.rpc('desktop_sync_composio_service_plugins',{p_user:user,p_items:items,p_complete_connected_inventory:completeConnectedInventory}));
 }
 async composioServices(user:string,agent?:string){
  const rows=data(await this.db.from('desktop_plugins').select('*').eq('user_id',user).like('name','composio-service-%')),parent=data(await this.db.from('desktop_plugins').select('*').eq('user_id',user).eq('name',composioMcpPluginName).maybeSingle());
  if(parent)this.checked(parent);
  const grants=agent?data(await this.db.from('desktop_agent_plugins').select('plugin_name,enabled').eq('user_id',user).eq('agent_id',agent)):[];
  if(agent){await this.owned(user,agent);data(await this.db.from('agents').select('id').eq('id',agent).eq('user_id',user).eq('active',true).single());}
  return rows.flatMap((row:any)=>{const slug=composioServicePackageSlug(row.package);if(!slug)return [];this.checked(row);return [{...row,slug,title:row.package.manifest.extensions['com.openai'].interface.displayName,connectionId:composioServiceConnectionId(row.name),enabled:!!parent?.enabled&&row.enabled&&(!agent||grants.some((grant:any)=>grant.plugin_name===row.name&&grant.enabled))}];});
 }
 async accountComposioService(user:string,agent:string,name:string){
  const row=(await this.composioServices(user,agent)).find((row:any)=>row.name===name);
  if(!row?.enabled)throw Error('This Composio service capability is disabled or unassigned for this agent.');return row;
 }
 async reviewed(user:string,name:string){return this.checked(data(await this.db.from('desktop_plugins').select('*').eq('user_id',user).eq('name',name).single()));}
 private async owned(user:string,agent:string){data(await this.db.from('agents').select('id').eq('id',agent).eq('user_id',user).single());}
 async skillPackages(user:string,agent:PluginPrincipal):Promise<SkillPackage[]>{
  const skills=new Skills(this.db);await skills.migrate(user);
  if(typeof agent!=='string'){const principal=pluginPrincipalIdentity(agent),scopes=new CreationToolResources(this.db);await scopes.active(user,agent.creationId);const scope=await scopes.read(user,agent.creationId);if(!scope||JSON.stringify(creationPrincipal(scope))!==JSON.stringify(principal))throw Error('The creation app selection changed or was saved. Refresh it before selecting skills.');await scopes.validate(user,scope.grants);const packages:SkillPackage[]=[];for(const grant of scope.grants){const row=await this.reviewed(user,grant.name);if(!row.enabled||row.digest!==grant.digest||row.source==='legacy')throw Error('A creation skill package changed or was revoked.');if(row.package.files)packages.push({name:row.name,digest:row.digest,package:row.package});}await scopes.active(user,agent.creationId);const current=await scopes.read(user,agent.creationId);if(!current||JSON.stringify(current)!==JSON.stringify(scope))throw Error('The creation app selection changed while reading skills.');return skills.runtime(user,packages,true);}
  data(await this.db.from('agents').select('id').eq('id',agent).eq('user_id',user).eq('active',true).single());
  const grants=data(await this.db.from('desktop_agent_plugins').select('plugin_name').eq('user_id',user).eq('agent_id',agent).eq('enabled',true));if(!grants.length)return [];
  const rows=data(await this.db.from('desktop_plugins').select('*').eq('user_id',user).eq('enabled',true).in('name',grants.map((grant:any)=>grant.plugin_name)));
  return skills.runtime(user,rows.filter((row:any)=>row.package?.files).map((row:any)=>{this.checked(row);return {name:row.name,digest:row.digest,package:validatePluginPackage(row.package)};}),false,agent);
 }
 async hostAvailability(user:string,agent?:PluginPrincipal){
  let creationScope:Awaited<ReturnType<CreationToolResources["read"]>>=null;await this.ensure(user);if(typeof agent==='string')await this.owned(user,agent);else if(agent){const resources=new CreationToolResources(this.db);await resources.active(user,agent.creationId);const scope=await resources.read(user,agent.creationId);if(!scope||scope.id!==agent.id||scope.revision!==agent.revision||scope.boundAgentId)throw Error('The creation plugin selection changed.');await resources.validate(user,scope.grants);creationScope=scope;}
  const rows=data(await this.db.from('desktop_plugins').select('*').eq('user_id',user).in('name',hostPluginNames));
  const grants=typeof agent==='string'?data(await this.db.from('desktop_agent_plugins').select('plugin_name,enabled').eq('user_id',user).eq('agent_id',agent)):agent?creationScope!.grants.map(grant=>({plugin_name:grant.name,enabled:true})):[];
  return new Set<string>(rows.filter((row:any)=>{this.checked(row);return row.enabled&&(!grants||grants.some((grant:any)=>grant.plugin_name===row.name&&grant.enabled));}).map((row:any)=>row.name));
 }
 async hostEnabled(user:string,agent:PluginPrincipal|undefined,family:HostPluginFamily){return (await this.hostAvailability(user,agent)).has(hostPluginFamilies[family].name);}
 async availableDefinitions(user:string,agent:PluginPrincipal|undefined,definitions:ToolDefinition[]){const available=await this.hostAvailability(user,agent);return definitions.map(ownHostTool).filter(tool=>(tool.hostPlugins??[]).every(name=>!hostPluginNames.includes(name as any)||available.has(name)));}
 async assertHostTool(user:string,agent:PluginPrincipal|undefined,name:string){const {hostToolPlugin}=await import('./host-plugin-contracts');const plugin=hostToolPlugin(name);if(plugin&&!(await this.hostAvailability(user,agent)).has(plugin))throw Error('This tool’s plugin is disabled or is not assigned to this agent.');}
 async ensure(user:string){
  for(const pkg of bundledPlugins.filter(pkg=>!hostPlugins.includes(pkg)))data(await this.db.from('desktop_plugins').upsert({user_id:user,name:pkg.manifest.name,package:pkg,digest:pluginDigest(pkg),source:'bundled'},{onConflict:'user_id,name',ignoreDuplicates:true}));
  data(await this.db.rpc('desktop_seed_host_plugins',{p_user:user,p_packages:hostPlugins.map(pkg=>({name:pkg.manifest.name,package:pkg,digest:pluginDigest(pkg)}))}));
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
  const skills=new Skills(this.db);await skills.migrate(user.id);const hidden=await skills.hidden(user.id);
  const [rows,grants,links,keys,ownedKeys]=await Promise.all([
   this.db.from('desktop_plugins').select('*').eq('user_id',user.id).order('name').then(data),
   this.db.from('desktop_agent_plugins').select('*').eq('user_id',user.id).then(data),
   this.db.from('desktop_plugin_connections').select('plugin_name,agent_id,connection_id').eq('user_id',user.id).then(data),
   this.db.from('system_api_keys').select('provider_name,vault_secret_id,is_active').in('provider_name',['serper_api','tavily_api']).then(data),
   this.db.from('desktop_plugin_credentials').select('plugin_name,vault_secret_id,enabled').eq('user_id',user.id).then(data)
  ]);
  const configuredServices=new Map<string,boolean>();for(const row of rows){const slug=composioServicePackageSlug(row.package);if(slug)configuredServices.set(row.name,this.serviceConfigured?await this.serviceConfigured(user.id,slug):false);}
  return rows.filter((row:any)=>!hidden.has(row.name)).map((row:any)=>{const adapter=row.package.manifest.extensions?.['com.agentopia']?.adapter,service=composioServicePackageSlug(row.package);this.checked(row);return {name:row.name,...(service?{displayName:row.package.manifest.extensions['com.openai'].interface.displayName}:{}),version:row.package.manifest.version,description:row.package.manifest.description,enabled:row.enabled,bundled:row.source==='bundled',updatable:row.source==='imported',digest:row.digest,validation:'Schema validated',package:row.package,kind:service?'composio-service':row.package.manifest.extensions?.['com.agentopia']?.hostFamily?(row.name==='composio'?'composio':'host'):row.package.manifest.extensions?.['com.agentopia']?.imageGeneration==='v1'?'images':adapter?'search':row.package.files&&!row.package.mcp?'skills':'mcp',configured:service?configuredServices.get(row.name)===true:row.name==='composio'?this.legacyComposioConfigured():row.package.manifest.extensions?.['com.agentopia']?.imageGeneration==='v1'?this.imageConfigured():adapter?(ownedKeys.some((key:any)=>key.plugin_name===row.name)?ownedKeys.some((key:any)=>key.plugin_name===row.name&&key.enabled&&key.vault_secret_id):keys.some((key:any)=>key.provider_name===adapter+'_api'&&key.is_active&&key.vault_secret_id)):true,assignments:grants.filter((g:any)=>g.plugin_name===row.name).map((g:any)=>({agent_id:g.agent_id,enabled:g.enabled,connection_ids:service?[composioServiceConnectionId(row.name)]:row.name===composioMcpPluginName?[composioMcpConnectionId]:row.name===chromePluginName?[chromeConnectionId]:links.filter((l:any)=>l.plugin_name===row.name&&l.agent_id===g.agent_id).map((l:any)=>l.connection_id) }))};});
 }
 private checked(row:any){
  if(!row||row.name!==row.package?.manifest?.name||row.digest!==pluginDigest(row.package))throw new Error('Plugin integrity verification failed. Reinstall the reviewed package.');
  if(row.source==='legacy'){
   const expected={manifest:{$schema:pluginSchemaUrl,name:row.name,version:'1.0.0',description:row.package.manifest.description}};
   validateLegacyPlugin(row.package);if(pluginDigest(expected)!==pluginDigest(row.package))throw new Error('Invalid protected connection wrapper.');
  }else{validatePluginPackage(row.package,row.source==='bundled');if(row.source==='bundled'&&!composioServicePackageSlug(row.package)&&!bundledPlugins.some(pkg=>pkg.manifest.name===row.name&&pluginDigest(pkg)===row.digest))throw new Error('The bundled plugin differs from its packaged declaration.');}
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
 async accountComposio(user:string,agent:string){await this.owned(user,agent);const row=await this.allowed(user,agent,composioMcpPluginName);if(row.source!=='bundled')throw Error('The Composio connector differs from its pinned declaration.');data(await this.db.from('agents').select('id').eq('id',agent).eq('user_id',user).eq('active',true).single());return row;}
 async managedChrome(user:string,agent:string){await this.owned(user,agent);const row=await this.allowed(user,agent,chromePluginName);if(row.source!=='bundled'||row.package.manifest.extensions?.['com.agentopia']?.managedMcp!==chromePluginName)throw new Error('The Chrome plugin runtime is not its pinned declaration.');return row;}
 async imageGeneration(user:string,agent:string){await this.owned(user,agent);const row=await this.allowed(user,agent,imageGenerationPluginName);if(row.source!=='bundled'||row.package.manifest.extensions?.['com.agentopia']?.imageGeneration!=='v1')throw new Error('The image plugin differs from its pinned declaration.');return row;}
 async searchCredential(user:string,adapter:string,provider=adapter+'_api'){
  if(!['serper','tavily'].includes(adapter))throw Error('Choose a supported search adapter.');
  const own=data(await this.db.from('desktop_plugin_credentials').select('vault_secret_id,enabled').eq('user_id',user).eq('plugin_name',adapter+'-search').maybeSingle());
  if(own)return {vault_secret_id:own.vault_secret_id,is_active:own.enabled,scope:'account' as const};
  const shared=data(await this.db.from('system_api_keys').select('vault_secret_id,is_active').eq('provider_name',provider).maybeSingle());return shared?{...shared,scope:'shared' as const}:undefined;
 }
 async search(user:string,agent:string){
  await this.owned(user,agent);
  const grants=data(await this.db.from('desktop_agent_plugins').select('plugin_name,enabled').eq('user_id',user).eq('agent_id',agent));
  for(const g of grants){if(!g.enabled)continue;const row=data(await this.db.from('desktop_plugins').select('*').eq('user_id',user).eq('name',g.plugin_name).single());const adapter=row.package.manifest.extensions?.['com.agentopia']?.adapter;if(adapter){this.checked(row);return {name:row.name,adapter,enabled:row.enabled,digest:row.digest};}}
  return {name:'serper-search',adapter:'serper',enabled:false,digest:''};
 }
 async call(action:string,args:Record<string,unknown>,user:Identity){
  if(action==='plugins.example')return examplePluginPackage;
  if(action==='plugins.list')return this.list(user);
  if(action==='plugins.validate'){const pkg=validatePluginPackage(args.package);return {package:pkg,digest:pluginDigest(pkg),validation:'Schema validated',notice:'Schema validation checks structure and host support. It does not certify the publisher or server.'};}
  await this.ensure(user.id);
  if(action==='plugins.install'){
   const pkg=validatePluginPackage(args.package),digest=pluginDigest(pkg);if(pkg.files&&!pkg.mcp)throw Error('Import skill-only packages from Skills.');if(args.digest!==digest)throw new Error('Validate and review this exact package before installing.');
   if(bundledPlugins.some(p=>p.manifest.name===pkg.manifest.name)||pkg.manifest.name.startsWith('mcp-')||pkg.manifest.name.startsWith('skill-'))throw new Error('This plugin name is reserved.');
   const old=data(await this.db.from('desktop_plugins').select('name').eq('user_id',user.id).eq('name',pkg.manifest.name).maybeSingle());if(old)throw new Error('A plugin with this name is already installed. Open Manage plugin to review an update.');
   data(await this.db.from('desktop_plugins').insert({user_id:user.id,name:pkg.manifest.name,package:pkg,digest,source:'imported'}));return;
  }
  if(typeof args.name==='string'&&(await new Skills(this.db).hidden(user.id)).has(args.name))throw Error('Manage this skill from Skills.');
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
   const adapter=row.package.manifest.extensions?.['com.agentopia']?.adapter;if(row.source!=='bundled'||!['serper','tavily'].includes(adapter as string))throw new Error('Choose a bundled search connection.');
   const key=action.endsWith('remove')?null:args.key;if(key!==null&&(typeof key!=='string'||!key.trim()||key.length>4096))throw new Error('Enter a valid search API key.');
   data(await this.db.rpc('desktop_store_plugin_credential',{p_user:user.id,p_plugin:row.name,p_secret:key}));return;
  }
  throw new Error('Unsupported plugin operation.');
 }
}
