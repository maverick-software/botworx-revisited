const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),os=require('node:os'),fs=require('node:fs/promises');
const build=process.env.AGENTOPIA_PLUGIN_IMPORT_BUILD;
const {planPluginUpdate}=require(path.join(build,'plugin-update.js')),{pluginDigest}=require(path.join(build,'plugin-validation.js')),{Plugins}=require(path.join(build,'plugins.js')),{NativePluginSkills}=require(path.join(build,'native-plugin-skills.js'));
const copy=v=>JSON.parse(JSON.stringify(v));
const file=value=>Buffer.from('---\nname: update-fixture\ndescription: Reviewed update fixture.\n---\n'+value).toString('base64');
const pkg={manifest:{$schema:'https://agent-plugins.org/schemas/1.0.0/plugin.schema.json',name:'update-fixture',version:'1.0.0',description:'Update fixture.'},mcp:{$schema:'https://agent-plugins.org/schemas/1.0.0/mcp.schema.json',mcpServers:{same:{type:'streamable-http',url:'https://same.example/mcp'},changed:{type:'sse',url:'https://old.example/mcp'},removed:{type:'sse',url:'https://removed.example/mcp'}}},files:{'skills/update/SKILL.md':file('Old reviewed instructions.'),'skills/update/references/removed.txt':Buffer.from('Removed').toString('base64')}};
const next=copy(pkg);next.manifest.version='2.0.0';next.mcp.mcpServers.changed={type:'streamable-http',url:'https://new.example/mcp'};delete next.mcp.mcpServers.removed;next.mcp.mcpServers.added={type:'sse',url:'https://added.example/mcp'};next.files['skills/update/SKILL.md']=file('New reviewed instructions.');delete next.files['skills/update/references/removed.txt'];next.files['skills/update/references/added.txt']=Buffer.from('Added').toString('base64');

test('review separates retained credentials from changed, removed and new servers and lists changed skill bytes',()=>{
 const {package:value,update}=planPluginUpdate(pkg,next);assert.deepEqual(value,next);assert.deepEqual(update.preservedServers,['same']);assert.deepEqual(update.changedServers,['changed']);assert.deepEqual(update.removedServers,['removed']);assert.deepEqual(update.addedServers,['added']);
 assert.equal(update.previousDigest,pluginDigest(pkg));assert.equal(update.digest,pluginDigest(next));assert.deepEqual(update.changedFiles,['skills/update/SKILL.md']);assert.deepEqual(update.addedFiles,['skills/update/references/added.txt']);assert.deepEqual(update.removedFiles,['skills/update/references/removed.txt']);
 const transport=copy(next);transport.mcp.mcpServers.same.type='sse';assert(planPluginUpdate(pkg,transport).update.changedServers.includes('same'));
});
test('updates retain stable identity, require a distinct version and continue full schema/credential checks',()=>{
 assert.throws(()=>planPluginUpdate(pkg,pkg),/different version/);const wrong=copy(next);wrong.manifest.name='another-plugin';assert.throws(()=>planPluginUpdate(pkg,wrong),/installed plugin name/);
 for(const change of [p=>p.mcp.mcpServers.same.url='https://same.example/mcp?api_key=secret',p=>p.mcp.mcpServers.same.headers={Authorization:'secret'},p=>p.manifest.hooks='./run.js',p=>p.files['../outside.txt']='eA==']){const value=copy(next);change(value);assert.throws(()=>planPluginUpdate(pkg,value));}
 const onlySkills=copy(next);delete onlySkills.mcp;assert.deepEqual(planPluginUpdate(pkg,onlySkills).update.removedServers,['changed','removed','same']);
});
function fixture(){let row={user_id:'owner',name:pkg.manifest.name,source:'imported',package:copy(pkg),digest:pluginDigest(pkg)},calls=[];const db={from:table=>{const filters=[];const query={select:()=>query,eq:(key,value)=>{filters.push([key,value]);return query;},single:async()=>({data:table==='desktop_plugins'&&filters.every(([k,v])=>row[k]===v)?copy(row):null,error:table==='desktop_plugins'&&filters.every(([k,v])=>row[k]===v)?null:{message:'Not found'}})};return query;},rpc:async(name,args)=>{calls.push({name,args});if(args.p_expected_digest!==row.digest)return {error:{message:'changed'}};row={...row,package:args.p_package,digest:args.p_digest};return {error:null};}};const registry=new Plugins(db);registry.ensure=async()=>{};return {registry,calls,row:()=>row,set:change=>Object.assign(row,change)};}
test('owned update requires both reviewed digests and sends one atomic replacement, without copying a credential',async()=>{
 const f=fixture(),user={id:'owner',admin:false},args={name:pkg.manifest.name,previousDigest:pluginDigest(pkg),package:next};
 const review=await f.registry.call('plugins.reviewUpdate',args,user);assert.equal(f.calls.length,0);assert.equal(review.update.toVersion,'2.0.0');
 await assert.rejects(f.registry.call('plugins.update',{...args,digest:'wrong'},user),/exact update/);assert.equal(f.calls.length,0);
 await f.registry.call('plugins.update',{...args,digest:review.digest},user);assert.equal(f.calls.length,1);assert.equal(f.calls[0].name,'desktop_update_plugin');assert.deepEqual(f.calls[0].args,{p_user:'owner',p_name:pkg.manifest.name,p_expected_digest:pluginDigest(pkg),p_package:next,p_digest:pluginDigest(next)});
 await assert.rejects(f.registry.call('plugins.update',{...args,digest:review.digest},user),/changed/);assert.equal(f.calls.length,1);
});
test('another owner, a stale review and managed package replacement cannot reach the update transaction',async()=>{
 const f=fixture(),args={name:pkg.manifest.name,previousDigest:pluginDigest(pkg),package:next,digest:pluginDigest(next)};
 await assert.rejects(f.registry.call('plugins.update',args,{id:'other'}));await assert.rejects(f.registry.call('plugins.reviewUpdate',{...args,previousDigest:'0'.repeat(64)},{id:'owner'}),/changed/);
 f.set({source:'bundled'});await assert.rejects(f.registry.call('plugins.update',args,{id:'owner'}));assert.equal(f.calls.length,0);
});
test('updating removes the old owned skill cache while retaining the new digest and another account',async()=>{
 const directory=await fs.mkdtemp(path.join(os.tmpdir(),'agentopia-plugin-update-'));let current=pkg;
 const service=new NativePluginSkills({skillPackages:async()=>[{name:current.manifest.name,package:current,digest:pluginDigest(current)}]},directory,''),client={request:async()=>({})};
 try{
  const old=await service.capture('alice','agent'),oldRoots=await service.configure(client,old,async()=>{});await service.configure(client,await service.capture('bob','agent'),async()=>{});
  current=next;const fresh=await service.capture('alice','agent'),newRoots=await service.configure(client,fresh,async()=>{});
  await service.removeCached('alice',pkg.manifest.name,pluginDigest(next));await assert.rejects(fs.stat(oldRoots[0].directory),{code:'ENOENT'});await service.validate(fresh,newRoots);await assert.rejects(service.validate(old),/changed or were revoked/);
  assert.equal((await fs.readdir(service.ownerDirectory('bob'))).length,1);
 }finally{assert.equal(path.dirname(await fs.realpath(directory)),await fs.realpath(os.tmpdir()));await fs.rm(directory,{recursive:true,force:true,maxRetries:10,retryDelay:100});}
});
