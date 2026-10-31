const test=require('node:test'),assert=require('node:assert/strict');
const {SylvanaAccount}=require('../build/sylvana-account.js');
const {Providers,streamTurn}=require('../build/providers.js');
const owner='12345678-1234-4123-8123-123456789abc',firm='22345678-1234-4123-8123-123456789abc';
function fixture(){
 const connection={owner,email:'synthetic@sylvana.example',firmId:firm,firmName:'Synthetic',access_token:'synthetic-access',refresh_token:'synthetic-refresh',expires_at:Date.now()+3600000};
 const values=new Map([['sylvana-account:'+owner,connection],['sylvana-binding:'+owner,{issuer:'https://xukoabvnftoosxyrfbea.supabase.co/auth/v1',subject:owner,firmId:firm}],['sylvana-legal:'+owner,true],['openrouter',{key:'synthetic-direct'}],['image-openai-key:'+owner,'synthetic-image']]);
 const secrets={get:k=>values.get(k),set:async(k,v)=>v===undefined?values.delete(k):values.set(k,v),setMany:async rows=>{for(const[k,v]of rows)v===undefined?values.delete(k):values.set(k,v);}};
 const account=new SylvanaAccount(secrets,async()=>{});let legal=true,version=1,provider='sylvana';
 account.request=async()=>Response.json({user:{id:owner},firm:{id:firm,name:'Synthetic',legal_mode:legal},policy:{legal_mode:legal,version,workspace_ai:{provider:legal?'sylvana':provider,models:{},voice:{connection:'sylvana',tier:'standard',voice:''}}},provider:{enabled:true,origin:'https://api.sylvana.example'},allowance:{status:'active',limit_units:100,remaining_units:75,reserved_units:0}});
 return {account,secrets,values,setPolicy(value){legal=value;version++;},setProvider(value){provider=value;version++;}};
}
test('Cloud policy toggles preserve the account, saved provider credentials and allowance',async()=>{
 const f=fixture();await f.account.verifySession(owner,true);assert(f.account.legal(owner));f.setPolicy(false);await f.account.verifySession(owner,true);assert.equal(f.account.legal(owner),false);assert.equal(f.account.status(owner).linked,true);assert.equal(f.account.status(owner).allowance.remaining_units,75);assert.equal(f.values.get('openrouter').key,'synthetic-direct');assert.equal(f.values.get('image-openai-key:'+owner),'synthetic-image');f.setPolicy(true);await f.account.verifySession(owner,true);assert(f.account.legal(owner));assert(f.values.has('openrouter'));
});
test('ChatGPT OAuth and API credentials remain available under the selected firm service when legal mode permits them',async()=>{
 const f=fixture(),providers=new Providers(f.secrets,'synthetic-host');providers.account=f.account;
 providers.connection=async()=>({scope:'chatgpt.tokens.use.direct',access_token:'synthetic-chatgpt'});
 await assert.rejects(providers.token('openai-oauth',owner),/Legal compliance/);
 f.setPolicy(false);await assert.rejects(providers.token('openai-oauth',owner),/firm owner/);
 f.setProvider('openai-oauth');assert.equal(await providers.token('openai-oauth',owner),'synthetic-chatgpt');await assert.rejects(providers.token('openai-api',owner),/firm owner/);
 f.setProvider('openai-api');assert.equal(await providers.token('openai-api',owner),'synthetic-image');await assert.rejects(providers.token('openai-oauth',owner),/firm owner/);
 await assert.rejects(providers.token('openrouter',owner),/firm owner/);
 f.setPolicy(true);await assert.rejects(providers.token('openai-api',owner),/Legal compliance/);assert.equal(f.values.get('openrouter').key,'synthetic-direct');assert.equal(f.values.get('image-openai-key:'+owner),'synthetic-image');
});
test('Managed requests use only the configured Sylvana origin, a desktop bearer and a stable operation key',async()=>{
 const f=fixture(),original=global.fetch;let request;
 global.fetch=async(url,init)=>{request={url,headers:new Headers(init.headers)};return Response.json({ok:true});};
 try{const operation='32345678-1234-4123-8123-123456789abc';await f.account.transport(owner)('https://sylvana.invalid/v1/responses',{method:'POST',headers:{'Idempotency-Key':operation},body:'{}'});assert.equal(request.url,'https://api.sylvana.example/v1/responses');assert.equal(request.headers.get('Authorization'),'Bearer synthetic-access');assert.equal(request.headers.get('Idempotency-Key'),operation);}finally{global.fetch=original;}
});
test('Managed legacy chat retains tool continuations through the managed transport',async()=>{
 let target,body;const result=await streamTurn('sylvana','synthetic-access','sylvana-aaaaaaaaaaaaaaaaaaaaaaaa','Instructions',[],new AbortController().signal,async()=>{},async(url,init)=>{target=url;body=JSON.parse(init.body);return new Response('data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"call-1","function":{"name":"read_file","arguments":"{}"}}]},"finish_reason":"tool_calls"}]}\n\ndata: [DONE]\n\n',{headers:{'Content-Type':'text/event-stream'}});},'default',[{name:'read_file',description:'Read selected file',parameters:{type:'object',properties:{}}}]);assert.equal(target,'https://sylvana.invalid/v1/chat/completions');assert.equal(result.calls[0].name,'read_file');assert.equal(body.tools[0].function.name,'read_file');
});
