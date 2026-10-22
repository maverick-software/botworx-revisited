const test=require('node:test'),assert=require('node:assert/strict');
const{applyNativeEvent}=require('../build/native-events.js');
const{CodexHarness}=require('../build/codex-harness.js');
const state=()=>({version:'0.163.0',threadId:'parent',turnId:'turn',items:[],approvals:[],steering:[]});
const change=(diff='@@ -1 +1 @@\n-old\n+new\n')=>({path:'C:/workspace/notes.md',kind:{type:'update',move_path:null},diff});
const event=(extra={})=>({threadId:'parent',turnId:'turn',itemId:'patch',...extra});

test('streamed native patches remain available before item start and completion stays authoritative',()=>{
 const s=state(),changes=[change()];applyNativeEvent(s,'item/fileChange/patchUpdated',event({changes}));assert.equal(s.items.length,1);assert.equal(s.items[0].completed,false);
 changes[0].diff='mutated transport frame';assert(s.items[0].item.changes[0].diff.includes('-old'));
 applyNativeEvent(s,'item/started',event({item:{type:'fileChange',id:'patch',changes:[],status:'inProgress'}}));assert(s.items[0].item.changes[0].diff.includes('+new'));
 applyNativeEvent(s,'item/completed',event({item:{type:'fileChange',id:'patch',changes:[change('final diff')],status:'completed'}}));
 applyNativeEvent(s,'item/fileChange/patchUpdated',event({changes:[change('late partial')]}));applyNativeEvent(s,'item/started',event({item:{type:'fileChange',id:'patch',changes:[],status:'inProgress'}}));
 assert.equal(s.items.length,1);assert.equal(s.items[0].completed,true);assert.equal(s.items[0].item.changes[0].diff,'final diff');
});
test('native item identity includes child thread and turn so reused IDs cannot overwrite earlier patches',()=>{
 const s=state();for(const [threadId,turnId,value]of[['parent','turn','main'],['child','turn','child'],['child','later','follow-up']])applyNativeEvent(s,'item/fileChange/patchUpdated',event({threadId,turnId,changes:[change(value)]}));
 assert.deepEqual(s.items.map(row=>row.item.changes[0].diff),['main','child','follow-up']);applyNativeEvent(s,'item/fileChange/patchUpdated',event({threadId:'child',turnId:'later',changes:[change('latest')]}));assert.deepEqual(s.items.map(row=>row.item.changes[0].diff),['main','child','latest']);
});
test('turn diffs replace their own aggregate, retain other turns and explicitly mark bounded previews',()=>{
 const s=state();applyNativeEvent(s,'turn/diff/updated',event({diff:'first'}));applyNativeEvent(s,'turn/diff/updated',event({diff:'second'}));applyNativeEvent(s,'turn/diff/updated',event({threadId:'child',diff:'child'}));applyNativeEvent(s,'turn/diff/updated',event({turnId:'later',diff:'x'.repeat(1000001)}));
 assert.equal(s.diffs.length,3);assert.equal(s.diffs[0].diff,'second');assert.equal(s.diffs[1].diff,'child');assert.equal(s.diffs[2].diff.length,1000000);assert.equal(s.diffs[2].truncated,true);
});
test('native deltas do not alter completed or different-turn items and private reasoning stays excluded',()=>{
 const s=state();applyNativeEvent(s,'item/started',event({item:{type:'agentMessage',id:'answer',text:'',phase:'final_answer'}}));applyNativeEvent(s,'item/agentMessage/delta',event({itemId:'answer',delta:'real'}));applyNativeEvent(s,'item/agentMessage/delta',event({turnId:'other',itemId:'answer',delta:'wrong turn'}));
 applyNativeEvent(s,'item/completed',event({item:{type:'agentMessage',id:'answer',text:'final',phase:'final_answer'}}));applyNativeEvent(s,'item/agentMessage/delta',event({itemId:'answer',delta:'late duplicate'}));assert.equal(s.items[0].item.text,'final');
 applyNativeEvent(s,'item/completed',event({item:{type:'reasoning',id:'reason',content:['private'],summary:['private']}}));assert.deepEqual(s.items[1].item.content,[]);assert.deepEqual(s.items[1].item.summary,[]);
});
test('real harness dispatch publishes patch and aggregate updates for main, child and report state',()=>{
 const harness=new CodexHarness({}, {},'unused','unused',()=>{},async()=>{}),published=[];harness.publish=r=>published.push(structuredClone(r.state));harness.settle=()=>{};
 const root={state:state(),ended:false},child={view:{state:state(),turnId:'turn',status:'running'},root},worker={current:root,children:new Map([['child',child]])};
 harness.dispatch(worker,'turn/diff/updated',event({diff:'main aggregate'}));harness.dispatch(worker,'item/fileChange/patchUpdated',event({threadId:'child',changes:[change()]}));harness.dispatch(worker,'turn/diff/updated',event({threadId:'child',diff:'child aggregate'}));
 assert.equal(root.state.diffs.length,2);assert.equal(child.view.state.diffs[0].diff,'child aggregate');assert.equal(root.state.items[0].threadId,'child');assert.equal(published.length,3);
 worker.current=undefined;worker.report={state:state(),ended:false};harness.dispatch(worker,'turn/diff/updated',event({diff:'report aggregate'}));assert.equal(worker.report.state.diffs[0].diff,'report aggregate');assert.equal(published.length,4);
});
