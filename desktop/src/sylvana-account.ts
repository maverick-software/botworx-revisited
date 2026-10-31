import {createServer} from 'node:http';
import {requestProviderCapacity} from './provider-capacity';
import {createHash,randomBytes,randomUUID,timingSafeEqual} from 'node:crypto';
import {createRemoteJWKSet,jwtVerify} from 'jose';
import type {Secrets} from './secrets';
import type {Model} from './contracts';
import {LocalSessionEnded} from './session-end';
import {defaultWorkspaceAI,type WorkspaceAI} from './workspace-ai';

// Public native-client registration. Server credentials never enter the app.
export const sylvanaAccountConfig={issuer:'https://xukoabvnftoosxyrfbea.supabase.co/auth/v1',
 clientId:'b0b26b4d-8f4a-4c10-894d-2417fddb6acb',service:'https://sylvana-legal-web-app.vercel.app',ports:[45927,45928,45929]};
export type SylvanaConnection={owner:string;email:string;displayName?:string;firmId:string;firmName:string;access_token:string;refresh_token:string;expires_at:number;legalMode?:boolean;firmRole?:'owner'|'member';connections?:FirmConnections;workspaceAI?:WorkspaceAI;canManageAI?:boolean;directTiers?:{provider:string;tier:string;capability:string;model:string;revision:number}[];policyVersion?:number;providerOrigin?:string|null;providerEnabled?:boolean;allowance?:{unlimited_llm?:boolean;status:string;remaining_units:number;limit_units:number;reserved_units:number;resets_at?:string}};
type Connection=SylvanaConnection;
export type FirmConnections={sylvana:boolean;chatgpt:boolean;openai_api:boolean;openrouter:boolean;openai_zdr_attested_at?:string|null};
const config=sylvanaAccountConfig,jwks=createRemoteJWKSet(new URL(config.issuer+'/.well-known/jwks.json'));
const equal=(a:string|null,b:string)=>!!a&&Buffer.byteLength(a)===Buffer.byteLength(b)&&timingSafeEqual(Buffer.from(a),Buffer.from(b));
export class SylvanaAccount {
 private pending=false;
 private controller?:AbortController;
 private verified=new Map<string,{connection:Connection;at:number}>();
 private checking=new Map<string,{connection:Connection;work:Promise<void>}>();
 private refreshing=new Map<string,Promise<Connection>>();
 private received=new Map<string,Connection>();
 constructor(private secrets:Pick<Secrets,'get'|'set'|'setMany'>,private openBrowser:(url:string)=>Promise<unknown>){}
 legal(owner:string){return this.secrets.get<boolean>('sylvana-legal:'+owner)===true;}
 connections(owner:string):FirmConnections{const c=this.secrets.get<Connection&{connections?:FirmConnections}>('sylvana-account:'+owner),legal=this.legal(owner);return c?.connections??{sylvana:true,chatgpt:!legal,openai_api:!legal,openrouter:!legal};}
 aiSettings(owner:string):WorkspaceAI{return this.secrets.get<Connection>('sylvana-account:'+owner)?.workspaceAI??defaultWorkspaceAI;}
 canManage(owner:string){return this.secrets.get<Connection>('sylvana-account:'+owner)?.canManageAI===true;}
 async requireManager(owner:string){await this.verifySession(owner,true);if(!this.canManage(owner))throw Error('Workspace administrator access required.');}
 allows(owner:string,provider:string){if(this.legal(owner))return provider==='sylvana';const c=this.secrets.get<Connection>('sylvana-account:'+owner);if(c?.workspaceAI)return provider===c.workspaceAI.provider;const p=this.connections(owner);return provider==='sylvana'||(provider==='openai-oauth'?p.chatgpt:provider==='openai-api'?p.openai_api:provider==='openrouter'?p.openrouter:false);}
 assertConnection(owner:string,provider:string){if(!this.allows(owner,provider))throw Error(this.legal(owner)?'Legal compliance (Legal Compliance): this connection is disabled by your firm policy.':'This AI connection is disabled by your firm owner.');}
 cancel(){this.controller?.abort(Error('Sylvana sign-in was cancelled.'));}
 publication(connection:Connection):[string,unknown][]{
  const selected=this.secrets.get<string>('profile-cloud-owner');if(selected&&selected!==connection.owner)throw Error('Use the Sylvana web account selected for this desktop profile.');
  const old=this.secrets.get<{issuer:string;subject:string;firmId:string}>('sylvana-binding:'+connection.owner),previous=this.secrets.get<Connection>('sylvana-account:'+connection.owner);
  if(old&&(old.issuer!==config.issuer||old.subject!==connection.owner||old.firmId!==connection.firmId)||previous&&previous.firmId!==connection.firmId)throw Error('This firm needs a separate desktop profile. Your earlier workspace has been preserved.');
  return [['sylvana-account:'+connection.owner,connection],['sylvana-legal:'+connection.owner,connection.legalMode!==false],['sylvana-binding:'+connection.owner,{issuer:config.issuer,subject:connection.owner,firmId:connection.firmId}]];
 }
 async verifySession(owner:string,force=false){
  const connection=this.secrets.get<Connection>('sylvana-account:'+owner),binding=this.secrets.get<{issuer:string;subject:string;firmId:string}>('sylvana-binding:'+owner);
  if(!connection||!binding||binding.issuer!==config.issuer||binding.subject!==owner||binding.firmId!==connection.firmId)throw new LocalSessionEnded('Continue with Sylvana to open this workspace.');
  const verified=this.verified.get(owner);if(!force&&verified?.connection===connection&&Date.now()-verified.at<60000)return;
  if(this.checking.get(owner)?.connection!==connection){const work=(async()=>{const access=await this.access(owner),credential=this.secrets.get<Connection>('sylvana-account:'+owner),me=await (await this.request('/api/desktop/me',access)).json();const latest=this.secrets.get<Connection>('sylvana-account:'+owner);if(!latest||latest!==credential)throw Error('Your Sylvana account changed during verification. Retry with the current account.');if(me.user?.id!==owner||me.firm?.id!==binding.firmId||typeof me.firm?.legal_mode!=='boolean')throw new LocalSessionEnded('Your Sylvana workspace authorization changed.');const updated=this.policy(latest,me);await this.secrets.setMany([['sylvana-account:'+owner,updated],['sylvana-legal:'+owner,updated.legalMode]]);this.verified.set(owner,{connection:updated,at:Date.now()});})();this.checking.set(owner,{connection,work});void work.finally(()=>{if(this.checking.get(owner)?.work===work)this.checking.delete(owner);}).catch(()=>{});}
  return this.checking.get(owner)!.work;
 }
 status(owner:string){const c=this.secrets.get<Connection>('sylvana-account:'+owner);return {linked:!!c,legalMode:this.legal(owner),connections:this.connections(owner),workspaceAI:this.aiSettings(owner),canManageAI:this.canManage(owner),...(c?{email:c.email,displayName:c.displayName,firmId:c.firmId,firmName:c.firmName,role:c.firmRole}:{}),simulated:!c?.providerEnabled,policyVersion:c?.policyVersion??1,allowance:c?.allowance};}
 async setLegalCompliance(owner:string,enabled:boolean){throw Error('Manage Legal Compliance in your workspace settings on the web.');}
 async directTiers(owner:string,provider:string,capability='responses'){await this.verifySession(owner,true);this.assertConnection(owner,provider);return (this.secrets.get<Connection>('sylvana-account:'+owner)?.directTiers??[]).filter(r=>r.provider===provider&&r.capability===capability&&['standard','advanced'].includes(r.tier));}
 async directModel(owner:string,provider:string,tier:string,capability='responses'){if(!['standard','advanced'].includes(tier))throw Error('Choose Standard or Advanced.');const route=(await this.directTiers(owner,provider,capability)).find(r=>r.tier===tier);if(!route)throw Error('This service level is awaiting administrator configuration.');return route.model;}
 private async identity(token:string,owner?:string){
  const {payload}=await jwtVerify(token,jwks,{issuer:config.issuer,audience:'authenticated',requiredClaims:['sub','exp','iat','session_id','client_id'],clockTolerance:5});
  if(payload.client_id!==config.clientId||typeof payload.sub!=='string'||owner&&payload.sub!==owner)throw Error('The Sylvana account did not match this local workspace.');
  return payload.sub;
 }
 private async exchange(form:Record<string,string>,signal?:AbortSignal){
  const response=await fetch(config.issuer+'/oauth/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams(form),signal:signal?AbortSignal.any([signal,AbortSignal.timeout(30000)]):AbortSignal.timeout(30000)});
  if(!response.ok){const error=await response.json().catch(()=>({}));throw Object.assign(form.grant_type==='refresh_token'&&error.error==='invalid_grant'?new LocalSessionEnded('Your Sylvana session expired. Continue with Sylvana again.'):Error(response.status<500?'Sign in to Sylvana again to renew this connection.':'Sylvana sign-in is temporarily unavailable. Retry when connected.'),{status:response.status,code:error.error});}
  const tokens=await response.json();
  if(typeof tokens.access_token!=='string'||typeof tokens.refresh_token!=='string'||!Number.isFinite(tokens.expires_in)||tokens.expires_in<=0)throw Error('Sylvana returned an incomplete sign-in response.');
  return tokens;
 }
 private async request(route:string,access:string,method='GET',body?:unknown,signal?:AbortSignal){
  const response=await fetch(config.service+route,{method,headers:{Authorization:'Bearer '+access,'Content-Type':'application/json','X-Sylvana-Policy-Version':'3'},body:body===undefined?undefined:JSON.stringify(body),signal:signal?AbortSignal.any([signal,AbortSignal.timeout(20000)]):AbortSignal.timeout(20000)});
  if(!response.ok){const result=await response.json().catch(()=>({})),code=result.error?.code,message=typeof result.error?.message==='string'?result.error.message:'Sylvana could not complete the request. Check your connection and account allowance.';throw Object.assign(['session_expired','sign_in_required','desktop_revoked','desktop_link_required','desktop_relink_required','member_suspended'].includes(code)&&[401,403].includes(response.status)?new LocalSessionEnded(message):Error(message),{status:response.status,code});}
  return response;
 }
 async connect(expectedOwner?:string){
  if(this.pending)throw Error('Complete the Sylvana sign-in already open in your browser.');this.pending=true;
  const controller=new AbortController();this.controller=controller;const signal=controller.signal;
  const state=randomBytes(32).toString('base64url'),nonce=randomBytes(32).toString('base64url'),verifier=randomBytes(48).toString('base64url');
  let server:ReturnType<typeof createServer>|undefined,timer:NodeJS.Timeout|undefined;
  try{
   let port=0;
   for(const candidate of config.ports){const listener=createServer();try{await new Promise<void>((resolve,reject)=>{listener.once('error',reject);listener.listen(candidate,'127.0.0.1',resolve);});server=listener;port=candidate;break;}catch{listener.close();}}
   if(!server)throw Error('The Sylvana sign-in callback ports are occupied. Close another sign-in attempt and retry.');
   const redirect='http://127.0.0.1:'+port+'/oauth/callback';let consumed=false;
   const callback=new Promise<URL>((resolve,reject)=>{
    signal.addEventListener('abort',()=>reject(signal.reason),{once:true});
    timer=setTimeout(()=>reject(Error('Sylvana sign-in expired. Start sign-in again.')),300000);
    server!.on('request',(req,res)=>{
     const url=new URL(req.url??'/',redirect);
     if(req.method!=='GET'||req.headers.host!=='127.0.0.1:'+port||url.pathname!=='/oauth/callback'){res.writeHead(404).end();return;}
     if(consumed||!equal(url.searchParams.get('state'),state)){res.writeHead(400).end('Invalid sign-in state.');return;}
     consumed=true;clearTimeout(timer);res.writeHead(200,{'Content-Type':'text/plain','Cache-Control':'no-store','Content-Security-Policy':"default-src 'none'"}).end('Sign-in received. Return to Sylvana.');resolve(url);
    });
   });callback.catch(()=>{});
   const authorize=new URL(config.issuer+'/oauth/authorize');authorize.search=new URLSearchParams({client_id:config.clientId,response_type:'code',redirect_uri:redirect,code_challenge:createHash('sha256').update(verifier).digest('base64url'),code_challenge_method:'S256',scope:'openid email profile',state,nonce}).toString();
   await this.openBrowser(authorize.toString());const returned=await callback;
   if(returned.searchParams.has('error')||!returned.searchParams.get('code'))throw Error('Sylvana sign-in was cancelled.');
   signal.throwIfAborted();const tokens=await this.exchange({grant_type:'authorization_code',client_id:config.clientId,redirect_uri:redirect,code:returned.searchParams.get('code')!,code_verifier:verifier},signal);
   const {payload}=await jwtVerify(tokens.id_token,jwks,{issuer:config.issuer,audience:config.clientId,requiredClaims:['sub','exp','iat','nonce'],clockTolerance:5});
   const owner=await this.identity(tokens.access_token,expectedOwner);
   if(payload.nonce!==nonce||payload.sub!==owner)throw Error('The Sylvana sign-in identity could not be verified.');
   await this.finishLogout(owner);
   await this.request('/api/desktop/link',tokens.access_token,'POST',{},signal);
   const me=await (await this.request('/api/desktop/me',tokens.access_token,'GET',undefined,signal)).json();signal.throwIfAborted();
   if(me.user?.id!==owner||typeof me.firm?.id!=='string'||typeof me.firm.legal_mode!=='boolean')throw Error('This Sylvana workspace policy could not be verified.');
   return this.policy({owner,email:String(me.user.email),firmId:me.firm.id,firmName:String(me.firm.name),access_token:tokens.access_token,refresh_token:tokens.refresh_token,expires_at:Date.now()+tokens.expires_in*1000},me);
  }finally{clearTimeout(timer);server?.closeAllConnections();server?.close();this.pending=false;if(this.controller===controller)this.controller=undefined;}
 }
 committed(connection:Connection){this.verified.delete(connection.owner);this.received.delete(connection.owner);this.refreshing.delete(connection.owner);this.checking.delete(connection.owner);}
 async save(connection:Connection){await this.secrets.setMany(this.publication(connection));this.committed(connection);}
 async access(owner:string){
  const current=this.secrets.get<Connection>('sylvana-account:'+owner);if(!current)throw Error('Connect your Sylvana account to use your firm’s allowance.');
  if(current.expires_at>Date.now()+60000)return current.access_token;
  if(!this.refreshing.has(owner)){
   const work=(async()=>{
    let next=this.received.get(owner);
    if(!next){const tokens=await this.exchange({grant_type:'refresh_token',client_id:config.clientId,refresh_token:current.refresh_token});await this.identity(tokens.access_token,owner);next={...current,access_token:tokens.access_token,refresh_token:tokens.refresh_token,expires_at:Date.now()+tokens.expires_in*1000};if(this.secrets.get('sylvana-account:'+owner)!==current)throw Error('The Sylvana account changed during renewal.');this.received.set(owner,next);}
    if(this.secrets.get('sylvana-account:'+owner)!==current)throw Error('The Sylvana account changed during renewal.');
    await this.secrets.set('sylvana-account:'+owner,next);this.received.delete(owner);return next;
   })();this.refreshing.set(owner,work);work.finally(()=>{if(this.refreshing.get(owner)===work)this.refreshing.delete(owner);}).catch(()=>{});
  }
  return (await this.refreshing.get(owner)!).access_token;
 }
 private policy(connection:Connection,me:any):Connection{
  const origin=me.provider?.origin;
  if(origin!==undefined&&origin!==null){const url=new URL(origin);if(url.protocol!=='https:'||url.username||url.password||url.pathname!=='/'||url.search||url.hash||/^(localhost|127\.|169\.254\.|10\.|192\.168\.)/.test(url.hostname))throw Error('The Sylvana provider address is invalid.');}
  const connections=me.policy?.connections;
  if(connections&&['sylvana','chatgpt','openai_api','openrouter'].some(key=>typeof connections[key]!=='boolean'))throw Error('The firm connection policy could not be verified.');
  return {...connection,displayName:typeof me.user?.name==='string'?me.user.name.trim():undefined,connections,workspaceAI:me.policy?.workspace_ai??defaultWorkspaceAI,canManageAI:me.policy?.can_manage===true,legalMode:me.policy?.legal_mode??me.firm.legal_mode,firmRole:me.firm.role,directTiers:me.direct_tiers??[],policyVersion:me.policy?.version??1,providerOrigin:origin??null,providerEnabled:me.provider?.enabled===true,allowance:me.allowance};
 }
 async allowance(owner:string){await this.verifySession(owner,true);return (await this.request('/api/desktop/me',await this.access(owner))).json();}
 async providerURL(owner:string){await this.verifySession(owner,true);const c=this.secrets.get<Connection>('sylvana-account:'+owner);if(!c?.providerEnabled||!c.providerOrigin)throw Error('Sylvana managed processing is awaiting service configuration.');return c.providerOrigin.replace(/\/$/,'');}
 async providerRequest(owner:string,route:string,init:RequestInit={}):Promise<Response>{
  if(!/^\/v1\/[a-zA-Z0-9_./?=&%-]+$/.test(route))throw Error('Invalid Sylvana service route.');
  const origin=await this.providerURL(owner),headers=new Headers(init.headers);headers.set('Authorization','Bearer '+await this.access(owner));
  if(init.method==='POST'&&!headers.has('Idempotency-Key'))headers.set('Idempotency-Key',randomUUID());
  const send=async()=>{headers.set('Authorization','Bearer '+await this.access(owner));return fetch(origin+route,{...init,headers,redirect:'error'});};
  return init.method==='POST'&&/^\/v1\/(responses|chat\/completions)$/.test(route)&&typeof init.body==='string'&&init.signal?requestProviderCapacity(send,init.signal):send();
 }
 transport(owner:string):typeof fetch{return (async(input:any,init?:RequestInit)=>{const url=new URL(String(input));if(url.origin!=='https://sylvana.invalid')throw Error('Invalid managed transport destination.');return this.providerRequest(owner,url.pathname+url.search,init);}) as typeof fetch;}
 async models(owner:string):Promise<Model[]>{
  await this.verifySession(owner,true);const c=this.secrets.get<Connection>('sylvana-account:'+owner);
  if(!c?.providerEnabled)throw Error('Sylvana managed processing is awaiting service configuration. Legal Compliance does not permit a fallback connection.');
  const response=await this.providerRequest(owner,'/v1/models');if(!response.ok)throw Error('The Sylvana model catalog is unavailable.');const value=await response.json();if(!Array.isArray(value.data))throw Error('The Sylvana catalog could not be read.');return value.data.filter((m:any)=>m.capabilities?.includes('responses')||m.capabilities?.includes('chat/completions'));
 }
 async disconnect(owner:string){
  this.verified.delete(owner);
  const connection=this.secrets.get<Connection>('sylvana-account:'+owner);
  if(connection){await this.secrets.setMany([['sylvana-logout:'+owner,connection],['sylvana-account:'+owner,undefined]]);await this.finishLogout(owner);}
  this.received.delete(owner);
 }
 private async finishLogout(owner:string){
  let pending=this.secrets.get<Connection>('sylvana-logout:'+owner);if(!pending)return;
  try{
   if(pending.expires_at<=Date.now()+1000){const tokens=await this.exchange({grant_type:'refresh_token',client_id:config.clientId,refresh_token:pending.refresh_token});await this.identity(tokens.access_token,owner);pending={...pending,access_token:tokens.access_token,refresh_token:tokens.refresh_token,expires_at:Date.now()+tokens.expires_in*1000};await this.secrets.set('sylvana-logout:'+owner,pending);}
   await this.request('/api/desktop/session',pending.access_token,'DELETE');
  }catch(error){if(![401,403].includes((error as {status?:number}).status??0)&&(error as {code?:string}).code!=='invalid_grant')throw error;}
  await this.secrets.set('sylvana-logout:'+owner,undefined);
 }
 async infer(owner:string,requestId:string,input:string,signal:AbortSignal,onDelta:(value:string)=>Promise<void>){
  const response=await this.request('/api/inference',await this.access(owner),'POST',{request_id:requestId,input,model:'sylvana-simulated-v1'},AbortSignal.any([signal,AbortSignal.timeout(300000)]));
  const reader=response.body?.getReader();if(!reader)throw Error('Sylvana returned no response stream.');
  const decoder=new TextDecoder();let pending='',complete=false,total=0;
  try{for(;;){const next=await reader.read();if(next.done)break;total+=next.value.length;if(total>2*1024*1024)throw Error('The Sylvana response exceeded its size limit.');pending+=decoder.decode(next.value,{stream:true});let index:number;while((index=pending.indexOf('\n\n'))>=0){const event=pending.slice(0,index);pending=pending.slice(index+2);const data=event.split('\n').find(line=>line.startsWith('data: '));if(!data)continue;const value=JSON.parse(data.slice(6));if(event.startsWith('event: delta')&&typeof value.text==='string')await onDelta(value.text);if(event.startsWith('event: completed'))complete=true;if(event.startsWith('event: error'))throw Error('The Sylvana request stopped. Review your usage before retrying.');}}}
  finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
  if(!complete)throw Error('The Sylvana response stopped before completion. Your partial response remains local.');
 }
}
