const test=require('node:test'),assert=require('node:assert/strict'),{randomUUID}=require('node:crypto');
const {ChatDrafts,draftScope}=require('../build/chat-drafts.js'),{restoreWindow}=require('../build/window-state.js');
class Secrets{data=new Map();fail=false;get(k){return this.data.get(k);}async set(k,v){await new Promise(r=>setTimeout(r,2));if(this.fail)throw new Error('Disk unavailable');this.data.set(k,v);}}
test('chat drafts isolate accounts, serialize edits, retain context, reject invalid data and retry failed writes',async()=>{
 const secrets=new Secrets(),drafts=new ChatDrafts(secrets),owner=randomUUID(),other=randomUUID(),scope='conversation:'+randomUUID(),home='new:'+randomUUID()+':home',file=randomUUID();
 const draft={text:'Unsent private message',options:{provider:'openrouter',model:'fixture/model',thinking:'high',permission:'ask',mode:'plan',files:[file],goalId:randomUUID()}};
 await Promise.all([drafts.save(owner,scope,draft),drafts.save(owner,home,{...draft,text:'Other draft'})]);
 assert.equal(drafts.get(owner,scope).text,draft.text);assert.equal(drafts.get(owner,home).text,'Other draft');assert.equal(drafts.get(other,scope),null);assert.equal(drafts.get(owner,scope).options.goalId,undefined);assert.deepEqual(drafts.get(owner,scope).options.files,[file]);
 assert.throws(()=>draftScope('__proto__'));assert.throws(()=>drafts.save(owner,scope,{text:'a'.repeat(100001)}));assert.throws(()=>drafts.save(owner,scope,{...draft,options:{permission:'full-unrestricted'}}));
 secrets.fail=true;await assert.rejects(drafts.save(owner,scope,{...draft,text:'Changed'}),/Disk unavailable/);assert.equal(drafts.get(owner,scope).text,draft.text);secrets.fail=false;await drafts.save(owner,scope,{...draft,text:'Recovered'});assert.equal(drafts.get(owner,scope).text,'Recovered');
 await drafts.save(owner,scope,{text:'',options:{files:[]}});assert.equal(drafts.get(owner,scope),null);assert.equal(drafts.get(owner,home).text,'Other draft');
});
test('restored windows stay visible when monitor layout changes and retain maximized preference',()=>{
 const areas=[{x:0,y:0,width:1920,height:1040},{x:-1280,y:0,width:1280,height:960}];
 assert.deepEqual(restoreWindow({bounds:{x:-1200,y:20,width:1100,height:800},maximized:true},areas),{bounds:{x:-1200,y:20,width:1100,height:800},maximized:true});
 const moved=restoreWindow({bounds:{x:4000,y:4000,width:5000,height:5000}},areas);assert.deepEqual(moved.bounds,{x:0,y:0,width:1920,height:1040});
 const tiny=restoreWindow({bounds:{x:0,y:0,width:-4,height:0}},areas);assert.equal(tiny.bounds.width,960);assert.equal(tiny.bounds.height,640);
 assert.deepEqual(restoreWindow({bounds:{x:NaN}},areas),restoreWindow(null,areas));
});
