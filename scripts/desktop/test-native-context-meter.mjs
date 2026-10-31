import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createServer} from 'node:http';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
const require=createRequire(import.meta.url),root=path.resolve(import.meta.dirname,'../..');
const {CodexClient}=require(root+'/desktop/build/codex-client.js');
const {CodexHarness}=require(root+'/desktop/build/codex-harness.js');
const out='F:/Sylvana/verification/platform-hardening/context-'+Date.now();
for(const name of ['home','workspace','temp','roaming','local'])await mkdir(out+'/'+name,{recursive:true});
const sentinel='PRESERVED-CONSTRAINT-'+randomUUID(),removed='PRE-SUMMARY-CANARY-'+randomUUID();
const summary='CONTROLLED-SUMMARY: Continue the synthetic site review. Keep the user constraint '+sentinel+'. No external submission is authorized.';
const requests=[],events=[],snapshots=[],receipt={success:false,actualNativeRuntime:true,controlledLocalResponses:true,liveProviderRequests:0,productionProfileChanged:false,out,at:new Date().toISOString()};
const server=createServer(async(req,res)=>{
 try{
  assert.equal(req.method,'POST');assert.equal(req.url,'/v1/responses');assert(requests.length<4);
  let body='';for await(const chunk of req)body+=chunk;requests.push(JSON.parse(body));
  const text=requests.length===2?summary:requests.length===1?removed+' '+('Synthetic assistant working history. '.repeat(400)):'Controlled continuation complete.';
  const item={id:'message-'+randomUUID(),type:'message',role:'assistant',status:'completed',content:[{type:'output_text',text,annotations:[]}]};
  const input=[800,900,160,180][requests.length-1],response={id:'response-'+randomUUID(),object:'response',status:'completed',output:[item],usage:{input_tokens:input,input_tokens_details:{cached_tokens:40},output_tokens:20,total_tokens:input+20}};
  res.writeHead(200,{'Content-Type':'text/event-stream'});
  for(const type of ['response.created','response.output_item.added','response.output_item.done','response.completed'])res.write('event: '+type+'\ndata: '+JSON.stringify({type,...(type==='response.created'?{response:{...response,status:'in_progress',output:[]}}:type==='response.completed'?{response}:{output_index:0,item})})+'\n\n');res.end();
 }catch(error){receipt.serverError=error.message;res.writeHead(500).end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const harness=new CodexHarness({}, {},out,out,()=>{},async()=>{});
harness.publish=r=>snapshots.push(structuredClone(r.state));harness.settle=()=>{};
const state={version:'0.163.0',threadId:'',turnId:'',items:[],approvals:[],steering:[]};
const record={state,ended:false,options:{},controller:new AbortController(),resolve:()=>{},reject:error=>{receipt.nativeError=error.message;},save:Promise.resolve()};
const worker={current:record,children:new Map()};record.worker=worker;
const config={model_provider:'sylvana',model:'gpt-6.1-sol',model_catalog_json:root+'/desktop/resources/codex/models.json','model_providers.sylvana.name':'Controlled context verification','model_providers.sylvana.base_url':'http://127.0.0.1:'+server.address().port+'/v1','model_providers.sylvana.wire_api':'responses','model_providers.sylvana.requires_openai_auth':false,'model_providers.sylvana.supports_websockets':false,'model_providers.sylvana.capabilities.remote_compaction':'unsupported','features.shell_tool':false,web_search:'disabled'};
const env={SystemRoot:process.env.SystemRoot,PATH:process.env.PATH,USERPROFILE:out,APPDATA:out+'/roaming',LOCALAPPDATA:out+'/local',TEMP:out+'/temp',TMP:out+'/temp',CODEX_HOME:out+'/home'};
const args=Object.entries(config).flatMap(([key,value])=>['-c',key+'='+JSON.stringify(value)]);
let client;
async function start(){
 client=new CodexClient(root+'/desktop/resources/codex/x86_64-pc-windows-msvc/bin/codex.exe',args,env,out+'/workspace');worker.client=client;
 client.onEvent=(method,params)=>{events.push({method,params});harness.dispatch(worker,method,params);};await client.initialize();
}
async function until(check,label){const deadline=Date.now()+35000;while(!check()){if(receipt.nativeError)throw Error(receipt.nativeError);if(Date.now()>deadline)throw Error(label+' did not finish');await new Promise(resolve=>setTimeout(resolve,25));}}
async function turn(text){const offset=events.length,{turn}=await client.request('turn/start',{threadId:state.threadId,input:[{type:'text',text,text_elements:[]}]});await until(()=>events.slice(offset).some(e=>e.method==='turn/completed'&&e.params.turn.id===turn.id),'Native turn');}
try{
 await start();const {thread}=await client.request('thread/start',{model:'gpt-6.1-sol',cwd:out+'/workspace',sandbox:'read-only',approvalPolicy:'never',developerInstructions:'Use only the synthetic loopback fixture.'});state.threadId=thread.id;
 await turn('Review a synthetic website. Preserve '+sentinel+'.');
 assert(state.tokenUsage,'Real native usage event must reach the actual harness');const before=structuredClone(state.tokenUsage);
 const offset=events.length;await client.request('thread/compact/start',{threadId:state.threadId});
 await until(()=>events.slice(offset).some(e=>e.method==='item/completed'&&e.params.item?.type==='contextCompaction'),'Native local compaction');
 await until(()=>events.slice(offset).some(e=>e.method==='turn/completed'),'Native compaction turn completion');
 await turn('Continue under the preserved user constraint.');
 assert.equal(requests.length,3);assert(JSON.stringify(requests[2]).includes(sentinel));assert(JSON.stringify(requests[2]).includes('CONTROLLED-SUMMARY'));assert(!JSON.stringify(requests[2]).includes(removed));
 const after=structuredClone(state.tokenUsage);assert(after.value.last.totalTokens<before.value.last.totalTokens);assert(after.value.total.totalTokens>before.value.total.totalTokens);
 await client.close();await start();await client.request('thread/resume',{threadId:state.threadId,excludeTurns:true});await turn('Continue after reopening under the same preserved constraint.');
 assert.equal(requests.length,4);assert(JSON.stringify(requests[3]).includes(sentinel));assert(JSON.stringify(requests[3]).includes('CONTROLLED-SUMMARY'));assert(!JSON.stringify(requests[3]).includes(removed));
 receipt.success=true;Object.assign(receipt,{nativeThread:state.threadId,controlledResponses:requests.length,usageNotifications:events.filter(e=>e.method==='thread/tokenUsage/updated').length,contextBefore:before,contextAfter:after,summaryPreservedAfterCompaction:true,summaryPreservedAfterColdResume:true,oldVerbatimContextRemoved:true,compactionItems:state.items.filter(e=>e.completed&&e.item.type==='contextCompaction').length});
 await writeFile(out+'/native-state.json',JSON.stringify(state,null,2));
}catch(error){receipt.error=error.stack;process.exitCode=1;}
finally{await client?.close();await new Promise(resolve=>server.close(resolve));await writeFile(out+'/evidence.json',JSON.stringify(receipt,null,2));}
console.log(JSON.stringify(receipt));
