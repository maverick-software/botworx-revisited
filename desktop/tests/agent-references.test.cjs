const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const build=process.env.AGENTOPIA_AGENT_TEST_BUILD??path.resolve(__dirname,'../build'),{AgentService}=require(path.join(build,'agent-service.js'));
test('tool-read revisions override an earlier automatic memory snapshot and survive independent child request wrappers',async()=>{
 const calls=[],service=new AgentService({rpc:async(name,args)=>{calls.push({name,args});return {data:true};}}),request={agent_memory:{memories:[{id:'note',revision:1}],instances:[{id:'own-instance'}]},agent_references:{memories:[],instances:[]}};
 service.references({...request,native_scope_id:'native:child'},[{id:'note',revision:2}],['specialist-instance']);
 await service.validateReferences('owner',request,'speaker','project');assert.equal(calls[0].name,'desktop_validate_agent_references');assert.deepEqual(calls[0].args.p_memories,[{id:'note',revision:2}]);assert.deepEqual(calls[0].args.p_instances,['own-instance','specialist-instance']);
 assert.deepEqual(JSON.parse(JSON.stringify(request.agent_references)),{memories:[{id:'note',revision:2}],instances:['specialist-instance']});
});
test('a changed or isolated tool-read source blocks later inference validation and reference accumulation stays bounded',async()=>{
 const service=new AgentService({rpc:async()=>({error:{message:'An agent reference was corrected, forgotten or isolated'}})}),request={agent_references:{memories:[],instances:[]}};service.references(request,[{id:'note',revision:1}]);
 await assert.rejects(service.validateReferences('owner',request,'speaker',null),/corrected, forgotten or isolated/);
 assert.throws(()=>service.references(request,Array.from({length:501},(_,id)=>({id:String(id),revision:1}))),/saved-reference limit/);
 assert.deepEqual(request.agent_references.memories,[{id:'note',revision:1}]);
});
test('memory writes recheck revocation after source lookup and do not commit after cancellation',async()=>{
 const {defaultAgentPolicy}=require(path.join(build,'agent-contracts.js'));for(const cancelled of [false,true]){let mutations=0;const controller=new AbortController(),query={select(){return query},eq(){return query},maybeSingle:async()=>({data:{id:'source'}})},service=new AgentService({from:()=>query,rpc:async()=>{mutations++;return {data:{id:'saved',revision:1}};}});service.context=async()=>({instance:{agent_id:'speaker',project_id:null,conversation_id:'chat'},profile:{policy:defaultAgentPolicy}});service.validate=async()=>{if(cancelled){controller.abort();return;}throw Error('The agent definition changed');};
 await assert.rejects(service.execute('owner',{id:'request',user_message_id:'source'},'save_agent_memory',{id:null,revision:null,title:'Decision',content:'An approved decision',source_message_id:null},{permission:'files',mode:'chat',files:[]},'call',controller.signal),cancelled?/abort/i:/definition changed/);assert.equal(mutations,0);
 }
});
