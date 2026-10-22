const test=require('node:test'),assert=require('node:assert/strict'),{randomUUID}=require('node:crypto');
const {Broker}=require('../build/broker.js');
function fixture(){const owner=randomUUID(),requestId=randomUUID(),threadId=randomUUID(),calls=[],broker=Object.create(Broker.prototype);Object.assign(broker,{workspaceMonitor:{generation:0},identity:async()=>({id:owner,admin:true}),nativeControls:0,backingUp:false,native:{backgrounds:async(...args)=>{calls.push(['list',...args]);return [];},stopBackground:async(...args)=>{calls.push(['stop',...args]);return {terminated:true};}}});return {broker,owner,requestId,threadId,calls};}
test('background command bridge derives ownership from the signed-in account and retains the full command identity',async()=>{
 const f=fixture(),args={owner:'forged-owner',requestId:f.requestId,threadId:f.threadId,itemId:'opaque-item',processId:'native:opaque-process'};
 assert.deepEqual(await f.broker.call('native.background.list',args),[]);assert.deepEqual(await f.broker.call('native.background.stop',args),{terminated:true});assert.deepEqual(f.calls,[['list',f.owner,f.requestId,f.threadId],['stop',f.owner,f.requestId,f.threadId,'opaque-item','native:opaque-process']]);assert.equal(f.broker.nativeControls,0);
});
test('invalid native background identities and backup interleaving fail before native control',async()=>{
 const f=fixture(),args={requestId:f.requestId,threadId:f.threadId,itemId:'item',processId:'process'};
 await assert.rejects(f.broker.call('native.background.stop',{...args,threadId:'invalid'}));await assert.rejects(f.broker.call('native.background.stop',{...args,processId:'x'.repeat(501)}));assert.equal(f.calls.length,0);assert.equal(f.broker.nativeControls,0);
 f.broker.backingUp=true;await assert.rejects(f.broker.call('native.background.stop',args),/backup/);assert.equal(f.calls.length,0);
});
test('a failed native stop releases the consistent-backup control counter',async()=>{
 const f=fixture();f.broker.native.stopBackground=async()=>{assert.equal(f.broker.nativeControls,1);throw Error('Native process already exited');};await assert.rejects(f.broker.call('native.background.stop',{requestId:f.requestId,threadId:f.threadId,itemId:'item',processId:'process'}),/already exited/);assert.equal(f.broker.nativeControls,0);
});
