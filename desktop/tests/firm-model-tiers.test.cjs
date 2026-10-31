const test=require('node:test'),assert=require('node:assert/strict');
const {SylvanaAccount}=require('../build/sylvana-account.js'),{Providers}=require('../build/providers.js');
const {ImageConnections}=require('../build/image-connections.js');
const owner='12345678-1234-4123-8123-123456789abc',firm='22345678-1234-4123-8123-123456789abc';
function fixture(){
 const values=new Map([['sylvana-account:'+owner,{owner,firmId:firm,email:'synthetic@sylvana.example',firmName:'Synthetic',access_token:'synthetic-access',refresh_token:'synthetic-refresh',expires_at:Date.now()+3600000}],['sylvana-binding:'+owner,{issuer:'https://xukoabvnftoosxyrfbea.supabase.co/auth/v1',subject:owner,firmId:firm}],['openrouter',{key:'synthetic-api'}]]);
 const secrets={get:k=>values.get(k),set:async(k,v)=>values.set(k,v),setMany:async rows=>{for(const[k,v]of rows)values.set(k,v);}},account=new SylvanaAccount(secrets,async()=>{});let legal=false,role='owner',version=1,enabled=true,selected='openai-oauth';
 const routes=['openai-oauth','openrouter'].flatMap(provider=>['standard','advanced'].map(tier=>({provider,tier,capability:'responses',model:provider==='openai-oauth'?'gpt-'+tier:'vendor/'+tier,revision:1})));
 account.request=async(route,_token,method,body)=>{if(route==='/api/firm/legal-compliance'){if(role!=='owner')throw Error('Owner access required');legal=body.enabled;version++;return Response.json({ok:true});}return Response.json({user:{id:owner},firm:{id:firm,name:'Synthetic',role,legal_mode:legal},policy:{legal_mode:legal,version,workspace_ai:{provider:legal?'sylvana':selected,models:{},voice:{connection:'sylvana',tier:'standard',voice:''}},connections:{sylvana:true,chatgpt:!legal,openai_api:!legal,openrouter:!legal}},direct_tiers:legal?[]:routes,provider:{enabled,origin:'https://api.sylvana.example'}});};
 const providers=new Providers(secrets,'synthetic');providers.account=account;providers.connection=async()=>({scope:'chatgpt.tokens.use.direct',access_token:'synthetic-chatgpt'});
 routes.push({provider:'openai-api',tier:'standard',capability:'images',model:'gpt-image-2',revision:1});
 return {account,providers,secrets,values,select:v=>{selected=v;version++;},policy:v=>{legal=v;version++;},role:v=>{role=v;},enabled:v=>{enabled=v;}};
}
test('Desktop firm policy changes are refused; web-managed Legal Compliance preserves saved credentials',async()=>{const f=fixture();await assert.rejects(f.account.setLegalCompliance(owner,true),/web/);f.policy(true);await assert.rejects(f.providers.token('openai-oauth',owner),/Legal compliance/);assert.equal(f.values.get('openrouter').key,'synthetic-api');});

test('Standard and Advanced use backend model mappings while retaining direct API endpoints',async()=>{
 const f=fixture(),original=global.fetch,calls=[];global.fetch=async(url,init)=>{const u=String(url);if(u.endsWith('/models'))return Response.json(u.startsWith('https://api.openai.com')?{models:['standard','advanced'].map(t=>({slug:'gpt-'+t,display_name:'Private '+t,visibility:'list'}))}:{data:['standard','advanced'].map(t=>({id:'vendor/'+t,name:'Private '+t,supported_parameters:['tools']}))});calls.push({url:u,body:JSON.parse(init.body)});return Response.json({ok:true});};
 try {for(const provider of ['openai-oauth']){const models=await f.providers.models(provider,owner);assert.deepEqual(models.map(m=>m.id),['standard','advanced']);assert(!JSON.stringify(models).includes('Private'));await f.providers.transport(provider,owner)(provider==='openai-oauth'?'https://api.openai.com/v1/responses':'https://openrouter.ai/api/v1/chat/completions',{method:'POST',body:JSON.stringify({model:'advanced',input:[]})});}assert.equal(calls[0].body.model,'gpt-advanced');f.policy(true);await assert.rejects(f.providers.transport('openai-oauth',owner)('https://api.openai.com/v1/responses',{method:'POST',body:'{"model":"standard"}'}),/Legal Compliance/);assert.equal(calls.length,1);}finally{global.fetch=original;}
});
test('Legal Compliance has no simulated or direct fallback while the managed service is unavailable',async()=>{const f=fixture();f.policy(true);f.enabled(false);await assert.rejects(f.account.models(owner),/awaiting service configuration/);await assert.rejects(f.providers.token('openrouter',owner),/Legal compliance/);});

test('Legal Compliance dispatches tiers only to the verified managed origin with the Sylvana credential',async()=>{
 const f=fixture(),original=global.fetch,calls=[];f.policy(true);
 global.fetch=async(url,init)=>{calls.push({url:String(url),init});return Response.json({ok:true});};
 try{
  await f.providers.transport('sylvana',owner)('https://sylvana.invalid/v1/chat/completions',{method:'POST',headers:{Authorization:'Bearer must-be-replaced','Content-Type':'application/json'},body:JSON.stringify({model:'advanced',messages:[]})});
  assert.equal(calls.length,1);assert.equal(calls[0].url,'https://api.sylvana.example/v1/chat/completions');
  const headers=new Headers(calls[0].init.headers);assert.equal(headers.get('Authorization'),'Bearer synthetic-access');assert.match(headers.get('Idempotency-Key'),/^[a-f0-9-]{36}$/);assert.equal(calls[0].init.redirect,'error');assert.equal(JSON.parse(calls[0].init.body).model,'advanced');
  await assert.rejects(f.providers.transport('sylvana',owner)('https://openrouter.ai/api/v1/chat/completions',{method:'POST',body:'{"model":"advanced"}'}),/Invalid managed transport destination/);
  for(const provider of ['openai-oauth','openrouter'])await assert.rejects(f.providers.token(provider,owner),/Legal compliance/);
  assert.equal(calls.length,1);
 }finally{global.fetch=original;}
});
test('raw model IDs cannot bypass the backend-controlled Standard and Advanced mappings',async()=>{const f=fixture();await assert.rejects(f.account.directModel(owner,'openrouter','vendor/standard'),/Standard or Advanced/);});
test('image settings expose a service level, resolve the backend model privately, and preserve disabled status',async()=>{const f=fixture();f.select('openai-api');f.values.set('image-openai-key:'+owner,'synthetic-image-key');f.values.set('image-generation:'+owner,{enabled:false,provider:'openai-api',model:'old-user-model'});const images=new ImageConnections(f.secrets,f.account);await f.account.verifySession(owner,true);assert.equal(images.connection(owner).model,'standard');assert.equal(images.connection(owner).enabled,false);assert.equal((await images.resolve(owner)).model,'gpt-image-2');f.policy(true);await f.account.verifySession(owner,true);assert.equal(images.connection(owner).provider,'sylvana');assert.equal(images.connection(owner).enabled,false);await assert.rejects(images.credentialFor(owner,'openai-api'),/current policy/);assert.equal(f.values.get('image-openai-key:'+owner),'synthetic-image-key');});
