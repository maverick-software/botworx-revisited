import {randomUUID} from 'node:crypto';
import {Cron} from 'croner';
import type {SupabaseClient} from '@supabase/supabase-js';
import {capabilityOptions,type Identity} from './contracts';
import {mcpAddress} from './mcp-client';

function data<T extends {data:unknown;error:any}>(r:T):NonNullable<T['data']>{if(r.error)throw new Error(r.error.message);return r.data as NonNullable<T['data']>;}
function str(v:unknown,max=4000){if(typeof v!=='string'||v.length>max)throw new Error('Invalid settings value.');return v.trim();}
function id(v:unknown){const s=str(v,36);if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s))throw new Error('Invalid record identifier.');return s;}
function bool(v:unknown){if(typeof v!=='boolean')throw new Error('Choose an enabled or disabled value.');return v;}
function integer(v:unknown,min:number,max:number){if(typeof v!=='number'||!Number.isInteger(v)||v<min||v>max)throw new Error(`Choose a whole number from ${min} to ${max}.`);return v;}
function ids(v:unknown){if(!Array.isArray(v)||v.length>1000)throw new Error('Invalid resource selection.');return [...new Set(v.map(id))];}
function object(v:unknown):Record<string,any>{if(!v||typeof v!=='object'||Array.isArray(v))throw new Error('Enter a JSON object.');return v as Record<string,any>;}
export const systemKeyProviders=[{id:'openai',name:'OpenAI',prefix:'sk-'},{id:'anthropic',name:'Anthropic',prefix:'sk-ant-'},{id:'mistral_ai',name:'Mistral AI',prefix:''},{id:'serper_api',name:'Serper API',prefix:''},{id:'tavily_api',name:'Tavily API',prefix:''}];
export class ProjectSettings {
 constructor(private db:SupabaseClient){}
 private admin(user:Identity){if(!user.admin)throw new Error('Administrator access is required.');}
 private async all(query:()=>any){const result:any[]=[];for(let offset=0;;offset+=500){const batch=data(await query().range(offset,offset+499)) as any[];result.push(...batch);if(batch.length<500)return result;}}
 private async agent(user:Identity,agentId:unknown){const agent=id(agentId);data(await this.db.from('agents').select('id').eq('id',agent).eq('user_id',user.id).single());return agent;}
 async call(action:string,args:Record<string,unknown>,user:Identity):Promise<any>{
  const db=this.db;
  if(action==='settings.profile.get')return data(await db.from('profiles').select('username,first_name,last_name,company_name,title,mobile_number').eq('id',user.id).maybeSingle())??{};
  if(action==='settings.profile.save'){
   const value=object(args.value),row:Record<string,string|null>={};
   for(const key of ['username','first_name','last_name','company_name','title','mobile_number'])row[key]=str(value[key]??'',key==='mobile_number'?40:100)||null;
   if(row.username&&!/^[a-zA-Z0-9_.-]{3,50}$/.test(row.username))throw new Error('Use 3–50 letters, numbers, dots, hyphens, or underscores for your username.');
   data(await db.from('profiles').upsert({id:user.id,...row,updated_at:new Date().toISOString()},{onConflict:'id'}));return;
  }
  if(action==='agentSettings.get'){
   const agent=await this.agent(user,args.agentId);
   const [record,datastores,links,documents,assigned,connections,permissions,teams,members,contacts,contactPermission,contactLinks,mcp,tasks]=await Promise.all([
    db.from('agents').select('id,name,personality,email_enabled,sms_enabled,slack_enabled,discord_enabled,telegram_enabled,whatsapp_enabled,metadata').eq('id',agent).single().then(data),
    this.all(()=>db.from('datastores').select('id,name,type').eq('user_id',user.id).order('id')),
    db.from('agent_datastores').select('datastore_id').eq('agent_id',agent).then(data),
    this.all(()=>db.from('media_library').select('id,display_name,file_name,processing_status,file_extension,file_size,version,is_archived,category,tags,description,updated_at,storage_bucket').eq('user_id',user.id).order('id')),
    db.from('agent_media_assignments').select('media_id').eq('agent_id',agent).eq('user_id',user.id).eq('is_active',true).then(data),
    this.connections(user),
    db.from('agent_integration_permissions').select('user_oauth_connection_id').eq('agent_id',agent).eq('granted_by_user_id',user.id).eq('is_active',true).then(data),
    this.all(()=>db.from('teams').select('id,name').eq('owner_user_id',user.id).order('id')),
    db.from('team_members').select('team_id').eq('agent_id',agent).then(data),
    this.all(()=>db.from('contacts').select('id,display_name,organization').eq('user_id',user.id).is('deleted_at',null).eq('contact_status','active').order('id')),
    db.from('agent_contact_permissions').select('permission_type').eq('agent_id',agent).maybeSingle().then(data),
    db.from('agent_specific_contact_access').select('contact_id').eq('agent_id',agent).eq('user_id',user.id).then(data),
    db.from('agent_mcp_connections').select('id,connection_name,connection_type,is_active,server_info,auth_config').eq('agent_id',agent).order('created_at').then(data),
    this.all(()=>db.from('agent_tasks').select('id,name,instructions,cron_expression,timezone,status,next_run_at,total_executions').eq('agent_id',agent).eq('user_id',user.id).order('id')),
   ]);
   const settings=record.metadata?.settings??{};const exposed:Record<string,unknown>={};
   for(const c of capabilityOptions){exposed[c.key+'_enabled']=settings[c.key+'_enabled']===true;exposed[c.key+'_credential']=typeof settings[c.key+'_credential']==='string'?settings[c.key+'_credential']:'';}
   exposed.use_account_graph=settings.use_account_graph===true;exposed.context_history_size=settings.context_history_size??null;
   const {metadata,...agentRecord}=record;
   return {agent:{...agentRecord,mbtiType:metadata?.mbtiType??'',purpose:metadata?.purpose??'',settings:exposed},datastores,datastoreIds:links.map((v:any)=>v.datastore_id),documents,documentIds:assigned.map((v:any)=>v.media_id),connections,connectionIds:permissions.map((v:any)=>v.user_oauth_connection_id),teams,teamIds:members.map((v:any)=>v.team_id).filter((v:string)=>teams.some(t=>t.id===v)),contacts,contactMode:contactPermission?.permission_type??'no_access',contactIds:contactLinks.map((v:any)=>v.contact_id),mcp:mcp.map(({server_info,auth_config,...row}:any)=>({...row,hasToken:!!auth_config?.desktop_token_id,host:typeof server_info?.display_host==='string'&&server_info.display_host?server_info.display_host:'Protected server address'})),tasks};
  }
  if(action==='agentSettings.save'){
   const agent=await this.agent(user,args.agentId),section=str(args.section,30),v=object(args.value);let value:Record<string,unknown>;
   if(section==='identity'){const name=str(v.name,100);if(!name)throw new Error('Enter an agent name.');value={name,personality:str(v.personality,8000),mbtiType:str(v.mbtiType,10),purpose:str(v.purpose,4000)};}
   else if(section==='capabilities'){
    const settings:Record<string,unknown>={};for(const c of capabilityOptions){settings[c.key+'_enabled']=bool(v[c.key+'_enabled']);settings[c.key+'_credential']=v[c.key+'_credential']?id(v[c.key+'_credential']):'';}value={settings};
   }else if(section==='memory')value={settings:{use_account_graph:bool(v.use_account_graph),context_history_size:v.context_history_size===null?null:integer(v.context_history_size,1,1000)},datastores:ids(v.datastores)};
   else if(section==='channels'){value={};for(const channel of ['email','sms','slack','discord','telegram','whatsapp'])value[channel+'_enabled']=bool(v[channel+'_enabled']);}
   else if(['documents','sources','team'].includes(section))value={ids:ids(v.ids)};
   else if(section==='contacts'){if(!['no_access','all_contacts','specific_contacts'].includes(v.mode))throw new Error('Choose a contact permission.');value={mode:v.mode,ids:ids(v.ids)};}
   else throw new Error('Unsupported settings section.');
   data(await db.rpc('desktop_save_agent_settings',{p_user:user.id,p_agent:agent,p_section:section,p_value:value}));return;
  }
  if(action==='agentSettings.mcp.save'||action==='agentSettings.mcp.remove'){
   const agent=await this.agent(user,args.agentId),remove=action.endsWith('remove'),connection=args.id?id(args.id):randomUUID();
   if(remove){data(await db.rpc('desktop_store_setting_secret',{p_user:user.id,p_scope:'mcp',p_id:connection,p_secret:null,p_value:{agentId:agent,name:'',host:''}}));return;}
   const name=str(args.name,100),url=args.url?mcpAddress(args.url).href:null;if(!name||!args.id&&!url)throw new Error('Enter a connection name and server URL.');const token=args.token===undefined||args.token===''?null:str(args.token,8192);
   data(await db.rpc('desktop_save_mcp_connection',{p_user:user.id,p_id:connection,p_agent:agent,p_name:name,p_url:url,p_token:token,p_clear_token:args.clearToken===true}));
   if(url){const row=data(await db.from('agent_mcp_connections').select('server_info').eq('id',connection).single());data(await db.from('agent_mcp_connections').update({server_info:{...row.server_info,display_host:new URL(url).hostname}}).eq('id',connection).eq('agent_id',agent));}return {id:connection};
  }
  if(action==='agentSettings.mcp.enable'){const agent=await this.agent(user,args.agentId);data(await db.from('agent_mcp_connections').update({is_active:bool(args.enabled)}).eq('id',id(args.id)).eq('agent_id',agent).select('id').single());return;}
  if(action==='agentSettings.task.save'){
   const agent=await this.agent(user,args.agentId),value=object(args.value),name=str(value.name,200),instructions=str(value.instructions,50000),cron=str(value.cron,200),timezone=str(value.timezone,100);
   if(!name||!instructions||cron.split(/\s+/).length!==5)throw new Error('Enter a task name, instructions, and five-field cron schedule.');
   try{new Intl.DateTimeFormat('en',{timeZone:timezone});}catch{throw new Error('Enter a valid time zone, for example America/Los_Angeles.');}
   try{new Cron(cron,{paused:true,timezone}).stop();}catch{throw new Error('Enter a valid five-field cron schedule.');}
   const row={name,instructions,cron_expression:cron,timezone,status:'paused',updated_at:new Date().toISOString()};
   if(args.id)return data(await db.from('agent_tasks').update(row).eq('id',id(args.id)).eq('agent_id',agent).eq('user_id',user.id).select('id').single());
   return data(await db.from('agent_tasks').insert({...row,agent_id:agent,user_id:user.id,created_by:user.id}).select('id').single());
  }
  if(action==='agentSettings.task.remove'){
   const agent=await this.agent(user,args.agentId);data(await db.from('agent_tasks').delete().eq('id',id(args.id)).eq('agent_id',agent).eq('user_id',user.id));return;
  }
  if(action==='settings.connections')return this.connections(user);
  if(action==='settings.connection.providers')return this.all(()=>db.from('service_providers').select('id,name,display_name').eq('is_enabled',true).order('name'));
  if(action==='settings.connection.save'||action==='settings.connection.remove'){
   const remove=action.endsWith('remove'),name=remove?'':str(args.name,100),key=remove?null:str(args.key,4096);
   if(!remove&&(!name||!key||key.length<8))throw new Error('Enter a connection name and API key.');
   data(await db.rpc('desktop_store_setting_secret',{p_user:user.id,p_scope:'connection',p_id:args.id?id(args.id):randomUUID(),p_secret:key,p_value:{providerId:remove?null:id(args.providerId),name}}));return;
  }
  if(!action.startsWith('settings.admin.'))throw new Error('Unsupported project settings operation.');
  this.admin(user);
  switch(action){
   case 'settings.admin.keys':{
    const rows=data(await db.from('system_api_keys').select('provider_name,display_name,is_active,vault_secret_id,updated_at'));
    return systemKeyProviders.map(p=>{const row=rows.find(r=>r.provider_name===p.id);return {id:p.id,name:p.name,configured:!!row?.vault_secret_id,active:row?.is_active===true,updated_at:row?.updated_at};});
   }
   case 'settings.admin.key.save':case 'settings.admin.key.remove':{
    const p=systemKeyProviders.find(p=>p.id===args.provider);if(!p)throw new Error('Choose an existing system API provider.');const secret=action.endsWith('remove')?null:str(args.key,4096);
    if(secret!==null&&(!secret||p.prefix&&!secret.startsWith(p.prefix)))throw new Error('Enter a valid key for '+p.name+'.');
    data(await db.rpc('desktop_store_setting_secret',{p_user:user.id,p_scope:'api-key',p_id:p.id,p_secret:secret,p_value:{name:p.name}}));return;
   }
   default:throw new Error('Unsupported project settings operation.');
  }
 }
 private async connections(user:Identity){return this.all(()=>this.db.from('user_integration_credentials').select('id,connection_name,connection_status,credential_type,service_providers!oauth_provider_id(name,display_name)').eq('user_id',user.id).order('id'));}
}
