import assert from 'node:assert/strict';
import vm from 'node:vm';
import path from 'node:path';
import crypto from 'node:crypto';
import {AsyncLocalStorage} from 'node:async_hooks';
import {EventEmitter} from 'node:events';
import {mkdir,writeFile} from 'node:fs/promises';
import {installLiveImageEditGuard} from './install-live-image-edit60-guard.mjs';
import {hash} from './phased-backup-control.mjs';

async function fixture(){
 let context,realCalls=0;const written=[];
 class Broker{constructor(){this.native={running:new Map([['root',{state:{threadId:'thread',turnId:'turn'},owner:'owner',request:{id:'request',agent_id:'agent'},conversation:'conversation'}]])};}async initialize(){}}
 class CodexGateway{constructor(){this.server=new EventEmitter();this.server.on('request',(request,response)=>context.fetch(request.url,request.args).then(response.resolve,response.reject));}start(){}}
 const req=name=>name==='node:path'?path:name==='node:fs'?{writeFileSync:(file,body)=>written.push({file,body})}:name==='node:crypto'?crypto:name==='node:async_hooks'?{AsyncLocalStorage}:name.endsWith('broker.js')?{Broker}:name.endsWith('codex-gateway.js')?{CodexGateway}:(()=>{throw Error('Unexpected guard test dependency');})();
 context=vm.createContext({Buffer,Date,Map,Set,JSON,URL,__durableProbeRequire:req,fetch:async()=>{realCalls++;return {status:200,headers:{get:()=>null}};}});
 const install=vm.runInContext('('+installLiveImageEditGuard.toString()+')',context);await install({evaluate:fn=>fn({app:{getAppPath:()=>'/fixture'}})});const broker=new Broker();await broker.initialize();const gateway=new CodexGateway();gateway.start();const state=context.__coordination;
 state.leaseActive=true;state.expiresAt=Date.now()+3600000;state.expected={owner:'owner',requestId:'request',agentId:'agent',conversation:'conversation',out:'F:/generated-guard-test'};
 const send=(body={model:'gpt-6.1-sol',input:[{type:'input_text',text:'Generated test prompt'}]},url='https://api.openai.com/v1/responses')=>new Promise((resolve,reject)=>gateway.server.emit('request',{url,args:{method:'POST',body:JSON.stringify(body)},headers:{'thread-id':'thread','x-codex-turn-metadata':JSON.stringify({turn_id:'turn'})}},{resolve,reject}));
 return {state,broker,send,calls:()=>realCalls,written};
}
let checks=0;
for(const [name,change,pattern]of [
 ['inactive access lease',f=>f.state.leaseActive=false,/fresh access/],
 ['different request',f=>f.state.expected.requestId='other',/outside/],
 ['different agent',f=>f.state.expected.agentId='other',/outside/],
 ['different conversation',f=>f.state.expected.conversation='other',/outside/],
 ['response ceiling',f=>f.state.calls=Array.from({length:6},()=>({})),/ceiling/]
]){const f=await fixture();change(f);await assert.rejects(f.send(),pattern);assert.equal(f.calls(),0);checks++;console.log('PASS '+name);}
{const f=await fixture();await assert.rejects(f.send(undefined,'https://openrouter.ai/api/v1/chat/completions'),/Only the bound/);await assert.rejects(f.send({model:'other',input:[]}),/explicit ChatGPT model/);assert.equal(f.calls(),0);checks++;console.log('PASS unrelated service and model refused before submission');}
{const f=await fixture();await f.send();assert.equal(f.calls(),1);assert.equal(f.written.length,2);await assert.rejects(f.send({model:'gpt-6.1-sol',input:[{type:'input_text',text:'Generated test prompt'}],metadata:{different:'transport metadata'}}),/already submitted/);assert.equal(f.calls(),1);checks++;console.log('PASS identical model input cannot be repeated after dispatch');}
{const f=await fixture();await f.send();await f.send({model:'gpt-6.1-sol',input:[{type:'function_call_output',output:'A distinct confirmed tool result'}]});assert.equal(f.calls(),2);assert.equal(f.state.calls.length,2);assert(f.state.calls.every(row=>row.inputSha256&&row.status===200));checks++;console.log('PASS distinct tool-result continuation remains allowed and journaled');}
const root=path.resolve(import.meta.dirname,'../..'),out=path.join(root,'.supabase/desktop-live-image-edit60');await mkdir(out,{recursive:true});const sourceHashes={};for(const name of ['install-live-image-edit60-guard.mjs','launch-live-image-edit60-probe.mjs','live-image-edit60-workflow.mjs','test-live-image-edit60.mjs','test-live-image-edit60-guard.mjs'])sourceHashes[name]=await hash(path.join(root,'scripts/desktop',name));await writeFile(path.join(out,'guards-qualified.json'),JSON.stringify({success:true,at:new Date().toISOString(),checks,sourceHashes,realProviderRequests:0,productionWrites:0},null,2));console.log(JSON.stringify({success:true,checks,realProviderRequests:0}));
