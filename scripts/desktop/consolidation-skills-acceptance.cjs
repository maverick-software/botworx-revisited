/** Read-only packaged acceptance. Never calls broker.call, RPCs, providers, or mutation APIs.
 * Load with __durableProbeRequire in a packaged probe, passing the already-observed
 * public catalog names/IDs. Only counts, booleans and content hashes leave the app.
 */
const assert=require('node:assert/strict'),{createHash}=require('node:crypto');
const HOSTS=['agentopia-browser','agentopia-files-terminal','agentopia-computer','agentopia-workspace-agents','agentopia-documents-planning','agentopia-schedules','composio'];
const canonical=value=>JSON.stringify(value,(_,item)=>item&&typeof item==='object'&&!Array.isArray(item)?Object.fromEntries(Object.keys(item).sort().map(key=>[key,item[key]])):item);
const hash=value=>createHash('sha256').update(canonical(value)).digest('hex');
const same=(a,b,message)=>assert.equal(canonical(a),canonical(b),message);
async function read(db,table,columns,keys){const rows=[];for(let offset=0;;offset+=1000){let query=db.from(table).select(columns);for(const key of keys)query=query.order(key);const result=await query.range(offset,offset+999);if(result.error)throw Error('Read-only acceptance could not read '+table+': '+result.error.message);rows.push(...result.data);if(result.data.length<1000)return rows;}}
async function preferencesForOwners(broker,owners){
 const choices=await read(broker.admin,'agent_llm_preferences','agent_id,provider,model',['agent_id']);
 const perAccount=owners.sort().map(owner=>{const composer=broker.secrets.get('composer:'+owner)??{};return {owner,composer:{provider:composer.provider??null,model:composer.model??null,thinking:composer.thinking??null},models:broker.secrets.get('model-choices:'+owner)??{},preferChatGPT:broker.secrets.get('prefer-chatgpt:'+owner)!==false};});
 const images=owners.map(owner=>({owner,enabled:broker.imageConnections.connection(owner).enabled}));
 return {version:1,owners:owners.length,agentModelChoices:choices.length,sha256:hash({choices,perAccount,sharedDefaultModel:broker.secrets.get('openrouter-default')??null}),imageState:{accounts:images.length,enabledAccounts:images.filter(row=>row.enabled).length,sha256:hash(images)}};
}
async function captureConsolidationPreferencesReadOnly(broker){const agents=await read(broker.admin,'agents','id,user_id',['id']);return preferencesForOwners(broker,[...new Set(agents.map(row=>row.user_id))]);}
async function inspectBrokerConsolidationReadOnly({broker,catalogs,baselinePreferences,expectedSkills,expectedWrappers,imageDisabledOwner}){
 assert(broker?.admin&&broker?.secrets,'Pass the actual initialized packaged broker');assert(Array.isArray(catalogs)&&catalogs.length,'Pass catalog names and IDs already observed through the packaged interface');
 const db=broker.admin,[plugins,skills,versions,grants,pluginGrants,aliases,receipts,agents]=await Promise.all([
  read(db,'desktop_plugins','user_id,name,package,digest,source,enabled',['user_id','name']),
  read(db,'desktop_skills','user_id,id,name,files,execution_name,enabled,revision,origin_plugin,origin_directory',['user_id','id']),
  read(db,'desktop_skill_versions','user_id,skill_id,execution_name,digest,package',['user_id','execution_name']),
  read(db,'desktop_skill_grants','user_id,skill_id,agent_id,enabled',['user_id','skill_id','agent_id']),
  read(db,'desktop_agent_plugins','user_id,plugin_name,agent_id,enabled',['user_id','plugin_name','agent_id']),
  read(db,'desktop_skill_aliases','user_id,selection,skill_id,execution_name,digest',['user_id','selection']),
  read(db,'desktop_skill_migrations','user_id,plugin_name,source_digest,receipt',['user_id','plugin_name']),
  read(db,'agents','id,user_id',['id'])]);
 const migrated=skills.filter(row=>row.origin_plugin),executionNames=new Set(versions.map(row=>row.user_id+':'+row.execution_name)),sources=plugins.filter(row=>row.source==='imported'&&row.package.files&&!row.package.mcp&&!executionNames.has(row.user_id+':'+row.name));
 if(expectedSkills!==undefined)assert.equal(migrated.length,expectedSkills,'Expected migrated skill count');if(expectedWrappers!==undefined)assert.equal(sources.length,expectedWrappers,'Expected retained source wrapper count');assert.equal(receipts.length,sources.length,'Every retained wrapper has a completed receipt');assert.equal(migrated.length,sources.reduce((count,row)=>count+Object.keys(row.package.files).filter(file=>/^skills\/[^/]+\/SKILL[.]md$/.test(file)).length,0),'Every retained source skill has an independent record');
 let filesChecked=0,resourceFiles=0,byteCount=0,grantsChecked=0;const fingerprints=[];
 for(const source of sources){
  const owned=migrated.filter(row=>row.user_id===source.user_id&&row.origin_plugin===source.name),merged={},originalGrants=pluginGrants.filter(row=>row.user_id===source.user_id&&row.plugin_name===source.name).map(({agent_id,enabled})=>({agent_id,enabled})).sort((a,b)=>a.agent_id.localeCompare(b.agent_id)),receipt=receipts.find(row=>row.user_id===source.user_id&&row.plugin_name===source.name);
  assert.equal(hash(source.package),source.digest,'Retained source package digest');assert.equal(receipt.source_digest,source.digest);assert.equal(receipt.receipt.skills.length,owned.length);assert.equal(receipt.receipt.grantsPerSkill,originalGrants.length);
  for(const skill of owned){
   const expected=Object.fromEntries(Object.entries(source.package.files).filter(([file])=>file.startsWith('skills/'+skill.origin_directory+'/'))),alias=aliases.find(row=>row.user_id===skill.user_id&&row.skill_id===skill.id&&row.selection==='agentopia-plugin:'+source.name+':'+source.digest+':skills/'+skill.origin_directory+'/SKILL.md');
   assert(expected['skills/'+skill.origin_directory+'/SKILL.md'],'Retained skill instruction exists');assert(alias,'Historical skill selection alias exists');const original=versions.find(row=>row.user_id===skill.user_id&&row.execution_name===alias.execution_name);
   assert(original&&original.skill_id===skill.id&&!original.package.mcp,'Alias resolves to its owned tool-less version');assert.equal(hash(original.package),original.digest);assert.equal(alias.digest,original.digest);same(original.package.files,expected,'Original version preserves exact base64 bytes');
   const envelope=plugins.find(row=>row.user_id===skill.user_id&&row.name===original.execution_name);assert(envelope,'Private execution envelope exists');same(envelope.package,original.package);assert.equal(envelope.digest,original.digest);
   if(skill.revision===1){same(skill.files,expected,'Unedited owned skill preserves all files');assert.equal(skill.enabled,source.enabled,'Migrated disabled state preserved');}
   const actualGrants=grants.filter(row=>row.user_id===skill.user_id&&row.skill_id===skill.id).map(({agent_id,enabled})=>({agent_id,enabled})).sort((a,b)=>a.agent_id.localeCompare(b.agent_id));same(actualGrants,originalGrants,'Effective original assignments retained');grantsChecked+=actualGrants.length;
   for(const [file,encoded]of Object.entries(expected)){assert(!Object.hasOwn(merged,file),'Source bytes assigned once');merged[file]=encoded;const bytes=Buffer.from(encoded,'base64');assert.equal(bytes.toString('base64'),encoded,'Canonical source bytes');filesChecked++;if(!file.endsWith('/SKILL.md'))resourceFiles++;byteCount+=bytes.length;fingerprints.push([skill.user_id,source.name,file,createHash('sha256').update(bytes).digest('hex')]);}
  }
  same(merged,source.package.files,'No source resource was omitted');
 }
 const ownerIds=[...new Set(agents.map(row=>row.user_id))].sort(),settings=await preferencesForOwners(broker,ownerIds);if(baselinePreferences)same(settings,baselinePreferences,'Persisted provider/model/thinking choices unchanged');
 if(imageDisabledOwner!==undefined){assert(ownerIds.includes(imageDisabledOwner),'Expected disabled image account exists');assert.equal(broker.imageConnections.connection(imageDisabledOwner).enabled,false,'Image generation stays disabled for the selected account');}
 const catalogChecks=[];
 for(const catalog of catalogs){assert(ownerIds.includes(catalog.owner),'Observed catalog belongs to an existing account');assert(Array.isArray(catalog.pluginNames)&&Array.isArray(catalog.accountSkillIds));const hidden=[...sources.filter(row=>row.user_id===catalog.owner).map(row=>row.name),...versions.filter(row=>row.user_id===catalog.owner).map(row=>row.execution_name)];assert(hidden.every(name=>!catalog.pluginNames.includes(name)),'Source wrappers and private envelopes hidden from Plugins');for(const name of HOSTS){const host=plugins.find(row=>row.user_id===catalog.owner&&row.name===name);assert(host&&host.source==='bundled','Owned host plugin installed: '+name);assert(catalog.pluginNames.includes(name),'Host plugin visible in actual catalog: '+name);}const expectedIds=skills.filter(row=>row.user_id===catalog.owner).map(row=>row.id).sort();same([...catalog.accountSkillIds].sort(),expectedIds,'Actual Skills catalog exposes every independent owned skill exactly once');catalogChecks.push({ownedSkillCount:expectedIds.length,hiddenWrappers: sources.filter(row=>row.user_id===catalog.owner).length,hostPluginsVisible:HOSTS.length});}
 return {success:true,readOnly:true,providerRequests:0,mutations:0,migratedSkills:migrated.length,retainedWrappers:sources.length,filesChecked,resourceFiles,bytesChecked:byteCount,grantsChecked,aliasesChecked:migrated.length,sourceFileHashesSha256:hash(fingerprints.sort((a,b)=>canonical(a).localeCompare(canonical(b)))),catalogs:catalogChecks,imageState:settings.imageState,selectedAccountImageDisabled:imageDisabledOwner!==undefined?true:null,providerChoices:settings,providerChoicesAndImagesMatchBaseline:baselinePreferences?true:null};
}
module.exports={captureConsolidationPreferencesReadOnly,inspectBrokerConsolidationReadOnly};
if(require.main===module){console.log('Load this read-only module from a packaged application probe. See exported captureConsolidationPreferencesReadOnly and inspectBrokerConsolidationReadOnly.');}
