const {readFileSync}=require('node:fs');
const {randomBytes,randomUUID}=require('node:crypto');
const assert=require('node:assert/strict');
const {Broker}=require('../build/broker.js');
const {Providers}=require('../build/providers.js');
class MemorySecrets{constructor(){this.values=new Map()}get(k){return this.values.get(k)}async set(k,v){this.values.set(k,v)}}
(async()=>{
 const state=JSON.parse(readFileSync(process.argv[2],'utf8'));assert.equal(state.runtime,'native');
 const secrets=new MemorySecrets(),broker=new Broker(state.env,secrets,new Providers(secrets,'urn:uuid:'+randomUUID()),()=>{});
 assert.equal((await broker.call('auth.state')).needsAdministrator,true);
 const password=randomBytes(24).toString('base64url')+'Aa1!';
 const identity=await broker.call('auth.firstAdmin',{email:'fresh-admin-proof@example.com',password,name:'Fresh proof'});
 assert.equal(identity.admin,true);
 await assert.rejects(broker.call('auth.firstAdmin',{email:'forbidden@example.com',password,name:'Invalid'}),/already exists/);
 await assert.rejects(broker.call('auth.register',{email:'forbidden@example.com',password,name:'Invalid'}),/Registration is disabled/);
 const settings=await (await fetch(state.env.API_URL+'/auth/v1/settings',{headers:{apikey:state.env.ANON_KEY}})).json();
 assert.equal(settings.external.email,true);assert.equal(settings.disable_signup,true);
 await broker.call('auth.signOut');
 console.log('PASS: A fresh installation creates and signs in its first administrator, prevents a second bootstrap, enables email login, and disables public signup.');
})().catch(error=>{console.error(error.message);process.exitCode=1});
