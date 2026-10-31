const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),{randomUUID}=require('node:crypto');
const {Broker}=require(path.resolve(process.env.SYLVANA_SESSION_BUILD??path.join(__dirname,'../build'),'broker.js'));
test('sidebar preferences survive broker recreation, retain legacy defaults, and reject another account or invalid widths',async()=>{
 const owner=randomUUID(),other=randomUUID(),values=new Map(),secrets={get:key=>values.get(key),set:async(key,value)=>values.set(key,value)};
 const make=()=>{const broker=new Broker({API_URL:'http://127.0.0.1:1',ANON_KEY:'fixture-anon',SERVICE_ROLE_KEY:'fixture-service'},secrets,{},()=>{});broker.identity=async()=>({id:owner,email:'preferences-fixture@example.com',admin:false});return broker;};
 const appearance={theme:'dark',textSize:'large',sendWith:'ctrl-enter',sidebarCollapsed:false},broker=make();
 assert.equal((await broker.call('preferences.get')).sidebarWidth,244);
 await broker.call('preferences.save',{userId:owner,preferences:appearance});assert.deepEqual(await make().call('preferences.get'),{...appearance,sidebarWidth:244});
 for(const sidebarWidth of [200,317,400]){await broker.call('preferences.save',{userId:owner,preferences:{...appearance,sidebarWidth}});assert.deepEqual(await make().call('preferences.get'),{...appearance,sidebarWidth});}
 for(const sidebarWidth of [199,401,250.5,'250',NaN,Infinity,null])await assert.rejects(broker.call('preferences.save',{userId:owner,preferences:{...appearance,sidebarWidth}}),/200 to 400/);
 await assert.rejects(broker.call('preferences.save',{userId:other,preferences:{...appearance,sidebarWidth:250}}),/another account/);
 assert.deepEqual(await make().call('preferences.get'),{...appearance,sidebarWidth:400});assert.equal(values.size,1);
});
