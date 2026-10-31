const test=require('node:test'),assert=require('node:assert/strict');
const {LocalSessionEnded,localSessionEnded,rejectedLocalSession,SessionEndBoundary}=require('../build/session-end.js');
test('local session loss survives Electron error wrapping without treating provider and network errors as logout',()=>{
 assert(localSessionEnded(new Error("Error invoking remote method 'sylvana:call': Error: "+new LocalSessionEnded().message)));
 for(const e of [new Error('fetch failed'),new Error('Provider returned 401'),new Error('Sign in to another service'),new Error('Your session expired. Sign in again.')])assert(!localSessionEnded(e));
 assert(rejectedLocalSession({status:400,code:'refresh_token_not_found'}));assert(!rejectedLocalSession({status:503,code:'session_expired'}));
});
test('an expired authenticated request ends the current view once and stale requests cannot dismiss a later login',()=>{
 const boundary=new SessionEndBoundary();let epoch=1,ended=0;const off=boundary.listen(()=>epoch,()=>{ended++;epoch++;}),first=boundary.request(),late=boundary.request();first(new LocalSessionEnded());late(new LocalSessionEnded());assert.equal(ended,1);const old=boundary.request();epoch++;old(new LocalSessionEnded());assert.equal(ended,1);boundary.request()(new LocalSessionEnded());assert.equal(ended,2);const unmounted=boundary.request();off();unmounted(new LocalSessionEnded());assert.equal(ended,2);
});
test('the backend marks missing local sessions explicitly',async()=>{
 const {Broker}=require('./legacy-harness.cjs'),broker=new Broker({API_URL:'http://127.0.0.1:1',ANON_KEY:'fixture-anon',SERVICE_ROLE_KEY:'fixture-service'},{get:()=>undefined,set:async()=>{}},{},()=>{});broker.auth.auth.getSession=async()=>({data:{session:null},error:null});await assert.rejects(broker.identity(),localSessionEnded);
});
