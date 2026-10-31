const assert=require('node:assert/strict');const {createServer}=require('node:http');
const {mkdir,writeFile}=require('node:fs/promises');
const path=require('node:path');
const {CodexClient}=require('../../desktop/build/codex-client.js');
(async()=>{
 const out=path.resolve('.supabase/question-flow90/probe-'+Date.now());await mkdir(out,{recursive:true});
 let sequence=0,client,finish;const done=new Promise(r=>finish=r),events=[];
 const server=createServer(async(req,res)=>{let bytes='';for await(const b of req)bytes+=b;const body=JSON.parse(bytes);await writeFile(path.join(out,'request-'+(++sequence)+'.json'),JSON.stringify(body,null,2));
  const question={type:'function_call',id:'fc_q',call_id:'call_q',name:'request_user_input_async',arguments:JSON.stringify({questions:[{title:'Where will the business be formed?',options:['California','Another state']}]})};
  const output=sequence===1?[question]:[{id:'message_done',type:'message',role:'assistant',content:[{type:'output_text',text:'I can research a general startup checklist while the jurisdiction question is unanswered.',annotations:[]}]}];
  res.writeHead(200,{'content-type':'text/event-stream'});const emit=(type,data)=>res.write('event: '+type+'\ndata: '+JSON.stringify({type,...data})+'\n\n');
  emit('response.created',{response:{id:'response_'+sequence,status:'in_progress',output:[]}});
  output.forEach((item,index)=>{emit('response.output_item.added',{output_index:index,item:{...item,...(item.type==='function_call'?{arguments:''}:{content:[]})}});emit('response.output_item.done',{output_index:index,item});});
  emit('response.completed',{response:{id:'response_'+sequence,status:'completed',output,usage:{input_tokens:10,output_tokens:10,total_tokens:20}}});res.end();
 });await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const home=path.join(out,'home');await mkdir(home);const env={...process.env,CODEX_HOME:home};
 try{client=new CodexClient(path.resolve('desktop/resources/codex/x86_64-pc-windows-msvc/bin/codex.exe'),['-c','model_provider="probe"','-c','model_providers.probe.name="Local fixture"','-c','model_providers.probe.base_url="http://127.0.0.1:'+server.address().port+'/v1"','-c','model_providers.probe.wire_api="responses"','-c','model_providers.probe.requires_openai_auth=false','-c','features.send_message_to_user_async=true','-c','features.default_mode_request_user_input=true'],env,out);client.onEvent=(method,params)=>{events.push({method,params});if(method==='turn/completed')finish();};await client.initialize();const thread=await client.request('thread/start',{model:'gpt-6.1-sol',cwd:out,sandbox:'read-only',approvalPolicy:'never'});await client.request('turn/start',{threadId:thread.thread.id,input:[{type:'text',text:'Ask the fixture question.',text_elements:[]}]});await Promise.race([done,new Promise((_,j)=>setTimeout(()=>j(Error('Probe deadline')),30000).unref())]);await writeFile(path.join(out,'events.json'),JSON.stringify(events,null,2));assert.equal(sequence,2);assert(events.some(e=>e.params?.item?.questions?.length));assert(events.some(e=>e.params?.item?.text?.includes('while the jurisdiction question is unanswered')));console.log(JSON.stringify({success:true,out,requests:sequence,nativeQuestionsEmitted:true,continuedWithoutAnswer:true,providerRequests:0}));}finally{await client?.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
