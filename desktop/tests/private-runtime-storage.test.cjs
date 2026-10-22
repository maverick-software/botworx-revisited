const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const {mkdir,mkdtemp,writeFile,readFile,rm,symlink}=require('node:fs/promises');
const build=process.env.AGENTOPIA_PRIVATE_STORAGE_BUILD||path.resolve(__dirname,'../build');
const {privateRuntimeStoragePaths,localRuntimeStoragePath,registeredPrivateRuntimeStorage}=require(path.join(build,'private-runtime-storage.js'));
const {privateRuntimePath,privateDistribution,transferPrefix}=require(path.join(build,'runtime-binding.js'));
const {WorkspaceFiles}=require(path.join(build,'workspace.js')),{WorkspaceTools}=require(path.join(build,'workspace-tools.js'));
const runtime='AgentopiaRuntime-12345678-1234-4123-8123-123456789abc',reader='AgentopiaBackupReader-22345678-1234-4123-8123-123456789abc';
const fixtureParent=process.env.AGENTOPIA_PRIVATE_STORAGE_FIXTURES||'F:/Agentopia-Acceptance/private-storage-tests';
class Secrets{data=new Map();get(k){return this.data.get(k);}async set(k,v){this.data.set(k,v);}}

test('private runtime storage follows registered folders across drives while unrelated WSL distributions remain outside this policy',()=>{
 const rows=[{name:'AgentopiaRuntime',path:'\\\\?\\F:\\PrivateData\\legacy\\',version:2},{name:runtime,path:'G:/PrivateData/current',version:2},{name:reader,path:'H:\\PrivateData\\reader',version:2},{name:runtime.toUpperCase(),path:'g:\\privatedata\\CURRENT',version:2},{name:'Ubuntu',path:'I:\\Personal Linux',version:2},{name:'AgentopiaRuntime-ordinary-project',path:'J:\\Public',version:2}];
 const found=privateRuntimeStoragePaths(rows).map(x=>x.toLowerCase()).sort();assert.deepEqual(found,['f:\\privatedata\\legacy','g:\\privatedata\\current','h:\\privatedata\\reader']);
});
test('unverified private runtime locations fail closed instead of becoming ordinary workspaces',()=>{
 for(const value of [null,{},'[]',Array(513).fill({name:'Ubuntu'})])assert.throws(()=>privateRuntimeStoragePaths(value),/private runtime storage/);
 for(const value of ['',null,{},'relative/folder','F:relative','F:\\','F:\\folder\\..','\\\\server\\share\\data','\\\\?\\UNC\\server\\share\\data','F:\\private:stream','F:\\private\nfolder','\\\\.\\PhysicalDrive0'])assert.throws(()=>privateRuntimeStoragePaths([{name:runtime,path:value,version:2}]),/private runtime storage/);
 for(const version of [undefined,0,3,'2'])assert.throws(()=>privateRuntimeStoragePaths([{name:runtime,path:'F:\\Private',version}]),/private runtime storage/);
});
test('local mounted-volume paths and WSL1 retained private folders remain protected',()=>{
 const volume='\\\\?\\Volume{12345678-1234-1234-1234-123456789abc}\\private';assert.equal(localRuntimeStoragePath(volume),volume);assert.throws(()=>localRuntimeStoragePath(volume.slice(0,-7)),/private runtime storage/);assert.deepEqual(privateRuntimeStoragePaths([{name:runtime,path:'F:\\Retained',version:1}]),['F:\\Retained']);
});
test('registered aliases also protect their physical destination, with unavailable old registrations kept protected by their logical path',async()=>{
 const calls=[],result=await registeredPrivateRuntimeStorage({platform:'win32',read:async()=>[{name:runtime,path:'D:\\Alias',version:2},{name:'AgentopiaRuntime',path:'C:\\Old',version:2}],canonical:async value=>{calls.push(value);if(value==='C:\\Old')throw Object.assign(Error('removed'),{code:'ENOENT'});return 'F:\\PrivateData';}});assert.deepEqual(result,['D:\\Alias','C:\\Old','F:\\PrivateData']);assert.deepEqual(calls,['D:\\Alias','C:\\Old']);
});
test('registry errors and unverifiable physical paths do not silently disable the private-folder guard',async()=>{
 await assert.rejects(registeredPrivateRuntimeStorage({platform:'win32',read:async()=>{throw Error('registry read failed');}}));
 for(const code of ['EACCES','ELOOP'])await assert.rejects(registeredPrivateRuntimeStorage({platform:'win32',read:async()=>[{name:runtime,path:'F:\\Private',version:2}],canonical:async()=>{throw Object.assign(Error('blocked'),{code});}}),/private runtime storage/);
 let touched=false;assert.deepEqual(await registeredPrivateRuntimeStorage({platform:'linux',read:async()=>{touched=true;throw Error('must not run Windows tools');}}),[]);assert.equal(touched,false);
});
test('recovery readers are excluded as private UNC storage without becoming valid application runtime bindings',()=>{
 for(const name of [runtime,'AgentopiaRuntime',reader])for(const prefix of ['\\\\wsl$\\','\\\\wsl.localhost\\','\\\\?\\UNC\\wsl.localhost\\'])assert(privateRuntimePath(prefix+name+'\\home\\private'));
 assert(!privateDistribution(reader));assert.throws(()=>transferPrefix(reader,'root'),/Invalid private runtime/);assert(!privateRuntimePath('\\\\wsl.localhost\\Ubuntu\\home\\project'));
});
test('private relocated folders reject attachments, stale selected references and external backup capture in both permission modes',async t=>{
 await mkdir(fixtureParent,{recursive:true});const root=await mkdtemp(path.join(fixtureParent,'private-runtime-')),privateDir=path.join(root,'storage'),ordinary=path.join(root,'project');await mkdir(privateDir);await mkdir(ordinary);await writeFile(path.join(privateDir,'data.json'),'PRIVATE TEST FIXTURE');await writeFile(path.join(ordinary,'notes.txt'),'Ordinary project');
 t.after(async()=>{assert.equal(path.dirname(path.resolve(root)),path.resolve(fixtureParent));assert(path.basename(root).startsWith('private-runtime-'));await rm(root,{recursive:true,force:true});});
 const secrets=new Secrets(),files=new WorkspaceFiles(secrets,undefined,[privateDir]),tools=new WorkspaceTools(files,[privateDir]);
 await assert.rejects(files.add('owner',[privateDir]),/storage cannot be attached/);await assert.rejects(files.add('owner',[path.join(privateDir,'data.json')]),/storage cannot be attached/);assert.throws(()=>files.checkBackupPath(privateDir),/database storage/);assert.deepEqual(files.list('owner'),[]);
 secrets.data.set('files:owner',[{id:'stale',name:'storage',kind:'folder',path:privateDir}]);
 for(const permission of ['ask','full']){const options={permission,mode:'chat',thinking:'default',files:['stale']},args={reference_id:'stale',path:'data.json'};await assert.rejects(tools.read('owner',options,args),/storage cannot be attached/);await assert.rejects(tools.preview('owner',options,{...args,expected_hash:null,content:'REJECTED TEST WRITE',reason:'Verify private-folder exclusion'}),/storage cannot be attached/);assert.throws(()=>tools.guardManagedPath(path.join(privateDir,'new.json')),/storage cannot be attached/);}
 assert.equal(await readFile(path.join(privateDir,'data.json'),'utf8'),'PRIVATE TEST FIXTURE');secrets.data.set('files:owner',[]);const [reference]=await files.add('owner',[ordinary]);assert.equal((await tools.read('owner',{permission:'full',mode:'chat',files:[reference.id]},{reference_id:reference.id,path:'notes.txt'})).content,'Ordinary project');
 const alias=path.join(root,'alias');await symlink(privateDir,alias,'junction');await assert.rejects(files.add('owner',[alias]),/storage cannot be attached/);
});
test('Windows long-path and case aliases cannot bypass registered private-folder checks',{skip:process.platform!=='win32'},()=>{
 const files=new WorkspaceFiles(new Secrets(),undefined,['F:\\Private Runtime']);for(const value of ['F:\\Private Runtime','f:\\PRIVATE RUNTIME\\data.json','\\\\?\\F:\\Private Runtime\\data.json']){assert.throws(()=>files.checkPath(value),/storage cannot be attached/);assert.throws(()=>files.checkBackupPath(value),/database storage/);}assert.doesNotThrow(()=>files.checkPath('F:\\Private Runtime-project\\notes.txt'));
});
