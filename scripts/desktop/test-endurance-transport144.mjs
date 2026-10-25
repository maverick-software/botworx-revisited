import assert from 'node:assert/strict';
import vm from 'node:vm';
import path from 'node:path';
import {writeFile} from 'node:fs/promises';
import {desktopOperation} from './operation-lock.mjs';
import {hash} from './phased-backup-control.mjs';
desktopOperation('qualify the exact injected endurance spending transport with synthetic response streams');
const root=path.resolve(import.meta.dirname,'../..'),checks=[],model='openai/gpt-5-mini',url='https://openrouter.ai/api/v1/responses';
const forward=process.argv.includes('--forward'),moduleName=forward?'endurance-spend145.mjs':'endurance-spend144.mjs',install=(await import('./'+moduleName))[forward?'installEnduranceSpend145':'installEnduranceSpend144'];
const usage=cost=>({type:'response.completed',response:{status:'completed',usage:{input_tokens:100,output_tokens:10,input_tokens_details:{cached_tokens:0},...(cost===undefined?{}:{cost})}}});
async function fixture(handler){
 const writes=[],state={out:'/fixture',calls:[]},context=vm.createContext({Response,ReadableStream,TextDecoder,Date,JSON,Promise,Error,Number,Math,__validation76:state,__durableProbeRequire:name=>name==='node:path'?path:name==='node:fs'?{writeFileSync:(file,value)=>writes.push({file,value})}:assert.fail('Unexpected import'),fetch:async(...args)=>{state.calls.push({requestId:'synthetic-'+state.calls.length,inputSha256:'generated'});return handler(...args);}});
 await install({evaluate:(fn,arg)=>vm.runInContext('('+fn.toString()+')',context)(undefined,arg)});
 return {state,writes,fetch:context.fetch,context,post:()=>context.fetch(url,{method:'POST',body:JSON.stringify({model,input:'Generated scope-only fixture'})})};
}
let stream;let requests=0;
const active=await fixture(async()=>{requests++;if(requests===1)return new Response(new ReadableStream({start(controller){stream=controller;}}),{headers:{'content-type':'text/event-stream'}});return Response.json(usage().response);});
const first=await active.post(),firstText=first.text();assert.equal(active.state.billing144.rows[0].accounted,.356);const next=active.post();await Promise.resolve();await Promise.resolve();assert.equal(requests,1);checks.push('A subsequent paid request waits for streaming usage, with the in-flight reservation retained.');
const firstBody='data: '+JSON.stringify(usage())+'\n\ndata: [DONE]\n';stream.enqueue(new TextEncoder().encode(firstBody));stream.close();assert.equal(await firstText,firstBody);await(await next).text();await active.state.billingPending144;assert.equal(requests,2);assert(active.state.billing144.rows.every(r=>r.usageKnown));assert(active.state.billing144.rows.every(r=>Math.abs(r.accounted-.000045)<1e-12));assert(active.writes.length>=4);checks.push('The exact injected wrapper reads real stream framing and journals both charges without changing returned responses.');
const count=active.state.billing144.rows.length;await active.fetch('https://openrouter.ai/api/v1/models');assert.equal(active.state.billing144.rows.length,count);checks.push('Catalog traffic passes through without creating a paid reservation.');
await assert.rejects(()=>active.fetch(url,{body:JSON.stringify({model:'another-model'})}),/Unexpected/);assert.equal(requests,3);checks.push('An unexpected model is refused before the inner dispatch.');
let unknownCalls=0;const unknown=await fixture(async()=>{unknownCalls++;return new Response('data: {"type":"error"}\n\n');});
for(let n=0;n<8;n++){await(await unknown.post()).text();await unknown.state.billingPending144;}assert.equal(unknown.state.billing144.rows.length,8);assert(unknown.state.billing144.rows.every(r=>!r.usageKnown&&r.accounted===.356));await assert.rejects(unknown.post,/allowance/);assert.equal(unknownCalls,8);await assert.rejects(unknown.post,/stopped/);assert.equal(unknownCalls,8);checks.push('Unknown streaming outcomes keep their reservations and eventually stop before another dispatch.');
let higherCalls=0;const higher=await fixture(async()=>{higherCalls++;return Response.json(usage(.5).response);});await(await higher.post()).text();await higher.state.billingPending144;assert(higher.state.billing144.stopped);await assert.rejects(higher.post,/stopped/);assert.equal(higherCalls,1);checks.push('Unexpected higher pricing permanently stops this run despite remaining nominal allowance.');
const unconfirmed=await fixture(async()=>{throw Error('Synthetic connection uncertainty');});await assert.rejects(unconfirmed.post,/uncertainty/);assert.equal(unconfirmed.state.billing144.rows[0].status,'outcome-unconfirmed');assert.equal(unconfirmed.state.billing144.rows[0].accounted,.356);checks.push('A thrown transport outcome retains its complete reservation.');
await writeFile(path.join(root,'.supabase/desktop-endurance144',forward?'spend-transport-qualification145.json':'spend-transport-qualification.json'),JSON.stringify({success:true,at:new Date().toISOString(),checks,providerRequests:0,sourceSha256:await hash(path.join(root,'scripts/desktop',moduleName)),meterSha256:await hash(path.join(root,'scripts/desktop/endurance-spend144.mjs'))},null,2));console.log(JSON.stringify({success:true,forward,checks:checks.length,providerRequests:0}));
