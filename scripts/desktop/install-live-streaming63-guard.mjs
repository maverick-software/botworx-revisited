import {observeProviderStream} from './provider-stream-observer63.mjs';
export async function installLiveStreamingGuard(application){
 await application.evaluate(({app},observerSource)=>{
  const observe=eval('('+observerSource+')');
  const req=globalThis.__durableProbeRequire,path=req('node:path'),fs=req('node:fs'),crypto=req('node:crypto'),{AsyncLocalStorage}=req('node:async_hooks'),routing=new AsyncLocalStorage(),{Broker}=req(path.join(app.getAppPath(),'build/broker.js')),{CodexGateway}=req(path.join(app.getAppPath(),'build/codex-gateway.js')),{ToolService}=req(path.join(app.getAppPath(),'build/tool-service.js'));
  const s=globalThis.__coordination={broker:null,calls:[],blocked:[],errors:[],catalog:0,catalogCalls:[],leaseActive:false,expiresAt:0,expected:null,maxResponses:9};globalThis.__liveStreaming63=s;
  const initialize=Broker.prototype.initialize;Broker.prototype.initialize=async function(...args){s.broker=this;return initialize.apply(this,args);};
  ToolService.prototype.execute=async()=>{throw Error('This bounded live control verification authorizes no tool execution');};
  const start=CodexGateway.prototype.start;CodexGateway.prototype.start=function(){const handlers=this.server.listeners('request');if(handlers.length!==1)throw Error('Unexpected native gateway');const original=handlers[0];this.server.removeListener('request',original);this.server.on('request',(request,response)=>routing.run({thread:request.headers['thread-id'],metadata:request.headers['x-codex-turn-metadata']},()=>original(request,response)));return start.apply(this);};
  const journal=()=>{if(s.expected?.out)fs.writeFileSync(path.join(s.expected.out,'model-dispatches.json'),JSON.stringify({calls:s.calls,catalog:s.catalogCalls,blocked:s.blocked},null,2));};
  const real=globalThis.fetch;globalThis.fetch=async(input,args={})=>{
   const url=new URL(typeof input==='string'?input:input.url??String(input)),method=args.method??'GET';if(url.protocol==='http:'&&['127.0.0.1','localhost','[::1]'].includes(url.hostname))return real(input,args);
   const refuse=message=>{s.blocked.push({origin:url.origin,path:url.pathname,message});journal();throw Error(message);};if(!s.leaseActive||s.expiresAt<Date.now()+90000)return refuse('Fresh access-only authorization required');
   if(url.href==='https://api.openai.com/v1/models'&&method==='GET'){if(s.catalog>=6)return refuse('The scoped model-catalog allowance is exhausted');s.catalog++;const row={status:null};s.catalogCalls.push(row);const response=await real(input,{...args,redirect:'error'});row.status=response.status;journal();return response;}
   if(url.href!=='https://api.openai.com/v1/responses'||method!=='POST')return refuse('Only the owned concurrency verification requests may use inference');
   const current=routing.getStore();if(!current?.thread||!current.metadata)return refuse('No observed native routing');const metadata=JSON.parse(current.metadata),active=[...s.broker.native.running.values()].find(row=>row.state.threadId===current.thread&&row.state.turnId===metadata.turn_id),target=active&&s.expected.requests[active.request.id];
   if(!target||active.owner!==s.expected.owner||active.request.agent_id!==target.agent)return refuse('Inference is outside the owned request and saved agent');
   const count=s.calls.filter(row=>row.requestId===active.request.id).length;if(s.calls.length>=s.maxResponses||count>=target.maxCalls)return refuse('The bounded response allowance is exhausted; inspect saved work');
   const body=JSON.parse(args.body),context=JSON.stringify([body.instructions??null,body.input]);if(body.model!=='gpt-6.1-sol'||!context.includes(target.role)||!context.includes(s.expected.marker)||context.length>500000||/data:image\//.test(context))return refuse('The expected model, saved role and bounded text task are required');if(target.requireInput&&!context.includes(target.requireInput))return refuse('The exact queued or steering instruction must reach the actual model input');
   const inputSha256=crypto.createHash('sha256').update(JSON.stringify([body.model,body.instructions??null,body.input,body.previous_response_id??null])).digest('hex');if(s.calls.some(row=>row.inputSha256===inputSha256))return refuse('This model input was already submitted; do not replay it');
   const row={requestId:active.request.id,agentId:active.request.agent_id,conversationId:active.conversation,threadId:current.thread,turnId:metadata.turn_id,model:body.model,inputSha256,submittedAt:new Date().toISOString(),status:null,includesSteering:!!target.steering&&context.includes(target.steering),includesQueued:!!target.requireInput&&context.includes(target.requireInput)};s.calls.push(row);journal();
   const response=await real(input,{...args,redirect:'error'});row.status=response.status;journal();
   return observe(response,args.signal,row,journal);
  };
 },observeProviderStream.toString());
}
