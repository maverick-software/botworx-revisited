import {createServer,type Server} from 'node:http';
import {randomBytes,timingSafeEqual} from 'node:crypto';
import type {Provider} from './contracts';
import {maxNativeRequestBytes} from './image-limits';

export type NativeInferenceScope={threadId:string;turnId:string;signal:AbortSignal};
export class NativeAuthorizationError extends Error{constructor(message='This native request does not belong to an active owned turn.',readonly status=403){super(message);}}
function routing(headers:Record<string,string|string[]|undefined>){
 const threadId=headers['thread-id'],raw=headers['x-codex-turn-metadata'],uuid=/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;
 if(typeof threadId!=='string'||!uuid.test(threadId)||typeof raw!=='string'||raw.length>8192)throw new NativeAuthorizationError('The native request has no valid thread and turn routing.',400);
 let value:any;try{value=JSON.parse(raw);}catch{throw new NativeAuthorizationError('The native request routing could not be read.',400);}
 if(!value||value.thread_id!==threadId||typeof value.turn_id!=='string'||!uuid.test(value.turn_id))throw new NativeAuthorizationError('The native request routing does not match its thread.',400);
 return {threadId,turnId:value.turn_id as string};
}

/** Inference transport only. Codex owns the agent loop; upstream credentials never enter its process. */
export class CodexGateway {
 private server:Server;private controllers=new Set<AbortController>();
 readonly bearer=randomBytes(32).toString('base64url');baseUrl='';
 observe:(request:{model:string;tools:string[];store:unknown;stream:unknown;inputTypes:string[];keys:string[]})=>void=()=>{};
 constructor(private provider:Provider,private credential:(scope:NativeInferenceScope)=>Promise<string>,private models:Set<string>,private managedFetch?:typeof fetch){this.server=createServer((req,res)=>{void(async()=>{
  const auth=Buffer.from(req.headers.authorization??''),expected=Buffer.from('Bearer '+this.bearer);
  if(auth.length!==expected.length||!timingSafeEqual(auth,expected)){res.writeHead(401).end();return;}
  if(req.method!=='POST'||req.url!=='/v1/responses'){res.writeHead(404).end();return;}
  let size=0;const chunks:Buffer[]=[];for await(const chunk of req){size+=chunk.length;if(size>maxNativeRequestBytes){res.writeHead(413).end();return;}chunks.push(chunk);}
  let body:any;try{body=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{res.writeHead(400).end();return;}
  if(!this.models.has(body.model)||body.previous_response_id){res.writeHead(400).end(JSON.stringify({error:{message:'This model or continuation is not authorized for this connection.'}}));return;}
  const scope=routing(req.headers);
  // Both private providers require stateless, complete Responses input.
  body.store=false;body.stream=true;
  if((body.input??[]).some((item:any)=>item.type==='agent_message')){res.writeHead(400).end(JSON.stringify({error:{message:'This connection requires the bundled native V1 subagent catalog. Repair the runtime resources before continuing.'}}));return;}
  this.observe({model:body.model,tools:(body.tools??[]).map((t:any)=>t.type),store:body.store,stream:body.stream,inputTypes:(body.input??[]).map((i:any)=>i.type??i.role),keys:Object.keys(body)});
  const controller=new AbortController();this.controllers.add(controller);res.once('close',()=>controller.abort());
  try{
   const token=await this.credential({...scope,signal:controller.signal});controller.signal.throwIfAborted();const upstream=await (this.managedFetch??fetch)(this.provider==='sylvana'?'https://sylvana.invalid/v1/responses':this.provider==='openrouter'?'https://openrouter.ai/api/v1/responses':'https://api.openai.com/v1/responses',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json','User-Agent':'Sylvana/0.31.0'},body:JSON.stringify(body),signal:controller.signal});
   if(!upstream.ok){await upstream.body?.cancel();const messages:Record<number,string>={401:'The provider credential expired or is invalid. Reconnect in AI connections.',402:this.provider==='sylvana'?'Your Sylvana allowance is exhausted. Manage usage in the firm dashboard.':'OpenRouter needs more credits.',403:'This account is not authorized for the selected model or capability.',429:'The provider reached a usage limit. Wait before retrying.'};res.writeHead(upstream.status,{'Content-Type':'application/json','Cache-Control':'no-store'}).end(JSON.stringify({error:{message:messages[upstream.status]??'The provider could not accept this native request. Review the model and connection settings.',code:'provider_http_'+upstream.status}}));return;}
   res.writeHead(upstream.status,{'Content-Type':upstream.headers.get('content-type')??'text/event-stream','Cache-Control':'no-store'});
   if(upstream.body)for await(const chunk of upstream.body as any){if(res.destroyed)break;if(!res.write(chunk))await new Promise<void>(resolve=>{res.once('drain',resolve);res.once('close',resolve);});}res.end();
  }finally{this.controllers.delete(controller);}
 })().catch(error=>{if(res.destroyed)return;const refused=error instanceof NativeAuthorizationError;if(!res.headersSent)res.writeHead(refused?error.status:502,{'Content-Type':'application/json'});res.end(JSON.stringify({error:{message:refused?error.message:'The provider connection failed. Check AI connections and retry.',...(refused?{code:'native_turn_not_authorized'}:{})}}));});});}
 async start(){await new Promise<void>((resolve,reject)=>{this.server.once('error',reject);this.server.listen(0,'127.0.0.1',resolve);});const address=this.server.address();if(!address||typeof address==='string')throw new Error('The private inference gateway could not start.');this.baseUrl=`http://127.0.0.1:${address.port}/v1`;return this;}
 close(){for(const controller of this.controllers)controller.abort();this.server.closeAllConnections();this.server.close();}
}
