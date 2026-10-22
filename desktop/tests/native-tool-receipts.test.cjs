const {test}=require('node:test'),assert=require('node:assert/strict');
const {ToolService}=require(process.env.AGENTOPIA_TOOL_RECEIPT_SERVICE??'../build/tool-service.js');
const {nativeActivityReceipt}=require(process.env.AGENTOPIA_NATIVE_ACTIVITY_HELPER??'../build/native-activity-presentation.js');
function fixture(provider){
 const rows=[],events=[],user={id:'owner',admin:true},request={id:'request',conversation_id:'conversation',assistant_message_id:'answer'},options={provider,model:'controlled',harness:'codex',permission:'ask',mode:'chat',files:[]};let runs=0;
 const db={from(table){assert.equal(table,'desktop_tool_calls');let filters=[],inserted,patch;const matches=row=>filters.every(([key,value])=>row[key]===value);const q={select(){return q},eq(key,value){filters.push([key,value]);return q},order(){return q},insert(row){inserted=structuredClone(row);rows.push(inserted);return q},update(value){patch=structuredClone(value);return q},async maybeSingle(){return {data:structuredClone(rows.find(matches)??null)}},async single(){const row=inserted??rows.find(matches);if(patch)Object.assign(row,patch);return {data:structuredClone(row)}},then(resolve,reject){const found=rows.filter(matches);if(patch)found.forEach(row=>Object.assign(row,patch));return Promise.resolve({data:structuredClone(found)}).then(resolve,reject)}};return q}};
 const definitions=[{name:'mcp_search',namespace:'tools',parameters:{properties:{query:{type:'string'}}}},{name:'mcp_call',namespace:'tools',parameters:{properties:{connection_id:{type:'string'},tool_name:{type:'string'},arguments_json:{type:'string'}}}}],plan={definitions,denied:new Set()},remote={discover:async()=>({tools:[],total:0}),prepare:async()=>({key:'fixture',approval:{source:'Fixture',tool:'lookup',description:'Controlled operation',arguments:{query:'Generated public query'}},run:async()=>{runs++;return {content:[{type:'text',text:'Confirmed fixture result'}],isError:false}}})};
 const make=()=>{const service=new ToolService(db,{},(_owner,event)=>events.push(structuredClone(event)),async()=>user,remote);service.planning.definitions=async()=>[];service.memory.definitions=()=>[];service.chats.definitions=()=>[];return service};
 const service=make(),execute=(name,id,thread='root',args=name==='mcp_search'?{query:'schema'}:{connection_id:'connection',tool_name:'lookup',arguments_json:'{"query":"Generated public query"}'})=>service.execute(user,request,{name,namespace:'tools',id:thread+':'+id,arguments:JSON.stringify(args)},options,new AbortController().signal,plan,'agent',thread);
 return {rows,events,user,service,execute,make,runs:()=>runs};
}
for(const provider of ['openai-oauth','openrouter'])test(provider+' saves distinct native discovery identities and resolves them after a service reload',async()=>{
 const f=fixture(provider);await f.execute('mcp_search','first');await f.execute('mcp_search','second');await f.execute('mcp_search','first','child');
 const saved=await f.make().list('owner','conversation');assert.equal(saved.length,3);
 for(const [thread,id] of [['root','first'],['root','second'],['child','first']]){
  const entry={threadId:thread,turnId:'turn',completed:true,item:{id,type:'mcpToolCall',server:'agentopia_host',tool:'mcp_search',status:'completed'}};
  const resolved=nativeActivityReceipt(entry,[entry],saved,'request');assert(resolved);assert.equal(resolved.arguments.provider_call_id,thread+':'+id);assert.equal(resolved.native_thread_id,thread);assert.equal(resolved.status,'completed');
 }
 assert.equal(f.runs(),0);
});
test('reviewed MCP calls retain native linkage and redacted saved arguments while preserving their result',async()=>{
 const f=fixture('openai-oauth'),work=f.execute('mcp_call','lookup');
 for(let n=0;n<100&&!f.rows.some(r=>r.status==='awaiting_approval');n++)await new Promise(setImmediate);
 const row=f.rows.find(r=>r.status==='awaiting_approval');assert(row);assert.equal(f.runs(),0);await f.service.decide(f.user.id,row.id,true);await work;
 const saved=(await f.make().list('owner','conversation'))[0];assert.equal(saved.arguments.provider_call_id,'root:lookup');assert.equal(saved.arguments.arguments_json,undefined);assert.equal(saved.arguments.connection_id,'connection');assert.equal(saved.status,'completed');assert.equal(saved.result.content[0].text,'Confirmed fixture result');assert.equal(f.runs(),1);
});
test('a model cannot submit the host-owned receipt identifier through tool arguments',async()=>{
 const f=fixture('openai-oauth'),result=await f.execute('mcp_search','spoof','root',{query:'schema',provider_call_id:'other:call'});assert.match(result.error,/schema/);assert.equal(f.rows.length,0);assert.equal(f.runs(),0);
});
