import {artifactTestScope} from './artifact-test-scope61.mjs';
export async function installLiveArtifactsGuard(application){
 await application.evaluate(({app},scopeSource)=>{
  const req=globalThis.__durableProbeRequire,fs=req('node:fs'),path=req('node:path'),crypto=req('node:crypto'),{AsyncLocalStorage}=req('node:async_hooks'),routingScope=new AsyncLocalStorage(),{Broker}=req(path.join(app.getAppPath(),'build/broker.js')),{CodexGateway}=req(path.join(app.getAppPath(),'build/codex-gateway.js')),{ToolService}=req(path.join(app.getAppPath(),'build/tool-service.js')),scopeCheck=eval('('+scopeSource+')');
  const state=globalThis.__coordination={broker:null,calls:[],blocked:[],errors:[],catalog:[],tools:[],leaseActive:false,expiresAt:0,expected:null,maxResponses:9};globalThis.__liveArtifacts61=state;
  const initialize=Broker.prototype.initialize;Broker.prototype.initialize=async function(...args){state.broker=this;return initialize.apply(this,args);};
  const execute=ToolService.prototype.execute;ToolService.prototype.execute=async function(user,request,call,...rest){
   const allowed=state.expected?.requests?.[request.id];if(!state.leaseActive||user.id!==state.expected.owner||!allowed||request.agent_id!==allowed.agentId)throw Error('Tool call is outside the authorized artifact requests');
   const name=call.name.replace(/^(?:workspace|tools)\./,''),args=JSON.parse(call.arguments),checked=scopeCheck(name,args,allowed);
   if(state.tools.length>=16)throw Error('Artifact tool ceiling reached');
   if(checked.script){const file=path.join(allowed.root,checked.script),stat=fs.lstatSync(file);if(!stat.isFile()||stat.isSymbolicLink()||stat.size>160000)throw Error('Builder must be a small regular owned file');scopeCheck('write_file',{reference_id:allowed.referenceId,path:checked.script,content:fs.readFileSync(file,'utf8')},allowed);}
   const row={requestId:request.id,name,submittedAt:new Date().toISOString(),status:'running'};state.tools.push(row);fs.writeFileSync(path.join(state.expected.out,'tool-dispatches.json'),JSON.stringify(state.tools,null,2));
   try{const result=await execute.call(this,user,request,call,...rest);row.status=result?.error||result?.isError?'failed':'completed';return result;}finally{fs.writeFileSync(path.join(state.expected.out,'tool-dispatches.json'),JSON.stringify(state.tools,null,2));}
  };
  const start=CodexGateway.prototype.start;CodexGateway.prototype.start=function(){const handlers=this.server.listeners('request');if(handlers.length!==1)throw Error('Unexpected native gateway');const original=handlers[0];this.server.removeListener('request',original);this.server.on('request',(request,response)=>routingScope.run({thread:request.headers['thread-id'],metadata:request.headers['x-codex-turn-metadata']},()=>original(request,response)));return start.apply(this);};
  const real=globalThis.fetch;globalThis.fetch=async(input,args={})=>{
   const url=new URL(typeof input==='string'?input:input.url??String(input)),method=args.method??'GET';if(url.protocol==='http:'&&['127.0.0.1','localhost','[::1]'].includes(url.hostname))return real(input,args);
   const refuse=message=>{state.blocked.push({origin:url.origin,path:url.pathname,message});throw Error(message);};if(!state.leaseActive||state.expiresAt<Date.now()+90000)return refuse('Fresh access-only authorization is required');
   if(url.href==='https://api.openai.com/v1/models'&&method==='GET'){if(state.catalog.length>=1)return refuse('Only one model catalog read is allowed');const row={status:null};state.catalog.push(row);const response=await real(input,{...args,redirect:'error'});row.status=response.status;return response;}
   if(url.href!=='https://api.openai.com/v1/responses'||method!=='POST')return refuse('Only the owned ChatGPT artifact requests may reach inference');
   const routing=routingScope.getStore();if(!routing?.thread||!routing.metadata)return refuse('No native routing');const metadata=JSON.parse(routing.metadata),active=[...state.broker.native.running.values()].find(row=>row.state.threadId===routing.thread&&row.state.turnId===metadata.turn_id),allowed=state.expected?.requests?.[active?.request.id];
   if(!active||active.owner!==state.expected?.owner||!allowed||active.request.agent_id!==allowed.agentId||allowed.conversation&&allowed.conversation!==active.conversation)return refuse('Inference is outside the owned request scope');
   if(state.calls.length>=state.maxResponses)return refuse('Artifact response ceiling reached');
   const body=JSON.parse(args.body),context=JSON.stringify([body.instructions??null,body.input]);if(body.model!=='gpt-6.1-sol'||!context.includes(allowed.role)||!context.includes(allowed.marker))return refuse('The explicit model, saved identity and task input must be present');
   const inputSha256=crypto.createHash('sha256').update(JSON.stringify([body.model,body.input,body.previous_response_id??null])).digest('hex');if(state.calls.some(row=>row.inputSha256===inputSha256))return refuse('The same model input was already submitted');allowed.conversation=active.conversation;
   const row={requestId:active.request.id,agentId:active.request.agent_id,conversationId:active.conversation,threadId:routing.thread,turnId:metadata.turn_id,inputSha256,model:body.model,submittedAt:new Date().toISOString(),status:null};state.calls.push(row);fs.writeFileSync(path.join(state.expected.out,'model-dispatches.json'),JSON.stringify({calls:state.calls,catalog:state.catalog},null,2));
   try{const response=await real(url.href,{...args,redirect:'error'});row.status=response.status;row.providerRequestId=response.headers.get('x-request-id');return response;}catch(error){row.outcome='unconfirmed';throw error;}finally{fs.writeFileSync(path.join(state.expected.out,'model-dispatches.json'),JSON.stringify({calls:state.calls,catalog:state.catalog},null,2));}
  };
 },artifactTestScope.toString());
}
