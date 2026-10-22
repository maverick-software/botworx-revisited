import {createServer} from 'node:http';
import {randomBytes,timingSafeEqual} from 'node:crypto';
import {auth,exchangeAuthorization,refreshAuthorization,validateAuthorizationResponseIssuer,discoverOAuthServerInfo,extractWWWAuthenticateParams,type OAuthClientProvider,type OAuthDiscoveryState} from '@modelcontextprotocol/client';
import {mcpAddress} from './mcp-client';
import {oauthNetwork} from './mcp-oauth-network';
import type {McpOAuthDeclaration} from './mcp-oauth-declaration';

export type McpOAuthScope={owner:string;agent:string;connection:string};
export type McpOAuthTarget={address:string;stamp:string;auth?:McpOAuthDeclaration};
type Stored={target:McpOAuthTarget;redirect:string;discovery?:OAuthDiscoveryState;client?:Awaited<ReturnType<OAuthClientProvider['clientInformation']>>;tokens?:Awaited<ReturnType<OAuthClientProvider['tokens']>>;expiresAt?:number};
type Store={get<T>(key:string):T|undefined;set(key:string,value:unknown):Promise<void>};
const equal=(a:string,b:string)=>{const left=Buffer.from(a),right=Buffer.from(b);return left.length===right.length&&timingSafeEqual(left,right);};
const key=(scope:McpOAuthScope)=>'mcp-oauth:'+scope.owner+':'+scope.agent+':'+scope.connection;
export class McpSignInRequiredError extends Error {constructor(){super('This MCP connection needs browser sign-in. Open the agent’s MCP connections and choose Connect.');}}
const reconnect=()=>new McpSignInRequiredError();
export class McpOAuth {
 private pending=new Map<string,AbortController>();private refreshing=new Map<string,Promise<string>>();
 constructor(private store:Store,private target:(scope:McpOAuthScope)=>Promise<McpOAuthTarget>,private owner:()=>Promise<string>,private open:(url:string)=>Promise<void>){}
 private async checked(scope:McpOAuthScope,expected?:McpOAuthTarget){
  if(await this.owner()!==scope.owner)throw Error('Your Agentopia account changed.');
  const target=await this.target(scope);if(expected&&(target.address!==expected.address||target.stamp!==expected.stamp))throw Error('The MCP connection or plugin assignment changed. Connect it again.');return target;
 }
 connected(scope:McpOAuthScope,target:McpOAuthTarget){const saved=this.store.get<Stored>(key(scope));return !!saved?.tokens&&saved.target.address===target.address&&saved.target.stamp===target.stamp;}
 cancel(scope?:McpOAuthScope){for(const [id,controller]of this.pending)if(!scope||id===key(scope))controller.abort(Error('MCP sign-in cancelled.'));}
 async disconnect(scope:McpOAuthScope){if(await this.owner()!==scope.owner)throw Error('Your Agentopia account changed.');this.cancel(scope);await this.store.set(key(scope),undefined);}
 private provider(record:Stored,state:string,interactive:boolean,redirect:(url:URL)=>Promise<void>):OAuthClientProvider{
  let verifier='';return {
   redirectUrl:record.redirect,clientMetadata:{client_name:'Agentopia',redirect_uris:[record.redirect],grant_types:['authorization_code','refresh_token'],response_types:['code'],token_endpoint_auth_method:'none'},
   state:()=>state,clientInformation:()=>record.client,saveClientInformation:value=>{record.client=value;},tokens:()=>record.tokens,
   saveTokens:value=>{if(value.token_type.toLowerCase()!=='bearer')throw Error('This MCP connection requires an unsupported token presentation method.');record.tokens=value;record.expiresAt=value.expires_in===undefined?undefined:Date.now()+value.expires_in*1000;},
   saveCodeVerifier:value=>{verifier=value;},codeVerifier:()=>verifier,
   discoveryState:()=>record.discovery,saveDiscoveryState:value=>{record.discovery=value;},
   redirectToAuthorization:async url=>{if(!interactive)throw reconnect();await redirect(url);},
  };
 }
 async connect(scope:McpOAuthScope,options:{clientId?:string;clientMetadataUrl?:string}={}){
  const id=key(scope);if(this.pending.has(id))throw Error('This MCP connection is already awaiting browser sign-in.');
  const controller=new AbortController();this.pending.set(id,controller);
  const signal=AbortSignal.any([controller.signal,AbortSignal.timeout(5*60*1000)]),server=createServer();let timerCleanup=()=>{};
  try{
   const target=await this.checked(scope);signal.throwIfAborted();
   if(target.auth?.type==='none')throw Error('This MCP plugin declares an unauthenticated server.');
   const registration=target.auth?.client;
   if(registration?.mode==='provided'){if(options.clientId&&options.clientId!==registration.clientId)throw Error('This MCP client ID differs from its reviewed plugin.');options={clientId:registration.clientId};}
   if(registration?.mode==='dcr')options={};
   if(registration?.mode==='cimd'&&!options.clientMetadataUrl)throw Error('Client metadata document URL is required by this plugin.');
   await new Promise<void>((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
   const address=server.address();if(!address||typeof address==='string')throw Error('The local MCP callback could not start.');
   const redirect=`http://127.0.0.1:${address.port}/mcp/callback`,state=randomBytes(32).toString('base64url');let consumed=false;
   const record:Stored={target,redirect},network=oauthNetwork(target.address,signal);
   const returned=new Promise<URL>((resolve,reject)=>{
    const abort=()=>reject(signal.reason);signal.addEventListener('abort',abort,{once:true});timerCleanup=()=>signal.removeEventListener('abort',abort);
    server.on('request',(req,res)=>{
     res.setHeader('Cache-Control','no-store');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('Content-Type','text/plain; charset=utf-8');
     const url=new URL(req.url??'/',redirect);
     if(req.method!=='GET'||req.headers.host!==`127.0.0.1:${address.port}`||url.pathname!=='/mcp/callback'){res.writeHead(404).end();return;}
     if(consumed||url.searchParams.getAll('state').length!==1||!equal(url.searchParams.get('state')??'',state)||['code','iss','error'].some(k=>url.searchParams.getAll(k).length>1)){res.writeHead(400).end('Invalid authorization callback.');return;}
     consumed=true;res.end('Authorization received. Return to Agentopia.');resolve(url);
    });
   });returned.catch(()=>{});
   // Read only the challenge headers: an unauthenticated SSE body can be unbounded.
   const challenge=await network(target.address,{headers:{Accept:'application/json, text/event-stream'}},true),params=extractWWWAuthenticateParams(challenge);
   const discovery=await discoverOAuthServerInfo(target.address,{resourceMetadataUrl:params.resourceMetadataUrl,fetchFn:network});
   const metadata=discovery.authorizationServerMetadata;
   if(!discovery.resourceMetadata||!metadata||!metadata.code_challenge_methods_supported?.includes('S256'))throw Error('This MCP server must publish resource metadata and OAuth metadata with PKCE S256 support.');
   record.discovery={...discovery,resourceMetadataUrl:params.resourceMetadataUrl?.href};
   const provider=this.provider(record,state,true,async url=>{await this.checked(scope,target);signal.throwIfAborted();mcpAddress(url.href);await this.open(url.href);});
   if(options.clientId){if(options.clientId.length>2048||/[\r\n]/.test(options.clientId))throw Error('Enter a valid public OAuth client ID.');record.client={client_id:options.clientId,issuer:metadata.issuer};}
   if(options.clientMetadataUrl){const url=mcpAddress(options.clientMetadataUrl);if(url.protocol!=='https:'||url.pathname==='/')throw Error('Client metadata must use a public HTTPS document URL.');provider.clientMetadataUrl=url.href;}
   const defaultScopes=target.auth?.defaultScopes,baseScopes=target.auth?.baseScopes??[],selectedScopes=defaultScopes??(params.scope===undefined?undefined:params.scope.split(' ')),scopeValue=selectedScopes===undefined&&!baseScopes.length?undefined:[...new Set([...baseScopes,...(selectedScopes??discovery.resourceMetadata.scopes_supported??[])])].join(' ');
   if(scopeValue==='')record.discovery={...record.discovery,resourceMetadata:{...discovery.resourceMetadata,scopes_supported:[]}};
   if(await auth(provider,{serverUrl:target.address,scope:scopeValue,fetchFn:network})!=='REDIRECT')throw Error('MCP sign-in did not open an authorization request.');
   const callback=await returned;await this.checked(scope,target);signal.throwIfAborted();
   const code=callback.searchParams.get('code');
   // The SDK checks RFC9207 issuer matching before any code exchange, including
   // callbacks advertising issuer support. Do not expose provider error text.
   const iss=callback.searchParams.get('iss')??undefined;
   validateAuthorizationResponseIssuer({iss,expectedIssuer:metadata.issuer,issParameterSupported:metadata.authorization_response_iss_parameter_supported===true});
   if(callback.searchParams.has('error')||!code||code.length>8192)throw Error('MCP authorization was declined or returned no code.');
   if(!record.client)throw Error('MCP authorization returned no client registration.');
   // Exchange each callback once. The general SDK auth orchestrator retries
   // invalid_grant, which would submit an already-consumed code a second time.
   const tokens=await exchangeAuthorization(discovery.authorizationServerUrl,{metadata,clientInformation:record.client,authorizationCode:code,iss,codeVerifier:await provider.codeVerifier(),redirectUri:redirect,resource:discovery.resourceMetadata.resource,fetchFn:network});
   await provider.saveTokens({...tokens,issuer:metadata.issuer});
   await this.checked(scope,target);signal.throwIfAborted();await this.store.set(id,record);
   // Prevent a cancelled/sign-out flow from committing credentials after await.
   try{await this.checked(scope,target);signal.throwIfAborted();}catch(error){await this.store.set(id,undefined);throw error;}
   return {connected:true};
  }catch(error){if(signal.aborted)throw Error(controller.signal.aborted?'MCP sign-in cancelled.':'MCP sign-in expired. Choose Connect to try again.');throw Error(error instanceof Error&&/^(This MCP|The MCP|Your Agentopia|MCP authorization|Client metadata|Enter a valid)/.test(error.message)?error.message:'MCP sign-in could not finish. Check the server’s OAuth setup and try again.');}
  finally{timerCleanup();server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));if(this.pending.get(id)===controller)this.pending.delete(id);}
 }
 async token(scope:McpOAuthScope,signal:AbortSignal){
  const record=this.store.get<Stored>(key(scope));if(!record)return undefined;const target=await this.checked(scope);
  if(!this.connected(scope,target))throw reconnect();
  if(record.expiresAt===undefined||record.expiresAt>Date.now()+30000)return record.tokens!.access_token;
  const existing=this.refreshing.get(key(scope));if(existing)return existing;
  const refresh=(async()=>{
   if(!record.tokens?.refresh_token)throw reconnect();
   const copy:Stored=structuredClone(record),controller=new AbortController(),id=key(scope);if(this.pending.has(id))throw reconnect();this.pending.set(id,controller);
   const deadline=AbortSignal.any([signal,controller.signal]);
   try{const provider=this.provider(copy,'',false,async()=>{throw reconnect();});if(!copy.discovery?.authorizationServerMetadata||!copy.client)throw reconnect();const tokens=await refreshAuthorization(copy.discovery.authorizationServerUrl,{metadata:copy.discovery.authorizationServerMetadata,clientInformation:copy.client,refreshToken:copy.tokens!.refresh_token!,resource:copy.discovery.resourceMetadata?.resource,fetchFn:oauthNetwork(target.address,deadline)});await provider.saveTokens({...tokens,issuer:copy.discovery.authorizationServerMetadata.issuer});await this.checked(scope,target);deadline.throwIfAborted();
    if(this.store.get(id)!==record)throw reconnect();await this.store.set(id,copy);await this.checked(scope,target);deadline.throwIfAborted();return copy.tokens!.access_token;
   }catch{if(this.store.get(id)===copy)await this.store.set(id,undefined);throw reconnect();}finally{if(this.pending.get(id)===controller)this.pending.delete(id);}
  })();this.refreshing.set(key(scope),refresh);try{return await refresh;}finally{if(this.refreshing.get(key(scope))===refresh)this.refreshing.delete(key(scope));}
 }
}
