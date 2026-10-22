const test=require('node:test');
const assert=require('node:assert/strict');
const {streamText,sse,equalState,providerUsageURL}=require('../build/providers.js');
function response(events){return new Response(new ReadableStream({start(c){for(const e of events)c.enqueue(new TextEncoder().encode(e));c.close();}}));}
test('stream parser preserves split UTF-8 text and multiline event framing',async()=>{
 const bytes=new TextEncoder().encode('data: {"delta":"hi 🌍"}\r\n\r\ndata: [DONE]\n\n');
 const input=new Response(new ReadableStream({start(c){for(let n=0;n<bytes.length;n+=3)c.enqueue(bytes.slice(n,n+3));c.close();}}));
 const events=[];for await(const event of sse(input))events.push(event);
 assert.deepEqual(events,[{delta:'hi 🌍'},{type:'done'}]);
});
test('OpenRouter streams content and requires a successful finish and DONE',async()=>{
 let payload;let text='';
 await streamText('openrouter','test-token','test-model','be helpful',[{role:'user',content:'Hello'}],new AbortController().signal,async d=>{text+=d;},async(url,options)=>{
  assert.equal(url,'https://openrouter.ai/api/v1/chat/completions');payload=JSON.parse(options.body);
  return response(['data: {"choices":[{"delta":{"content":"Hello"}}]}\n\n','data: {"choices":[{"finish_reason":"stop"}]}\n\n','data: [DONE]\n\n']);
 });
 assert.equal(text,'Hello');assert.equal(payload.messages[0].role,'system');
 await assert.rejects(streamText('openrouter','test','model','',[],new AbortController().signal,async()=>{},async()=>response(['data: {"choices":[{"delta":{"content":"partial"}}]}\n\n'])),/before completion/);
});
test('ChatGPT uses Responses restrictions and handles a failure after partial output',async()=>{
 let body;let output='';
 await assert.rejects(streamText('openai-oauth','test','model','Instructions',[{role:'user',content:'Hi'}],new AbortController().signal,async d=>{output+=d;},async(url,options)=>{
  assert.equal(url,'https://api.openai.com/v1/responses');body=JSON.parse(options.body);
  return response(['data: {"type":"response.output_text.delta","delta":"Partial"}\n\n','data: {"type":"response.failed","response":{"error":{"code":"subscription_sharing_usage_limit_exceeded"}}}\n\n']);
 }),/subscription_sharing_usage_limit_exceeded/);
 assert.equal(output,'Partial');assert.equal(body.store,false);assert.equal(body.stream,true);
 assert.deepEqual(Object.keys(body).sort(),['input','instructions','model','store','stream']);
});
test('ChatGPT completion, incomplete responses, cancellation, and invalid credentials',async()=>{
 await streamText('openai-oauth','test','model','',[],new AbortController().signal,async()=>{},async()=>response(['data: {"type":"response.completed"}\n\n']));
 await assert.rejects(streamText('openai-oauth','test','model','',[],new AbortController().signal,async()=>{},async()=>response(['data: {"type":"response.incomplete"}\n\n'])),/incomplete/);
 await assert.rejects(streamText('openrouter','test','model','',[],new AbortController().signal,async()=>{},async()=>new Response('',{status:401})),/HTTP 401/);
 const controller=new AbortController();controller.abort();
 await assert.rejects(streamText('openrouter','test','model','',[],controller.signal,async()=>{},async(_url,options)=>{options.signal.throwIfAborted();}),{name:'AbortError'});
});
test('authorization state rejects missing and mismatched callback values',()=>{
 assert(equalState('fresh-one-time-state','fresh-one-time-state'));
 assert(!equalState(null,'fresh-one-time-state'));assert(!equalState('wrong','fresh-one-time-state'));
 assert(!equalState('ééé','abc'));
});
test('provider failures give actionable errors without echoing upstream secrets',async()=>{
 for(const [code,message] of [[401,/credential expired or is invalid/],[402,/more credits/],[403,/denied access/],[429,/usage or request limit/]]){
  await assert.rejects(streamText('openrouter','private-key','model','',[],new AbortController().signal,async()=>{},async()=>new Response('private-key',{status:code})),message);
 }
 await assert.rejects(streamText('openrouter','private-key','model','',[],new AbortController().signal,async()=>{},async()=>response(['data: {"error":{"code":402,"message":"private-key"}}\n\n'])),e=>/more credits/.test(e.message)&&!e.message.includes('private-key'));
 await assert.rejects(streamText('openrouter','private-key','model','',[],new AbortController().signal,async()=>{},async()=>response(['data: not-json-private-key\n\n'])),e=>/unreadable stream/.test(e.message)&&!e.message.includes('private-key'));
});
test('OpenRouter catalog respects text output, image input, and mandatory reasoning; removal clears its cache',async()=>{
 const {Providers}=require('../build/providers.js'),original=global.fetch,values=new Map();
 const secrets={get:k=>values.get(k),set:async(k,v)=>v===undefined?values.delete(k):values.set(k,v)};
 global.fetch=async()=>new Response(JSON.stringify({data:[{id:'vendor/text',name:'Text',architecture:{input_modalities:['text','image'],output_modalities:['text']},reasoning:{mandatory:true,supported_efforts:['none','high']}},{id:'vendor/video',architecture:{output_modalities:['video']}}]}));
 try{
  const providers=new Providers(secrets,'fixture');await secrets.set('openrouter',{key:'private-key'});
  const models=await providers.routerModels();assert.equal(models.length,1);assert.deepEqual(models[0].inputModalities,['text','image']);assert.deepEqual(models[0].thinking,['high']);
  await providers.defaultRouter('vendor/text');assert.equal(providers.status('a').defaultModel,'vendor/text');assert(!JSON.stringify(providers.status('a')).includes('private-key'));
  await providers.removeRouter();assert.equal(providers.status('a').openrouter,false);assert.equal(values.get('models:openrouter:shared'),undefined);
 }finally{global.fetch=original;}
});

test('usage actions allow only the two fixed provider dashboards',()=>{assert.equal(providerUsageURL(),'https://chatgpt.com/settings/usage');assert.equal(providerUsageURL('openrouter'),'https://openrouter.ai/activity');for(const value of ['https://attacker.invalid',null,{},'other'])assert.throws(()=>providerUsageURL(value),/Choose ChatGPT or OpenRouter/);});
