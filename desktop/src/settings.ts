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
function endpoint(v:unknown,optional=false,protectedAddress=false){const s=str(v,2048);if(!s&&optional)return null;let url:URL;try{url=new URL(s);}catch{throw new Error('Enter a complete HTTPS URL.');}if(url.protocol!=='https:'||url.username||url.password||url.hash||!protectedAddress&&/[?&](?:key|token|secret|password|authorization)=/i.test(url.search))throw new Error('Use HTTPS endpoints without embedded credentials.');return url.toString();}
const secretField=/(?:secret|password|token|api.?key|authorization|credential)/i;
function publicValue(v:unknown):unknown{if(Array.isArray(v))return v.map(publicValue);if(v&&typeof v==='object')return Object.fromEntries(Object.entries(v).filter(([key])=>!secretField.test(key)).map(([key,value])=>[key,publicValue(value)]));return v;}
function publicMetadata(v:unknown):Record<string,unknown>{return publicValue(object(v??{})) as Record<string,unknown>;}
function safeMetadata(v:unknown){const raw=object(v);if(JSON.stringify(raw).length>16000)throw new Error('Integration metadata is too large.');const cleaned=publicMetadata(raw);if(JSON.stringify(cleaned)!==JSON.stringify(raw))throw new Error('Store credentials in protected credential fields, rather than integration metadata.');return cleaned;}
export const systemKeyProviders=[{id:'openai',name:'OpenAI',prefix:'sk-'},{id:'anthropic',name:'Anthropic',prefix:'sk-ant-'},{id:'mistral_ai',name:'Mistral AI',prefix:''},{id:'serper_api',name:'Serper API',prefix:''}];
const categories=['identity','tools','formatting','memory','meta'];
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
    this.all(()=>db.from('media_library').select('id,display_name,file_name,processing_status').eq('user_id',user.id).order('id')),
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
   if(args.id)data(await db.from('agent_tasks').update(row).eq('id',id(args.id)).eq('agent_id',agent).eq('user_id',user.id).select('id').single());
   else data(await db.from('agent_tasks').insert({...row,agent_id:agent,user_id:user.id,created_by:user.id}));return;
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
   case 'settings.admin.integrations':return (await this.all(()=>db.from('service_providers').select('id,name,display_name,authorization_endpoint,token_endpoint,revoke_endpoint,discovery_endpoint,scopes_supported,pkce_required,client_credentials_location,is_enabled,configuration_metadata').order('name'))).map(r=>({...r,configuration_metadata:publicMetadata(r.configuration_metadata)}));
   case 'settings.admin.integration.save':{
    const v=object(args.value),name=str(v.name,80),display=str(v.display_name,100);if(!/^[a-z][a-z0-9_-]*$/.test(name)||!display)throw new Error('Enter a provider identifier and display name.');
    if(!Array.isArray(v.scopes_supported)||v.scopes_supported.length>100||v.scopes_supported.some((s:unknown)=>typeof s!=='string'||s.length>200))throw new Error('Enter scopes as a JSON array of strings.');
    if(!['header','body'].includes(v.client_credentials_location))throw new Error('Choose a credential location.');
    const row={name,display_name:display,authorization_endpoint:endpoint(v.authorization_endpoint),token_endpoint:endpoint(v.token_endpoint),revoke_endpoint:endpoint(v.revoke_endpoint??'',true),discovery_endpoint:endpoint(v.discovery_endpoint??'',true),scopes_supported:v.scopes_supported,pkce_required:bool(v.pkce_required),client_credentials_location:v.client_credentials_location,is_enabled:bool(v.is_enabled),configuration_metadata:safeMetadata(v.configuration_metadata??{}),updated_at:new Date().toISOString()};
    if(args.id){const old=data(await db.from('service_providers').select('configuration_metadata').eq('id',id(args.id)).single());row.configuration_metadata={...object(old.configuration_metadata??{}),...row.configuration_metadata};data(await db.from('service_providers').update(row).eq('id',id(args.id)));}
    else data(await db.from('service_providers').insert(row));return;
   }
   case 'settings.admin.integration.remove':{
    const provider=id(args.id);const used=data(await db.from('user_integration_credentials').select('id').eq('oauth_provider_id',provider).limit(1));if(used.length)throw new Error('This provider has saved user connections. Disable it to preserve those connections.');data(await db.from('service_providers').delete().eq('id',provider));return;
   }
   case 'settings.admin.prompts':return this.all(()=>db.from('system_prompts').select('id,key,name,description,category,content,is_active,updated_at').order('key'));
   case 'settings.admin.prompt.save':{
    const v=object(args.value),key=str(v.key,100),name=str(v.name,150);if(!key||!name||!categories.includes(v.category))throw new Error('Enter a key, name, and prompt category.');
    const row={key,name,description:str(v.description??'',2000),category:v.category,content:str(v.content,100000),is_active:bool(v.is_active),updated_by:user.id,updated_at:new Date().toISOString()};
    if(args.id)data(await db.from('system_prompts').update(row).eq('id',id(args.id)));else data(await db.from('system_prompts').insert({...row,created_by:user.id}));return;
   }
   case 'settings.admin.prompt.remove':data(await db.from('system_prompts').delete().eq('id',id(args.id)));return;
   case 'settings.admin.stripe':{
    const rows=data(await db.from('admin_integration_credentials').select('credential_name,connection_method,connection_status').eq('integration_type','stripe'));
    const saved=data(await db.from('admin_settings').select('setting_value').eq('setting_key','stripe_config').maybeSingle());let value=saved?.setting_value??{};if(typeof value==='string'){try{value=JSON.parse(value);}catch{value={};}}
    const config=object(value);return {credentials:rows.map(r=>({name:r.credential_name,method:r.connection_method,status:r.connection_status})),mode:config.mode??null,last_sync:config.last_sync??null,account_id:config.account_id??config.stripe_account_id??null,webhook_url:config.webhook_url??'',plans:await this.all(()=>db.from('billing_plans').select('id,display_name,stripe_price_id,amount,currency,billing_interval,is_active').order('id'))};
   }
   case 'settings.admin.stripe.key.save':case 'settings.admin.stripe.key.remove':{
    const name=str(args.name,40);if(!['secret_key','webhook_secret','publishable_key'].includes(name))throw new Error('Choose a Stripe credential.');const secret=action.endsWith('remove')?null:str(args.key,4096);
    const prefix=name==='secret_key'?/^(?:sk|rk)_(?:live|test)_/:name==='publishable_key'?/^pk_(?:live|test)_/:/^whsec_/;
    if(secret!==null&&!prefix.test(secret))throw new Error('Enter a valid Stripe '+name.replaceAll('_',' ')+'.');
    data(await db.rpc('desktop_store_setting_secret',{p_user:user.id,p_scope:'stripe',p_id:name,p_secret:secret,p_value:{}}));
    if(name==='secret_key')await this.stripeMetadata(user,{mode:secret?.includes('_live_')?'live':secret?'test':null,account_id:null,connected:false,connection_method:'manual'});return;
   }
   case 'settings.admin.stripe.test':{
    const account=await this.stripeRequest('/v1/account');await this.stripeMetadata(user,{account_id:account.id,connected:true});return {account_id:account.id,country:account.country,charges_enabled:account.charges_enabled};
   }
   case 'settings.admin.stripe.sync':{
    let after='';let count=0;
    for(let page=0;page<100;page++){
     const products=await this.stripeRequest('/v1/products?active=true&expand[]=data.default_price&limit=100'+(after?'&starting_after='+encodeURIComponent(after):''));
     for(const p of products.data){const price=p.default_price;if(!price||typeof price!=='object'||!['month','year'].includes(price.recurring?.interval)||price.unit_amount===null)continue;
      const existing=data(await db.from('billing_plans').select('id').eq('stripe_price_id',price.id).maybeSingle());
      const row={plan_name:p.id,display_name:p.name,description:p.description??'',stripe_price_id:price.id,amount:price.unit_amount,currency:price.currency,billing_interval:price.recurring.interval,is_active:p.active,updated_at:new Date().toISOString()};
      if(existing)data(await db.from('billing_plans').update(row).eq('id',existing.id));else data(await db.from('billing_plans').insert(row));count++;
     }
     if(!products.has_more){await this.stripeMetadata(user,{last_sync:new Date().toISOString()});return {count};}after=products.data.at(-1)?.id;if(!after)throw new Error('Stripe returned an incomplete product page.');
    }throw new Error('The Stripe product catalog exceeds the supported sync limit.');
   }
   default:throw new Error('Unsupported project settings operation.');
  }
 }
 private async connections(user:Identity){return this.all(()=>this.db.from('user_integration_credentials').select('id,connection_name,connection_status,credential_type,service_providers!oauth_provider_id(name,display_name)').eq('user_id',user.id).order('id'));}
 private async stripeMetadata(user:Identity,patch:Record<string,unknown>){const db=this.db;const old=data(await db.from('admin_settings').select('setting_value').eq('setting_key','stripe_config').maybeSingle());let value=old?.setting_value??{};if(typeof value==='string'){try{value=JSON.parse(value);}catch{value={};}}data(await db.from('admin_settings').upsert({setting_key:'stripe_config',setting_value:{...object(value),...patch},updated_by:user.id,updated_at:new Date().toISOString()},{onConflict:'setting_key'}));}
 private async stripeRequest(path:string){
  const row=data(await this.db.from('admin_integration_credentials').select('vault_secret_id').eq('integration_type','stripe').eq('credential_name','secret_key').maybeSingle());
  if(!row)throw new Error('Save a Stripe secret key before testing or syncing.');const result=data(await this.db.rpc('get_secret',{secret_id:row.vault_secret_id}));const secret=Array.isArray(result)?result[0]?.key:null;
  if(!secret)throw new Error('The Stripe key could not be read from protected storage.');
  const response=await fetch('https://api.stripe.com'+path,{headers:{Authorization:'Bearer '+secret},redirect:'error',signal:AbortSignal.timeout(30000)});
  if(!response.ok)throw new Error(response.status===401?'Stripe rejected the saved credential.':`Stripe request failed (${response.status}).`);
  return response.json() as Promise<any>;
 }
}
