export async function installLiveVisionGuard(application){
 await application.evaluate(({app})=>{
  const req=globalThis.__durableProbeRequire,fs=req('node:fs'),path=req('node:path'),crypto=req('node:crypto'),{AsyncLocalStorage}=req('node:async_hooks'),scope=new AsyncLocalStorage(),{Broker}=req(path.join(app.getAppPath(),'build/broker.js')),{CodexGateway}=req(path.join(app.getAppPath(),'build/codex-gateway.js'));
  const state=globalThis.__coordination={broker:null,calls:[],blocked:[],errors:[],catalog:[],leaseActive:false,expiresAt:0,expected:null,maxResponses:3};globalThis.__liveVision61=state;
  const initialize=Broker.prototype.initialize;Broker.prototype.initialize=async function(...args){state.broker=this;return initialize.apply(this,args);};
  const start=CodexGateway.prototype.start;CodexGateway.prototype.start=function(){const handlers=this.server.listeners('request');if(handlers.length!==1)throw Error('Unexpected native gateway listener');const original=handlers[0];this.server.removeListener('request',original);this.server.on('request',(request,response)=>scope.run({thread:request.headers['thread-id'],metadata:request.headers['x-codex-turn-metadata']},()=>original(request,response)));return start.apply(this);};
  const real=globalThis.fetch;globalThis.fetch=async(input,args={})=>{
   const url=new URL(typeof input==='string'?input:input.url??String(input)),method=args.method??'GET';if(url.protocol==='http:'&&['127.0.0.1','localhost','[::1]'].includes(url.hostname))return real(input,args);
   const refuse=message=>{state.blocked.push({origin:url.origin,path:url.pathname,message});throw Error(message);};
   if(!state.leaseActive||state.expiresAt<Date.now()+90000)return refuse('Fresh access-only authorization is required; refresh and unrelated requests are refused');
   if(url.href==='https://api.openai.com/v1/models'&&method==='GET'){if(state.catalog.length>=1)return refuse('Only one model catalog read is allowed');const row={submittedAt:new Date().toISOString(),status:null};state.catalog.push(row);const response=await real(input,{...args,redirect:'error'});row.status=response.status;return response;}
   if(url.href!=='https://api.openai.com/v1/responses'||method!=='POST')return refuse('Only the single owned ChatGPT vision request may perform inference');
   const expected=state.expected,routing=scope.getStore();if(!routing?.thread||!routing.metadata||!expected)return refuse('No owned native thread routing');
   const metadata=JSON.parse(routing.metadata),active=[...state.broker.native.running.values()].find(row=>row.state.threadId===routing.thread&&row.state.turnId===metadata.turn_id);
   if(!active||active.owner!==expected.owner||active.request.id!==expected.requestId||active.request.agent_id!==expected.agentId||expected.conversation&&active.conversation!==expected.conversation)return refuse('Inference belongs to another request, agent or conversation');
   if(state.calls.length>=state.maxResponses)return refuse('The bounded response count was reached');
   const body=JSON.parse(args.body);if(body.model!=='gpt-6.1-sol')return refuse('Only the explicit ChatGPT model is allowed');
   const inputText=JSON.stringify(body.input),context=JSON.stringify([body.instructions??null,body.input]),inputSha256=crypto.createHash('sha256').update(JSON.stringify([body.model,body.input,body.previous_response_id??null])).digest('hex');if(state.calls.some(row=>row.inputSha256===inputSha256))return refuse('This exact model input was already submitted; inspect its outcome');
   if(!inputText.includes('"type":"input_image"')||!context.includes(expected.role)||!context.includes(expected.sourceHeading))return refuse('The saved identity, selected source and image must reach native inference');
   const row={inputSha256,requestId:active.request.id,agentId:active.request.agent_id,conversationId:active.conversation,threadId:routing.thread,turnId:metadata.turn_id,model:body.model,submittedAt:new Date().toISOString(),inputCharacters:inputText.length,hasImageInput:true,hasSavedRole:true,hasSelectedSource:true,status:null};state.calls.push(row);fs.writeFileSync(path.join(expected.out,'model-dispatches.json'),JSON.stringify({calls:state.calls,catalog:state.catalog},null,2));
   try{const response=await real(url.href,{...args,redirect:'error'});row.status=response.status;row.providerRequestId=response.headers.get('x-request-id');return response;}catch(error){row.outcome='unconfirmed';throw error;}finally{fs.writeFileSync(path.join(expected.out,'model-dispatches.json'),JSON.stringify({calls:state.calls,catalog:state.catalog},null,2));}
  };
 });
}
