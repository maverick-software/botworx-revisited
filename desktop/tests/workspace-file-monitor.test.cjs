const test=require('node:test'),assert=require('node:assert/strict');
const {mkdtemp,writeFile,mkdir,rename,rm,symlink,link,utimes}=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),{randomUUID}=require('node:crypto');
const {WorkspaceFiles}=require('../build/workspace.js'),{WorkspaceTools}=require('../build/workspace-tools.js'),{WorkspaceMonitor}=require('../build/workspace-monitor.js');
class Secrets{data=new Map();get(key){return this.data.get(key);}async set(key,value){this.data.set(key,value);}}
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const until=async predicate=>{const end=Date.now()+5000;while(!predicate()){if(Date.now()>end)throw Error('File notification did not arrive.');await pause(20);}};
test('active-file monitoring covers direct attachments, in-place writes and atomic saves without reading siblings or sending contents',async()=>{
 const base=await mkdtemp(path.join(os.tmpdir(),'agentopia-file-monitor-')),target=path.join(base,'document.md'),events=[],files=new WorkspaceFiles(new Secrets());await writeFile(target,'original');
 const reference=(await files.add('owner',[target]))[0],id=randomUUID(),monitor=new WorkspaceMonitor(files,new WorkspaceTools(files),()=>true,(_,event)=>events.push(event),25,70);
 try{
  await monitor.start('owner',id,reference.id,'',async()=>{},monitor.generation,'file');
  await writeFile(target,'PRIVATE UPDATED CONTENT');await until(()=>events.length);assert(!events[0].workspace.error);assert(!JSON.stringify(events).includes('PRIVATE'));assert(!JSON.stringify(events).includes(base));
  await pause(150);events.length=0;await writeFile(path.join(base,'sibling.md'),'UNSELECTED');await pause(200);assert.equal(events.length,0);
  await writeFile(path.join(base,'replacement.md'),'replacement');await rename(path.join(base,'replacement.md'),target);await until(()=>events.length);assert(events.every(event=>!event.workspace.error));
  await pause(150);events.length=0;await writeFile(target,'another edit');await until(()=>events.length);assert(events.every(event=>!event.workspace.error));
  await pause(150);events.length=0;await files.remove('owner',reference.id);await writeFile(target,'revoked');await pause(200);assert.equal(events.length,0);
 }finally{monitor.close();await rm(base,{recursive:true,force:true});}
});
test('file polling detects same-length writes even when modification time is restored, and rejects unsafe targets',async()=>{
 const base=await mkdtemp(path.join(os.tmpdir(),'agentopia-file-poll-')),root=path.join(base,'workspace'),target=path.join(root,'document.md'),outside=path.join(base,'outside.md'),events=[],files=new WorkspaceFiles(new Secrets());await mkdir(root);await writeFile(target,'first');await writeFile(outside,'outside');
 const reference=(await files.add('owner',[root]))[0],id=randomUUID(),monitor=new WorkspaceMonitor(files,new WorkspaceTools(files),()=>true,(_,event)=>events.push(event),25,70);
 try{
  await monitor.start('owner',id,reference.id,'document.md',async()=>{},monitor.generation,'file');
  // Close the OS subscription to exercise the stat-based fallback directly.
  monitor.entries.get(id).watcher.close();const original=await require('node:fs/promises').stat(target);await pause(30);await writeFile(target,'other');await utimes(target,original.atime,original.mtime);await until(()=>events.length);assert(!events[0].workspace.error);
  for(const relative of ['../outside.md','.env',''])await assert.rejects(monitor.start('owner',randomUUID(),reference.id,relative,async()=>{},monitor.generation,'file'));
  await assert.rejects(monitor.start('other',randomUUID(),reference.id,'document.md',async()=>{},monitor.generation,'file'));
  await symlink(outside,path.join(root,'linked.md'));await assert.rejects(monitor.start('owner',randomUUID(),reference.id,'linked.md',async()=>{},monitor.generation,'file'),/Linked|link|changed/);
  await link(outside,path.join(root,'hard.md'));await assert.rejects(monitor.start('owner',randomUUID(),reference.id,'hard.md',async()=>{},monitor.generation,'file'),/Linked/);
 }finally{monitor.close();await rm(base,{recursive:true,force:true});}
});
test('file monitoring stops after account change, pending cancellation or an unsafe replacement',async()=>{
 const base=await mkdtemp(path.join(os.tmpdir(),'agentopia-file-revoke-')),target=path.join(base,'document.md'),outside=path.join(base,'outside.md'),events=[],files=new WorkspaceFiles(new Secrets());await writeFile(target,'first');await writeFile(outside,'outside');
 const reference=(await files.add('owner',[target]))[0],id=randomUUID();let active=true,release;const monitor=new WorkspaceMonitor(files,new WorkspaceTools(files),()=>active,(_,event)=>events.push(event),20,60);
 try{
  const gate=new Promise(resolve=>release=resolve),pending=monitor.start('owner',id,reference.id,'',()=>gate,monitor.generation,'file');monitor.stop('owner',id);release();await assert.rejects(pending,/closed/);
  await monitor.start('owner',id,reference.id,'',async()=>{},monitor.generation,'file');active=false;await writeFile(target,'after account change');await pause(200);assert.equal(events.length,0);
  active=true;await monitor.start('owner',id,reference.id,'',async()=>{},monitor.generation,'file');await rm(target);await symlink(outside,target);await until(()=>events.some(event=>event.workspace.error));assert.equal(monitor.entries.size,0);
 }finally{monitor.close();await rm(base,{recursive:true,force:true});}
});
