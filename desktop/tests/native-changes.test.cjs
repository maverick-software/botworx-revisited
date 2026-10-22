const test=require('node:test'),assert=require('node:assert/strict'),{createTwoFilesPatch}=require('diff');
const{nativeChanges}=require('../build/native-change-presentation.js'),{nativeBlobHash,reconstructNativeChange}=require('../build/native-change-snapshots.js');
const zero='0'.repeat(40),root='C:/workspace/';
function block(from,to,before,after){return'diff --git a/'+(from??to)+' b/'+(to??from)+'\n'+(before===null?'new file mode 100644\n':after===null?'deleted file mode 100644\n':'')+'index '+(before===null?zero:nativeBlobHash(before))+'..'+(after===null?zero:nativeBlobHash(after))+'\n'+createTwoFilesPatch(before===null?'/dev/null':'a/'+from,after===null?'/dev/null':'b/'+to,before??'',after??'').replace(/^=+\n/,'');}
function state(diff,changes){return{threadId:'parent',turnId:'turn',items:[{threadId:'parent',turnId:'turn',completed:true,item:{id:'patch',type:'fileChange',status:'completed',changes}}],diffs:[{threadId:'parent',turnId:'turn',diff,truncated:false}],approvals:[],steering:[]};}
const change=(name,kind)=>({path:root+name,kind,diff:''});
test('native snapshots require exact original and current Git blob hashes for UTF-8, CRLF and absent final newlines',()=>{
 for(const [before,after]of[['old\n','new\n'],['café 🟢\r\nsecond\r\n','new 🟢\r\nsecond\r\n'],['old','new'],['','nonempty\n'],['old\n','']]){
  const file=nativeChanges(state(block('notes.md','notes.md',before,after),[change('notes.md',{type:'update',move_path:null})]))[0];assert(file);assert.deepEqual(reconstructNativeChange(file,after),{before,after});
  assert.throws(()=>reconstructNativeChange(file,after+'external'),/changed after/);assert.throws(()=>reconstructNativeChange({...file,beforeGit:'a'.repeat(40)},after),/could not be reconstructed/);
 }
});
test('creation, deletion and empty files distinguish absence from an existing empty file',()=>{
 for(const [before,after]of[[null,'created\n'],['removed\n',null],[null,''],['',null]]){
  const file=nativeChanges(state(block(before===null?null:'notes.md',after===null?null:'notes.md',before,after),[change('notes.md',{type:before===null?'add':'delete'})]))[0];assert(file);assert.deepEqual(reconstructNativeChange(file,after),{before,after});
  if(after===null)assert.throws(()=>reconstructNativeChange(file,''),/changed after/);
 }
 const diff='diff --git a/empty.md b/empty.md\nnew file mode 100644\nindex '+zero+'..'+nativeBlobHash('')+'\n';const file=nativeChanges(state(diff,[change('empty.md',{type:'add'})]))[0];assert(file);assert.deepEqual(reconstructNativeChange(file,''),{before:null,after:''});
});
test('native move snapshots preserve both paths and full content hashes, including separate delete/add aggregates',()=>{
 const moved={type:'update',move_path:root+'new.md'},native=[change('old.md',moved)],before='before\n',after='after\n';
 const direct=nativeChanges(state(block('old.md','new.md',before,after),native));assert.equal(direct.length,1);assert.equal(direct[0].absoluteFrom,root+'old.md');assert.equal(direct[0].absoluteTo,root+'new.md');assert.deepEqual(reconstructNativeChange(direct[0],after),{before,after});
 const split=nativeChanges(state(block('old.md',null,before,null)+block(null,'new.md',null,after),native));assert.equal(split.length,1);assert.equal(split[0].parts.length,2);assert.deepEqual(reconstructNativeChange(split[0],after),{before,after});
});
test('aggregate counts report net native edits while child and follow-up scopes remain distinct',()=>{
 const s=state(block('notes.md','notes.md','original\n','final\n'),[change('notes.md',{type:'update',move_path:null}),change('notes.md',{type:'update',move_path:null})]);s.diffs.push({...s.diffs[0],threadId:'child',turnId:'child-turn'});s.items.push({...s.items[0],threadId:'child',turnId:'child-turn'});const files=nativeChanges(s);assert.equal(files.length,2);assert.deepEqual(files.map(file=>[file.added,file.removed]),[[1,1],[1,1]]);assert.notEqual(files[0].key,files[1].key);
 s.diffs[0].truncated=true;assert.throws(()=>reconstructNativeChange(nativeChanges(s)[0],'final\n'),/truncated/);
});
test('unmatched, incomplete and unsafe native paths cannot produce an undo snapshot',()=>{
 const s=state(block('notes.md','notes.md','old\n','new\n'),[change('different.md',{type:'update',move_path:null})]);assert.throws(()=>reconstructNativeChange(nativeChanges(s)[0],'new\n'),/does not match/);
 s.items[0].completed=false;assert.throws(()=>reconstructNativeChange(nativeChanges(s)[0],'new\n'),/does not match/);
 assert.equal(nativeChanges(state(block('../escape.md','../escape.md','old\n','new\n'),[change('../escape.md',{type:'update',move_path:null})])).length,0);
});
test('native file leases exclude running workers, new turns, skills and steering, and release after failure',async()=>{
 const{CodexHarness}=require('../build/codex-harness.js'),h=new CodexHarness({},{harnessScope:()=> 'stable'},'unused','unused',()=>{},async()=>{}),user={id:'owner',admin:true};
 const worker={owner:'owner',children:new Map(),preparing:true};h.workers.add(worker);await assert.rejects(h.quietFiles('owner',async()=>true),/Finish or stop/);worker.preparing=false;
 await h.quietFiles('owner',async()=>{await assert.rejects(h.skills(user,'openrouter','fixture',[],{files:[],permission:'full',mode:'chat'}),/file review/);await assert.rejects(h.control('owner','request','child','send','turn','steer','id'),/file review/);await assert.rejects(h.run(user,{id:'request',conversation_id:'conversation'},{},'openrouter','fixture',{permission:'full',mode:'chat',files:[]},[],[],[],async()=>{},new AbortController()),/file review/);});
 await assert.rejects(h.quietFiles('owner',async()=>{throw new Error('controlled failure');}),/controlled failure/);assert.equal(await h.quietFiles('owner',async()=>42),42);h.workers.delete(worker);
});
