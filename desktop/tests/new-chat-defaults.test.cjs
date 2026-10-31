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
test('new defaults select a backend service level without loading or exposing a model catalog',async()=>{
 const options={...defaultChatOptions,provider:'openrouter',model:'old/vendor-model',thinking:'high',harness:'codex'},fixture={providers:{account:{status:()=>({linked:false})},status:()=>both},catalog:async()=>{throw Error('The composer must not load an underlying model catalog');},effectiveOptions:(_user,value)=>value};
 const resolved=await Broker.prototype.newOptions.call(fixture,{id:'owner'},options);assert.equal(resolved.provider,'openai-oauth');assert.equal(resolved.model,'standard');assert.equal(resolved.thinking,'default');assert.equal(options.model,'old/vendor-model');
 assert.equal((await Broker.prototype.newOptions.call(fixture,{id:'owner'},{...options,model:'advanced'})).model,'advanced');
 fixture.providers.status=()=>({...both,preferChatGPT:false});assert.equal((await Broker.prototype.newOptions.call(fixture,{id:'owner'},options)).provider,'openrouter');
});
test('Legal Compliance always chooses Sylvana even when a direct connection is preferred',()=>{
 assert.equal(newChatProvider({...both,legalMode:true,preferredProvider:'openai-oauth'},'openrouter'),'sylvana');
 assert.equal(newChatProvider({...both,sylvana:{linked:true},preferredProvider:'sylvana'}),'sylvana');
});
test('a recorded ChatGPT authorization failure retains its connection and service level for reconnection',async()=>{
 const status={...both,chatgpt:{authorized:false,connectionIssue:{kind:'reauthorize'}}},fixture={providers:{account:{status:()=>({linked:false})},status:()=>status},effectiveOptions:(_user,value)=>value};
 const resolved=await Broker.prototype.newOptions.call(fixture,{id:'owner'},{...defaultChatOptions,provider:'openrouter',model:'advanced'});assert.equal(resolved.provider,'openai-oauth');assert.equal(resolved.model,'advanced');
});
