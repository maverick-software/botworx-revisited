const {test}=require('node:test');
const assert=require('node:assert/strict');
const {nativeActivityReceipt:receipt,nativeActivityStatus:status}=require(process.env.AGENTOPIA_NATIVE_ACTIVITY_HELPER??'../build/native-activity-presentation.js');
const entry=(threadId='root',turnId='turn')=>({threadId,turnId,completed:false,item:{id:'call',type:'mcpToolCall',server:'agentopia_host',tool:'browser_open',status:'inProgress',result:null,error:null}});
const tool=(patch={})=>({id:'receipt',request_id:'request',native_thread_id:'root',name:'browser_open',status:'interrupted',arguments:{provider_call_id:'root:call'},error:'Tool execution was cancelled.',...patch});

test('saved cancellation supplies the exact host outcome without changing native history',()=>{
 const item=entry(),saved=structuredClone(item),activity=tool(),resolved=receipt(item,[item],[activity],'request');
 assert.equal(resolved,activity);assert.equal(status(item,true,resolved),'Interrupted');assert.deepEqual(item,saved);
});
test('a receipt cannot cross request, native thread, tool name, or call identity',()=>{
 const item=entry();for(const patch of [{request_id:'other'},{native_thread_id:'child'},{name:'browser_close'},{arguments:{provider_call_id:'root:other'}},{native_call_id:'root:other'},{arguments:{}}])assert.equal(receipt(item,[item],[tool(patch)],'request'),undefined);
 assert.equal(receipt(item,[item],[tool()],'other'),undefined);assert.equal(receipt({...item,item:{...item.item,server:'another_server'}},[item],[tool()],'request'),undefined);
});
test('reused native IDs across turns or duplicate receipts stay unresolved',()=>{
 const item=entry();assert.equal(receipt(item,[item,entry('root','later')],[tool()],'request'),undefined);
 assert.equal(receipt(item,[item],[tool(),tool({id:'second'})],'request'),undefined);
});
test('both live and stored host call identifiers are accepted only when consistent',()=>{
 const item=entry();assert.equal(receipt(item,[item],[tool({native_call_id:'root:call',arguments:{}})],'request')?.status,'interrupted');
 assert.equal(receipt(item,[item],[tool({native_call_id:'root:call'})],'request')?.status,'interrupted');
 assert.equal(receipt(item,[item],[tool({native_call_id:'root:call',arguments:{provider_call_id:'root:other'}})],'request'),undefined);
});
test('native completion keeps its actual outcome even when a host receipt differs',()=>{
 const item=entry();item.completed=true;item.item.status='completed';assert.equal(status(item,true,tool({status:'failed'})),'Completed');
 item.item.status='failed';assert.equal(status(item,true,tool({status:'completed'})),'Failed');
});
test('unmatched historical calls differ from active work without inventing cancellation',()=>{
 const item=entry();assert.equal(status(item,true),'No completion recorded');assert.equal(status(item,false),'Working');
 for(const [value,label] of [['denied','Declined'],['failed','Failed'],['completed','Completed'],['awaiting_approval','Needs your approval']])assert.equal(status(item,true,tool({status:value})),label);
 assert.equal(status(item,true,tool({status:'running'})),'No completion recorded');
});
test('native background command ownership labels survive a completed parent and explicit stop',()=>{
 const command={threadId:'root',turnId:'turn',completed:false,background:'running',item:{id:'server',type:'commandExecution',status:'inProgress'}};
 assert.equal(status(command,true),'Running in background');command.background='exited';assert.equal(status(command,true),'Exited');
 command.background='stopped';command.item.status='failed';assert.equal(status(command,true),'Stopped');command.background='interrupted';assert.equal(status(command,true),'Session ended');
});
