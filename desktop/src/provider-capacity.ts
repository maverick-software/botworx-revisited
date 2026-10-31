type Wait=(milliseconds:number,signal:AbortSignal)=>Promise<void>;
const waitForCapacity:Wait=(milliseconds,signal)=>new Promise((resolve,reject)=>{
 signal.throwIfAborted();
 const done=()=>{clearTimeout(timer);signal.removeEventListener('abort',abort);resolve();};
 const abort=()=>{clearTimeout(timer);signal.removeEventListener('abort',abort);reject(signal.reason);};
 // Spread simultaneous clients' readmission attempts instead of synchronizing them.
 const timer=setTimeout(done,Math.min(30000,Math.max(1000,Math.round(milliseconds*(0.8+Math.random()*0.4)))));signal.addEventListener('abort',abort,{once:true});
});

/** Retry only definitive pre-dispatch queue denials. Network errors, upstream
 * failures and possibly paid generations must never be replayed here. */
export async function requestProviderCapacity(send:()=>Promise<Response>,signal:AbortSignal,wait:Wait=waitForCapacity):Promise<Response>{
 let attempt=0;
 for(;;){
  signal.throwIfAborted();
  const response=await send();
  if(response.status!==503)return response;
  let code:unknown;
  try{code=(await response.clone().json()).error?.code;}catch{return response;}
  if(code!=='queue_full'&&code!=='queue_timeout')return response;
  await response.body?.cancel();
  const seconds=Number(response.headers.get('Retry-After')??2);
  const delay=Math.min(30000,Math.max(1000,(Number.isFinite(seconds)?seconds:2)*1000)*(++attempt));
  await wait(delay,signal);
 }
}
