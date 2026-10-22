export async function installLiveImageEditGuard(application){
 await application.evaluate(({app})=>{
  const req=globalThis.__durableProbeRequire,path=req('node:path'),fs=req('node:fs'),crypto=req('node:crypto'),{AsyncLocalStorage}=req('node:async_hooks'),scope=new AsyncLocalStorage(),{Broker}=req(path.join(app.getAppPath(),'build/broker.js')),{CodexGateway}=req(path.join(app.getAppPath(),'build/codex-gateway.js'));
  const state=globalThis.__coordination={broker:null,calls:[],blocked:[],errors:[],catalog:0,catalogCalls:[],imagePosts:[],imageMetadata:[],leaseActive:false,expiresAt:0,expected:null,maxResponses:6};globalThis.__liveImageEdit60=state;
  const initialize=Broker.prototype.initialize;Broker.prototype.initialize=async function(...args){state.broker=this;return initialize.apply(this,args);};
  const start=CodexGateway.prototype.start;CodexGateway.prototype.start=function(){const handlers=this.server.listeners('request');if(handlers.length!==1)throw Error('Unexpected native gateway listener');const original=handlers[0];this.server.removeListener('request',original);this.server.on('request',(request,response)=>scope.run({thread:request.headers['thread-id'],metadata:request.headers['x-codex-turn-metadata']},()=>original(request,response)));return start.apply(this);};
  const real=globalThis.fetch;globalThis.fetch=async(input,args)=>{
   const url=new URL(typeof input==='string'?input:input.url??String(input)),method=args?.method??'GET';
   if(url.protocol==='http:'&&['127.0.0.1','localhost','[::1]'].includes(url.hostname))return real(input,args);
   const refuse=message=>{state.blocked.push({origin:url.origin,path:url.pathname,message});throw Error(message);};
   if(!state.leaseActive||state.expiresAt<Date.now()+90000)return refuse('A fresh access-only lease is required; renewal and unrelated external calls are refused');
   if(url.href==='https://api.openai.com/v1/models'&&method==='GET'){state.catalog++;const row={url:url.href,submittedAt:new Date().toISOString(),status:null};state.catalogCalls.push(row);const result=await real(input,{...args,redirect:'error'});row.status=result.status;return result;}
   if(url.href!=='https://api.openai.com/v1/responses'||method!=='POST')return refuse('Only the bound ChatGPT image-edit turn may perform inference');
   if(state.calls.length>=state.maxResponses)return refuse('The bounded live model-response ceiling has been reached');
   const routing=scope.getStore();if(!routing?.thread||!routing.metadata)return refuse('Native inference has no observed thread routing');const metadata=JSON.parse(routing.metadata),active=[...state.broker.native.running.values()].find(row=>row.state.threadId===routing.thread&&row.state.turnId===metadata.turn_id),expected=state.expected;
   if(!active||active.owner!==expected?.owner||active.request.id!==expected.requestId||active.request.agent_id!==expected.agentId||active.conversation!==expected.conversation)return refuse('Inference is outside the sole generated UI edit request');
   const body=JSON.parse(args.body);if(body.model!=='gpt-6.1-sol')return refuse('The live image-edit check requires its explicit ChatGPT model');
   const inputSha256=crypto.createHash('sha256').update(JSON.stringify([body.model,body.input,body.previous_response_id??null])).digest('hex');if(state.calls.some(row=>row.inputSha256===inputSha256))return refuse('This model input was already submitted; inspect its outcome before any repeat');const row={inputSha256,requestId:active.request.id,conversationId:active.conversation,threadId:routing.thread,turnId:metadata.turn_id,model:body.model,submittedAt:new Date().toISOString(),inputCharacters:JSON.stringify(body.input).length,hasImageInput:JSON.stringify(body.input).includes('"type":"input_image"'),status:null};state.calls.push(row);fs.writeFileSync(path.join(expected.out,'model-dispatches.json'),JSON.stringify({calls:state.calls,catalog:state.catalogCalls},null,2));
   try{const result=await real(input,{...args,redirect:'error'});row.status=result.status;row.providerRequestId=result.headers.get('x-request-id');return result;}catch(error){row.outcome='unconfirmed';throw error;}finally{fs.writeFileSync(path.join(expected.out,'model-dispatches.json'),JSON.stringify({calls:state.calls,catalog:state.catalogCalls},null,2));}
  };
 });
}
