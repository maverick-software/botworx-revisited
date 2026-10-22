import {createRequire} from 'node:module';
import {mkdir,mkdtemp,writeFile,readFile,realpath} from 'node:fs/promises';
import {createHash,randomUUID} from 'node:crypto';
import {createReadStream,existsSync} from 'node:fs';
import {createServer} from 'node:net';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import {desktopOperation} from './operation-lock.mjs';

desktopOperation('reproduce native idle shutdown of an active background preview');
const root=path.resolve(import.meta.dirname,'../..'),out=path.join(root,'.supabase/desktop-background-commands',String(Date.now()));await mkdir(out,{recursive:true});
const archived=path.join(root,'.supabase/desktop-packaged-coordination/1792370177149/archived'),require=createRequire(path.join(archived,'package.json'));
const {CodexHarness}=require('./build/codex-harness.js');
const resources=path.join(root,'.supabase/desktop-platform-release/candidate-04429/portable/resources/resources');
const image=path.join(resources,'../app.asar'),h=createHash('sha256');for await(const b of createReadStream(image))h.update(b);
assert.equal(h.digest('hex'),'aa4c26414d29861eec9efb61e416baffbc13961ed09426dd0e3ba1c809e817b8');
const directory=await mkdtemp(path.join(os.tmpdir(),'bg-')),workspace=path.join(directory,'workspace');await mkdir(workspace);
const node=path.join(resources,'script-runtimes/node-24.22.0/node.exe');assert(existsSync(node));
const reservation=createServer();await new Promise((resolve,reject)=>{reservation.once('error',reject);reservation.listen(0,'127.0.0.1',resolve);});const port=reservation.address().port;await new Promise(resolve=>reservation.close(resolve));
const marker='BACKGROUND-'+randomUUID(),serverFile=path.join(workspace,'server.cjs');
await writeFile(serverFile,'require("node:http").createServer((req,res)=>{res.writeHead(200,{"Content-Type":"text/plain"});res.end('+JSON.stringify(marker)+');}).listen('+port+',"127.0.0.1",()=>console.log('+JSON.stringify(marker)+'));',{flag:'wx'});
const owner=randomUUID(),user={id:owner,email:'background@example.invalid',admin:true},agent={id:randomUUID()},request={id:randomUUID(),agent_id:agent.id,conversation_id:randomUUID(),user_message_id:randomUUID(),assistant_message_id:randomUUID(),nativeCommands:true};
function database(){const tables=new Map();return {tables,from(name){const rows=tables.get(name)??[];tables.set(name,rows);let mode='select',values,filters=[];const perform=()=>{const selected=rows.filter(row=>filters.every(([key,value])=>row[key]===value));if(mode==='insert'){const next=Array.isArray(values)?values:[values];rows.push(...structuredClone(next));mode='done';return {data:next,error:null};}if(mode==='update'){for(const row of selected)Object.assign(row,structuredClone(values));mode='done';}return {data:selected,error:null};};const query={select(){return query;},eq(key,value){filters.push([key,value]);return query;},insert(value){mode='insert';values=value;return query;},update(value){mode='update';values=value;return query;},maybeSingle(){const result=perform();return Promise.resolve({data:result.data[0]??null,error:null});},single(){return query.maybeSingle();},then(resolve,reject){return Promise.resolve(perform()).then(resolve,reject);}};return query;}};}
function response(item){const response={id:'response-'+randomUUID(),object:'response',status:'completed',output:[item],usage:{input_tokens:5,output_tokens:2,total_tokens:7}};return new Response(['response.created','response.output_item.added','response.output_item.done','response.completed'].map(type=>'event: '+type+'\ndata: '+JSON.stringify({type,...(type==='response.created'?{response:{...response,status:'in_progress',output:[]}}:type==='response.completed'?{response}:{output_index:0,item})})+'\n\n').join(''),{headers:{'content-type':'text/event-stream'}});}
const db=database(),providers={harnessScope:()=> 'controlled-background',models:async()=>[{id:'gpt-6.1-sol'}],token:async()=> 'CONTROLLED-NOT-A-PROVIDER-KEY'},savedEnv={},originalFetch=global.fetch;
for(const [key,value]of Object.entries({USERPROFILE:directory,APPDATA:path.join(directory,'appdata'),LOCALAPPDATA:path.join(directory,'local')})){savedEnv[key]=process.env[key];process.env[key]=value;}
const events=[],harness=new CodexHarness(db,providers,directory,resources,(_,event)=>events.push(event),async()=>{}),controller=new AbortController();
const evidence={at:new Date().toISOString(),out,directory,version:'0.44.29',imageSha256:'aa4c26414d29861eec9efb61e416baffbc13961ed09426dd0e3ba1c809e817b8',phase:'prepared',port,marker,requestId:request.id,controlledResponses:0,realProviderRequests:0,productionAccess:false,checks:[]};
const save=()=>writeFile(path.join(out,'evidence.json'),JSON.stringify(evidence,null,2));await save();
const command="& '"+node.replaceAll("'","''")+"' '"+serverFile.replaceAll("'","''")+"'";
global.fetch=async(url,init)=>{assert.equal(String(url),'https://api.openai.com/v1/responses');const input=JSON.parse(init.body);evidence.controlledResponses++;assert(evidence.controlledResponses<=2,'The reproduction must not loop model responses');if(evidence.controlledResponses===1)return response({id:'exec-server',call_id:'exec-server',type:'custom_tool_call',name:'exec',input:'const t=ALL_TOOLS.find(t=>t.name.endsWith("exec_command"));if(!t)throw Error("Missing native exec_command");text(await tools[t.name]('+JSON.stringify({cmd:command,yield_time_ms:1000,max_output_tokens:1000})+'));',status:'completed'});assert(JSON.stringify(input.input).includes(marker),'The actual server did not report readiness to Codex');return response({id:'done',type:'message',role:'assistant',status:'completed',content:[{type:'output_text',text:'BACKGROUND-PREVIEW-STARTED',annotations:[]}]});};
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function http(){try{const r=await originalFetch('http://127.0.0.1:'+port+'/',{signal:AbortSignal.timeout(2000)});return {status:r.status,text:await r.text()};}catch{return {unavailable:true};}}
let work;const deadline=setTimeout(()=>controller.abort(),120000);
try{
 evidence.phase='native-turn';await save();work=harness.run(user,request,agent,'openai-oauth','gpt-6.1-sol',{permission:'full',mode:'chat',thinking:'default',files:[]},[{id:randomUUID(),kind:'folder',path:workspace,name:'Isolated background test'}],[{id:request.user_message_id,role:'user',content:{text:'Start the isolated local preview command, then finish this response while the command remains running.'},metadata:{}},{id:request.assistant_message_id,role:'assistant',content:{text:''},metadata:{}}],[],()=>{throw Error('No Agentopia host tools expected');},controller);
 await work;const record=harness.contexts.get(request.id);assert(record?.rootFinished);const worker=record.worker;
 evidence.threadId=record.state.threadId;evidence.commands=record.state.items.filter(r=>r.item.type==='commandExecution').map(r=>({completed:r.completed,status:r.item.status,processId:r.item.processId}));assert(evidence.commands.some(c=>!c.completed&&c.status==='inProgress'));
 evidence.terminalsBefore=await worker.client.request('thread/backgroundTerminals/list',{threadId:record.state.threadId,limit:100});assert(evidence.terminalsBefore.data.length===1);
 evidence.firstHttp=await http();assert.deepEqual(evidence.firstHttp,{status:200,text:marker});evidence.busyDespiteLiveTerminal=harness.busy;evidence.currentWorkingResult=harness.working(worker);assert.equal(evidence.currentWorkingResult,false);
 evidence.phase='waiting-for-real-idle-disposal';evidence.parentFinishedAt=Date.now();await save();console.log('PROBE: Parent finished; actual native terminal serves the nonce, but the harness reports idle. Waiting for its unmodified60-second disposal timer.');
 const end=Date.now()+75000;while(!worker.disposing&&Date.now()<end)await sleep(250);assert(worker.disposing,'The expected idle disposal did not occur');await worker.disposing;evidence.disposedAfterMs=Date.now()-evidence.parentFinishedAt;
 assert(evidence.disposedAfterMs>=55000&&evidence.disposedAfterMs<75000);evidence.finalHttp=await http();assert(evidence.finalHttp.unavailable);
 evidence.phase='reproduced';evidence.success=true;evidence.rootCauseReproduced=true;evidence.checks=['Actual Codex exec_command starts an owned native background HTTP terminal','The parent response ends while HTTP still returns the exact nonce and native terminals/list reports one process','Unmodified harness working() reports false and arms its60-second idle timer','Idle disposal closes the Codex client and the previously working preview becomes unavailable'];await save();console.log(JSON.stringify(evidence,null,2));
}catch(error){evidence.success=false;evidence.error=error.message;evidence.nativeItems=events.flatMap(e=>e.native?.items??[]).map(r=>({type:r.item.type,status:r.item.status,output:r.item.type==='commandExecution'?String(r.item.aggregatedOutput??'').slice(-2000):undefined}));await save();throw error;}
finally{clearTimeout(deadline);controller.abort();await work?.catch(()=>{});await harness.close();global.fetch=originalFetch;for(const [key,value]of Object.entries(savedEnv))if(value===undefined)delete process.env[key];else process.env[key]=value;assert.equal(path.dirname(await realpath(directory)),await realpath(os.tmpdir()));evidence.ownedNativeRuntimeClosed=true;await save();}
