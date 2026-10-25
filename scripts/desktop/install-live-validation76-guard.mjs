// Observation and scope limits surround the exact packaged Broker and Codex loop.
// Model responses, tool results, screenshots and operating-system input stay real.
export async function installValidationGuard76(application){
 await application.evaluate(({app})=>{
  const req=globalThis.__durableProbeRequire,path=req('node:path'),fs=req('node:fs'),crypto=req('node:crypto'),{AsyncLocalStorage}=req('node:async_hooks'),routing=new AsyncLocalStorage(),{CodexGateway}=req(app.getAppPath()+'/build/codex-gateway.js'),{ToolService}=req(app.getAppPath()+'/build/tool-service.js');
  const s=globalThis.__validation76={owner:null,out:null,cases:{},goalCases:{},calls:[],tools:[],blocked:[],catalog:[],events:[],configs:[],leaseActive:false,expiresAt:0,maxResponses:230,maxTools:180};
  const journal=()=>{if(s.out){fs.writeFileSync(path.join(s.out,'model-dispatches.json'),JSON.stringify({calls:s.calls,catalog:s.catalog,blocked:s.blocked,events:s.events,configs:s.configs},null,2));fs.writeFileSync(path.join(s.out,'tool-dispatches.json'),JSON.stringify(s.tools,null,2));}};
  const refuse=message=>{s.blocked.push({at:new Date().toISOString(),message});journal();throw Error(message);};
  const execute=ToolService.prototype.execute;ToolService.prototype.execute=async function(user,request,call,...rest){
   const c=s.cases[request.id]??s.goalCases[rest[0]?.goalId],name=call.name.replace(/^(?:workspace|tools|planning)\./,''),args=JSON.parse(call.arguments);
   if(c)s.cases[request.id]=c;
   if(!s.leaseActive||user.id!==s.owner||!c||request.agent_id!==c.agent||s.tools.length>=s.maxTools)return refuse('Tool execution is outside the new bounded validation cases');
   if(c.kind==='computer'){
    const skillRead=!!c.plugin&&['list_plugin_files','read_plugin_file'].includes(name);
    if(skillRead){
     if(name==='list_plugin_files'?args.plugin!==undefined&&args.plugin!==c.plugin:args.plugin!==c.plugin||args.digest!==c.digest||!args.path.startsWith(c.skillPrefix)||!args.path.endsWith('.md'))return refuse('Only the selected reviewed skill instructions and references may be read');
    }else{
    if(!['computer_windows','computer_snapshot','computer_click','computer_type','computer_key','computer_scroll','computer_drag'].includes(name))return refuse('The computer case permits only its declared native-window tools');
    if(name!=='computer_windows'&&args.window_id!==c.reference)return refuse('Another native window is outside this case');
    if(name==='computer_type'&&(args.text!==c.append||s.tools.some(row=>row.requestId===request.id&&row.name==='computer_type')))return refuse('Only one exact generated append is authorized');
    if(name==='computer_key'&&!/^(?:ctrl|control|control_l)\+end$/i.test(args.key)&&args.key!=='End')return refuse('Only an end-of-note navigation key is authorized');
    if(['computer_click','computer_scroll','computer_drag'].includes(name)){
     const snapshot=this.computer.snapshots.get(args.snapshot_id),node=snapshot?.native.nodes.find(n=>args.ref?n.ref===args.ref:/Text editor/i.test(n.name));
     if(!snapshot||snapshot.reference!==c.reference||!node||!/Text editor/i.test(node.name))return refuse('Input must target the observed scratch editor');
     if(args.ref==null){const b=node.bounds,box=snapshot.box,x=box.left+args.x*box.width/snapshot.width,y=box.top+args.y*box.height/snapshot.height;if(x<b.left||x>b.left+b.width||y<b.top||y>b.top+b.height)return refuse('Coordinates leave the scratch editor');}
    }
    }
   }else if(c.kind==='preview'){
    if(!['list_files','read_file','write_file','list_plugin_files','read_plugin_file'].includes(name))return refuse('The preview case permits only its selected receipt files and reviewed procedure');
    if(name==='list_plugin_files'&&args.plugin!==undefined&&args.plugin!==c.plugin||name==='read_plugin_file'&&(args.plugin!==c.plugin||args.digest!==c.digest||!c.skillFiles.includes(args.path)))return refuse('Only the staged preview procedure may be read');
    if(['list_files','read_file','write_file'].includes(name)&&args.reference_id!==c.reference)return refuse('Only the preview-owned workspace is shared');
    if(name==='list_files'&&args.path!=='')return refuse('Only the workspace root may be listed');
    if(name==='read_file'&&!c.readPaths.includes(args.path))return refuse('Only the generated preview input and prior receipt may be read');
    if(name==='write_file'&&(args.path!==c.outputPath||args.expected_hash!==null||typeof args.content!=='string'||args.content.length>3000||s.tools.some(row=>row.requestId===request.id&&row.name==='write_file')))return refuse('Only one new bounded preview receipt is authorized');
   }else if(c.kind==='preview-delegation'){
    if(!['list_files','read_file','write_file'].includes(name)||args.reference_id!==c.reference||!globalThis.__coordination.broker.previewRunner.native.childScope(user.id,request.id,rest[4]))return refuse('Only the owned preview child may use its generated receipt folder');
    if(name==='list_files'&&args.path!==''||name==='read_file'&&!c.readPaths.includes(args.path))return refuse('Only the generated child input and receipt may be read');
    if(name==='write_file'&&(args.path!==c.outputPath||args.expected_hash!==null||typeof args.content!=='string'||args.content.length>3000||s.tools.some(row=>row.requestId===request.id&&row.name==='write_file'&&(!c.continuation||row.arguments.path===args.path))))return refuse('The child may propose exactly one new bounded receipt per accepted stage');
   }else if(c.kind==='preview-command'){
    if(!['list_files','read_file'].includes(name)||args.reference_id!==c.reference)return refuse('Only this command preview’s generated folder may be read');
    if(name==='list_files'&&args.path!==''||name==='read_file'&&!c.readPaths.includes(args.path))return refuse('Only the generated helper, inputs and receipt may be read');
   }else if(c.kind==='preview-browser'){
    if(!['browser_list','browser_open','browser_snapshot','browser_screenshot','browser_action'].includes(name))return refuse('Only the generated preview browser task is authorized');
    if(name==='browser_open'&&(args.url!==c.url||s.tools.some(row=>row.requestId===request.id&&row.name==='browser_open')))return refuse('Only one generated local page may be opened');
    if(!['browser_list','browser_open'].includes(name)&&!c.tabs?.includes(args.tab_id))return refuse('Only this preview task’s generated tab may be used');
    if(name==='browser_action'){
     if(!['fill','click'].includes(args.action)||s.tools.some(row=>row.requestId===request.id&&row.name===name&&row.arguments.action===args.action))return refuse('Only one generated fill and submit are authorized');
     const contents=this.browser.browser.agentContents(user.id,request.conversation_id,args.tab_id,'agent-draft-preview'),snapshot=this.browser.state(contents).snapshot,node=snapshot?.elements.get(args.ref);
     if(!snapshot||snapshot.id!==args.snapshot_id||!node)return refuse('Input needs a current observed generated control');
     if(args.action==='fill'&&(node.name!=='Draft note'||node.role!=='textbox'||args.text!==c.note))return refuse('Only the exact generated receipt text may be filled');
     if(args.action==='click'&&(node.name!=='Apply note'||node.role!=='button'||args.text!==''))return refuse('Only the generated local submit button may be clicked');
    }
   }else if(c.kind==='goal'){
    if(!['browser_open','browser_snapshot','browser_close','read_file','write_file'].includes(name))return refuse('The longer case permits only its scoped pages and receipt files');
    if(name==='browser_open'&&(!args.url?.startsWith(c.baseUrl+'/')||args.url.slice((c.baseUrl+'/').length).includes('/')))return refuse('The longer case may open only its local stage pages');
    if(['browser_snapshot','browser_close'].includes(name)&&!c.tabs?.includes(args.tab_id))return refuse('Only a case-owned browser tab may be used');
    if(['read_file','write_file'].includes(name)&&(args.reference_id!==c.reference||!/^stage-\d{2}\.json$/.test(args.path)))return refuse('Only a case-owned stage receipt may be used');
    if(name==='write_file'&&(args.expected_hash!==null||typeof args.content!=='string'||args.content.length>12000))return refuse('Stage receipts must be new bounded files');
   }else return refuse('No case kind was authorized');
   const row={requestId:request.id,name,nativeThreadId:rest[4]??null,arguments:args,at:new Date().toISOString(),status:'running'};s.tools.push(row);journal();
   try{const result=await execute.call(this,user,request,call,...rest);row.status=result?.error||result?.isError||result?.denied?'failed':'completed';row.sent=result?.sent??null;row.imageCount=Array.isArray(result?.content)?result.content.filter(part=>part.type==='image').length:0;row.observation=!!result?.observation;row.error=result?.error??null;
    if(['goal','preview-browser'].includes(c.kind)&&name==='browser_open'){const tab=result?.tab_id??result?.id??result?.tab?.id;if(tab)c.tabs=[...(c.tabs??[]),tab];}
    return result;
   }catch(error){row.status='failed';row.error=String(error.message).slice(0,400);throw error;}finally{row.finishedAt=new Date().toISOString();journal();}
  };
  const start=CodexGateway.prototype.start;CodexGateway.prototype.start=function(){const handlers=this.server.listeners('request');if(handlers.length!==1)throw Error('Unexpected native gateway');const original=handlers[0];this.server.removeListener('request',original);this.server.on('request',(request,response)=>routing.run({thread:request.headers['thread-id'],metadata:request.headers['x-codex-turn-metadata']},()=>original(request,response)));return start.apply(this);};
  const real=globalThis.__durableProbeOriginalFetch;globalThis.fetch=async(input,args={})=>{
   const url=new URL(typeof input==='string'?input:input.url??String(input)),method=args.method??'GET';if(url.protocol==='http:'&&['127.0.0.1','localhost','[::1]'].includes(url.hostname))return real(input,args);
   if(!s.leaseActive||s.expiresAt<Date.now()+90000)return refuse('Fresh leased access is required for external validation requests');
   if(['https://api.openai.com/v1/models','https://openrouter.ai/api/v1/models'].includes(url.href)&&method==='GET'){if(s.catalog.length>=4)return refuse('Catalog allowance exhausted');const row={url:url.href,status:null};s.catalog.push(row);const response=await real(input,{...args,redirect:'error'});row.status=response.status;journal();return response;}
   if(!['https://api.openai.com/v1/responses','https://openrouter.ai/api/v1/responses'].includes(url.href)||method!=='POST')return refuse('External destination is outside the two selected inference connections');
   const b=globalThis.__coordination.broker,current=routing.getStore(),metadata=current?.metadata?JSON.parse(current.metadata):null;let actor='parent',active=metadata&&[...b.native.running.values(),...(b.previewRunner?.native?.running?.values()??[])].find(row=>row.state.threadId===current.thread&&row.state.turnId===metadata.turn_id);
   if(!active&&metadata)for(const native of [b.native,b.previewRunner?.native]){if(!native)continue;for(const root of native.contexts.values()){const child=root.worker.children.get(current.thread);if(child?.root===root&&child.view.turnId===metadata.turn_id){active=root;actor='child';break;}}if(active)break;for(const worker of native.workers){const report=worker.report;if(report?.state.threadId===current.thread&&report.state.turnId===metadata.turn_id){active=report;actor='report';break;}}if(active)break;}
   const c=active&&(s.cases[active.request.id]??s.goalCases[active.options.goalId]);
   if(c)s.cases[active.request.id]=c;
   if(!active||active.owner!==s.owner||!c||active.request.agent_id!==c.agent)return refuse('Inference is outside the new owned validation requests');
   const body=JSON.parse(args.body),provider=url.hostname==='openrouter.ai'?'openrouter':'openai-oauth';if(provider!==c.provider||body.model!==c.model||s.calls.length>=s.maxResponses||s.calls.filter(row=>c.kind==='goal'?row.goalId===active.options.goalId:row.requestId===active.request.id).length>=(c.maximumResponses??16))return refuse('The selected model or response allowance changed');
   const context=JSON.stringify([body.instructions??null,body.input]),images=(context.match(/data:image\//g)??[]).length;if(c.kind==='goal'&&images)return refuse('The longer text task does not authorize image input');
   const inputSha256=crypto.createHash('sha256').update(JSON.stringify([body.model,body.instructions??null,body.input,body.previous_response_id??null])).digest('hex');if(s.calls.some(row=>row.inputSha256===inputSha256))return refuse('An already submitted model input cannot be replayed');
   const row={requestId:active.request.id,goalId:active.options.goalId??null,conversationId:active.conversation,threadId:current.thread,turnId:metadata.turn_id,actor,provider,model:body.model,inputSha256,images,characters:context.length,submittedAt:new Date().toISOString(),status:null};s.calls.push(row);journal();
   try{const response=await real(input,{...args,redirect:'error'});row.status=response.status;row.providerRequestId=response.headers.get('x-request-id');return response;}catch(error){row.outcome='unconfirmed';throw error;}finally{journal();}
  };
  const clientModule=req(app.getAppPath()+'/build/codex-client.js'),Original=clientModule.CodexClient;clientModule.CodexClient=class extends Original{
   constructor(exe,args,env,cwd){if(args.some(value=>/^(?:model_auto_compact_token_limit|model_context_window)=/.test(value)))throw Error('This acceptance requires the production context defaults');super(exe,args,env,cwd);}
   async initialize(){await super.initialize();const {config}=await this.request('config/read',{includeLayers:false});s.configs.push({limit:config.model_auto_compact_token_limit??null,scope:config.model_auto_compact_token_limit_scope??null,contextWindow:config.model_context_window??null,provider:config.model_provider,model:config.model,argumentsUnchanged:true});journal();}
  };
  const {CodexHarness}=req(app.getAppPath()+'/build/codex-harness.js'),serverRequest=CodexHarness.prototype.serverRequest;s.commands=[];CodexHarness.prototype.serverRequest=async function(record,rpc,...rest){const c=s.cases[record.request.id];if(c?.kind==='preview-delegation'&&['item/commandExecution/requestApproval','item/fileChange/requestApproval'].includes(rpc.method))return refuse('The generated preview child case permits only reviewed workspace tools');if(c?.kind==='preview-command'&&['item/commandExecution/requestApproval','item/fileChange/requestApproval'].includes(rpc.method)){if(!s.leaseActive||record.owner!==s.owner||record.request.agent_id!==c.agent||rpc.method!=='item/commandExecution/requestApproval'||!c.commands.includes(rpc.params.command)||path.resolve(rpc.params.cwd).toLowerCase()!==path.resolve(c.cwd).toLowerCase()||s.commands.some(row=>row.requestId===record.request.id))return refuse('Only one exact generated helper invocation from its selected folder is authorized');s.commands.push({requestId:record.request.id,command:rpc.params.command,cwd:rpc.params.cwd,beforeExecution:true});fs.writeFileSync(path.join(s.out,'native-command-dispatches.json'),JSON.stringify(s.commands,null,2));}return serverRequest.call(this,record,rpc,...rest);};
  const dispatch=CodexHarness.prototype.dispatch;CodexHarness.prototype.dispatch=function(worker,method,p){if(method==='thread/tokenUsage/updated'||method==='thread/compacted'||p?.item?.type==='contextCompaction'||method==='turn/started'||method==='turn/completed'||method.startsWith('thread/goal/')){s.events.push({method,observedAt:new Date().toISOString(),callCount:s.calls.length,threadId:p.threadId??p.goal?.threadId,turnId:p.turnId??p.turn?.id,status:p.turn?.status,goal:p.goal,tokenUsage:p.tokenUsage,item:p.item?.type==='contextCompaction'?p.item:undefined});journal();}return dispatch.call(this,worker,method,p);};
 });
}
