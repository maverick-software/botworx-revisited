const test=require('node:test');
const assert=require('node:assert/strict');
const {createHash,randomUUID}=require('node:crypto');
const electronPath=require.resolve('electron');require(electronPath);
let browser;
require.cache[electronPath].exports={shell:{openExternal:url=>browser(url)}};
const {Providers}=require('../build/providers.js');
class MemorySecrets{constructor(){this.values=new Map()}get(k){return this.values.get(k)}async set(k,v){if(v===undefined)this.values.delete(k);else this.values.set(k,v)}}
test('OAuth callback, PKCE, signed identity, per-user storage, renewal, and denied consent',async()=>{
 const {generateKeyPair,exportJWK,SignJWT}=require('jose');
 const keys=await generateKeyPair('RS256');const publicKey=await exportJWK(keys.publicKey);publicKey.kid='fixture-key';
 const secrets=new MemorySecrets(),host='urn:uuid:'+randomUUID(),providers=new Providers(secrets,host);
 const originalFetch=global.fetch;let authorization,tokens,wrongNonce=false,tokenCalls=0,mode='success';
 global.fetch=async(input,options)=>{
  const url=String(input);
  if(url==='https://auth.openai.com/.well-known/jwks.json')return new Response(JSON.stringify({keys:[publicKey]}),{headers:{'Content-Type':'application/json'}});
  if(url==='https://auth.openai.com/api/accounts/oauth/token'){
   tokenCalls++;const form=new URLSearchParams(options.body);assert.equal(form.get('client_id'),'oaiapp_fixture');assert.equal(form.get('resource'),'https://api.openai.com/v1');
   if(form.get('grant_type')==='refresh_token'){assert.equal(form.get('refresh_token'),'fixture-refresh');return new Response(JSON.stringify({...tokens,access_token:'renewed-access',refresh_token:'renewed-refresh'}));}
   assert.equal(form.get('redirect_uri'),authorization.searchParams.get('redirect_uri'));
   assert.equal(createHash('sha256').update(form.get('code_verifier')).digest('base64url'),authorization.searchParams.get('code_challenge'));
   return new Response(JSON.stringify(tokens));
  }
  if(url==='https://api.openai.com/v1/models')return new Response(JSON.stringify({models:[{slug:'fixture-model',display_name:'Fixture model',visibility:'list'},{slug:'hidden',visibility:'hide'}]}));
  return originalFetch(input,options);
 };
 browser=async value=>{
  authorization=new URL(value);assert.equal(authorization.origin,'https://auth.openai.com');assert.equal(authorization.searchParams.get('ext_agent_host_id'),host);
  assert.equal(authorization.searchParams.get('code_challenge_method'),'S256');
  const callback=new URL(authorization.searchParams.get('redirect_uri'));assert.equal(callback.hostname,'127.0.0.1');assert.equal(callback.pathname,'/auth/callback');
  callback.searchParams.set('state','invalid-state');assert.equal((await fetch(callback)).status,400);
  callback.searchParams.set('state',authorization.searchParams.get('state'));
  if(mode==='denied')callback.searchParams.set('error','access_denied');
  else{
   callback.searchParams.set('code','fixture-code');callback.searchParams.set('client_id','oaiapp_fixture');
   const idToken=await new SignJWT({nonce:wrongNonce?'wrong-nonce':authorization.searchParams.get('nonce'),email:'fixture@example.com'})
    .setProtectedHeader({alg:'RS256',kid:'fixture-key'}).setIssuer('https://auth.openai.com').setAudience('oaiapp_fixture').setSubject('fixture-subject').setIssuedAt().setExpirationTime('5m').sign(keys.privateKey);
   tokens={id_token:idToken,access_token:'fixture-access',refresh_token:'fixture-refresh',scope:'openid email offline_access resource.invoke chatgpt.tokens.use.direct',expires_in:3600};
  }
  assert.equal((await fetch(callback)).status,200);
 };
 try{
  assert.deepEqual(await providers.connect('local-user-a'),[{id:'fixture-model',name:'Fixture model',thinking:[]}]);
  assert.equal(authorization.searchParams.get('client_id'),'dynamic_agent_client');assert.equal(authorization.searchParams.get('agent_name_hint'),'Agentopia');
  assert.equal(secrets.get('openai:local-user-a').subject,'fixture-subject');
  assert(!JSON.stringify(providers.status('local-user-a')).includes('fixture-access'));
  assert.equal(providers.status('local-user-b').chatgpt,null);await assert.rejects(providers.token('openai-oauth','local-user-b'),/Connect your ChatGPT/);
  wrongNonce=true;await assert.rejects(providers.connect('local-user-a'),/identity did not match/);
  assert.equal(authorization.searchParams.get('client_id'),'oaiapp_fixture');assert.equal(secrets.get('openai:local-user-a').access_token,'fixture-access');
  mode='denied';const before=tokenCalls;await assert.rejects(providers.connect('local-user-a'),/declined or is unavailable/);assert.equal(tokenCalls,before);
  wrongNonce=false;const saved=secrets.get('openai:local-user-a');saved.expires_at=0;tokens.id_token=saved.id_token;
  assert.equal(await providers.token('openai-oauth','local-user-a'),'renewed-access');assert.equal(secrets.get('openai:local-user-a').refresh_token,'renewed-refresh');
  await providers.disconnect('local-user-a');assert.equal(providers.status('local-user-a').chatgpt,null);
 }finally{global.fetch=originalFetch;}
});
