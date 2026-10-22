import assert from 'node:assert/strict';
import path from 'node:path';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {randomUUID,randomBytes} from 'node:crypto';
import {expect} from '@playwright/test';
import {desktopOperation} from './operation-lock.mjs';
import {json,hash,list} from './phased-backup-control.mjs';
import {launchDurableProfileProbe} from './launch-durable-profile-probe.mjs';

desktopOperation('exact packaged68 agent-scoped app selection and cold persistence');
const root=path.resolve(import.meta.dirname,'../..');
const pointer=await json(path.join(root,'.supabase/desktop-agent-apps68-real/current.json'));
const cfg=await json(pointer.sourceIntent),candidate=await json(pointer.candidateFile);
assert(cfg.registered&&cfg.emptyRuntimeVerified&&cfg.role==='source');
assert.equal(candidate.version,'0.44.68');
assert.equal(await hash(path.join(cfg.program,'resources/app.asar')),candidate.imageSha256);
assert.equal(await hash(cfg.configFile),cfg.testConfigSha256);
assert((await list(false)).includes(cfg.distribution));
assert(!(await list(true)).includes(cfg.distribution),'The generated runtime must start cold.');
const cold=process.argv.includes('--cold'),resumeIndex=process.argv.indexOf('--resume-seed'),resume=resumeIndex!==-1,phase=cold?'cold':'seed';
assert(!(cold&&resume));
const out=path.join(cfg.out,phase+'-'+Date.now()),checkpoint=path.join(cfg.out,'fixture.json');
await mkdir(out);
let fixture;
if(cold||resume){fixture=await json(checkpoint);if(cold)assert((await json(path.join(cfg.out,'seed-accepted.json'))).success);}
else{
 fixture={marker:'APP68-'+randomUUID(),peerMarker:'PEER68-'+randomUUID(),email:'apps68-'+randomUUID()+'@qa.invalid',password:'Qa68!'+randomBytes(24).toString('base64url'),requestId:randomUUID(),plugin:'generated-app-checklist',pluginTitle:'Generated App Checklist',name:'App Scope68 Agent',peerName:'App Scope68 Peer',role:'Verify selected app access and cite the private source.',instructions:'# Generated app acceptance\n\nPreserve the selected agent identity and cite approved sources.\n',unsavedInstructions:'Unsaved instructions survive browsing apps.',unsavedSop:'Unsaved procedure survives browsing apps.'};
 await writeFile(checkpoint,JSON.stringify(fixture,null,2),{flag:'wx',mode:0o600});
}
const evidence={success:false,at:new Date().toISOString(),out,phase,imageSha256:candidate.imageSha256,actualPostgres:true,actualSupabaseAuth:true,actualCodexHarness:true,controlledProviderResponses:true,realProviderRequests:0,liveComposioRequests:0,productionAccess:false,installed:false,checks:[]};
if(resume){
 const previous=path.resolve(process.argv[resumeIndex+1]);assert(previous.startsWith(cfg.out+path.sep));
 const prior=await json(previous),probe=await json(path.join(prior.out,'app/evidence.json'));
 assert(!prior.success&&prior.phase==='seed'&&prior.checks.length===2&&prior.cause.includes('Invalid chat settings.'));
 assert.equal(prior.imageSha256,candidate.imageSha256);assert.equal(probe.failureCleanupNormalExit,0);assert.deepEqual(probe.controlledNetwork.calls,[]);
 evidence.priorPassedEvidence=previous;evidence.checks=[...prior.checks];evidence.resumedAfterFixtureCorrection=true;
}
const check=async name=>{evidence.checks.push(name);await writeFile(path.join(out,'evidence.json'),JSON.stringify(evidence,null,2));console.log('PASS '+name);};
try{
 const result=await launchDurableProfileProbe(cfg,{
  label:path.relative(cfg.out,path.join(out,'app')),testProfile:false,initialProfile:cfg.profile,expectedProfile:cfg.profile,expectedRuntime:'ready',resumeDebugWorkers:true,isolateOsHome:true,
  evaluationTimeoutMs:15*60000,normalCloseTimeoutMs:120000,
  runReady:async({application,page})=>{
   const call=(action,args)=>page.evaluate(({action,args})=>window.agentopia.call(action,args),{action,args});
   let auth=await call('auth.state');
   if(!cold){
    if(!resume){
    assert(auth.needsAdministrator,'A fresh generated database is required.');
    await page.getByLabel('Your name',{exact:true}).fill('Generated App Acceptance Administrator');
    await page.getByLabel('Email address',{exact:true}).fill(fixture.email);
    await page.getByLabel('Password',{exact:true}).fill(fixture.password);
    await page.getByRole('button',{name:'Create administrator',exact:true}).click();
    await expect.poll(async()=>(await call('auth.state')).identity?.email,{timeout:30000}).toBe(fixture.email);
    auth=await call('auth.state');assert(auth.identity?.admin);fixture.owner=auth.identity.id;
    await writeFile(checkpoint,JSON.stringify(fixture,null,2));
    await check('The exact68 package starts its own PostgreSQL and creates a generated administrator through the real UI.');
    const seeded=await application.evaluate(async(_,fixture)=>{
     const b=globalThis.__coordination.broker,req=globalThis.__durableProbeRequire,{app}=globalThis.__durableProbeElectron,owner=(await b.identity()).id;
     if(owner!==fixture.owner)throw Error('Generated account changed');
     await b.secrets.setMany([['openai:'+owner,{client_id:'controlled-private-client',subject:'controlled-subject',email:'controlled@example.invalid',id_token:'CONTROLLED',access_token:'CONTROLLED-NOT-A-PROVIDER-CREDENTIAL',refresh_token:'',scope:'chatgpt.tokens.use.direct',expires_at:Date.now()+3600000}],['models:openai-oauth:'+owner,[{id:'gpt-6.1-sol',name:'GPT-6.1 Sol',thinking:['default','low','high'],supportsTools:true}]],['chatgpt-welcome:'+owner,true],['image-generation:'+owner,{enabled:false,provider:'openrouter',model:''}]]);
     const agent=await b.call('agents.save',{name:fixture.name,description:'Generated exact-package app picker acceptance',instructions:fixture.instructions,provider:'openai-oauth',model:'gpt-6.1-sol'});
     const peer=await b.call('agents.save',{name:fixture.peerName,description:'Independent generated peer',instructions:'Retain this peer identity.',provider:'openai-oauth',model:'gpt-6.1-sol'});
     let profile=await b.call('agents.profile',{agentId:agent});
     profile=await b.call('agents.profile.save',{agentId:agent,value:{...profile,handle:'appscope68',role:fixture.role,sops:'Preserve the selected account and agent.',guardrails:'Operate only on this generated acceptance data.',policy:{...profile.policy,memory:true,memoryWrite:true}}});
     const memory=await b.call('agents.memory.save',{agentId:agent,title:'Generated source marker',content:fixture.marker});
     await b.call('agents.memory.save',{agentId:peer,title:'Private peer marker',content:fixture.peerMarker});
     const skill='---\nname: generated-app-checklist\ndescription: Verify the generated app assignment fixture.\n---\n\nCite the saved source marker when reporting app verification.\n';
     const pkg={manifest:{$schema:'https://agent-plugins.org/schemas/1.0.0/plugin.schema.json',name:fixture.plugin,version:'1.0.0',description:'Generated packaged app selection checklist'},files:{'skills/generated-app-checklist/SKILL.md':req('node:buffer').Buffer.from(skill).toString('base64')}};
     const reviewed=await b.call('plugins.validate',{package:pkg});await b.call('plugins.install',{package:reviewed.package,digest:reviewed.digest});
     await b.call('plugins.enable',{name:fixture.plugin,enabled:true});await b.call('plugins.assign',{name:fixture.plugin,agentId:peer,enabled:true});
     return {agent,peer,memory:memory.id,profileRevision:profile.revision,options:{harness:'codex',provider:'openai-oauth',model:'gpt-6.1-sol',thinking:'default',permission:'files',mode:'chat',files:[]}};
    },fixture);
    Object.assign(fixture,seeded);await writeFile(checkpoint,JSON.stringify(fixture,null,2));
    await page.goto('agentopia://app/agents/'+fixture.agent);
    const home=page.getByRole('region',{name:'Agent home for '+fixture.name,exact:true});
    await home.getByRole('button',{name:'Edit agent',exact:true}).click();
    const editor=page.getByRole('region',{name:'Edit agent',exact:true});
    await editor.getByRole('button',{name:'Behavior',exact:true}).click();
    await editor.getByLabel('Standard operating procedures',{exact:true}).fill(fixture.unsavedSop);
    await editor.getByRole('button',{name:'General',exact:true}).click();
    await editor.getByRole('button',{name:'Markdown',exact:true}).click();
    await editor.getByLabel('Instructions',{exact:true}).fill(fixture.unsavedInstructions);
    await editor.getByRole('button',{name:'Browse apps',exact:true}).click();
    const picker=page.getByRole('dialog',{name:'Apps for '+fixture.name,exact:true});
    for(const name of ['Public','Personal','Composio'])await expect(picker.getByRole('tab',{name,exact:true})).toBeVisible();
    await picker.getByRole('tab',{name:'Personal',exact:true}).click();
    await picker.getByRole('button',{name:'Manage plugin '+fixture.pluginTitle,exact:true}).click();
    await expect(page.getByRole('dialog')).toHaveCount(1);
    await expect(picker.getByRole('checkbox',{name:/Enable plugin/})).toHaveCount(0);
    await expect(picker.getByRole('checkbox',{name:new RegExp(fixture.peerName)})).toHaveCount(0);
    const assignment=picker.getByRole('checkbox',{name:'Assign '+fixture.pluginTitle+' to '+fixture.name,exact:true});
    await assignment.check();await expect(assignment).toBeEnabled();await expect(assignment).toBeChecked();
    await page.screenshot({path:path.join(out,'packaged-scoped-app-picker.png'),animations:'disabled'});
    const persisted=await call('plugins.list'),row=persisted.find(row=>row.name===fixture.plugin);
    assert(row.assignments.some(grant=>grant.agent_id===fixture.agent&&grant.enabled));assert(row.assignments.some(grant=>grant.agent_id===fixture.peer&&grant.enabled));
    const profile=await call('agents.profile',{agentId:fixture.agent});assert.equal(profile.revision,fixture.profileRevision);assert.equal(profile.sops,'Preserve the selected account and agent.');
    await picker.getByRole('button',{name:'Close dialog',exact:true}).click();
    await expect(editor.getByLabel('Instructions',{exact:true})).toHaveValue(fixture.unsavedInstructions);
    await editor.getByRole('button',{name:'Behavior',exact:true}).click();
    await expect(editor.getByLabel('Standard operating procedures',{exact:true})).toHaveValue(fixture.unsavedSop);
    page.once('dialog',dialog=>dialog.accept());await editor.getByRole('button',{name:'Close agent editor',exact:true}).click();
    await check('The real packaged picker assigns only the selected agent, keeps the peer grant, and preserves unsaved instructions and procedures without saving them.');
    }else{assert.equal(auth.identity?.id,fixture.owner);assert.equal(auth.identity.email,fixture.email);}
    const existingRequest=await application.evaluate(async(_,id)=>{const r=await globalThis.__coordination.broker.admin.from('desktop_requests').select('id,status').eq('id',id).maybeSingle();if(r.error)throw Error(r.error.message);return r.data;},fixture.requestId);
    assert.equal(existingRequest,null,'Preserve any completed or uncertain request; never replay it.');
    if(resume){assert.equal(fixture.options.mode,'work');fixture.options.mode='chat';evidence.correctedFixtureMode='chat';}
    await writeFile(checkpoint,JSON.stringify(fixture,null,2));
    // Allocate the request once. A failed or uncertain run is retained for diagnosis.
    await application.evaluate((_,fixture)=>{globalThis.__coordination.requests[fixture.requestId]={steps:[{text:'Packaged app verification '+fixture.marker,requireInputs:[fixture.marker,fixture.role],inspectInput:[fixture.marker,fixture.peerMarker,fixture.role]}]};},fixture);
    await call('chat.start',{requestId:fixture.requestId,agentId:fixture.agent,text:'Report the generated saved marker for this acceptance fixture.',options:fixture.options});
    await expect.poll(async()=>application.evaluate(async(_,id)=>{const r=await globalThis.__coordination.broker.admin.from('desktop_requests').select('status,error').eq('id',id).single();if(r.error)throw Error(r.error.message);if(['failed','cancelled','interrupted'].includes(r.data.status))throw Error(r.data.error??r.data.status);return r.data.status;},fixture.requestId),{timeout:90000,intervals:[200,500]}).toBe('completed');
    const saved=await application.evaluate(async(_,fixture)=>{const b=globalThis.__coordination.broker,r=await b.admin.from('desktop_requests').select('conversation_id,status').eq('id',fixture.requestId).single();if(r.error)throw Error(r.error.message);return {conversation:r.data.conversation_id,network:globalThis.__coordination.calls,images:b.images.connections.status(fixture.owner)};},fixture);
    assert.equal(saved.network.length,1);assert.equal(saved.network[0].inputObservation.matches[fixture.peerMarker],false);assert.equal(saved.images.connection.enabled,false);
    fixture.conversation=saved.conversation;fixture.draft='Unsent app selection draft '+fixture.marker;
    await call('drafts.save',{owner:fixture.owner,scope:'conversation:'+fixture.conversation,draft:{text:fixture.draft,options:fixture.options}});
    await page.goto('agentopia://app/conversations/'+fixture.conversation);await expect(page.getByRole('textbox',{name:'Message',exact:true})).toHaveValue(fixture.draft);
    await writeFile(checkpoint,JSON.stringify(fixture,null,2));
    await check('The actual packaged Codex process receives the saved agent role and own memory, excludes the peer memory, and completes one controlled response. Image generation stays disabled.');
   }else{
    assert.equal(auth.identity?.id,fixture.owner,'The saved account must reopen without signing in again.');
    assert.equal(auth.identity.email,fixture.email);
    const profile=await call('agents.profile',{agentId:fixture.agent});assert.equal(profile.revision,fixture.profileRevision);assert.equal(profile.role,fixture.role);assert.equal(profile.sops,'Preserve the selected account and agent.');
    const memories=await call('agents.memory',{agentId:fixture.agent,query:fixture.marker});assert(memories.some(row=>row.id===fixture.memory));
    const agents=await call('agents.list');assert.equal(agents.find(row=>row.id===fixture.agent).system_instructions,fixture.instructions);
    const plugins=await call('plugins.list'),row=plugins.find(row=>row.name===fixture.plugin);assert(row.enabled);for(const agent of [fixture.agent,fixture.peer])assert(row.assignments.some(grant=>grant.agent_id===agent&&grant.enabled));
    await page.goto('agentopia://app/conversations/'+fixture.conversation);await expect(page.getByRole('textbox',{name:'Message',exact:true})).toHaveValue(fixture.draft);await expect(page.getByText('Packaged app verification '+fixture.marker,{exact:true})).toBeVisible();
    await check('A fresh process restores the saved account, both app grants, original instructions, private memory, completed conversation and unsent draft.');
    await page.goto('agentopia://app/agents/'+fixture.agent);await page.getByRole('region',{name:'Agent home for '+fixture.name,exact:true}).getByRole('button',{name:'Edit agent',exact:true}).click();
    const editor=page.getByRole('region',{name:'Edit agent',exact:true});await editor.getByRole('button',{name:'Browse apps',exact:true}).click();
    const picker=page.getByRole('dialog',{name:'Apps for '+fixture.name,exact:true});await picker.getByRole('tab',{name:'Personal',exact:true}).click();await picker.getByRole('button',{name:'Manage plugin '+fixture.pluginTitle,exact:true}).click();
    await expect(picker.getByRole('checkbox',{name:'Assign '+fixture.pluginTitle+' to '+fixture.name,exact:true})).toBeChecked();
    await page.setViewportSize({width:640,height:900});assert(await picker.evaluate(element=>element.scrollWidth<=element.clientWidth));await page.screenshot({path:path.join(out,'cold-scoped-picker-narrow.png'),animations:'disabled'});
    await picker.getByRole('button',{name:'Close dialog',exact:true}).click();await editor.getByRole('button',{name:'Close agent editor',exact:true}).click();
    const observations=await application.evaluate(async(_,fixture)=>{const b=globalThis.__coordination.broker,r=await b.admin.from('desktop_requests').select('id,status').eq('id',fixture.requestId).single();if(r.error)throw Error(r.error.message);return {request:r.data,calls:globalThis.__coordination.calls,images:b.images.connections.status(fixture.owner)};},fixture);
    assert.equal(observations.request.status,'completed');assert.deepEqual(observations.calls,[]);assert.equal(observations.images.connection.enabled,false);
    await check('The reopened narrow picker retains its selected-agent grant; startup and browsing make no model requests and never replay the completed response.');
   }
   return {phase,savedAccount:true,scopedAppAssignment:true,peerGrantPreserved:true,imagesDisabled:true};
  }
 });
 assert(result.success&&result.normalExit===0);assert(!(await list(true)).includes(cfg.distribution));
 evidence.normalExit=result.normalExit;evidence.runtimeStopped=true;evidence.controlledResponses=result.controlledNetwork.calls.length;evidence.success=true;
 await writeFile(path.join(cfg.out,phase+'-accepted.json'),JSON.stringify({success:true,out,evidence:path.join(out,'evidence.json'),phase,imageSha256:candidate.imageSha256,actualPostgres:true,actualCodexHarness:true,controlledResponses:evidence.controlledResponses,realProviderRequests:0,productionAccess:false,installed:false},null,2),{flag:'wx'});
}catch(error){evidence.error=error.stack;evidence.cause=error.cause?.stack;console.error(error.stack);if(error.cause)console.error(error.cause.stack);process.exitCode=1;}
finally{await writeFile(path.join(out,'evidence.json'),JSON.stringify(evidence,null,2));}
console.log(JSON.stringify({success:evidence.success,out,phase,checks:evidence.checks.length,installed:false,realProviderRequests:0}));
