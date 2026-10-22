const test=require('node:test'),assert=require('node:assert/strict');
const {changedFiles,changedFileCount,undoableEdits,elapsedLabel,turnLabel}=require('../build/turn-presentation.js');
const edit=(id,before,after,beforeHash,afterHash,extra={})=>({id,name:'write_file',status:'completed',preview:{path:'C:\\Workspace\\notes.md',referenceId:'ref',relativePath:'notes.md',before,after,beforeHash,afterHash},...extra});

test('file summary combines only verified edit chains and counts the net diff',()=>{
 const rows=[edit('1','old\n','middle\n','a','b'),edit('2','middle\n','new\nline\n','b','c')];
 const files=changedFiles(rows);assert.equal(files.length,1);assert.deepEqual([files[0].added,files[0].removed],[2,1]);assert.equal(files[0].before,'old\n');assert.equal(files[0].after,'new\nline\n');assert.deepEqual(files[0].tools.map(t=>t.id),['1','2']);
 assert.equal(changedFiles([...rows,{...rows[1],id:'3',status:'reverted'}]).length,1);
});
test('independent later edits retain distinct snapshots and can form their own verified chain',()=>{
 const files=changedFiles([edit('1','a\n','b\n','a','b'),edit('2','human\n','c\n','h','c'),edit('3','c\n','d\n','c','d')]);
 assert.equal(files.length,2);assert.equal(changedFileCount(files),1);assert.equal(files[0].after,'b\n');assert.equal(files[1].before,'human\n');assert.equal(files[1].after,'d\n');assert.deepEqual(files[1].tools.map(t=>t.id),['2','3']);
});
test('proposed, failed, reverted and net-zero edits do not claim applied file changes',()=>{
 const original=edit('1','a\n','b\n','a','b');assert.equal(changedFiles(['awaiting_approval','failed','reverted','interrupted','denied'].map(status=>({...original,status}))).length,0);
 assert.equal(changedFiles([original,edit('2','b\n','a\n','b','a')]).length,0);
 assert.equal(changedFiles([edit('1',null,'',null,'empty')]).length,1);
});
test('work duration is based on recorded times, stops at completion, and rejects invalid timestamps',()=>{
 const start='2026-10-16T12:00:00.000Z',timing={requestId:'request',startedAt:start};
 assert.equal(elapsedLabel(timing,Date.parse(start)+205000),'3m 25s');assert.equal(elapsedLabel({...timing,finishedAt:'2026-10-16T12:03:25.000Z'},Date.parse(start)+7200000),'3m 25s');
 assert.equal(elapsedLabel({...timing,startedAt:'bad'},Date.now()),undefined);assert.equal(elapsedLabel({...timing,finishedAt:'2026-10-15'},Date.now()),undefined);
 assert.equal(turnLabel('cancelled','3m 25s',false),'Stopped for 3m 25s');assert.equal(turnLabel('running','4s',true),'Waiting for approval · 4s');assert.equal(turnLabel('interrupted',undefined,false),'Interrupted');assert.equal(turnLabel('interrupted','8h 25m',false),'Interrupted');
});
test('undo uses only the changes represented in the review and reverses their application order',()=>{
 const first=edit('1','old\n','middle\n','a','b'),second=edit('3','middle\n','new\n','b','c');
 const zeroFirst=edit('2','original\n','temporary\n','x','y'),zeroLast=edit('4','temporary\n','original\n','y','x');
 zeroFirst.preview.path=zeroLast.preview.path='C:\\Workspace\\net-zero.md';
 assert.deepEqual(undoableEdits([first,zeroFirst,second,zeroLast]).map(tool=>tool.id),['3','1']);
});
