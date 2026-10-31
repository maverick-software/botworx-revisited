import {test} from 'node:test';
import assert from 'node:assert/strict';
import capacity from '../../desktop/build/provider-capacity.js';
import accountModule from '../../desktop/build/sylvana-account.js';
const {requestProviderCapacity}=capacity;
const queued=code=>Response.json({error:{code}},{status:503,headers:{'Retry-After':'0'}});

test('queue bounds and expiry keep waiting until one generation is admitted',async()=>{
 const replies=[queued('queue_full'),queued('queue_timeout'),Response.json({accepted:true})],waits=[];
 const response=await requestProviderCapacity(async()=>replies.shift(),new AbortController().signal,async ms=>{waits.push(ms);});
 assert.equal(response.status,200);assert.equal(replies.length,0);assert.deepEqual(waits,[1000,2000]);
});
test('network failures and possibly paid server failures are never retried',async()=>{
 for(const response of [queued('provider_http_503'),Response.json({error:{code:'operation_interrupted'}},{status:503}),Response.json({error:{code:'request_already_processed'}},{status:409})]){
  let calls=0;assert.equal(await requestProviderCapacity(async()=>{calls++;return response;},new AbortController().signal),response);assert.equal(calls,1);
 }
 let calls=0;await assert.rejects(requestProviderCapacity(async()=>{calls++;throw Error('Connection lost after dispatch.');},new AbortController().signal),/Connection lost/);assert.equal(calls,1);
});
test('stopping an active goal cancels its capacity wait promptly',async()=>{
 const controller=new AbortController();let calls=0;
 const waiting=requestProviderCapacity(async()=>{calls++;return queued('queue_full');},controller.signal);
 setTimeout(()=>controller.abort(),10);
 await assert.rejects(waiting,{name:'AbortError'});assert.equal(calls,1);
});
test('the account transport retains the operation key and body across pre-dispatch retries',async()=>{
 const account=new accountModule.SylvanaAccount({get:()=>undefined,set:async()=>{}});
 account.providerURL=async()=> 'https://provider.example.test';account.access=async()=> 'synthetic-credential';
 const original=globalThis.fetch,calls=[];
 globalThis.fetch=async(url,init)=>{calls.push({url,key:init.headers.get('Idempotency-Key'),body:init.body});return calls.length===1?queued('queue_full'):Response.json({accepted:true});};
 try{
  const body='{"model":"standard","input":"Synthetic capacity test"}';
  const response=await account.providerRequest('synthetic-owner','/v1/responses',{method:'POST',body,signal:new AbortController().signal});
  assert.equal(response.status,200);assert.equal(calls.length,2);assert.equal(calls[0].key,calls[1].key);assert(calls[0].key);assert.equal(calls[0].body,body);assert.equal(calls[1].body,body);
 }finally{globalThis.fetch=original;}
});
