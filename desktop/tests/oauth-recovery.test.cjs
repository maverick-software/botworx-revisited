const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const {Providers}=require('../build/providers.js'),{authorizationFailure}=require('../build/oauth-recovery.js'),{newChatProvider}=require('../build/new-chat-defaults.js');
const tokenURL='https://auth.openai.com/api/accounts/oauth/token',keysURL='https://auth.openai.com/.well-known/jwks.json';
class MemorySecrets{values=new Map();writes=[];get(key){return this.values.get(key);}async set(key,value){this.writes.push(key);if(value===undefined)this.values.delete(key);else this.values.set(key,value);}}
function fixture(){const secrets=new MemorySecrets(),connection={client_id:'oaiapp_fixture',subject:'fixture-subject',email:'fixture@example.com',id_token:'fixture-old-identity',access_token:'fixture-expired-access',refresh_token:'fixture-refresh',scope:'openid offline_access chatgpt.tokens.use.direct',expires_at:0};secrets.values.set('openai:owner',connection);secrets.values.set('openrouter',{key:'fixture-router'});secrets.values.set('model-choices:owner',{'openai-oauth':{model:'gpt-6.1-sol',thinking:'high'}});return {secrets,connection,providers:new Providers(secrets,'urn:uuid:fixture-host')};}
const renewed=(extra={})=>({access_token:'fixture-new-access',refresh_token:'fixture-new-refresh',expires_in:3600,...extra});

test('OAuth error diagnostics distinguish terminal, configuration and temporary failures without echoing provider text',async()=>{
 for(const [body,status,kind,code] of [[{error:'invalid_grant'},400,'reauthorize','invalid_grant'],[{error:{code:'refresh_token_reused',message:'fixture-private-token'}},400,'reauthorize','refresh_token_reused'],[{error:'invalid_client'},400,'configuration','invalid_client'],[{error:'server_error'},503,'retry','server_error'],[{detail:'fixture-private-token'},429,'retry',undefined]]){
  const error=await authorizationFailure(new Response(JSON.stringify(body),{status,headers:{'x-request-id':'req_fixture'}}));assert.equal(error.issue.kind,kind);assert.equal(error.issue.code,code);assert.equal(error.issue.httpStatus,status);assert.equal(error.issue.requestId,'req_fixture');assert(!JSON.stringify(error.issue).includes('fixture-private-token'));assert(!error.message.includes('fixture-private-token'));
 }
 const oversized=await authorizationFailure(new Response('fixture-private-token'.repeat(5000),{status:400}));assert.equal(oversized.issue.kind,'retry');assert(!oversized.message.includes('fixture-private-token'));
 const malformed=await authorizationFailure(new Response('not JSON fixture-private-token',{status:502}));assert.equal(malformed.issue.kind,'retry');assert(!malformed.message.includes('fixture-private-token'));
});

test('temporary renewal failures retain credentials and preferred ChatGPT, then a retry commits the rotated pair',async()=>{
 const {secrets,connection,providers}=fixture(),original=global.fetch;let calls=0;
 global.fetch=async url=>{assert.equal(String(url),tokenURL);calls++;return calls===1?new Response('{"error":"temporarily_unavailable"}',{status:503}):Response.json(renewed());};
 try{await assert.rejects(providers.token('openai-oauth','owner'),/Retry/);assert.equal(secrets.get('openai:owner'),connection);assert.equal(providers.status('owner').chatgpt.connectionIssue.kind,'retry');assert.equal(newChatProvider(providers.status('owner'),'openrouter'),'openai-oauth');assert.equal(await providers.token('openai-oauth','owner'),'fixture-new-access');assert.equal(calls,2);assert.equal(secrets.get('openai:owner').refresh_token,'fixture-new-refresh');assert.equal(providers.status('owner').chatgpt.connectionIssue,undefined);assert.equal(secrets.get('openrouter').key,'fixture-router');assert(secrets.writes.indexOf('openai-renewal:owner')<secrets.writes.indexOf('openai:owner'));}finally{global.fetch=original;}
});

test('terminal rejection clears unusable access/refresh tokens, retains registration, and cannot charge through OpenRouter',async()=>{
 const {secrets,providers}=fixture(),original=global.fetch;let calls=0;global.fetch=async()=>{calls++;return new Response('{"error":"invalid_grant"}',{status:400});};
 try{await assert.rejects(providers.token('openai-oauth','owner'),/Continue with ChatGPT/);const saved=secrets.get('openai:owner');assert.equal(saved.access_token,'');assert.equal(saved.refresh_token,'');assert.equal(saved.client_id,'oaiapp_fixture');assert.equal(saved.subject,'fixture-subject');assert.equal(secrets.get('openai-registration:owner').client_id,'oaiapp_fixture');assert.equal(providers.status('owner').chatgpt.authorized,false);assert.equal(providers.status('owner').chatgpt.connectionIssue.code,'invalid_grant');assert.equal(newChatProvider(providers.status('owner'),'openrouter'),'openai-oauth');await assert.rejects(new Providers(secrets,'fixture-host').token('openai-oauth','owner'),/Continue with ChatGPT/);assert.equal(calls,1);assert(!JSON.stringify(providers.status('owner')).includes('fixture-refresh'));assert.equal(secrets.get('openrouter').key,'fixture-router');}finally{global.fetch=original;}
});

test('invalid client is a configuration failure and preserves the exact saved token set',async()=>{
 const {secrets,connection,providers}=fixture(),original=global.fetch;global.fetch=async()=>new Response('{"error":"invalid_client"}',{status:400});
 try{await assert.rejects(providers.token('openai-oauth','owner'),/configuration/);assert.equal(secrets.get('openai:owner'),connection);assert.equal(providers.status('owner').chatgpt.connectionIssue.kind,'configuration');assert.equal(newChatProvider(providers.status('owner'),'openrouter'),'openai-oauth');}finally{global.fetch=original;}
});

test('parallel token requests share one renewal and persist its latest rotating credential once',async()=>{
 const {secrets,providers}=fixture(),original=global.fetch;let calls=0;global.fetch=async()=>{calls++;await new Promise(resolve=>setTimeout(resolve,10));return Response.json(renewed());};
 try{assert.deepEqual(await Promise.all(Array.from({length:6},()=>providers.token('openai-oauth','owner'))),Array(6).fill('fixture-new-access'));assert.equal(calls,1);assert.equal(secrets.writes.filter(key=>key==='openai:owner').length,1);}finally{global.fetch=original;}
});

test('disconnect during renewal cannot restore its old connection or pending rotation',async()=>{
 const {secrets,providers}=fixture(),original=global.fetch;let release;global.fetch=async()=>new Promise(resolve=>release=()=>resolve(Response.json(renewed())));
 try{const pending=providers.token('openai-oauth','owner');await new Promise(resolve=>setImmediate(resolve));await providers.disconnect('owner');release();await assert.rejects(pending,/connection changed/);assert.equal(providers.status('owner').chatgpt,null);assert.equal(secrets.get('openai-renewal:owner'),undefined);assert.equal(secrets.get('openai-registration:owner').client_id,'oaiapp_fixture');}finally{global.fetch=original;}
});

test('a newer validated connection cannot be erased by an older failed renewal',async()=>{
 const {secrets,providers}=fixture(),original=global.fetch;let release;global.fetch=async()=>new Promise(resolve=>release=()=>resolve(new Response('{"error":"invalid_grant"}',{status:400})));
 try{const pending=providers.token('openai-oauth','owner');await new Promise(resolve=>setImmediate(resolve));const next={...secrets.get('openai:owner'),...renewed(),expires_at:Date.now()+3600000};await secrets.set('openai:owner',next);release();await assert.rejects(pending,/connection changed/);assert.equal(secrets.get('openai:owner'),next);assert.equal(providers.status('owner').chatgpt.authorized,true);assert.equal(providers.status('owner').chatgpt.connectionIssue,undefined);}finally{global.fetch=original;}
});

test('a rotated pair survives identity-key network failure and a fresh provider finishes validation without refreshing again',async()=>{
 const {generateKeyPair,exportJWK,SignJWT}=require('jose'),keys=await generateKeyPair('RS256'),publicKey=await exportJWK(keys.publicKey);publicKey.kid='renewal-fixture';
 const signed=await new SignJWT({}).setProtectedHeader({alg:'RS256',kid:publicKey.kid}).setIssuer('https://auth.openai.com').setAudience('oaiapp_fixture').setSubject('fixture-subject').setIssuedAt().setExpirationTime('1h').sign(keys.privateKey);
 const {secrets,connection,providers}=fixture(),original=global.fetch;let tokenCalls=0,keyCalls=0;
 global.fetch=async url=>{if(String(url)===tokenURL){tokenCalls++;return Response.json(renewed({id_token:signed}));}assert.equal(String(url),keysURL);keyCalls++;return keyCalls===1?new Response('{}',{status:503}):Response.json({keys:[publicKey]});};
 try{await assert.rejects(providers.token('openai-oauth','owner'),/Check your internet/);assert.equal(secrets.get('openai:owner'),connection);assert.equal(secrets.get('openai-renewal:owner').connection.refresh_token,'fixture-new-refresh');assert.equal(await new Providers(secrets,'fixture-host').token('openai-oauth','owner'),'fixture-new-access');assert.equal(tokenCalls,1);assert.equal(keyCalls,2);assert.equal(secrets.get('openai-renewal:owner'),undefined);assert.equal(secrets.get('openai:owner').refresh_token,'fixture-new-refresh');}finally{global.fetch=original;}
});

test('a renewed identity for another account is never activated',async()=>{
 const {generateKeyPair,exportJWK,SignJWT}=require('jose'),keys=await generateKeyPair('RS256'),publicKey=await exportJWK(keys.publicKey);publicKey.kid='mismatch-fixture';
 const signed=await new SignJWT({}).setProtectedHeader({alg:'RS256',kid:publicKey.kid}).setIssuer('https://auth.openai.com').setAudience('oaiapp_fixture').setSubject('different-subject').setIssuedAt().setExpirationTime('1h').sign(keys.privateKey);
 const {secrets,providers}=fixture(),original=global.fetch;global.fetch=async url=>String(url)===tokenURL?Response.json(renewed({id_token:signed})):Response.json({keys:[publicKey]});
 try{await assert.rejects(providers.token('openai-oauth','owner'),/Continue with ChatGPT/);assert.equal(secrets.get('openai:owner').subject,'fixture-subject');assert.equal(secrets.get('openai:owner').access_token,'');assert.equal(secrets.get('openai-renewal:owner'),undefined);assert.equal(providers.status('owner').chatgpt.connectionIssue.code,'identity_mismatch');}finally{global.fetch=original;}
});

test('a delayed pending rotation is verified at receipt time then renews using its latest refresh token',async()=>{
 const {generateKeyPair,exportJWK,SignJWT}=require('jose'),keys=await generateKeyPair('RS256'),publicKey=await exportJWK(keys.publicKey);publicKey.kid='delayed-fixture';
 const signed=await new SignJWT({}).setProtectedHeader({alg:'RS256',kid:publicKey.kid}).setIssuer('https://auth.openai.com').setAudience('oaiapp_fixture').setSubject('fixture-subject').setIssuedAt().setExpirationTime('1h').sign(keys.privateKey);
 const {secrets,providers}=fixture(),original=global.fetch,clock=Date.now;let tokenCalls=0,keyCalls=0;
 global.fetch=async(url,args)=>{if(String(url)===tokenURL){tokenCalls++;if(tokenCalls===1)return Response.json(renewed({id_token:signed}));assert.equal(new URLSearchParams(args.body).get('refresh_token'),'fixture-new-refresh');return Response.json(renewed({access_token:'fixture-latest-access',refresh_token:'fixture-latest-refresh'}));}assert.equal(String(url),keysURL);keyCalls++;return keyCalls===1?new Response('{}',{status:503}):Response.json({keys:[publicKey]});};
 try{await assert.rejects(providers.token('openai-oauth','owner'),/Check your internet/);const later=clock()+7200000;Date.now=()=>later;const fresh=new Providers(secrets,'fixture-host');assert.deepEqual(await Promise.all(Array.from({length:4},()=>fresh.token('openai-oauth','owner'))),Array(4).fill('fixture-latest-access'));assert.equal(tokenCalls,2);assert.equal(secrets.get('openai:owner').refresh_token,'fixture-latest-refresh');assert.equal(secrets.get('openai-renewal:owner'),undefined);}finally{Date.now=clock;global.fetch=original;}
});

test('renewal ignores unrequested identity fields and rejects malformed scopes before activation',async()=>{
 const {secrets,providers}=fixture(),original=global.fetch;global.fetch=async()=>Response.json(renewed({client_id:'different-client',subject:'different-subject',email:'different@example.com'}));
 try{assert.equal(await providers.token('openai-oauth','owner'),'fixture-new-access');assert.equal(secrets.get('openai:owner').client_id,'oaiapp_fixture');assert.equal(secrets.get('openai:owner').subject,'fixture-subject');assert.equal(secrets.get('openai:owner').email,'fixture@example.com');const second=fixture();global.fetch=async()=>Response.json(renewed({scope:['invalid-scope-shape']}));await assert.rejects(second.providers.token('openai-oauth','owner'),/invalid renewal/);assert.equal(second.secrets.get('openai:owner'),second.connection);}finally{global.fetch=original;}
});

test('a credential-store failure retains the received rotation in memory and retries persistence without renewing twice',async()=>{
 const {secrets,connection,providers}=fixture(),original=global.fetch,save=secrets.set.bind(secrets);let unavailable=true,calls=0;secrets.set=async(key,value)=>{if(unavailable)throw Error('fixture-private-token in storage failure');return save(key,value);};global.fetch=async()=>{calls++;return Response.json(renewed());};
 try{await assert.rejects(providers.token('openai-oauth','owner'),error=>error.issue?.code==='credential_storage_unavailable'&&!error.message.includes('fixture-private-token'));assert.equal(secrets.get('openai:owner'),connection);assert.equal(providers.status('owner').chatgpt.connectionIssue.code,'credential_storage_unavailable');unavailable=false;assert.equal(await providers.token('openai-oauth','owner'),'fixture-new-access');assert.equal(calls,1);assert.equal(secrets.get('openai:owner').refresh_token,'fixture-new-refresh');assert.equal(providers.status('owner').chatgpt.connectionIssue,undefined);}finally{global.fetch=original;}
});
