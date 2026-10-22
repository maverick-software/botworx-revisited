const test=require('node:test'),assert=require('node:assert/strict'),{randomUUID}=require('node:crypto');
const {BrowserDataStore,browserPartition,downloadName}=require('../build/browser-data.js');
test('browser partitions keep accounts, temporary sessions and HTML canvases separate',()=>{
 assert.equal(browserPartition('owner-a',true),browserPartition('owner-a',true));assert(browserPartition('owner-a',true).startsWith('persist:'));
 assert(!browserPartition('owner-a',false).startsWith('persist:'));assert(!browserPartition('owner-a',true,true).startsWith('persist:'));
 assert.notEqual(browserPartition('owner-a',true),browserPartition('owner-b',true));assert.notEqual(browserPartition('owner-a',false),browserPartition('owner-a',true,true));assert(!browserPartition('../private',true).includes('..'));assert.throws(()=>browserPartition('',true));
});
test('download default names retain Unicode and cannot supply paths or Windows reserved names',()=>{
 assert.equal(downloadName('Report café 🟢.md'),'Report café 🟢.md');assert.equal(downloadName('../../secret:document.txt'),'.._.._secret_document.txt');assert.equal(downloadName('CON.txt'),'download-CON.txt');assert.equal(downloadName('..'),'download');assert(downloadName('x'.repeat(200)).length<=120);assert(!/[\\/:*?"<>|\x00-\x1f]/.test(downloadName('a\u0000b\\c')));
});
test('browser history is account-scoped, serially persisted and interrupted without replay after restart',async()=>{
 const saved=new Map(),store={get:key=>saved.get(key),set:async(key,value)=>{await new Promise(r=>setTimeout(r,5));saved.set(key,value);}},data=new BrowserDataStore(store),row={id:randomUUID(),tabId:randomUUID(),name:'report.txt',origin:'https://example.test',state:'downloading',received:20,total:100,startedAt:new Date().toISOString(),path:'C:\\download\\report.txt'};
 data.get('a').downloads.push(row);const first=data.save('a');row.received=80;const second=data.save('a');await Promise.all([first,second]);await data.flush();assert.equal(saved.get('browser-data:a').downloads[0].received,80);assert.equal(data.get('b').downloads.length,0);
 const restarted=new BrowserDataStore(store);assert.equal(restarted.get('a').downloads[0].state,'interrupted');assert.equal(restarted.get('a').downloads[0].resumable,false);assert.equal(restarted.get('a').downloads[0].received,80);assert.equal(restarted.get('b').rememberSignIns,true);const longName='Saved '+ 'x'.repeat(180)+'.txt';saved.set('browser-data:long',{rememberSignIns:true,downloads:[{...row,state:'completed',name:longName}]});assert.equal(new BrowserDataStore(store).get('long').downloads[0].name,longName);
 let fail=true;const failing=new BrowserDataStore({get:()=>undefined,set:async()=>{if(fail)throw new Error('Disk unavailable');}});await assert.rejects(failing.save('a'),/Disk unavailable/);assert(failing.error('a'));assert.equal(failing.error('b'),'');await assert.rejects(failing.flush(),/could not be saved/);fail=false;await failing.save('a');await failing.flush();assert.equal(failing.error('a'),'');
});
