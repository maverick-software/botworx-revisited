const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),{randomUUID}=require('node:crypto');
const build=process.env.AGENTOPIA_INSPECTION_BUILD??path.resolve(__dirname,'../build');
const {ChatInspection}=require(path.join(build,'chat-inspection.js')),{allowsAgentTool}=require(path.join(build,'agent-policy.js')),{defaultAgentPolicy}=require(path.join(build,'agent-contracts.js'));
const {ProjectMemory}=require(path.join(build,'project-memory.js'));
const user=randomUUID(),request={id:randomUUID(),conversation_id:randomUUID(),project:{id:randomUUID(),memory_enabled:false}},chat=randomUUID(),message=randomUUID();
const options={permission:'ask',mode:'chat',files:[],thinking:'default'};
function fixture(handler){const calls=[];return {calls,service:new ChatInspection({rpc:async(name,args)=>{calls.push({name,args});return {data:await handler(name,args)};}})};}
const summary={conversation_id:chat,title:'Saved decision',status:'completed'};

test('inspection is available in Default and Full, including plan mode, and respects agent memory/tool policy',()=>{
 const service=new ChatInspection({});
 for(const permission of ['chat','files'])assert.deepEqual(service.definitions({...options,permission}),[]);
 for(const permission of ['ask','full'])assert.deepEqual(service.definitions({...options,permission,mode:'plan'}).map(t=>t.name),['list_chats','read_chat']);
 for(const name of ['list_chats','read_chat']){
  assert(allowsAgentTool(defaultAgentPolicy,{name,namespace:'tools'}));
  assert.equal(allowsAgentTool({...defaultAgentPolicy,memory:false},{name,namespace:'tools'}),false);
  assert.equal(allowsAgentTool({...defaultAgentPolicy,tools:['read_file']},{name,namespace:'tools'}),false);
 }
});

test('list uses trusted account/request/project/native scope and rechecks each result before returning',async()=>{
 const f=fixture(name=>name==='desktop_inspect_chats'?{chats:[summary],total:1,next_offset:null}:null);let guards=0;
 const result=await f.service.execute(user,request,'list_chats',{query:'decision',limit:4,offset:0},options,async()=>{guards++},'owned-child');
 assert.equal(result.chats[0].conversation_id,chat);assert(result.untrusted&&result.readOnly);assert.equal(guards,2);
 assert.deepEqual(f.calls.map(c=>c.name),['desktop_inspect_chats','desktop_validate_chat_inspection']);
 assert.deepEqual(f.calls[0].args,{p_user:user,p_request:request.id,p_project:request.project.id,p_thread:'owned-child',p_query:'decision',p_limit:4,p_offset:0});
 assert.deepEqual(f.calls[1].args.p_chats,[chat]);
 await assert.rejects(f.service.execute(user,request,'list_chats',{p_user:randomUUID()},options,async()=>{}),/schema/);
 assert.equal(f.calls.length,2);
});

test('read applies a total Unicode character budget and resumes inside the exact source message',async()=>{
 const texts=['A😀B𐐀C','Second message'],ids=[message,randomUUID()];
 const f=fixture((name,args)=>{
  if(name!=='desktop_inspect_chat')return null;
  return {chat:summary,total_messages:2,offset:args.p_offset,activities:[],messages:texts.slice(args.p_offset,args.p_offset+args.p_limit).map((text,i)=>({id:ids[args.p_offset+i],role:'assistant',text:Array.from(text).slice(i===0?args.p_message_offset:0,(i===0?args.p_message_offset:0)+args.p_characters).join(''),text_length:Array.from(text).length,character_offset:i===0?Math.min(args.p_message_offset,Array.from(text).length):0}))};
 });
 let cursor={offset:0,message_offset:0},reconstructed=['',''],pages=0;
 do{const page=await f.service.execute(user,request,'read_chat',{conversation_id:chat,...cursor,limit:2,characters:3},options,async()=>{});assert(page.messages.reduce((n,m)=>n+Array.from(m.text).length,0)<=3);for(const m of page.messages){reconstructed[ids.indexOf(m.id)]+=m.text;assert.equal(m.citation,'agentopia-chat://'+chat+'/message/'+m.id);assert(!/[\uD800-\uDBFF]$/.test(m.text));}cursor=page.next;pages++;assert(pages<20);}while(cursor);
 assert.deepEqual(reconstructed,texts);assert.equal(pages,7);
});

test('read handles empty messages, exhausted cursors and end-of-page boundaries without repeating text',async()=>{
 const empty=randomUUID(),f=fixture(name=>name==='desktop_inspect_chat'?{chat:summary,total_messages:2,messages:[{id:empty,text:'',character_offset:0,text_length:0},{id:message,text:'abc',character_offset:0,text_length:3}],activities:[]}:null);
 const result=await f.service.execute(user,request,'read_chat',{conversation_id:chat,characters:3},options,async()=>{});assert.equal(result.messages.length,2);assert.equal(result.next,null);
});

test('all offsets and limits reject invalid model arguments before storage access',async()=>{
 const f=fixture(()=>{throw Error('Unexpected RPC');});
 for(const args of [{limit:0},{limit:51},{offset:-1},{offset:2**31},{query:'x'.repeat(201)},{query:'a\0b'}])await assert.rejects(f.service.execute(user,request,'list_chats',args,options,async()=>{}));
 for(const args of [{conversation_id:chat,limit:13},{conversation_id:chat,message_offset:1.5},{conversation_id:chat,characters:12001},{conversation_id:'invalid'},{conversation_id:request.conversation_id}])await assert.rejects(f.service.execute(user,request,'read_chat',args,options,async()=>{}));
 assert.equal(f.calls.length,0);
});

test('a source revoked during a read never reaches the caller',async()=>{
 const f=fixture(name=>{if(name==='desktop_validate_chat_inspection')throw Error('This chat is unavailable in the current scope');return {chats:[summary]};});
 await assert.rejects(f.service.execute(user,request,'list_chats',{},options,async()=>{}),/unavailable/);
 let guardCalls=0;const g=fixture(name=>name==='desktop_inspect_chats'?{chats:[summary]}:null);
 await assert.rejects(g.service.execute(user,request,'list_chats',{},options,async()=>{if(++guardCalls===2)throw Error('Account changed');}),/Account changed/);
});

test('saved receipts are revalidated by the exact native thread on each later inference',async()=>{
 const f=fixture(()=>null);await f.service.validate(user,request,options,'native-branch');
 assert.deepEqual(f.calls,[{name:'desktop_validate_chat_inspection_receipts',args:{p_user:user,p_request:request.id,p_project:request.project.id,p_thread:'native-branch'}}]);
 await f.service.validate(user,request,{...options,permission:'chat'});assert.equal(f.calls.length,1);
});

test('credential-like text is redacted in chat text, titles and activity labels',async()=>{
 const f=fixture(name=>name==='desktop_inspect_chat'?{chat:{...summary,title:'token=private-token-value'},total_messages:1,messages:[{id:message,text:'password=fixture-private-value',text_length:30,character_offset:0}],activities:[{label:'https://example.com/?api_key=fixture-private-key',name:'example',status:'completed'}]}:null);
 const result=await f.service.execute(user,request,'read_chat',{conversation_id:chat},options,async()=>{}),serialized=JSON.stringify(result);
 assert(!serialized.includes('fixture-private-value'));assert(!serialized.includes('fixture-private-key'));
});

test('automatic project recall validates the native child scope while legacy root calls keep their original signature',async()=>{
 const calls=[],memory=new ProjectMemory({rpc:async(name,args)=>{calls.push({name,args});return {data:name.includes('access')?request.project.id: name==='desktop_search_project_chats_all'?[]:true};}}),remembering={...request,project:{...request.project,memory_enabled:true}};
 await memory.execute(user,remembering,'search_project_chats',{query:'saved decision',limit:4},options,async()=>{},'live-child');
 assert.deepEqual(calls.map(c=>c.name),['desktop_project_memory_scope_access','desktop_search_project_chats_all','desktop_validate_project_memory_scope']);
 assert.equal(calls[0].args.p_thread,'live-child');assert.equal(calls[2].args.p_thread,'live-child');
 assert.equal(calls[2].args.p_active,true);
 calls.length=0;await memory.validate(user,remembering,[],options);assert.equal(calls[0].name,'desktop_validate_project_memory');assert(!('p_thread' in calls[0].args));
 calls.length=0;await memory.validate(user,remembering,[],options,undefined,true);assert.equal(calls[0].name,'desktop_validate_project_memory_scope');assert.equal(calls[0].args.p_active,false);assert.equal(calls[0].args.p_thread,null);
});

test('restoring a child stages saved-context validation and requires active scope for actual inference',async()=>{
 const {Broker}=require(path.join(build,'broker.js')),broker=Object.create(Broker.prototype),calls=[];
 const memory={definitions:()=>[],snapshot:async()=>{throw Error('Restore must use its saved recall');},validate:async(...args)=>{calls.push({thread:args[4],preparing:args[5]});if(!args[4]&&!args[5])throw Error('Completed parent requires staged restore validation');}};
 const query={select(){return this;},eq(){return this;},single:async()=>({data:{id:randomUUID()}})};
 Object.assign(broker,{loadMessages:async()=>[],identity:async()=>({id:user,admin:false}),admin:{from:()=>query},files:{list:()=>[]},terminal:{definitions:()=>[],permissions:()=>({enabled:false})},tools:{computerDefinitions:()=>[],browserDefinitions:()=>[],pluginDefinitions:async()=>[],imageDefinitions:async()=>[],remote:{plan:async()=>({definitions:[]})},planning:{definitions:async()=>[]},memory,chats:{definitions:()=>[],validate:async()=>{}}},native:{run:async(...args)=>{assert.equal(args[12],true);await args[11]();await args[11]('live-child');}}});
 await broker.executeNative({id:user},{...request,recalledMemory:[]},{id:randomUUID()},{model:'fixture'},'openai-oauth','unused',new AbortController(),options,true);
 assert.deepEqual(calls,[{thread:undefined,preparing:true},{thread:undefined,preparing:true},{thread:'live-child',preparing:false}]);
});
