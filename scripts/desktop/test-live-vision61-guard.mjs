import assert from 'node:assert/strict';
import vm from 'node:vm';
import path from 'node:path';
import crypto from 'node:crypto';
import {AsyncLocalStorage} from 'node:async_hooks';
import {EventEmitter} from 'node:events';
import {mkdir,writeFile} from 'node:fs/promises';
import {installLiveVisionGuard} from './install-live-vision61-guard.mjs';
import {hash} from './phased-backup-control.mjs';
async function fixture(){
 let context,realCalls=0;const written=[];
 class Broker{constructor(){this.native={running:new Map([['root',{state:{threadId:'thread',turnId:'turn'},owner:'owner',request:{id:'request',agent_id:'agent'},conversation:'conversation'}]])};}async initialize(){}}
 class CodexGateway{constructor(){this.server=new EventEmitter();this.server.on('request',(request,response)=>context.fetch(request.url,request.args).then(response.resolve,response.reject));}start(){}}
 const req=name=>name==='node:path'?path:name==='node:fs'?{writeFileSync:(file,body)=>written.push({file,body})}:name==='node:crypto'?crypto:name==='node:async_hooks'?{AsyncLocalStorage}:name.endsWith('broker.js')?{Broker}:name.endsWith('codex-gateway.js')?{CodexGateway}:(()=>{throw Error('Unexpected fixture dependency');})();
 context=vm.createContext({Buffer,Date,Map,JSON,URL,__durableProbeRequire:req,fetch:async()=>{realCalls++;return {status:200,headers:{get:()=>null}};}});
 const install=vm.runInContext('('+installLiveVisionGuard.toString()+')',context);await install({evaluate:fn=>fn({app:{getAppPath:()=>'/fixture'}})});const broker=new Broker();await broker.initialize();const gateway=new CodexGateway();gateway.start();const state=context.__coordination;
 state.leaseActive=true;state.expiresAt=Date.now()+3600000;state.expected={owner:'owner',requestId:'request',agentId:'agent',conversation:'conversation',role:'CONFIGURED-ROLE',sourceHeading:'SELECTED-HEADING',out:'F:/generated-guard-test'};
 const body=()=>({model:'gpt-6.1-sol',input:[{type:'input_text',text:'CONFIGURED-ROLE SELECTED-HEADING'},{type:'input_image',image_url:'data:image/png;base64,GENERATED'}]});
 const send=(value=body(),url='https://api.openai.com/v1/responses')=>new Promise((resolve,reject)=>gateway.server.emit('request',{url,args:{method:'POST',body:JSON.stringify(value)},headers:{'thread-id':'thread','x-codex-turn-metadata':JSON.stringify({turn_id:'turn'})}},{resolve,reject}));
 return {state,broker,send,body,calls:()=>realCalls,written};
}
let checks=0;
for(const [name,change,pattern]of [
 ['expired access',f=>f.state.expiresAt=0,/Fresh access/],['wrong owner',f=>f.state.expected.owner='other',/another request/],['wrong agent',f=>f.state.expected.agentId='other',/another request/],['wrong request',f=>f.state.expected.requestId='other',/another request/],['wrong conversation',f=>f.state.expected.conversation='other',/another request/]
]){const f=await fixture();change(f);await assert.rejects(f.send(),pattern);assert.equal(f.calls(),0);checks++;console.log('PASS '+name);}
for(const [name,value,url,pattern]of [['missing image',{model:'gpt-6.1-sol',input:[]},undefined,/must reach/],['wrong model',{model:'unapproved',input:[]},undefined,/explicit ChatGPT/],['image generation',undefined,'https://openrouter.ai/api/v1/images',/single owned/],['copied refresh',undefined,'https://auth.openai.com/api/accounts/oauth/token',/single owned/]]){const f=await fixture();await assert.rejects(f.send(value,url),pattern);assert.equal(f.calls(),0);checks++;console.log('PASS '+name);}
const valid=await fixture();await valid.send();assert.equal(valid.calls(),1);assert.equal(valid.state.calls[0].status,200);assert(valid.written.length>=2&&JSON.parse(valid.written[0].body).calls[0].status===null);await assert.rejects(valid.send(),/already submitted/);assert.equal(valid.calls(),1);checks++;console.log('PASS journal-before-dispatch and refusal of identical input replay');
const limited=await fixture();limited.state.calls=[{},{},{}];await assert.rejects(limited.send(),/bounded response/);assert.equal(limited.calls(),0);checks++;console.log('PASS response ceiling');
const instructions=await fixture(),payload=instructions.body();payload.instructions='CONFIGURED-ROLE';payload.input[0].text='SELECTED-HEADING';await instructions.send(payload);assert.equal(instructions.calls(),1);checks++;console.log('PASS identity may use the actual native instructions channel');
const root=path.resolve(import.meta.dirname,'../..'),folder=path.join(root,'.supabase/desktop-live-vision61');await mkdir(folder,{recursive:true});const sourceHashes={};for(const name of ['install-live-vision61-guard.mjs','launch-live-vision61-probe.mjs','prepare-live-access-envelope57.mjs','test-live-vision61-guard.mjs','test-live-vision61.mjs','live-vision61-workflow.mjs'])sourceHashes[name]=await hash(path.join(import.meta.dirname,name));await writeFile(path.join(folder,'guards-qualified.json'),JSON.stringify({success:true,checks,sourceHashes,realProviderRequests:0},null,2));console.log(JSON.stringify({success:true,checks,realProviderRequests:0}));
