const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),os=require('node:os');
const {mkdtemp,writeFile,mkdir,readFile,link,rm}=require('node:fs/promises');
const {parseRuntimeBinding,loadRuntimeBinding,privateDistribution,privateRuntimePath,transferPrefix}=require('../build/runtime-binding.js');
const {Runtime}=require('../build/runtime.js');
const instanceId='12345678-1234-4123-8123-123456789abc',distribution='AgentopiaRuntime-'+instanceId,binding={format:1,distribution,instanceId};
async function fixture(t){const directory=await mkdtemp(path.join(os.tmpdir(),'agentopia-binding-'));t.after(async()=>{assert.equal(path.dirname(path.resolve(directory)),path.resolve(os.tmpdir()));assert(path.basename(directory).startsWith('agentopia-binding-'));await rm(directory,{recursive:true,force:true});});return directory;}
test('a migrated runtime binding selects only its exact generated distribution and instance',()=>{
 assert.deepEqual(parseRuntimeBinding(binding),binding);
 for(const value of [null,[],{}, {...binding,format:2},{...binding,distribution:'Ubuntu'},{...binding,distribution:'AgentopiaRuntime'},{...binding,instanceId:'../../other'},{...binding,extra:true},{...binding,instanceId:instanceId.toUpperCase()}])assert.throws(()=>parseRuntimeBinding(value),/Invalid runtime binding/);
 assert(privateDistribution(distribution));assert(privateDistribution(distribution.toUpperCase()));assert(!privateDistribution('AgentopiaRuntime-anything'));assert(!privateDistribution('Ubuntu'));assert.deepEqual(transferPrefix(distribution,'agentopia'),['--distribution',distribution,'--user','agentopia']);assert.throws(()=>transferPrefix('Ubuntu','root'));
});
test('missing bindings preserve legacy installations; invalid existing files never fall back',async t=>{
 const directory=await fixture(t),file=path.join(directory,'runtime-binding.json');assert.equal((await loadRuntimeBinding(directory)).distribution,'AgentopiaRuntime');
 for(const text of ['{',JSON.stringify({...binding,distribution:'Ubuntu'}),' '.repeat(5000)]){await writeFile(file,text);await assert.rejects(loadRuntimeBinding(directory),/runtime binding.*original backend/s);}
 await writeFile(file,JSON.stringify(binding));assert.deepEqual(await loadRuntimeBinding(directory),binding);
 await link(file,path.join(directory,'hardlink.json'));await assert.rejects(loadRuntimeBinding(directory),/runtime binding/);
});
test('all runtime commands keep the selected copy even if its binding file changes during the process',async t=>{
 const directory=await fixture(t),file=path.join(directory,'runtime-binding.json');await writeFile(file,JSON.stringify(binding));const runtime=new Runtime('unused',directory,()=>{}),calls=[];runtime.wsl=async args=>{calls.push(args);return '';};
 await runtime.command(['cat','/owned']);await writeFile(file,JSON.stringify({...binding,distribution:'Ubuntu'}));await runtime.command(['cat','/still-owned']);
 assert.equal(calls.length,2);for(const args of calls){assert.equal(args[1],distribution);assert(!args.includes('AgentopiaRuntime'));assert(!args.includes('Ubuntu'));}
});
test('a missing migrated registration does not create a blank runtime or stop the original',async t=>{
 const directory=await fixture(t);await writeFile(path.join(directory,'runtime-binding.json'),JSON.stringify(binding));const calls=[],runtime=new Runtime('unused',directory,()=>{});runtime.wsl=async args=>{calls.push(args);return 'AgentopiaRuntime\r\nUbuntu';};
 await assert.rejects(runtime.start(),/migrated.*not registered/);await runtime.stop();assert.deepEqual(calls,[['--list','--quiet']]);
});
test('wrong copied-instance identity stops before transfers, provisioning or shutdown',async t=>{
 const directory=await fixture(t);await writeFile(path.join(directory,'runtime-binding.json'),JSON.stringify(binding));const calls=[],runtime=new Runtime('unused',directory,()=>{});runtime.wsl=async args=>{calls.push(args);if(args[0]==='--list')return distribution;return args.at(-1)==='/opt/agentopia/runtime-identity'?'local.agentopia.desktop-runtime.v1':'different-instance';};runtime.send=async()=>{throw new Error('Unexpected transfer');};
 await assert.rejects(runtime.start(),/does not match/);await runtime.stop();assert.equal(calls.length,3);assert(calls.every(args=>!args.includes('--terminate')&&!args.includes('supabase')));
});
test('verified shutdown terminates only the selected copied runtime',async t=>{
 const directory=await fixture(t);await writeFile(path.join(directory,'runtime-binding.json'),JSON.stringify(binding));const calls=[],runtime=new Runtime('unused',directory,()=>{});runtime.wsl=async args=>{calls.push(args);if(args[0]==='--list')return distribution;return args.at(-1)==='/opt/agentopia/runtime-identity'?'local.agentopia.desktop-runtime.v1':instanceId;};runtime.send=async()=>{throw new Error('Controlled stop after identity verification');};
 await assert.rejects(runtime.start(),/Controlled stop/);calls.length=0;await runtime.stop();assert.deepEqual(calls,[['--distribution',distribution,'--user','agentopia','--cd','/home/agentopia/app','--exec','supabase','stop'],['--terminate',distribution]]);await runtime.stop();assert.equal(calls.length,2);assert(!calls.flat().includes('--shutdown'));
});
test('private WSL filesystem protection covers the original and migrated runtime through normal and extended UNC paths',()=>{
 for(const name of ['AgentopiaRuntime',distribution,distribution.toUpperCase()])for(const host of ['wsl$','wsl.localhost']){const root='\\\\'+host+'\\'+name;assert(privateRuntimePath(root));assert(privateRuntimePath(root+'\\home\\agentopia\\private'));assert(privateRuntimePath('\\\\?\\UNC\\'+host+'\\'+name+'\\home'));}
 for(const value of ['\\\\wsl$\\Ubuntu\\home','C:\\Users\\AgentopiaRuntime','\\\\wsl.localhost\\AgentopiaRuntime-other\\home'])assert(!privateRuntimePath(value));
});
test('closing before successful ownership verification leaves all WSL environments untouched',async()=>{
 const runtime=new Runtime('unused','unused',()=>{});runtime.wsl=async()=>{throw new Error('Unverified shutdown attempted WSL access');};await runtime.stop();
});
