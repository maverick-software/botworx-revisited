const test=require('node:test'),assert=require('node:assert/strict');
const {newChatProvider,needsNewChatDefaults}=require('../build/new-chat-defaults.js');
const {defaultChatOptions}=require('../build/contracts.js');
const {Providers}=require('../build/providers.js');
const {Broker}=require('../build/broker.js');
const both={openrouter:true,defaultModel:'vendor/default',chatgpt:{authorized:true}};
test('new chats prefer authorized ChatGPT by default and honor opting out only when another selected connection is available',()=>{
 for(const flag of [undefined,true])assert.equal(newChatProvider({...both,preferChatGPT:flag},'openrouter'),'openai-oauth');
 assert.equal(newChatProvider({...both,preferChatGPT:false},'openrouter'),'openrouter');
 assert.equal(newChatProvider({...both,preferChatGPT:false}),'openrouter');
 assert.equal(newChatProvider({...both,preferChatGPT:false},'openai-oauth'),'openai-oauth');
 assert.equal(newChatProvider({...both,openrouter:false,preferChatGPT:false},'openrouter'),'openai-oauth');
 assert.equal(newChatProvider({...both,chatgpt:{authorized:false}},'openai-oauth'),'openrouter');
 assert.equal(newChatProvider({...both,chatgpt:null}),'openrouter');
 assert.equal(newChatProvider({openrouter:false,chatgpt:{authorized:true}}),'openai-oauth');
 assert.equal(newChatProvider({openrouter:false,chatgpt:null},'openai-oauth'),'openai-oauth');
});
test('ChatGPT preference persists separately for each local account and rejects malformed values',async()=>{
 const values=new Map(),secrets={get:key=>values.get(key),set:async(key,value)=>values.set(key,value)},providers=new Providers(secrets,'fixture');
 assert.equal(providers.status('owner').preferChatGPT,true);await providers.preferChatGPT('owner',false);assert.equal(new Providers(secrets,'fixture').status('owner').preferChatGPT,false);assert.equal(providers.status('other').preferChatGPT,true);
 await assert.rejects(providers.preferChatGPT('owner','false'),/Choose whether/);assert.equal(providers.status('owner').preferChatGPT,false);await providers.preferChatGPT('owner',true);assert.equal(providers.status('owner').preferChatGPT,true);
});
test('empty new drafts receive current defaults while existing conversations, text and attachments retain their chosen connection',()=>{
 const empty={text:'',options:{...defaultChatOptions,provider:'openrouter',model:'vendor/paid'}};
 assert(needsNewChatDefaults('new:agent:home',null));assert(needsNewChatDefaults('new:agent:home',empty));
 assert(!needsNewChatDefaults('conversation:saved',empty));assert(!needsNewChatDefaults('child:request:thread',empty));assert(!needsNewChatDefaults('new:agent:home',{...empty,text:'Unsent work'}));
 for(const field of ['files','windows','skills'])assert(!needsNewChatDefaults('new:agent:home',{...empty,options:{...empty.options,[field]:['selected']}}));
});
test('default model resolution uses only the selected connection and never spends through OpenRouter after a ChatGPT catalog failure',async()=>{
 const options={...defaultChatOptions,provider:'openrouter',model:'openai/gpt-6.1-sol',thinking:'high',harness:'codex'},calls=[],fixture={providers:{status:()=>both},catalog:async provider=>{calls.push(provider);return [{id:'gpt-6.1-sol',thinking:['low','high']}];},effectiveOptions:(_user,value)=>value};
 const resolved=await Broker.prototype.newOptions.call(fixture,{id:'owner'},options);assert.equal(resolved.provider,'openai-oauth');assert.equal(resolved.model,'gpt-6.1-sol');assert.equal(resolved.thinking,'high');assert.deepEqual(calls,['openai-oauth']);assert.equal(options.provider,'openrouter');
 fixture.catalog=async provider=>{calls.push(provider);throw Error('Offline');};const offline=await Broker.prototype.newOptions.call(fixture,{id:'owner'},options);assert.equal(offline.provider,'openai-oauth');assert.equal(offline.model,undefined);assert.equal(offline.thinking,'default');assert(calls.every(provider=>provider==='openai-oauth'));
 fixture.catalog=async()=>[];assert.equal((await Broker.prototype.newOptions.call(fixture,{id:'owner'},options)).model,undefined);
 fixture.providers.status=()=>({...both,preferChatGPT:false});fixture.catalog=async provider=>{assert.equal(provider,'openrouter');return [{id:'openai/gpt-6.1-sol',thinking:['high']}];};assert.equal((await Broker.prototype.newOptions.call(fixture,{id:'owner'},options)).provider,'openrouter');
});

test('a recorded ChatGPT authorization failure retains its preferred selection without loading either provider catalog',async()=>{
 const issue={kind:'reauthorize',code:'invalid_grant',message:'Continue with ChatGPT',at:new Date().toISOString()},status={...both,chatgpt:{authorized:false,connectionIssue:issue},selections:{'openai-oauth':{model:'gpt-6.1-sol',thinking:'high'}}};
 assert.equal(newChatProvider(status,'openrouter'),'openai-oauth');assert.equal(newChatProvider({...status,preferChatGPT:false},'openrouter'),'openrouter');
 const fixture={providers:{status:()=>status},catalog:async()=>{throw Error('No catalog request should be made before reconnection.');},effectiveOptions:(_user,value)=>value};
 const options={...defaultChatOptions,provider:'openrouter',model:'openai/gpt-6.1-sol'};
 const resolved=await Broker.prototype.newOptions.call(fixture,{id:'owner'},options);assert.equal(resolved.provider,'openai-oauth');assert.equal(resolved.model,'gpt-6.1-sol');assert.equal(resolved.thinking,'high');assert.equal(options.provider,'openrouter');
});
