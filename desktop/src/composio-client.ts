import {composioRecord,composioIdentifier,composioSlug,composioScheme,composioHttps,composioToolkit,composioAccount,composioTool,type ComposioCatalog,type ComposioAuthConfig,type ComposioConnectLink} from './composio-contracts';
import {createHash} from 'node:crypto';
import {composioUploadNetwork,composioUploadUrl,maxComposioUploadBytes,type ComposioUploadNetwork} from './composio-file-network';

const origin='https://backend.composio.dev';
export class ComposioUnavailableError extends Error{}
/** Fixed-origin backend client. It never retries a possibly completed operation. */
export class ComposioClient{
 constructor(private key:string,private http:typeof fetch=fetch,private upload:ComposioUploadNetwork=composioUploadNetwork){if(!key.trim()||key.length>16384||/[\r\n]/.test(key))throw Error('Enter a valid Composio project API key.');this.key=key.trim();}
 private async request(route:string,{method='GET',query={},body,signal,limit=8*1024*1024}:{method?:string;query?:Record<string,string|number|boolean|undefined>;body?:unknown;signal?:AbortSignal;limit?:number}={}){
  if(!route.startsWith('/api/v3.1/')||route.includes('?')||route.includes('#')||route.includes('..'))throw Error('Unsupported Composio operation.');
  const url=new URL(route,origin);for(const [key,value]of Object.entries(query))if(value!==undefined)url.searchParams.set(key,String(value));
  const active=AbortSignal.any([...(signal?[signal]:[]),AbortSignal.timeout(method==='POST'&&route.includes('/execute/')?120000:30000)]);active.throwIfAborted();
  let response:Response;try{response=await this.http(url,{method,headers:{'x-api-key':this.key,'Content-Type':'application/json',Accept:'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)}),redirect:'error',signal:active});}catch{signal?.throwIfAborted();throw new ComposioUnavailableError(method==='GET'?'Composio could not be reached. Check the connection and try again.':'Composio did not confirm this operation. Check its saved connection or activity before retrying; it may already have completed.');}
  if(!response.ok){await response.body?.cancel();throw Error(response.status===401||response.status===403?'Composio rejected this project key or its permissions.':response.status===429?'Composio reached its usage limit. Try again later.':response.status===402?'This Composio operation requires an available service balance.':response.status===404?'This Composio connector, connection or action is unavailable.':'Composio could not complete this operation (HTTP '+response.status+').');}
  if(response.status===204)return {};
  const reader=response.body?.getReader();if(!reader)throw Error('Composio returned an empty response.');const chunks:Uint8Array[]=[];let size=0;
  try{while(true){const part=await reader.read();if(part.done)break;size+=part.value.byteLength;if(size>limit){await reader.cancel();throw Error('The Composio response is too large. Narrow the search.');}chunks.push(part.value);}}finally{reader.releaseLock();}
  let value:unknown;try{value=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{throw Error('Composio returned an invalid response.');}if(!composioRecord(value))throw Error('Composio returned an invalid response.');return value;
 }
 async catalog({search='',category,cursor,user,signal}:{search?:string;category?:string;cursor?:string;user?:string;signal?:AbortSignal}={}):Promise<ComposioCatalog>{
  if(typeof search!=='string'||search.length>300||category!==undefined&&(typeof category!=='string'||category.length>200)||cursor!==undefined&&(typeof cursor!=='string'||cursor.length>4000))throw Error('Choose a valid connector search or page.');
  const value=await this.request('/api/v3.1/toolkits',{query:{search:search.trim()||undefined,category,cursor,limit:60,sort_by:'alphabetically',type:'all',user_id:user===undefined?undefined:composioIdentifier(user,'user')},signal});
  if(!Array.isArray(value.items)||value.items.length>1000)throw Error('Composio returned an invalid catalog.');
  if(value.next_cursor!==undefined&&value.next_cursor!==null&&(typeof value.next_cursor!=='string'||value.next_cursor.length>4000||value.next_cursor===cursor))throw Error('Composio returned an invalid catalog page.');
  const items=value.items.map(composioToolkit);if(new Set(items.map(row=>row.slug)).size!==items.length)throw Error('Composio returned duplicate connectors.');
  return {items,nextCursor:value.next_cursor||null,total:Number.isSafeInteger(value.total_items)&&value.total_items>=0?value.total_items:null,fetchedAt:new Date().toISOString()};
 }
 async toolkit(slug:string,signal?:AbortSignal){return composioToolkit(await this.request('/api/v3.1/toolkits/'+composioSlug(slug),{signal}));}
 async categories(signal?:AbortSignal){const found:{id:string;name:string}[]=[],seen=new Set<string>();let cursor:string|undefined;do{const value=await this.request('/api/v3.1/toolkits/categories',{query:{limit:100,cursor},signal});if(!Array.isArray(value.items)||value.items.length>1000)throw Error('Composio returned invalid categories.');for(const row of value.items){const id=composioIdentifier(row.id??row.slug,'category');if(found.some(category=>category.id===id))throw Error('Composio returned duplicate categories.');found.push({id,name:String(row.name??'').slice(0,200)});}if(found.length>10000)throw Error('The Composio category catalog is too large.');cursor=value.next_cursor||undefined;if(cursor&&(typeof cursor!=='string'||cursor.length>4000||seen.has(cursor)))throw Error('Composio returned an invalid category page.');if(cursor)seen.add(cursor);}while(cursor);return found;}
 private authConfig(value:Record<string,any>):ComposioAuthConfig{const auth=composioRecord(value.auth_config)?value.auth_config:value;if(!composioRecord(value.toolkit))throw Error('Composio returned invalid authentication configuration.');return {id:composioIdentifier(auth.id,'authentication configuration'),toolkit:composioSlug(value.toolkit.slug),scheme:composioScheme(auth.auth_scheme),managed:auth.is_composio_managed===true,disabled:auth.is_disabled===true};}
 async configuration(id:string,signal?:AbortSignal){return this.authConfig(await this.request('/api/v3.1/auth_configs/'+composioIdentifier(id,'authentication configuration'),{signal}));}
 async createConfiguration(toolkit:string,scheme:string,managed:boolean,signal?:AbortSignal){
  const value=await this.request('/api/v3.1/auth_configs',{method:'POST',body:{toolkit:{slug:composioSlug(toolkit)},auth_config:managed?{type:'use_composio_managed_auth'}:{type:'use_custom_auth',authScheme:composioScheme(scheme),credentials:{}}},signal});return this.authConfig(value);
 }
 async connect(user:string,authConfig:string,alias:string,signal?:AbortSignal):Promise<ComposioConnectLink>{
  if(typeof alias!=='string'||alias.length>100||/[\x00-\x1f]/.test(alias))throw Error('Choose a connection name of up to 100 characters.');
  const value=await this.request('/api/v3.1/connected_accounts/link',{method:'POST',body:{user_id:composioIdentifier(user,'user'),auth_config_id:composioIdentifier(authConfig,'authentication configuration'),...(alias.trim()?{alias:alias.trim()}:{})},signal});
  const url=composioHttps(value.redirect_url,['connect.composio.dev']);if(!url||typeof value.expires_at!=='string'||!Number.isFinite(Date.parse(value.expires_at)))throw Error('Composio returned an invalid connection link.');
  return {accountId:composioIdentifier(value.connected_account_id,'connection'),url,expiresAt:value.expires_at};
 }
 async account(id:string,signal?:AbortSignal){return composioAccount(await this.request('/api/v3.1/connected_accounts/'+composioIdentifier(id,'connection'),{signal}));}
 async connectWithoutAuth(user:string,authConfig:string,alias:string,signal?:AbortSignal){
  if(typeof alias!=='string'||!alias.trim()||alias.length>100||/[\x00-\x1f]/.test(alias))throw Error('Choose a connection name of up to 100 characters.');
  const value=await this.request('/api/v3.1/connected_accounts',{method:'POST',body:{auth_config:{id:composioIdentifier(authConfig,'authentication configuration')},connection:{user_id:composioIdentifier(user,'user'),alias,state:{authScheme:'NO_AUTH',val:{status:'INITIALIZING'}}}},signal});return composioIdentifier(value.id,'connection');
 }
 async revoke(id:string,signal?:AbortSignal){await this.request('/api/v3.1/connected_accounts/'+composioIdentifier(id,'connection')+'/revoke',{method:'POST',signal});}
 async tools(toolkit:string,cursor?:string,search?:string,signal?:AbortSignal){
  if(cursor!==undefined&&(typeof cursor!=='string'||cursor.length>4000)||search!==undefined&&(typeof search!=='string'||search.length>500))throw Error('Choose a valid tool search.');
  const value=await this.request('/api/v3.1/tools',{query:{toolkit_slug:composioSlug(toolkit),toolkit_versions:'latest',limit:100,cursor,query:search?.trim()||undefined},signal});if(!Array.isArray(value.items)||value.items.length>1000)throw Error('Composio returned an invalid tool catalog.');
  if(value.next_cursor!==undefined&&value.next_cursor!==null&&(typeof value.next_cursor!=='string'||value.next_cursor.length>4000||value.next_cursor===cursor))throw Error('Composio returned an invalid tool page.');
  const items=value.items.map(composioTool);if(items.some(tool=>tool.toolkit!==toolkit))throw Error('Composio returned a tool outside this connector.');return {items,nextCursor:typeof value.next_cursor==='string'?value.next_cursor:null};
 }
 async tool(name:string,version:string,signal?:AbortSignal){return composioTool(await this.request('/api/v3.1/tools/'+composioIdentifier(name,'tool'),{query:{version:composioIdentifier(version,'tool version')},signal}));}
 async uploadFile(input:{name:string;mimetype:string;bytes:Uint8Array;tool:string;toolkit:string},guard:()=>Promise<void>,signal:AbortSignal){
  if(typeof input.name!=='string'||!input.name.trim()||input.name.length>255||/[\\/\x00-\x1f\x7f]/.test(input.name)||typeof input.mimetype!=='string'||input.mimetype.length>150||!/^[a-z0-9!#$&^_.+-]+\/[a-z0-9!#$&^_.+-]+$/i.test(input.mimetype)||!(input.bytes instanceof Uint8Array)||!input.bytes.byteLength||input.bytes.byteLength>maxComposioUploadBytes)throw Error('Choose a valid file of up to 20 MB for this upload.');
  const tool=composioIdentifier(input.tool,'tool'),toolkit=composioSlug(input.toolkit),bytes=Buffer.from(input.bytes);await guard();signal.throwIfAborted();const value=await this.request('/api/v3.1/files/upload/request',{method:'POST',body:{toolkit_slug:toolkit,tool_slug:tool,filename:input.name,mimetype:input.mimetype,md5:createHash('md5').update(bytes).digest('hex')},signal,limit:65536});
  const raw=value.new_presigned_url??value.newPresignedUrl;if(value.new_presigned_url!==undefined&&value.newPresignedUrl!==undefined&&value.new_presigned_url!==value.newPresignedUrl)throw Error('Composio returned conflicting upload destinations.');const url=composioUploadUrl(raw);if(typeof value.key!=='string'||!value.key||value.key.length>4096||/[\x00-\x1f\x7f]/.test(value.key))throw Error('Composio returned an invalid staged-file reference.');
  await guard();signal.throwIfAborted();let status:number;try{status=await this.upload(url,bytes,input.mimetype,signal);}catch{signal.throwIfAborted();throw new ComposioUnavailableError('The selected file transfer was not confirmed. Inspect this operation before continuing.');}if(status<200||status>299)throw Error('The selected file transfer failed (HTTP '+status+').');await guard();signal.throwIfAborted();return {name:input.name,mimetype:input.mimetype,s3key:value.key};
 }
 async execute(account:string,user:string,name:string,version:string,args:Record<string,unknown>,signal?:AbortSignal){
  if(account==='instant_account')throw Error('Connect the intended user account before executing this tool.');
  if(!composioRecord(args)||JSON.stringify(args).length>100000)throw Error('Choose valid Composio tool arguments.');
  return this.request('/api/v3.1/tools/execute/'+composioIdentifier(name,'tool'),{method:'POST',body:{connected_account_id:composioIdentifier(account,'connection'),user_id:composioIdentifier(user,'user'),version:composioIdentifier(version,'tool version'),arguments:args},signal,limit:2*1024*1024});
 }
}
