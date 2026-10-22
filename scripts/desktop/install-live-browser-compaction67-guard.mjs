// Developer QA only: real responses, exact generated agent, bounded dispatches.
export function checkContinuity66(s, request, now=Date.now()) {
 const x=s.expected;
 if(!s.leaseActive||s.expiresAt<now+90000)throw Error('Fresh access-only authorization is required.');
 if(!x||request.owner!==x.owner||request.agentId!==x.agent||!x.requests.includes(request.requestId))throw Error('Inference is outside the generated continuity task.');
 if(request.model!=='gpt-6.1-sol'||request.context.length>300000||!request.context.includes(x.marker)||!request.context.includes(x.role)||/data:image\//.test(request.context))throw Error('Expected generated identity, bounded text and selected model are required.');
 if(s.calls.length>=(x.maximumResponses??12)||s.calls.filter(row=>row.requestId===request.requestId).length>=8)throw Error('Continuity response ceiling reached; inspect the original requests.');
 if(s.calls.some(row=>row.inputSha256===request.inputSha256))throw Error('Never replay an already submitted model input.');
 return true;
}

export async function installContinuity66Guard(application){await application.evaluate(({app},source)=>{
 const req=globalThis.__durableProbeRequire,path=req('node:path'),fs=req('node:fs'),crypto=req('node:crypto'),{AsyncLocalStorage}=req('node:async_hooks'),routing=new AsyncLocalStorage(),check=eval('('+source+')');
 const {Broker}=req(path.join(app.getAppPath(),'build/broker.js')),{CodexGateway}=req(path.join(app.getAppPath(),'build/codex-gateway.js')),{ToolService}=req(path.join(app.getAppPath(),'build/tool-service.js'));
 const s=globalThis.__coordination={broker:null,calls:[],blocked:[],errors:[],catalog:0,leaseActive:false,expiresAt:0,expected:null,events:[],configs:[]};
 const journal=()=>{if(s.expected?.out)fs.writeFileSync(path.join(s.expected.out,'dispatch-'+s.expected.phase+'.json'),JSON.stringify({calls:s.calls,blocked:s.blocked,events:s.events,configs:s.configs,tools:s.tools??[]},null,2));};
 const initialize=Broker.prototype.initialize;Broker.prototype.initialize=async function(...args){s.broker=this;return initialize.apply(this,args);};
  const actualExecute=ToolService.prototype.execute;ToolService.prototype.execute=async function(user,request,call,...rest){
  const x=s.expected,name=call.name.replace(/^(?:workspace|tools)\./,''),args=JSON.parse(call.arguments),keys=Object.keys(args);s.tools??=[];
  if(!s.leaseActive||x?.phase!=='warm'||user.id!==x?.owner||request.agent_id!==x.agent||request.id!==x.requests[0])throw Error('Only the first generated browser task can read its one source.');
  if(name==='browser_open'){if(s.tools.length||args.url!==x.url||keys.some(key=>key!=='url'))throw Error('Only one exact generated local page may be opened.');}
  else if(name==='browser_snapshot'){if(s.tools.length!==1||!s.tabId||args.tab_id!==s.tabId||(args.text_offset??0)!==0||(args.element_offset??0)!==0||keys.some(key=>!['tab_id','text_offset','element_offset'].includes(key)))throw Error('Only one snapshot of the generated page is authorized.');}
  else throw Error('Only browser_open and browser_snapshot are authorized.');
  const row={name,requestId:request.id,submittedAt:new Date().toISOString(),status:'running'};s.tools.push(row);journal();
  try{const result=await actualExecute.call(this,user,request,call,...rest);if(result?.error||result?.isError)throw Error(result.error??'Generated browser tool failed');if(name==='browser_open'){if(result.url!==x.url||!result.tab_id)throw Error('Unexpected browser destination');s.tabId=result.tab_id;}else{const text=result.text??'';if(!text.includes(x.sourceSentinel)||![x.fields.task,x.fields.seal,x.fields.recipient].every(value=>text.includes(value)))throw Error('The actual browser result omitted generated source facts.');row.sourceCharacters=text.length;row.sourceSha256=crypto.createHash('sha256').update(text).digest('hex');}row.status='completed';return result;}catch(error){row.status='failed';row.error=String(error.message).slice(0,300);throw error;}finally{journal();}
 };
 const start=CodexGateway.prototype.start;CodexGateway.prototype.start=function(){const handlers=this.server.listeners('request');if(handlers.length!==1)throw Error('Unexpected gateway listener.');const handler=handlers[0];this.server.removeListener('request',handler);this.server.on('request',(request,response)=>routing.run({thread:request.headers['thread-id'],metadata:request.headers['x-codex-turn-metadata']},()=>handler(request,response)));return start.apply(this);};
 const real=globalThis.fetch;globalThis.fetch=async(input,args={})=>{
  const url=new URL(typeof input==='string'?input:input.url??String(input)),method=args.method??'GET';if(url.protocol==='http:'&&['127.0.0.1','localhost','[::1]'].includes(url.hostname))return real(input,args);
  const refuse=message=>{s.blocked.push({origin:url.origin,path:url.pathname,message});journal();throw Error(message);};
  if(!s.leaseActive||s.expiresAt<Date.now()+90000)return refuse('No fresh continuity authorization.');
  if(url.href==='https://api.openai.com/v1/models'&&method==='GET'){if(s.catalog>=4)return refuse('Model catalog ceiling reached.');s.catalog++;return real(input,{...args,redirect:'error'});}
  if(url.href!=='https://api.openai.com/v1/responses'||method!=='POST')return refuse('Only ChatGPT continuity inference is authorized.');
  const route=routing.getStore();if(!route?.thread||!route.metadata)return refuse('Missing native routing.');const metadata=JSON.parse(route.metadata),active=[...s.broker.native.running.values()].find(row=>row.state.threadId===route.thread&&row.state.turnId===metadata.turn_id);if(!active)return refuse('Unowned native request.');
  const body=JSON.parse(args.body),context=JSON.stringify([body.instructions??null,body.input]),inputSha256=crypto.createHash('sha256').update(JSON.stringify([body.model,body.instructions??null,body.input,body.previous_response_id??null])).digest('hex');
  try{check(s,{owner:active.owner,agentId:active.request.agent_id,requestId:active.request.id,model:body.model,context,inputSha256});}catch(error){return refuse(error.message);}
  const x=s.expected,row={requestId:active.request.id,agentId:active.request.agent_id,threadId:route.thread,turnId:metadata.turn_id,model:body.model,inputSha256,inputCharacters:context.length,sourceCorpusPresent:context.includes(x.sourceSentinel),inputKinds:(body.input??[]).map(item=>item.type??item.role),fields:Object.fromEntries(Object.entries(x.fields).map(([k,v])=>[k,context.includes(v)])),summaryRequest:/summari[sz]|compaction|compact.*context/i.test(JSON.stringify(body.input?.at(-1)??null)),submittedAt:new Date().toISOString(),status:null};s.calls.push(row);journal();
  try{const response=await real(input,{...args,redirect:'error'});row.status=response.status;row.providerRequestId=response.headers.get('x-request-id');return response;}catch(error){row.outcome='unconfirmed';throw error;}finally{journal();}
 };
 // Test-only lower threshold; no packaged source or persisted product config changes.
 const module=req(path.join(app.getAppPath(),'build/codex-client.js')),Original=module.CodexClient;
 module.CodexClient=class extends Original{
  constructor(exe,args,env,cwd){if(args.some(value=>value.startsWith('model_auto_compact_token_limit=')))throw Error('Unexpected production compaction override.');super(exe,[...args,'-c','model_auto_compact_token_limit=20000','-c','model_auto_compact_token_limit_scope="total"'],env,cwd);}
  async initialize(){await super.initialize();const {config}=await this.request('config/read',{includeLayers:false});if(Number(config.model_auto_compact_token_limit)!==20000||config.model_auto_compact_token_limit_scope!=='total')throw Error('The native QA compaction configuration was not accepted.');s.configs.push({limit:Number(config.model_auto_compact_token_limit),scope:config.model_auto_compact_token_limit_scope,provider:config.model_provider,model:config.model});journal();}
 };
 const {CodexHarness}=req(path.join(app.getAppPath(),'build/codex-harness.js')),dispatch=CodexHarness.prototype.dispatch;CodexHarness.prototype.dispatch=function(worker,method,p){if(method==='thread/tokenUsage/updated'||method==='thread/compacted'||p?.item?.type==='contextCompaction'){s.events.push({method,params:p,observedAt:new Date().toISOString()});journal();}return dispatch.call(this,worker,method,p);};
},checkContinuity66.toString());}
