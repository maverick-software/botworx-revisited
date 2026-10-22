export async function installLivePdfGuard(application){
 await application.evaluate(({app})=>{
  const req=globalThis.__durableProbeRequire,fs=req('node:fs'),path=req('node:path'),crypto=req('node:crypto'),{AsyncLocalStorage}=req('node:async_hooks'),scope=new AsyncLocalStorage(),{Broker}=req(path.join(app.getAppPath(),'build/broker.js')),{CodexGateway}=req(path.join(app.getAppPath(),'build/codex-gateway.js')),{ToolService}=req(path.join(app.getAppPath(),'build/tool-service.js'));
  const state=globalThis.__coordination={broker:null,calls:[],blocked:[],errors:[],catalog:[],tools:[],leaseActive:false,expiresAt:0,expected:null,maxResponses:4};globalThis.__livePdf63=state;
  const sha=value=>crypto.createHash('sha256').update(value).digest('hex'),journal=()=>fs.writeFileSync(path.join(state.expected.out,'model-dispatches.json'),JSON.stringify({calls:state.calls,catalog:state.catalog,tools:state.tools},null,2));
  const initialize=Broker.prototype.initialize;Broker.prototype.initialize=async function(...args){state.broker=this;return initialize.apply(this,args);};
  const execute=ToolService.prototype.execute;ToolService.prototype.execute=async function(user,request,call,...rest){
   const expected=state.expected;if(!state.leaseActive||!expected||user.id!==expected.owner||request.id!==expected.requestId||request.agent_id!==expected.agentId)throw Error('PDF tool is outside the owned request');
   const name=call.name.replace(/^(?:workspace|tools)\./,''),args=JSON.parse(call.arguments);
   if(name!=='read_file'||args.reference_id!==expected.referenceId||args.path!==''||JSON.stringify(args.pages)!=='[3]'||Object.keys(args).some(key=>!['reference_id','path','pages'].includes(key)))throw Error('Only page three of the selected PDF may be read');
   if(state.tools.length>=1)throw Error('The selected page was already requested; inspect its outcome');
   const row={requestId:request.id,name,pages:[3],submittedAt:new Date().toISOString(),status:'running'};state.tools.push(row);journal();
   try{const result=await execute.call(this,user,request,call,...rest);row.status=result?.error||result?.isError?'failed':'completed';if(row.status==='completed'){if(result.pageImages?.length!==1||result.pageImages[0].page!==3)throw Error('The PDF tool did not return the requested page image');row.pageImageSha256=sha(result.pageImages[0].image);}return result;}finally{journal();}
  };
  const start=CodexGateway.prototype.start;CodexGateway.prototype.start=function(){const handlers=this.server.listeners('request');if(handlers.length!==1)throw Error('Unexpected native gateway listener');const original=handlers[0];this.server.removeListener('request',original);this.server.on('request',(request,response)=>scope.run({thread:request.headers['thread-id'],metadata:request.headers['x-codex-turn-metadata']},()=>original(request,response)));return start.apply(this);};
  const real=globalThis.fetch;globalThis.fetch=async(input,args={})=>{
   const url=new URL(typeof input==='string'?input:input.url??String(input)),method=args.method??'GET';if(url.protocol==='http:'&&['127.0.0.1','localhost','[::1]'].includes(url.hostname))return real(input,args);
   const refuse=message=>{state.blocked.push({origin:url.origin,path:url.pathname,message});throw Error(message);};
   if(!state.leaseActive||state.expiresAt<Date.now()+90000)return refuse('Fresh access-only authorization is required');
   if(url.href==='https://api.openai.com/v1/models'&&method==='GET'){if(state.catalog.length>=2)return refuse('PDF catalog read ceiling reached');const row={submittedAt:new Date().toISOString(),status:null};state.catalog.push(row);const response=await real(input,{...args,redirect:'error'});row.status=response.status;return response;}
   if(url.href!=='https://api.openai.com/v1/responses'||method!=='POST')return refuse('Only the owned ChatGPT PDF request may reach inference');
   const expected=state.expected,routing=scope.getStore();if(!routing?.thread||!routing.metadata||!expected)return refuse('No owned native thread routing');
   const metadata=JSON.parse(routing.metadata),active=[...state.broker.native.running.values()].find(row=>row.state.threadId===routing.thread&&row.state.turnId===metadata.turn_id);
   if(!active||active.owner!==expected.owner||active.request.id!==expected.requestId||active.request.agent_id!==expected.agentId||expected.conversation&&active.conversation!==expected.conversation)return refuse('Inference belongs to another PDF request, agent or conversation');
   if(state.calls.length>=state.maxResponses)return refuse('The bounded PDF response count was reached');
   const body=JSON.parse(args.body),context=JSON.stringify([body.instructions??null,body.input]);if(body.model!=='gpt-6.1-sol'||!context.includes(expected.role)||!context.includes(expected.marker))return refuse('The explicit model, saved role and PDF task must reach inference');
   const imageHashes=[];const visit=value=>{if(!value||typeof value!=='object')return;if(value.type==='input_image'&&typeof value.image_url==='string')imageHashes.push(sha(value.image_url));for(const child of Object.values(value))if(Array.isArray(child))child.forEach(visit);else if(child&&typeof child==='object')visit(child);};visit(body.input);
   if(imageHashes.length<2)return refuse('The selected scanned PDF pages must reach inference');
   if(!state.calls.length&&context.includes(expected.answerCode))return refuse('The expected receipt code must remain outside the initial text input');
   if(state.tools.some(row=>row.status==='completed')&&!imageHashes.some(hash=>!state.calls[0].imageHashes.includes(hash)))return refuse('The requested later page image must reach the next inference');
   const inputSha256=sha(JSON.stringify([body.model,body.input,body.previous_response_id??null]));if(state.calls.some(row=>row.inputSha256===inputSha256))return refuse('This model input was already submitted; inspect its outcome');expected.conversation=active.conversation;
   const row={inputSha256,requestId:active.request.id,agentId:active.request.agent_id,conversationId:active.conversation,threadId:routing.thread,turnId:metadata.turn_id,model:body.model,submittedAt:new Date().toISOString(),imageHashes,status:null};state.calls.push(row);journal();
   try{const response=await real(url.href,{...args,redirect:'error'});row.status=response.status;row.providerRequestId=response.headers.get('x-request-id');return response;}catch(error){row.outcome='unconfirmed';throw error;}finally{journal();}
  };
 });
}
