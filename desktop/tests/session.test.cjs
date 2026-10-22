const test=require('node:test');
const assert=require('node:assert/strict');
const {Broker}=require('./legacy-harness.cjs');
test('local sign-out denies later operations even when server logout fails',async()=>{
 const values=new Map([['session',{access_token:'fixture',refresh_token:'fixture'}]]);
 const secrets={get:key=>values.get(key),set:async(key,value)=>value===undefined?values.delete(key):values.set(key,value)};
 const broker=new Broker({API_URL:'http://127.0.0.1:1',ANON_KEY:'fixture-anon',SERVICE_ROLE_KEY:'fixture-service'},secrets,{},()=>{});
 broker.auth.auth.signOut=async()=>({error:new Error('Simulated network loss')});
 await broker.call('auth.signOut');assert(!values.has('session'));
 await assert.rejects(broker.call('agents.list'),/Sign in to Agentopia/);
});
test('an in-flight identity check cannot restore access after logout',async()=>{
 const secrets={get:()=>undefined,set:async()=>{}};
 const broker=new Broker({API_URL:'http://127.0.0.1:1',ANON_KEY:'fixture-anon',SERVICE_ROLE_KEY:'fixture-service'},secrets,{},()=>{});
 const user={id:'fixture-user',email:'fixture@example.com'};
 broker.auth.auth.getSession=async()=>({data:{session:{user,access_token:'fixture',refresh_token:'fixture',expires_at:Date.now()/1000+3600}},error:null});
 broker.auth.auth.getUser=async()=>({data:{user},error:null});
 broker.admin.auth.admin.getUserById=async()=>({data:{user},error:null});
 let release,entered;const waiting=new Promise(resolve=>{entered=resolve});
 broker.admin.rpc=async()=>{entered();return new Promise(resolve=>{release=()=>resolve({data:true,error:null})})};
 broker.auth.auth.signOut=async()=>({error:new Error('Simulated network loss')});
 const identity=broker.identity();await waiting;await broker.call('auth.signOut');release();
 await assert.rejects(identity,/session changed/);
});
