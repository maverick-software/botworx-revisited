// Observe actual native routing. No inference response is synthesized.
export async function installLiveReportGuard(application){
 await application.evaluate(({app})=>{
  const req=globalThis.__durableProbeRequire,path=req('node:path'),{AsyncLocalStorage}=req('node:async_hooks'),scope=new AsyncLocalStorage(),{Broker}=req(path.join(app.getAppPath(),'build/broker.js')),{CodexGateway}=req(path.join(app.getAppPath(),'build/codex-gateway.js'));
  const state=globalThis.__coordination={broker:null,calls:[],blocked:[],errors:[],catalog:0,leaseActive:false,expiresAt:0,allowedRequests:new Set(),expected:null,maxResponses:12};globalThis.__liveReport=state;
  const initialize=Broker.prototype.initialize;Broker.prototype.initialize=async function(...args){state.broker=this;return initialize.apply(this,args);};
  const start=CodexGateway.prototype.start;CodexGateway.prototype.start=function(){const handlers=this.server.listeners('request');if(handlers.length!==1)throw Error('Unexpected native gateway listener');const original=handlers[0];this.server.removeListener('request',original);this.server.on('request',(request,response)=>scope.run({thread:request.headers['thread-id'],metadata:request.headers['x-codex-turn-metadata']},()=>original(request,response)));return start.apply(this);};
  const real=globalThis.fetch;
  globalThis.fetch=async(input,args)=>{
   const url=new URL(typeof input==='string'?input:input.url??String(input));
   if(url.protocol==='http:'&&['127.0.0.1','localhost','[::1]'].includes(url.hostname))return real(input,args);
   const refuse=message=>{state.blocked.push({origin:url.origin,path:url.pathname,message});throw Error(message);};
   if(!state.leaseActive||state.expiresAt<Date.now()+90000)return refuse('A valid access-only lease is required; detached credential renewal is refused');
   if(url.href==='https://api.openai.com/v1/models'&&(args?.method??'GET')==='GET'){state.catalog++;return real(input,{...args,redirect:'error'});}
   if(url.href!=='https://api.openai.com/v1/responses'||args?.method!=='POST')return refuse('Live report verification refuses unrelated external services');
   if(state.calls.length>=state.maxResponses)return refuse('Live response ceiling reached; inspect saved requests before any further submission');
   const routing=scope.getStore();if(!routing?.thread||!routing.metadata)return refuse('Native inference has no observed thread routing');const metadata=JSON.parse(routing.metadata);
   let actor='parent',active=[...state.broker.native.running.values()].find(row=>row.state.threadId===routing.thread&&row.state.turnId===metadata.turn_id);
   if(!active)for(const worker of state.broker.native.workers){const report=worker.report;if(report?.state.threadId===routing.thread&&report.state.turnId===metadata.turn_id){active=report;actor='report';break;}}
   if(!active||active.owner!==state.expected?.owner||!state.allowedRequests.has(active.request.id))return refuse('Inference is outside the explicitly generated request scope');
   if(active.request.agent_id===state.expected.child)actor='specialist';else if(active.request.agent_id!==state.expected.parent)return refuse('An unplanned agent attempted inference');
   const body=JSON.parse(args.body);if(body.model!=='gpt-6.1-sol')return refuse('An unplanned model was requested');
   const serialized=JSON.stringify(body.input),call={requestId:active.request.id,conversationId:active.conversation,threadId:routing.thread,turnId:metadata.turn_id,actor,model:body.model,submittedAt:new Date().toISOString(),inputCharacters:serialized.length,containsGeneratedFact:!!state.expected.fact&&serialized.includes(state.expected.fact),status:null};state.calls.push(call);
   try{const result=await real(input,{...args,redirect:'error'});call.status=result.status;call.providerRequestId=result.headers.get('x-request-id');return result;}catch(error){call.outcome='unconfirmed';throw error;}
  };
 });
}
