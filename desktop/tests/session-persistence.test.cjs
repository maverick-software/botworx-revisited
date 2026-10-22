const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const {createClient}=require('@supabase/supabase-js');
const {SessionPersistence}=require(path.resolve(process.env.AGENTOPIA_SESSION_BUILD??path.join(__dirname,'../build'),'session-persistence.js'));

function store(initial){const values=new Map(initial?[['session',initial]]:[]);return {values,get:key=>values.get(key),set:async(key,value)=>{if(value===undefined)values.delete(key);else values.set(key,value);}};}
const pair=n=>({access_token:'fixture-access-'+n,refresh_token:'fixture-refresh-'+n});

test('rotations survive a failed later account check and a fresh client restores the latest credential',async()=>{
 const originalNow=Date.now;let now=originalNow(),rotation=0;const user={id:'11111111-1111-4111-8111-111111111111',email:'fixture@example.com'};
 const jwt=()=>[Buffer.from('{"alg":"HS256","typ":"JWT"}').toString('base64url'),Buffer.from(JSON.stringify({sub:user.id,exp:Math.floor(now/1000)+3600})).toString('base64url'),'fixture'].join('.');
 const secrets=store({access_token:jwt(),refresh_token:'fixture-refresh-0'});
 const fetch=async(input,args={})=>{const url=new URL(String(input));if(url.pathname.endsWith('/user'))return new Response(JSON.stringify(user));if(url.pathname.endsWith('/token')){const provided=JSON.parse(args.body).refresh_token;assert.equal(provided,'fixture-refresh-'+rotation,'An outdated credential was sent');return new Response(JSON.stringify({access_token:jwt(),refresh_token:'fixture-refresh-'+(++rotation),expires_in:3600,token_type:'bearer',user}));}throw Error('Unexpected request');};
 const client=()=>createClient('http://session-fixture.invalid','fixture-anon',{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{fetch}});
 try{Date.now=()=>now;const persistence=new SessionPersistence(secrets),auth=client().auth;auth.onAuthStateChange((event,session)=>persistence.capture(event,session));await persistence.restore(auth);
  for(let n=0;n<2;n++){now+=3601000;assert.equal((await auth.getSession()).error,null);await assert.rejects(Promise.reject(Error('Controlled role lookup failed')),/role lookup/);assert.equal(secrets.get('session').refresh_token,'fixture-refresh-'+rotation);}
  const renewed=secrets.get('session');assert(rotation>=2);now+=3601000;const next=client().auth,nextPersistence=new SessionPersistence(secrets);next.onAuthStateChange((event,session)=>nextPersistence.capture(event,session));await nextPersistence.restore(next);assert.equal((await next.getSession()).data.session.user.id,user.id);assert.notEqual(secrets.get('session').refresh_token,renewed.refresh_token);
 }finally{Date.now=originalNow;}
});

test('temporary startup failures preserve the saved session and offer startup retry',async()=>{
 for(const error of [{name:'AuthRetryableFetchError',status:0},{name:'AuthApiError',status:503},{name:'AuthApiError',status:429},{name:'Error',message:'Controlled unknown failure'}]){const secrets=store(pair(0)),persistence=new SessionPersistence(secrets);await assert.rejects(persistence.restore({setSession:async()=>({error})}),/saved sign-in.*Retry/i);assert.deepEqual(secrets.get('session'),pair(0));}
});

test('definitively rejected credentials require sign-in and are cleared',async()=>{
 for(const code of ['refresh_token_already_used','refresh_token_not_found','session_not_found','session_expired','user_not_found','bad_jwt']){const secrets=store(pair(0)),persistence=new SessionPersistence(secrets);await persistence.restore({setSession:async()=>({error:{name:'AuthApiError',status:400,code}})});assert.equal(secrets.get('session'),undefined);}
});

test('sign-out suspension prevents delayed auth events from restoring saved access',async()=>{
 const secrets=store(pair(0)),persistence=new SessionPersistence(secrets);persistence.suspend();await persistence.capture('TOKEN_REFRESHED',pair(1));await secrets.set('session',undefined);await persistence.capture('SIGNED_IN',pair(2));assert.equal(secrets.get('session'),undefined);persistence.resume();await persistence.capture('SIGNED_IN',pair(3));assert.deepEqual(secrets.get('session'),pair(3));
});

test('restoration persists the returned rotation even when the client omits an auth event',async()=>{
 const secrets=store(pair(0)),persistence=new SessionPersistence(secrets);await persistence.restore({setSession:async()=>({data:{session:pair(1)},error:null})});assert.deepEqual(secrets.get('session'),pair(1));
});

test('a failed old restoration cannot erase a newer captured sign-in',async()=>{
 const secrets=store(pair(0)),persistence=new SessionPersistence(secrets);await persistence.restore({setSession:async()=>{await persistence.capture('SIGNED_IN',pair(1));return {error:{name:'AuthApiError',status:400,code:'refresh_token_already_used'}};}});assert.deepEqual(secrets.get('session'),pair(1));
});

test('credential write errors reveal no store contents and initialization events cannot clear sign-in',async()=>{
 const secrets=store(pair(0)),persistence=new SessionPersistence(secrets);await persistence.capture('INITIAL_SESSION',null);await persistence.capture('SIGNED_OUT',null);assert.deepEqual(secrets.get('session'),pair(0));secrets.set=async()=>{throw Error('Controlled private diagnostic');};await assert.rejects(persistence.capture('TOKEN_REFRESHED',pair(1)),error=>/save your sign-in/.test(error.message)&&!error.message.includes('private diagnostic'));
});

test('the actual broker saves SDK refresh events before role checks and restores after restart',async()=>{
 const {Broker}=require(path.resolve(process.env.AGENTOPIA_SESSION_BUILD??path.join(__dirname,'../build'),'broker.js'));
 const originalNow=Date.now,originalFetch=globalThis.fetch;let now=originalNow(),rotation=0;
 const user={id:'22222222-2222-4222-8222-222222222222',email:'broker-fixture@example.com'};
 const jwt=()=>[Buffer.from('{"alg":"HS256","typ":"JWT"}').toString('base64url'),Buffer.from(JSON.stringify({sub:user.id,exp:Math.floor(now/1000)+3600})).toString('base64url'),'fixture'].join('.');
 const secrets=store({access_token:jwt(),refresh_token:'broker-refresh-0'});
 const make=()=>{const broker=new Broker({API_URL:'http://broker-session-fixture.invalid',ANON_KEY:'fixture-anon',SERVICE_ROLE_KEY:'fixture-service'},secrets,{},()=>{});for(const service of [broker.native,broker.nativeChanges,broker.terminal,broker.fileOperations])service.recover=async()=>{};broker.fileOperations.recoverOwner=async()=>{};broker.admin.auth.admin.getUserById=async()=>({data:{user},error:null});broker.admin.rpc=async name=>name==='user_has_role'&&broker.fixtureRoleFailure?{data:null,error:{message:'Controlled broker role lookup failed'}}:{data:name==='user_has_role'?false:{},error:null};const query=new Proxy({},{get:(_,key)=>key==='then'?(resolve,reject)=>Promise.resolve({data:[],error:null}).then(resolve,reject):()=>query});broker.admin.from=()=>query;return broker;};
 try{Date.now=()=>now;globalThis.fetch=async(input,args={})=>{const url=new URL(String(input));assert.equal(url.hostname,'broker-session-fixture.invalid');if(url.pathname.endsWith('/user'))return new Response(JSON.stringify(user));if(url.pathname.endsWith('/token')){assert.equal(JSON.parse(args.body).refresh_token,'broker-refresh-'+rotation);return new Response(JSON.stringify({access_token:jwt(),refresh_token:'broker-refresh-'+(++rotation),expires_in:3600,token_type:'bearer',user}));}throw Error('Unexpected fixture route');};const broker=make();await broker.initialize();
  broker.fixtureRoleFailure=true;for(let n=0;n<2;n++){now+=3601000;await assert.rejects(broker.identity(),/broker role lookup failed/);assert.equal(secrets.get('session').refresh_token,'broker-refresh-'+rotation);}
  const previous=rotation;now+=3601000;const interrupted=make();interrupted.fixtureRoleFailure=true;await assert.rejects(interrupted.initialize(),/broker role lookup failed/);assert(rotation>previous);assert.equal(secrets.get('session').refresh_token,'broker-refresh-'+rotation);
  const reopened=make();await reopened.initialize();assert.equal(secrets.get('session').refresh_token,'broker-refresh-'+rotation);assert.equal((await reopened.auth.auth.getSession()).data.session.user.id,user.id);
 }finally{globalThis.fetch=originalFetch;Date.now=originalNow;}
});
