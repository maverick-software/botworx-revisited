import {createServer} from 'node:http';
import {randomBytes,createHash,timingSafeEqual} from 'node:crypto';
import {shell} from 'electron';
import type {Secrets} from './secrets';
import type {Model,ModelChoices,Provider,Thinking} from './contracts';
import {modelThinking} from './composer';
import {authorizationFailure,ChatGPTAuthorizationError,reconnectRequired,renewalUnavailable,type ChatGPTConnectionIssue} from './oauth-recovery';
import type {ToolDefinition,ProviderCall} from './tool-contracts';
type Connection={client_id:string;subject:string;email:string;id_token:string;access_token:string;refresh_token:string;scope:string;expires_at:number};
type Registration=Pick<Connection,'client_id'|'subject'|'email'>&{id_token?:string};
type Renewal={fingerprint:string;connection:Connection;validateIdentity:boolean;receivedAt:number};
type SavedIssue=ChatGPTConnectionIssue&{fingerprint:string};
type ChatLine={role:'user'|'assistant';content:any};
const AUTH='https://auth.openai.com';
const API='https://api.openai.com/v1';
function failure(code:unknown){
 const messages:Record<string,string>={
  '400':'The provider could not accept this model or request. Review your model and thinking settings.',
  '401':'The provider credential expired or is invalid. Reconnect it in Settings → AI connections.',
  '402':'OpenRouter needs more credits. Add credits to its account or choose another configured provider.',
  '403':'The provider denied access to this model. Check account permissions or choose another model.',
  '408':'The provider timed out. Try again when the connection is available.',
  '429':'The provider reached a usage or request limit. Wait before trying again or choose another configured provider.',
  insufficient_quota:'The provider account has reached its usage allowance. Check its usage settings.',
  subscription_sharing_usage_limit_exceeded:'ChatGPT request failed: subscription_sharing_usage_limit_exceeded. Review your ChatGPT plan usage.',
 };
 return messages[String(code)]??'The provider could not complete this request. Try again or choose another configured provider.';
}
export function equalState(actual:string|null,expected:string){if(!actual)return false;const received=Buffer.from(actual),original=Buffer.from(expected);return received.length===original.length&&timingSafeEqual(received,original);}
export async function* sse(response:Response):AsyncGenerator<any>{
 if(!response.ok){await response.body?.cancel();throw new Error(`Provider returned HTTP ${response.status}. ${failure(response.status)}`);}
 if(!response.body)throw new Error('The provider returned no response stream.');
 const decoder=new TextDecoder();let buffer='';
 for await(const chunk of response.body as any){
  buffer+=decoder.decode(chunk,{stream:true});buffer=buffer.replaceAll('\r\n','\n');
  if(buffer.length>4*1024*1024)throw new Error('The provider returned an oversized stream event.');
  let boundary:number;
  while((boundary=buffer.indexOf('\n\n'))>=0){
   const block=buffer.slice(0,boundary);buffer=buffer.slice(boundary+2);
   const data=block.split('\n').filter(line=>line.startsWith('data:')).map(line=>line.slice(5).trimStart()).join('\n');
   if(data==='[DONE]')yield {type:'done'};
   else if(data){let event;try{event=JSON.parse(data);}catch{throw new Error('The provider returned an unreadable stream event. Your partial response has been saved.');}if(!event||typeof event!=='object'||Array.isArray(event))throw new Error('The provider returned an invalid stream event.');yield event;}
  }
 }
}
export async function streamText(provider:Provider,token:string,model:string,instructions:string,history:ChatLine[],signal:AbortSignal,onDelta:(delta:string)=>Promise<void>,fetcher:typeof fetch=fetch,thinking:Thinking='default'){
 const result=await streamTurn(provider,token,model,instructions,history,signal,onDelta,fetcher,thinking);
 if(result.calls.length)throw new Error('The provider requested tools that were not enabled for this turn.');
}
export async function streamTurn(provider:Provider,token:string,model:string,instructions:string,history:any[],signal:AbortSignal,onDelta:(delta:string)=>Promise<void>,fetcher:typeof fetch=fetch,thinking:Thinking='default',tools:ToolDefinition[]=[]):Promise<{calls:ProviderCall[];continuation:any[]}>{
 const oauth=provider==='openai-oauth';
 const reasoning=thinking==='default'?{}:{reasoning:{effort:thinking}};
 const spec=(tool:ToolDefinition)=>({type:'function' as const,name:tool.name,description:tool.description,parameters:tool.strictParameters??tool.parameters,strict:true});
 const namespaces=[...new Set(tools.map(tool=>tool.namespace??'workspace'))];
 const toolConfig=!tools.length?{}:oauth?{tools:namespaces.map(name=>({type:'namespace',name,description:name==='planning'?'Create a reviewed plan and report approved implementation progress.':name==='workspace'?'Inspect selected workspace files, propose edits, and run Windows commands when explicitly enabled.':'Discover configured tools, search, and perform reviewed external calls.',tools:tools.filter(tool=>(tool.namespace??'workspace')===name).map(spec)})),parallel_tool_calls:false}:{tools:tools.map(tool=>({type:'function',function:{name:tool.name,description:tool.description,parameters:tool.strictParameters??tool.parameters,strict:true}})),provider:{require_parameters:true}};
 const body=oauth?{model,instructions,input:history,store:false,stream:true,...reasoning,...toolConfig}:
 {model,messages:[{role:'system',content:instructions},...history],stream:true,...reasoning,...toolConfig};
 const response=await fetcher(oauth?API+'/responses':'https://openrouter.ai/api/v1/chat/completions',{
  method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify(body),signal,
 });
 let complete=false;let finish=false;let text='',reasoningText='';const items=new Map<number,any>(),routerCalls=new Map<number,any>(),details:any[]=[];let output:any[]|undefined;
 for await(const event of sse(response)){
  if(event.error)throw new Error(failure(event.error.code));
  if(oauth){
   if(event.type==='response.output_text.delta'&&typeof event.delta==='string'){text+=event.delta;await onDelta(event.delta);}
   if(event.type==='response.output_item.done'&&event.item)items.set(event.output_index,event.item);
   // The SIWC stream can send complete items in output_item.done while the
   // terminal response.output is empty. Keep those streamed items for tools.
   if(event.type==='response.completed'){complete=true;if(Array.isArray(event.response?.output)&&event.response.output.length)output=event.response.output;}
   if(event.type==='response.failed')throw new Error(failure(event.response?.error?.code));
   if(event.type==='response.incomplete')throw new Error('ChatGPT returned an incomplete response.');
  }else{
   const choice=event.choices?.[0];
   if(typeof choice?.delta?.content==='string'){text+=choice.delta.content;await onDelta(choice.delta.content);}
   if(typeof choice?.delta?.reasoning==='string')reasoningText+=choice.delta.reasoning;
   if(Array.isArray(choice?.delta?.reasoning_details))details.push(...choice.delta.reasoning_details);
   if(Array.isArray(choice?.delta?.tool_calls))for(const part of choice.delta.tool_calls){
    if(!Number.isInteger(part.index)||part.index<0||part.index>=24)throw new Error('The provider returned too many tool calls.');
    const call=routerCalls.get(part.index)??{id:'',type:'function',function:{name:'',arguments:''}};
    if(typeof part.id==='string')call.id+=part.id;
    if(typeof part.function?.name==='string')call.function.name+=part.function.name;
    if(typeof part.function?.arguments==='string')call.function.arguments+=part.function.arguments;
    routerCalls.set(part.index,call);
   }
   if(choice?.finish_reason){if(!['stop','tool_calls'].includes(choice.finish_reason))throw new Error(`The response ended early (${choice.finish_reason}).`);finish=true;}
   if(event.type==='done'&&finish)complete=true;
  }
  if(text.length>2*1024*1024||reasoningText.length+JSON.stringify(details).length+JSON.stringify([...routerCalls.values()]).length+JSON.stringify([...items.values()]).length>4*1024*1024)throw new Error('The provider returned oversized tool context.');
 }
 if(!complete)throw new Error('The response stream ended before completion. Your partial response has been saved.');
 const continuation=oauth?(output??[...items].sort((a,b)=>a[0]-b[0]).map(([,value])=>value)):[{role:'assistant',content:text||null,...(routerCalls.size?{tool_calls:[...routerCalls].sort((a,b)=>a[0]-b[0]).map(([,value])=>value)}:{}),...(details.length?{reasoning_details:details}:reasoningText?{reasoning:reasoningText}:{})}];
 const calls:ProviderCall[]=oauth?continuation.filter(item=>item.type==='function_call').map(item=>({id:item.call_id,name:item.name,arguments:item.arguments,...(item.namespace?{namespace:item.namespace}:{})})):[...routerCalls].sort((a,b)=>a[0]-b[0]).map(([,item])=>({id:item.id,name:item.function.name,arguments:item.function.arguments}));
 if(calls.length>24||calls.some(call=>typeof call.id!=='string'||!call.id||call.id.length>200||typeof call.name!=='string'||call.name.length>150||typeof call.arguments!=='string'||call.arguments.length>200000)||new Set(calls.map(call=>call.id)).size!==calls.length)throw new Error('The provider returned invalid tool calls.');
 return {calls,continuation};
}
export function providerUsageURL(provider:unknown='openai-oauth'){if(provider!=='openai-oauth'&&provider!=='openrouter')throw new Error('Choose ChatGPT or OpenRouter usage.');return provider==='openrouter'?'https://openrouter.ai/activity':'https://chatgpt.com/settings/usage';}
export class Providers {
 private pending=false;
 private refreshing=new Map<string,Promise<Connection>>();
 private connectionVersions=new Map<string,number>();
 private renewalReceipts=new Map<string,Renewal>();
 private connectionIssues=new Map<string,SavedIssue>();
 constructor(private secrets:Secrets,private hostId:string){}
 harnessScope(provider:Provider,userId:string){const connection=this.secrets.get<Connection>('openai:'+userId),router=this.secrets.get<{key:string}>('openrouter');return createHash('sha256').update(JSON.stringify(provider==='openai-oauth'?[provider,connection?.subject,connection?.client_id]:[provider,router?.key])).digest('hex');}
 private fingerprint(connection:Connection){return createHash('sha256').update(JSON.stringify([connection.client_id,connection.subject,connection.access_token,connection.refresh_token])).digest('hex');}
 private issue(userId:string,connection:Connection){const saved=this.connectionIssues.get(userId)??this.secrets.get<SavedIssue>('openai-issue:'+userId);if(saved?.fingerprint!==this.fingerprint(connection))return;const {fingerprint,...issue}=saved;return issue;}
 private async saveCredential(key:string,value:unknown){try{await this.secrets.set(key,value);}catch{throw new ChatGPTAuthorizationError({kind:'retry',code:'credential_storage_unavailable',message:'Agentopia could not save the renewed ChatGPT credential securely. Check access to its application data folder and retry in this running app.',at:new Date().toISOString()});}}
 status(userId:string){const connection=this.secrets.get<Connection>('openai:'+userId),issue=connection?this.issue(userId,connection):undefined;return {
  openrouter:!!this.secrets.get('openrouter'),defaultModel:this.secrets.get<string>('openrouter-default')??'',selections:this.secrets.get<ModelChoices>('model-choices:'+userId)??{},preferChatGPT:this.secrets.get<boolean>('prefer-chatgpt:'+userId)!==false,
  chatgpt:connection?{email:connection.email,subject:connection.subject,workspace:connection.client_id,authorized:connection.scope.split(' ').includes('chatgpt.tokens.use.direct')&&connection.access_token!==''&&issue?.kind!=='reauthorize'&&issue?.kind!=='configuration',...(issue?{connectionIssue:issue}:{}),welcome:!this.secrets.get('chatgpt-welcome:'+userId)}:null,
 };}
 async preferChatGPT(userId:string,enabled:unknown){if(typeof enabled!=='boolean')throw new Error('Choose whether new chats prefer ChatGPT.');await this.secrets.set('prefer-chatgpt:'+userId,enabled);}
 async saveRouter(key:string,model:string){
  if(!key||key.length>4096)throw new Error('Enter a valid OpenRouter API key.');
  const response=await fetch('https://openrouter.ai/api/v1/key',{headers:{Authorization:`Bearer ${key}`},signal:AbortSignal.timeout(20000)});
  if(!response.ok){await response.body?.cancel();throw new Error(`OpenRouter rejected the credential (HTTP ${response.status}).`);}
  const models=await this.routerModels(key);if(!models.some(m=>m.id===model))throw new Error('Choose a model from the available OpenRouter catalog.');
  await this.secrets.set('openrouter',{key,models});await this.secrets.set('openrouter-default',model);await this.secrets.set('models:openrouter:shared',models);
 }
 async routerModels(key?:string):Promise<Model[]>{
  const credential=key??this.secrets.get<{key:string}>('openrouter')?.key;
  const response=await fetch('https://openrouter.ai/api/v1/models',{headers:credential?{Authorization:`Bearer ${credential}`}:{},signal:AbortSignal.timeout(20000)});
  if(!response.ok)throw new Error('OpenRouter model list is unavailable.');
  return ((await response.json()).data??[]).filter((m:any)=>!Array.isArray(m.architecture?.output_modalities)||m.architecture.output_modalities.includes('text')).map((m:any)=>({id:m.id,name:m.name??m.id,thinking:modelThinking(m),supportsTools:Array.isArray(m.supported_parameters)&&m.supported_parameters.includes('tools'),...(Array.isArray(m.architecture?.input_modalities)?{inputModalities:m.architecture.input_modalities}:{})}));
 }
 async defaultRouter(model:string){
  if(!this.secrets.get('openrouter'))throw new Error('Configure the shared OpenRouter credential first.');
  const models=await this.routerModels();if(!models.some(m=>m.id===model))throw new Error('Choose a model from the available OpenRouter catalog.');
  await this.secrets.set('openrouter-default',model);await this.secrets.set('models:openrouter:shared',models);
 }
 async removeRouter(){await this.secrets.set('openrouter',undefined);await this.secrets.set('openrouter-default',undefined);await this.secrets.set('models:openrouter:shared',undefined);}
 async disconnect(userId:string){this.connectionVersions.set(userId,(this.connectionVersions.get(userId)??0)+1);this.renewalReceipts.delete(userId);this.connectionIssues.delete(userId);const current=this.secrets.get<Connection>('openai:'+userId);if(current)await this.secrets.set('openai-registration:'+userId,{client_id:current.client_id,subject:current.subject,email:current.email});await this.secrets.set('openai:'+userId,undefined);await this.secrets.set('openai-renewal:'+userId,undefined);await this.secrets.set('openai-issue:'+userId,undefined);await this.secrets.set('models:openai-oauth:'+userId,undefined);}
 async acknowledge(userId:string){await this.secrets.set('chatgpt-welcome:'+userId,true);}
 async manageUsage(provider:unknown='openai-oauth'){await shell.openExternal(providerUsageURL(provider));}
 private async tokenRequest(form:Record<string,string>){
  const response=await fetch(AUTH+'/api/accounts/oauth/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams(form),signal:AbortSignal.timeout(30000)});
  if(!response.ok)throw await authorizationFailure(response);
  return response.json();
 }
 async connect(userId:string){
  if(this.pending)throw new Error('A ChatGPT connection is already awaiting authorization in your browser.');
  this.pending=true;
  const previous:Registration|undefined=this.secrets.get<Connection>('openai:'+userId)??this.secrets.get<Registration>('openai-registration:'+userId);
  const state=randomBytes(32).toString('base64url'),nonce=randomBytes(32).toString('base64url'),verifier=randomBytes(48).toString('base64url');
  const server=createServer();let timer:NodeJS.Timeout|undefined;let consumed=false;
  try{
   await new Promise<void>((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
   const address=server.address();if(!address||typeof address==='string')throw new Error('Unable to start local authorization callback.');
   const redirect=`http://127.0.0.1:${address.port}/auth/callback`;
   const callback=new Promise<URL>((resolve,reject)=>{
    timer=setTimeout(()=>reject(new Error('ChatGPT authorization expired. Choose Continue with ChatGPT to try again.')),5*60*1000);
    server.on('request',(req,res)=>{
     const url=new URL(req.url??'/',redirect);
     if(req.method!=='GET'||req.headers.host!==`127.0.0.1:${address.port}`||url.pathname!=='/auth/callback'){res.writeHead(404).end();return;}
     if(consumed||!equalState(url.searchParams.get('state'),state)){res.writeHead(400).end('Invalid authorization state.');return;}
     consumed=true;clearTimeout(timer);res.writeHead(200,{'Content-Type':'text/plain','Cache-Control':'no-store'}).end('Authorization received. Return to Agentopia.');resolve(url);
    });
   });
   callback.catch(()=>{});
   const url=new URL(AUTH+'/api/accounts/authorize');
   url.search=new URLSearchParams({client_id:previous?.client_id??'dynamic_agent_client',...(!previous?{agent_name_hint:'Agentopia'}:{}),
    ext_agent_host_id:this.hostId,...(previous?.id_token?{id_token_hint:previous.id_token}:{}),...(previous?{login_hint:previous.email}:{}),
    response_type:'code',redirect_uri:redirect,scope:'openid profile email offline_access resource.invoke chatgpt.tokens.use.direct',resource:API,
    state,nonce,code_challenge_method:'S256',code_challenge:createHash('sha256').update(verifier).digest('base64url'),
   }).toString();
   await shell.openExternal(url.toString());
   const returned=await callback;
   if(returned.searchParams.has('error'))throw new Error('ChatGPT authorization was declined or is unavailable for this private application.');
   const client=returned.searchParams.get('client_id')??previous?.client_id;
   if(!client||client==='dynamic_agent_client'||(previous&&client!==previous.client_id))throw new Error('The ChatGPT client registration could not be verified.');
   const code=returned.searchParams.get('code');if(!code)throw new Error('ChatGPT returned no authorization code.');
   const tokens=await this.tokenRequest({grant_type:'authorization_code',client_id:client,code,code_verifier:verifier,redirect_uri:redirect,resource:API});
   const {createRemoteJWKSet,jwtVerify}=await import('jose');
   const {payload}=await jwtVerify(tokens.id_token,createRemoteJWKSet(new URL(AUTH+'/.well-known/jwks.json')),{issuer:AUTH,audience:client,requiredClaims:['sub','exp','iat'],clockTolerance:5});
   if(payload.nonce!==nonce||!payload.sub||(previous&&payload.sub!==previous.subject))throw new Error('The ChatGPT account identity did not match the authorization attempt.');
   if(typeof tokens.access_token!=='string'||typeof tokens.refresh_token!=='string'||!Number.isFinite(tokens.expires_in)||!tokens.scope?.split(' ').includes('chatgpt.tokens.use.direct'))throw new Error('ChatGPT plan usage was not authorized. Reconnect with an eligible account and grant plan access.');
   this.connectionVersions.set(userId,(this.connectionVersions.get(userId)??0)+1);
   this.renewalReceipts.delete(userId);this.connectionIssues.delete(userId);
   await this.secrets.set('openai:'+userId,{...tokens,client_id:client,subject:payload.sub,email:typeof payload.email==='string'?payload.email:payload.sub,expires_at:Date.now()+tokens.expires_in*1000});
   await this.secrets.set('openai-registration:'+userId,{client_id:client,subject:payload.sub,email:typeof payload.email==='string'?payload.email:payload.sub});
   await this.secrets.set('openai-renewal:'+userId,undefined);await this.secrets.set('openai-issue:'+userId,undefined);
   // A model request tests plan authorization separately from application sign-in.
   const models=await this.models('openai-oauth',userId);await this.secrets.set('models:openai-oauth:'+userId,models);return models;
  }finally{clearTimeout(timer);server.close();this.pending=false;}
 }
 private async connection(userId:string,continued=false):Promise<Connection>{
  const current=this.secrets.get<Connection>('openai:'+userId);if(!current)throw new Error('Connect your ChatGPT account in AI connections.');
  if(current.access_token===''||this.issue(userId,current)?.kind==='reauthorize')throw reconnectRequired();
  if(current.expires_at>Date.now()+60000)return current;
  if(this.refreshing.has(userId)){const shared=await this.refreshing.get(userId)!;if(shared.expires_at<=Date.now()){if(continued)throw renewalUnavailable();return this.connection(userId,true);}return shared;}
  const version=this.connectionVersions.get(userId)??0,isCurrent=()=>this.secrets.get<Connection>('openai:'+userId)===current&&(this.connectionVersions.get(userId)??0)===version;
  const guard=()=>{if(!isCurrent())throw new Error('The ChatGPT connection changed during renewal. Retry with the current connection.');};
  const refresh=(async()=>{
   try{
    let pending=this.renewalReceipts.get(userId)??this.secrets.get<Renewal>('openai-renewal:'+userId);
    if(pending?.fingerprint!==this.fingerprint(current)){
     const tokens=await this.tokenRequest({grant_type:'refresh_token',client_id:current.client_id,refresh_token:current.refresh_token,resource:API});guard();
     if(!tokens||typeof tokens.access_token!=='string'||!tokens.access_token||!Number.isFinite(tokens.expires_in)||tokens.expires_in<=0||(tokens.refresh_token!==undefined&&(typeof tokens.refresh_token!=='string'||!tokens.refresh_token))||(tokens.scope!==undefined&&typeof tokens.scope!=='string')||(tokens.id_token!==undefined&&(typeof tokens.id_token!=='string'||!tokens.id_token)))throw new ChatGPTAuthorizationError({kind:'configuration',message:'ChatGPT returned an invalid renewal response. Your saved registration has been retained.',at:new Date().toISOString()});
     pending={fingerprint:this.fingerprint(current),connection:{...current,access_token:tokens.access_token,id_token:tokens.id_token??current.id_token,scope:tokens.scope??current.scope,refresh_token:tokens.refresh_token??current.refresh_token,expires_at:Date.now()+tokens.expires_in*1000},validateIdentity:typeof tokens.id_token==='string'&&!!tokens.id_token,receivedAt:Date.now()};
    }
    this.renewalReceipts.set(userId,pending);await this.saveCredential('openai-renewal:'+userId,pending);guard();
    if(pending.validateIdentity){const {createRemoteJWKSet,jwtVerify}=await import('jose');const {payload}=await jwtVerify(pending.connection.id_token,createRemoteJWKSet(new URL(AUTH+'/.well-known/jwks.json')),{issuer:AUTH,audience:current.client_id,requiredClaims:['sub','exp','iat'],clockTolerance:5,currentDate:new Date(pending.receivedAt)});if(payload.sub!==current.subject)throw new ChatGPTAuthorizationError({...reconnectRequired().issue,code:'identity_mismatch'});}
    guard();await this.saveCredential('openai:'+userId,pending.connection);this.renewalReceipts.delete(userId);this.connectionIssues.delete(userId);await this.secrets.set('openai-renewal:'+userId,undefined).catch(()=>{});await this.secrets.set('openai-issue:'+userId,undefined).catch(()=>{});return pending.connection;
   }catch(error){
    guard();const invalidIdentity=new Set(['ERR_JWS_SIGNATURE_VERIFICATION_FAILED','ERR_JWT_CLAIM_VALIDATION_FAILED','ERR_JWT_EXPIRED','ERR_JWS_INVALID','ERR_JWT_INVALID','ERR_JOSE_ALG_NOT_ALLOWED']),identityCode=(error as {code?:string})?.code;
    const failure=error instanceof ChatGPTAuthorizationError?error:identityCode&&invalidIdentity.has(identityCode)?new ChatGPTAuthorizationError({...reconnectRequired().issue,code:'identity_validation_failed'}):renewalUnavailable();
    let saved=current;
    if(failure.issue.kind==='reauthorize'){this.renewalReceipts.delete(userId);await this.saveCredential('openai-registration:'+userId,{client_id:current.client_id,subject:current.subject,email:current.email});guard();saved={...current,access_token:'',refresh_token:'',expires_at:0};await this.saveCredential('openai:'+userId,saved);await this.secrets.set('openai-renewal:'+userId,undefined).catch(()=>{});}
    const issue={...failure.issue,fingerprint:this.fingerprint(saved)};this.connectionIssues.set(userId,issue);await this.secrets.set('openai-issue:'+userId,issue).catch(()=>{});throw failure;
   }
  })();this.refreshing.set(userId,refresh);let renewed:Connection;try{renewed=await refresh;}finally{if(this.refreshing.get(userId)===refresh)this.refreshing.delete(userId);}
  if(renewed.expires_at<=Date.now()){if(continued)throw renewalUnavailable();return this.connection(userId,true);}return renewed;
 }
 async token(provider:Provider,userId:string){
  if(provider==='openrouter'){const connection=this.secrets.get<{key:string}>('openrouter');if(!connection)throw new Error('An administrator must configure OpenRouter in AI connections.');return connection.key;}
  const connection=await this.connection(userId);if(!connection.scope.split(' ').includes('chatgpt.tokens.use.direct'))throw new Error('ChatGPT plan usage is not authorized.');return connection.access_token;
 }
 async models(provider:Provider,userId:string):Promise<Model[]>{
  if(provider==='openrouter')return this.routerModels();
  const response=await fetch(API+'/models',{headers:{Authorization:`Bearer ${await this.token(provider,userId)}`},signal:AbortSignal.timeout(20000)});
  if(!response.ok)throw new Error(`ChatGPT model access failed (HTTP ${response.status}). Check this private application's eligibility and reconnect.`);
  const result=await response.json();
  if(!Array.isArray(result.models))throw new Error('ChatGPT returned an unsupported model catalog.');
  return result.models.filter((m:any)=>m.visibility==='list').map((m:any)=>({id:m.slug,name:m.display_name,thinking:modelThinking(m)}));
 }
}
