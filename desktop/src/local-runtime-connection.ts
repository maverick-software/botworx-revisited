/** Transport recovery never retries the caller's operation. */
export const localRuntimeUnavailableTag='[sylvana-local-runtime-unavailable]';
export const localRuntimeUnavailableMessage='Sylvana cannot reach its local services. Your drafts are retained. Wait for the connection to return, then try again.';
const interruptedMessage='Sylvana lost its local connection while handling this action. Your drafts are retained. Check its saved result before trying again.';
export function localRuntimeUnavailable(error:unknown){const message=String((error as Error)?.message??error);return message.includes(localRuntimeUnavailableTag)||message.includes(localRuntimeUnavailableMessage)||message.includes(interruptedMessage);}
export function localRuntimeError(interrupted=false){return Error(localRuntimeUnavailableTag+' '+(interrupted?interruptedMessage:localRuntimeUnavailableMessage));}
export function transportFailure(error:unknown){return /fetch failed|failed to fetch|ECONNREFUSED|ECONNRESET|EPIPE|UND_ERR_CONNECT_TIMEOUT/i.test(String((error as Error)?.message??error));}
export function runtimeErrorMessage(error:unknown){const message=String((error as Error)?.message??error);return localRuntimeUnavailable(error)?message.includes(interruptedMessage)?interruptedMessage:localRuntimeUnavailableMessage:message;}

/** One health/reconnect attempt shared by desktop calls and resume events. */
export class LocalRuntimeConnection{
 private checking?:Promise<boolean>;private checkedAt=0;private retryAt=0;private closed=false;
 available=true;
 interruptions=0;
 constructor(private hooks:{health:()=>Promise<boolean>;recover:()=>Promise<void>;publish:(available:boolean,message:string)=>void;now?:()=>number}){}
 close(){this.closed=true;}
 async check(force=false,retry=false):Promise<boolean>{
  if(this.closed)return false;if(this.checking)return this.checking;
  const now=this.hooks.now?.()??Date.now();if(!force&&this.checkedAt&&now-this.checkedAt<5000)return this.available;
  const work=(async()=>{
   let healthy=false;try{healthy=await this.hooks.health();}catch{}
   if(this.closed)return false;
   if(healthy){const changed=!this.available;this.available=true;if(changed)this.hooks.publish(true,'Your local services are connected.');return true;}
   if(this.available)this.interruptions++;this.available=false;this.hooks.publish(false,localRuntimeUnavailableMessage);
   if(!retry&&now<this.retryAt)return false;this.retryAt=now+20000;
   try{await this.hooks.recover();if(this.closed)return false;if(!await this.hooks.health())throw Error('Local services did not become ready.');this.available=true;this.retryAt=0;this.hooks.publish(true,'Your local services are connected.');return true;}
   catch{if(!this.closed)this.hooks.publish(false,localRuntimeUnavailableMessage);return false;}
  })();this.checking=work;
  try{return await work;}finally{this.checkedAt=this.hooks.now?.()??Date.now();if(this.checking===work)this.checking=undefined;}
 }
 async require(){if(!this.available&&!await this.check())throw localRuntimeError();}
 async activitySettled(){if(this.checking)await this.checking;if(!this.available&&!this.closed)await this.check(true,true);}
 async failed(error:unknown):Promise<never>{if(transportFailure(error)){const before=this.interruptions;await this.check(true);if(!this.available||before!==this.interruptions)throw localRuntimeError(true);}throw error;}
}
