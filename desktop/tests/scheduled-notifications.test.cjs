const {test}=require('node:test');
const assert=require('node:assert/strict');
const {ScheduledNotifications}=require('../build/scheduled-notifications');
const {taskSnapshot}=require('../build/scheduled-task-store');
function fixture(){let owner='one',runs=[];const saved=new Map(),shown=[];
 const store={get:key=>saved.has(key)?structuredClone(saved.get(key)):undefined,set:async(key,value)=>{saved.set(key,structuredClone(value));}};
 const host={owner:()=>owner,runs:async()=>structuredClone(runs),show:(name,status)=>shown.push({name,status})};
 return {store,host,shown,setOwner:value=>owner=value,setRuns:value=>runs=value,monitor:()=>new ScheduledNotifications(store,host)};
}
const run=(id,status,notifications='important',owner='one')=>({id,owner,status,snapshot:{name:id,notifications}});
test('important notifications report failed or held runs, all adds completed results and off stays quiet',async()=>{
 const f=fixture(),m=f.monitor();await m.changed('one');
 f.setRuns([run('important','completed'),run('all','completed','all'),run('failure','failed'),run('held','held'),run('off','failed','off')]);await m.changed('one');
 assert.deepEqual(f.shown,[{name:'all',status:'completed'},{name:'failure',status:'failed'},{name:'held',status:'held'}]);await m.changed('one');assert.equal(f.shown.length,3);
});
test('history and restart seed existing results without replaying their alerts',async()=>{
 const f=fixture();f.setRuns([run('old','completed','all')]);const m=f.monitor();await m.changed('one');assert.equal(f.shown.length,0);
 f.setRuns([run('old','completed','all'),run('new','completed','all')]);await Promise.all([m.changed('one'),m.changed('one')]);assert.equal(f.shown.length,1);
 await f.monitor().changed('one');assert.equal(f.shown.length,1);assert.deepEqual(f.store.get('scheduled-notifications:one'),{old:'completed',new:'completed'});
});
test('notification reads, receipts and display remain scoped to the signed-in owner',async()=>{
 const f=fixture(),m=f.monitor();await m.changed('one');f.setRuns([run('foreign','failed','all','two')]);await m.changed('one');assert.deepEqual(f.store.get('scheduled-notifications:one'),{});
 f.setOwner('two');await m.changed('one');assert.equal(f.shown.length,0);await m.changed('two');assert.equal(f.shown.length,0);
 f.setRuns([run('next','failed','important','two')]);await m.changed('two');assert.deepEqual(f.shown,[{name:'next',status:'failed'}]);
});
test('changing accounts while notification receipts save does not display the previous account result',async()=>{
 const f=fixture(),m=f.monitor();await m.changed('one');f.setRuns([run('private','failed')]);const original=f.store.set;f.store.set=async(...args)=>{await original(...args);f.setOwner('two');};await m.changed('one');assert.equal(f.shown.length,0);
});
test('account task notifications override per-task alerts without replaying muted results',async()=>{const f=fixture();let enabled=false;f.host.enabled=()=>enabled;const m=f.monitor();await m.changed('one');f.setRuns([run('muted','failed')]);await m.changed('one');enabled=true;await m.changed('one');assert.equal(f.shown.length,0);f.setRuns([run('muted','failed'),{...run('new','completed','all'),conversationId:'related-chat'}]);const shown=[];f.host.show=(...args)=>shown.push(args);await m.changed('one');assert.deepEqual(shown,[['new','completed','related-chat','one']]);});
test('switching accounts after the first alert prevents another previous-account alert',async()=>{const f=fixture(),m=f.monitor();await m.changed('one');f.setRuns([run('first','failed'),run('second','failed')]);f.host.show=(...args)=>{f.shown.push(args);f.setOwner('two');};await m.changed('one');assert.equal(f.shown.length,1);});
