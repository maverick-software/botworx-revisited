import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'../..');
let fixture=(await readFile(path.join(root,'desktop/tests/backup-main.test.cjs'),'utf8')).split("\ntest('")[0];
const before="void invoke('drafts.save').then(()=>ipcMain.emit('agentopia:close-ready',{senderFrame:this.mainFrame},{token}));";
assert(fixture.includes(before));
fixture=fixture.replace(before,"void invoke('drafts.save').then(()=>ipcMain.emit('agentopia:close-ready',{senderFrame:this.mainFrame},{token}),()=>ipcMain.emit('agentopia:close-ready',{senderFrame:this.mainFrame},{token,error:true}));");
fixture=fixture.replace("async call(action){observed.events.push(action);","async call(action){observed.events.push(action);if(action==='storage.commitChats'&&observed.holdStorage){observed.storageLocked=true;try{return await observed.holdStorage.promise;}finally{observed.storageLocked=false;observed.events.push('storage-settled');}}if(action==='drafts.save'&&observed.storageLocked)throw Error('Wait for storage cleanup.');");
fixture=fixture.replace("showMessageBox:async()=>({response:0})","showMessageBox:async()=>{observed.draftWarnings=(observed.draftWarnings??0)+1;return {response:0};}");
const checks=`
test('closing during reviewed Storage cleanup waits before saving drafts and stopping the runtime',()=>fixture(async f=>{
 const hold=deferred();f.observed.holdStorage=hold;
 const operation=f.invoke('storage.commitChats',{owner:f.owner.id,id:'generated-review'});
 await tick();assert(f.observed.storageLocked);
 f.observed.window.emit('close',{preventDefault(){}});await tick();
 const premature=f.observed.events.includes('draft-handshake');
 hold.resolve({kind:'chats',deleted:[],skipped:[],incomplete:[]});await operation;
 for(let i=0;i<40&&!f.observed.exits;i++)await tick();
 assert.equal(premature,false,'The draft-save handshake started while cleanup still blocked writes.');
 assert.equal(f.observed.draftWarnings??0,0);assert.equal(f.observed.exits,1);
 assert(f.observed.events.indexOf('storage-settled')<f.observed.events.indexOf('draft-handshake'));
 assert(f.observed.events.indexOf('drafts.save')<f.observed.events.indexOf('runtime-stop'));
}));
`;
await writeFile(path.join(root,'desktop/tests/storage-close.test.cjs'),fixture+checks);
console.log(JSON.stringify({created:true,scope:'Actual compiled main IPC and close listener, with a controlled pending cleanup and the broker write barrier.'}));
