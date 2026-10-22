const test=require('node:test'),assert=require('node:assert/strict');
const {mkdtemp,writeFile,mkdir,readFile,rename,rm,symlink}=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),{randomUUID}=require('node:crypto');
const {WorkspaceFiles}=require('../build/workspace.js'),{WorkspaceTools}=require('../build/workspace-tools.js'),{WorkspaceMonitor}=require('../build/workspace-monitor.js');
class Secrets{data=new Map();get(key){return this.data.get(key);}async set(key,value){this.data.set(key,value);}}
const until=async(predicate)=>{const end=Date.now()+5000;while(!predicate()){if(Date.now()>end)throw new Error('Folder notification did not arrive.');await new Promise(resolve=>setTimeout(resolve,20));}};
test('visible-folder notifications cover external changes, reject unsafe roots, stop on revocation and account change, and never contain file contents',async()=>{
 const base=await mkdtemp(path.join(os.tmpdir(),'agentopia-folder-monitor-')),root=path.join(base,'workspace'),outside=path.join(base,'outside'),events=[],files=new WorkspaceFiles(new Secrets());await mkdir(root);await mkdir(outside);await mkdir(path.join(root,'nested'));
 const tools=new WorkspaceTools(files),reference=(await files.add('owner',[root]))[0];let active=true;
 const monitor=new WorkspaceMonitor(files,tools,owner=>active&&owner==='owner',(_owner,event)=>events.push(event),25,80),id=randomUUID(),child=randomUUID(),start=(token,relative='')=>monitor.start('owner',token,reference.id,relative,async()=>{});
 try{
  await start(id);await start(child,'nested');await writeFile(path.join(root,'nested','note.md'),'PRIVATE TEST CONTENT');await until(()=>events.some(e=>e.workspace.id===child));
  assert(!JSON.stringify(events).includes('PRIVATE TEST CONTENT'));assert(!JSON.stringify(events).includes(root));
  events.length=0;await mkdir(path.join(root,'added'));await until(()=>events.some(e=>e.workspace.id===id));
  events.length=0;await rename(path.join(root,'added'),path.join(root,'renamed'));await until(()=>events.some(e=>e.workspace.id===id));
  await assert.rejects(monitor.start('other',id,reference.id,'',async()=>{}),/another account/);await assert.rejects(monitor.start('other',randomUUID(),reference.id,'',async()=>{}),/unavailable/);
  for(const bad of ['../outside','.env','nested/note.md'])await assert.rejects(start(randomUUID(),bad));
  await symlink(outside,path.join(root,'redirect'),'junction');await assert.rejects(start(randomUUID(),'redirect'),/Linked/);
  events.length=0;await rename(path.join(root,'nested'),path.join(root,'old-nested'));await until(()=>events.some(e=>e.workspace.id===child&&e.workspace.error));
  monitor.stop('owner',id);await start(id);await new Promise(resolve=>setTimeout(resolve,120));events.length=0;active=false;await writeFile(path.join(root,'note.md'),'owner switched');await new Promise(resolve=>setTimeout(resolve,220));assert.equal(events.length,0);
  active=true;await start(id);await new Promise(resolve=>setTimeout(resolve,120));events.length=0;await files.remove('owner',reference.id);await writeFile(path.join(root,'note.md'),'reference forgotten');await new Promise(resolve=>setTimeout(resolve,220));assert.equal(events.length,0);
 }finally{monitor.close();await rm(base,{recursive:true,force:true});}
});
test('folder creation is explicit, bounded to an owned workspace, never replaces existing items, and respects a cancelled account guard',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'agentopia-folder-create-')),files=new WorkspaceFiles(new Secrets()),tools=new WorkspaceTools(files),reference=(await files.add('owner',[root]))[0];
 try{
  assert.deepEqual(await tools.createDirectory('owner',reference.id,'research',async()=>{}),{path:'research'});await tools.createDirectory('owner',reference.id,'research/notes',async()=>{});
  await writeFile(path.join(root,'existing.md'),'keep');await assert.rejects(tools.createDirectory('owner',reference.id,'existing.md',async()=>{}));assert.equal(await readFile(path.join(root,'existing.md'),'utf8'),'keep');
  for(const value of ['research','../outside','.env','missing/child','a:b','a*','a?','a|','a<','a>','a"','CON','trailing.'])await assert.rejects(tools.createDirectory('owner',reference.id,value,async()=>{}));
  await assert.rejects(tools.createDirectory('other',reference.id,'stolen',async()=>{}),/unavailable/);await assert.rejects(tools.createDirectory('owner',reference.id,'cancelled',async()=>{throw new Error('Account changed');}),/Account changed/);
  const names=(await require('node:fs/promises').readdir(root)).sort();assert.deepEqual(names,['existing.md','research']);
 }finally{await rm(root,{recursive:true,force:true});}
});
test('closing a folder subscription during its asynchronous access check prevents a late watcher from being installed',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'agentopia-folder-pending-')),files=new WorkspaceFiles(new Secrets()),ref=(await files.add('owner',[root]))[0],events=[],monitor=new WorkspaceMonitor(files,new WorkspaceTools(files),()=>true,(_,event)=>events.push(event),20,50),id=randomUUID();let release;
 try{const gate=new Promise(resolve=>release=resolve),pending=monitor.start('owner',id,ref.id,'',()=>gate);monitor.stop('owner',id);release();await assert.rejects(pending,/closed/);await writeFile(path.join(root,'quiet.md'),'quiet');await new Promise(resolve=>setTimeout(resolve,130));assert.equal(events.length,0);const beforeReload=monitor.generation;monitor.close();await assert.rejects(monitor.start('owner',randomUUID(),ref.id,'',async()=>{},beforeReload),/closed/);}
 finally{monitor.close();await rm(root,{recursive:true,force:true});}
});
