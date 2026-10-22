export type ChatGPTConnectionIssue={kind:'reauthorize'|'retry'|'configuration';message:string;code?:string;httpStatus?:number;requestId?:string;at:string};
const unusable=new Set(['invalid_grant','invalid_refresh_token','token_expired','refresh_token_expired','refresh_token_invalidated','refresh_token_reused']);
const configuration=new Set(['invalid_client','invalid_request','unsupported_grant_type','invalid_scope','unauthorized_client']);
const known=new Set([...unusable,...configuration,'server_error','temporarily_unavailable','rate_limit_exceeded','access_denied']);

export class ChatGPTAuthorizationError extends Error {
 constructor(readonly issue:ChatGPTConnectionIssue){super(issue.message);this.name='ChatGPTAuthorizationError';}
}
export function renewalUnavailable(){return new ChatGPTAuthorizationError({kind:'retry',message:'ChatGPT could not renew this connection. Check your internet connection and retry. Your selected provider has been kept.',at:new Date().toISOString()});}
export function reconnectRequired(){return new ChatGPTAuthorizationError({kind:'reauthorize',message:'Your ChatGPT session can no longer be renewed. Choose Continue with ChatGPT in Settings → AI connections.',at:new Date().toISOString()});}

/** Retain diagnostic structure without echoing provider messages or token values. */
export async function authorizationFailure(response:Response):Promise<ChatGPTAuthorizationError>{
 let body:unknown;const reader=response.body?.getReader();let bytes=0,text='';
 if(reader){const decoder=new TextDecoder();try{while(true){const chunk=await reader.read();if(chunk.done)break;bytes+=chunk.value.length;if(bytes>32768){await reader.cancel();break;}text+=decoder.decode(chunk.value,{stream:true});}if(bytes<=32768)body=JSON.parse(text+decoder.decode());}catch{await reader.cancel().catch(()=>{});}finally{reader.releaseLock();}}
 const value=body as {error?:string|{code?:unknown};code?:unknown}|undefined,raw=typeof value?.error==='string'?value.error:value?.error?.code??value?.code,code=typeof raw==='string'&&known.has(raw)?raw:undefined;
 const kind=code&&unusable.has(code)?'reauthorize':code&&configuration.has(code)?'configuration':'retry';
 const message=kind==='reauthorize'?reconnectRequired().message:kind==='configuration'?'ChatGPT rejected Agentopia’s saved registration or renewal configuration. The connection needs repair; your credentials have been retained.':'ChatGPT could not renew this connection (HTTP '+response.status+'). Retry when the connection is available. Your selected provider has been kept.';
 const requestId=response.headers.get('x-request-id');
 return new ChatGPTAuthorizationError({kind,message,...(code?{code}:{}),httpStatus:response.status,...(requestId&&/^[A-Za-z0-9_-]{1,180}$/.test(requestId)?{requestId}:{}),at:new Date().toISOString()});
}
