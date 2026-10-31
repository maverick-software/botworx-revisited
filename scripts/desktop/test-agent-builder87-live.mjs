// Opt-in packaged acceptance. Never rerun an uncertain attempt: inspect its receipt first.
// First capture: --proof F:/.../package-proof.json --attempt unique-capture --capture-declarations
// Then live: --proof F:/.../package-proof.json --attempt unique-live --declarations F:/.../declarations.json [--create]
// A recorded screenshot-only failure can use --resume-from evidence.json to reuse
// its acknowledged creation and send only the follow-up, never another creation.
import assert from 'node:assert/strict';
import path from 'node:path';
import {mkdir,writeFile} from 'node:fs/promises';
import {randomUUID,createHash} from 'node:crypto';
import {expect as baseExpect} from '@playwright/test';
import {desktopOperation} from './operation-lock.mjs';
import {json,hash,list} from './phased-backup-control.mjs';
import {launchDurableProfileProbe} from './launch-durable-profile-probe.mjs';
import {prepareValidationAccess76} from './prepare-live-access-envelope76.mjs';
import {installValidationGuard76} from './install-live-validation76-guard.mjs';
import {callFor,seedValidation76,releaseValidation76} from './live-validation76-session.mjs';

const args=process.argv.slice(2),option=name=>{const index=args.indexOf(name);assert(index>=0&&args[index+1]&&!args[index+1].startsWith('--'),'Required '+name);return args[index+1];};
assert(args.every((value,index)=>['--proof','--attempt','--create','--capture-declarations','--declarations','--resume-from'].includes(value)||index>0&&['--proof','--attempt','--declarations','--resume-from'].includes(args[index-1])),'Unknown argument');
const proofFile=path.resolve(option('--proof')),attempt=option('--attempt'),create=args.includes('--create'),capture=args.includes('--capture-declarations');
assert(!(capture&&(create||args.includes('--declarations'))),'Capture cannot create an agent or consume a declaration receipt.');
const declarationsFile=capture?null:path.resolve(option('--declarations')),resumeFile=args.includes('--resume-from')?path.resolve(option('--resume-from')):null;assert(!(capture&&resumeFile));
assert(/^[a-zA-Z0-9_-]{8,80}$/.test(attempt),'Use an explicit unique attempt id (8-80 letters, digits, underscores or hyphens).');
desktopOperation('bounded seamless builder87 OAuth acceptance');
const proof=await json(proofFile),qualified=await json(path.join(proof.out,'qualification.json')),cfg=await json(proof.qaIntent),expect=baseExpect.configure({timeout:30000});
const bindingHashes={proofSha256:await hash(proofFile),imageSha256:proof.imageSha256,qaIntentSha256:await hash(proof.qaIntent)},declarations=capture?null:await json(declarationsFile);
if(!capture){assert(declarations.success&&declarations.mode==='capture-declarations'&&declarations.providerRequests===0&&declarations.externalBodyDispatched===false&&declarations.normalExit&&declarations.qaRuntimeStopped,'A successful offline declaration capture is required.');assert.deepEqual(declarations.binding,bindingHashes);assert(Array.isArray(declarations.declarations));assert.equal(createHash('sha256').update(JSON.stringify(declarations.declarations)).digest('hex'),declarations.digest);}
const retained=resumeFile?await json(resumeFile):null,retainedAccount=retained?await json(path.join(retained.out,'private-account.json')):null,retainedInput=retained?(await json(path.join(retained.out,'accepted-inputs.json'))).inputs[0]:null;
if(retained){assert(retained.error?.startsWith('page.screenshot: Timeout')&&retained.requests.length===1&&retained.requests[0].kind==='initial'&&retained.requests[0].status==='completed'&&retained.generated);assert.deepEqual(retained.binding,bindingHashes);assert.equal(retainedAccount.owner,retained.owner);assert.equal(retainedInput.requestId,retained.requests[0].id);assert(retained.cleanup.leaseRemoved&&retained.cleanup.oauthCredentialRemoved&&retained.cleanup.routerCredentialRemoved&&retained.cleanup.calls.length===1&&retained.cleanup.calls.every(row=>row.status===200&&!row.outcome));const priorApp=await json(path.join(cfg.out,'builder87-'+retained.attempt,'evidence.json'));assert.equal(priorApp.failureCleanupNormalExit,0);}
assert(proof.success&&proof.version==='0.44.85'&&proof.schema===90);
assert(qualified.success&&qualified.actualPackagedApp&&qualified.actualPostgres&&qualified.actualColdReopening&&qualified.eligibleForInstallerConstruction);
assert.equal(qualified.proofSha256,await hash(proofFile));assert.equal(qualified.imageSha256,proof.imageSha256);
const onF=value=>assert(/^f:\\/i.test(path.resolve(value)),'QA artifacts and home must be on F:');
for(const value of [proof.out,proof.program,proof.image,proof.exe,proof.assets,cfg.out,cfg.home,cfg.roaming,cfg.profile,cfg.program,cfg.exe,cfg.assets])onF(value);
// Qualification runs a separate QA program directory with an isolated database config.
assert(path.resolve(cfg.program).toLowerCase().startsWith(path.resolve(proof.out).toLowerCase()+path.sep));
assert.equal(path.resolve(cfg.exe),path.join(path.resolve(cfg.program),'Agentopia.exe'));
assert.equal(path.resolve(cfg.assets),path.join(path.resolve(cfg.program),'resources','resources'));
assert.equal(cfg.imageSha256,proof.imageSha256);
assert.equal(path.resolve(proof.image),path.join(path.resolve(proof.program),'resources','app.asar'));
assert.equal(await hash(proof.image),proof.imageSha256);assert.equal(await hash(path.join(cfg.program,'resources/app.asar')),proof.imageSha256);
for(const [name,digest]of Object.entries(proof.uiFiles))assert.equal(await hash(path.join(cfg.assets,'ui',name)),digest,'Qualified QA UI: '+name);
assert(!(await list(true)).includes(cfg.distribution),'QA runtime is already active.');
const source='F:/Agentopia-Data/profiles/a91a4800-e08f-4440-a4ec-588762d01bfd/profile';
assert.notEqual(path.resolve(cfg.profile).toLowerCase(),path.resolve(source).toLowerCase());
assert(path.resolve(cfg.home).toLowerCase().startsWith(path.resolve('F:/Agentopia-Acceptance').toLowerCase()+path.sep),'Use the qualified isolated QA home.');
assert(path.resolve(cfg.profile).toLowerCase().startsWith(path.resolve(cfg.home).toLowerCase()+path.sep));
const binding=await json(path.join(cfg.profile,'runtime-binding.json'));assert.equal(binding.distribution,cfg.distribution);assert.equal(binding.instanceId,cfg.instance);
const readyPointer=await json('F:/Agentopia/.supabase/desktop-live-readiness76/current.json'),ready=await json(readyPointer.evidence),sourceOwner=ready.accounts[0].owner;
assert(/^[a-f0-9-]{36}$/i.test(sourceOwner));
const out=path.join(proof.out,'live87-'+attempt),pointer=path.join(proof.out,'live87-'+attempt+'.json');
// Claim before credentials or launch. A repeated id always stops, including failed/unacknowledged attempts.
await writeFile(pointer,JSON.stringify({attempt,proof:proofFile,evidence:path.join(out,'evidence.json')},null,2),{flag:'wx'});await mkdir(out);
const phrase='Prepares clear project meeting briefs with verified decisions and next steps. '+randomUUID().slice(0,8);
const initial='Create an agent that turns the project notes I paste into a useful meeting brief for a project team. It should prepare a concise agenda, summarize progress, identify decisions and risks, and finish with action items showing owners and due dates when the notes provide them. Ask focused questions for important missing facts and keep uncertain facts clear. Choose a suitable name, description, icon, color, conversation starters, and detailed instructions for this purpose.';
const followup='Change only the description to exactly '+JSON.stringify(phrase)+'. Preserve every other field.';
const e={success:false,out,attempt,proof:proofFile,imageSha256:proof.imageSha256,mode:capture?'capture-declarations':'live',declarationsFile,binding:bindingHashes,provider:'openai-oauth',model:'gpt-6.1-sol',requests:[],checks:[],phase:'preparing',submitted:false,createRequested:create,realOpenRouterRequests:0,...(retained?{resumeFrom:{file:resumeFile,sha256:await hash(resumeFile),acknowledgedInitialRequest:retainedInput.requestId,modelReplay:false}}:{})};
const core=({resources,...configuration})=>configuration;
const save=()=>writeFile(path.join(out,'evidence.json'),JSON.stringify(e,null,2));await save();
try{
 const access=await prepareValidationAccess76({out,proof,source,sourceOwner});e.access=access.metadata;await save();
 const result=await launchDurableProfileProbe(cfg,{label:'builder87-'+attempt,testProfile:false,initialProfile:cfg.profile,expectedProfile:cfg.profile,expectedRuntime:'ready',resumeDebugWorkers:true,isolateOsHome:true,hiddenWindow:true,evaluationTimeoutMs:900000,normalCloseTimeoutMs:120000,
  prepareReady:async application=>{
   await installValidationGuard76(application);
   await application.evaluate(({app},{initial,followup,model,out,capture,declarations,retainedInput})=>{
    const req=globalThis.__durableProbeRequire,fs=req('node:fs'),path=req('node:path'),s=globalThis.__validation76;
    const helpers=req(app.getAppPath()+'/build/agent-builder.js'),{agentDraftPreviewInput}=req(app.getAppPath()+'/build/agent-draft-preview-contracts.js'),{AgentDraftPreviews}=req(app.getAppPath()+'/build/agent-draft-previews.js');
    if(typeof helpers.builderGenerationProposal!=='function'||typeof helpers.builderGenerationIssues!=='function')throw Error('Candidate lacks the complete generation contract.');
    s.maxResponses=retainedInput?3:4;s.maxTools=0;s.builder87={retainedInputs:retainedInput?[retainedInput]:[],inputs:[],kinds:[],followupReady:false,corrections:0,capture:null,interceptions:0,helpers};
    const record=()=>{if(!capture)fs.writeFileSync(path.join(out,'accepted-inputs.json'),JSON.stringify({inputs:s.builder87.inputs,kinds:s.builder87.kinds},null,2));};
    const canonical=value=>Array.isArray(value)?value.map(canonical):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])])):value;
    const digest=value=>req('node:crypto').createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
    const declarationSignatures=tools=>{if(tools!==undefined&&!Array.isArray(tools))throw Error('Malformed tool declarations.');return (tools??[]).map(tool=>({type:tool.type??null,name:tool.name??tool.function?.name??null,schemaSha256:digest(tool.parameters??tool.function?.parameters??tool.input_schema??tool.schema??null),signatureSha256:digest(tool)}));};
    const refuse=message=>{s.blocked.push({at:new Date().toISOString(),message});record();throw Error(message);};
    const fetch=globalThis.fetch;globalThis.fetch=(input,args={})=>{
     const url=new URL(typeof input==='string'?input:input.url??String(input));
     if(!['127.0.0.1','localhost','[::1]'].includes(url.hostname)){
      if(url.origin!=='https://api.openai.com'||!['/v1/models','/v1/responses'].includes(url.pathname))return refuse('Only the declared OAuth connection may access external services.');
      if(url.pathname==='/v1/responses'){
       if(url.href!=='https://api.openai.com/v1/responses'||args.method!=='POST')return refuse('Only the exact Responses POST is permitted.');
       const body=JSON.parse(args.body),context=JSON.stringify([body.instructions,body.input]);
       if(s.calls.some(row=>row.outcome==='unconfirmed'||row.status!==null&&(row.status<200||row.status>=300)))return refuse('A previous dispatch failed or is uncertain. Inspect it without another model request.');
       if(body.model!==model||/data:image\/|\"(?:input_image|image_url)\"/.test(context))return refuse('This acceptance permits only text and the selected model without images.');
       const signatures=declarationSignatures(body.tools),signatureDigest=req('node:crypto').createHash('sha256').update(JSON.stringify(signatures)).digest('hex');
       if(capture){
        if(!s.leaseActive||s.expiresAt<Date.now()+90000||s.builder87.inputs.length!==1||s.builder87.kinds[0]!=='initial')return refuse('Capture requires the fresh lease and exact initial UI request.');
        if(!args.signal?.addEventListener)return refuse('Capture requires the gateway cancellation signal.');
        if(s.builder87.interceptions++)return refuse('Only the first declaration capture is permitted.');
        s.builder87.capture={declarations:signatures,digest:signatureDigest,providerRequests:0,externalBodyDispatched:false};
        // Keep the undispatched request pending until the normal preview stop aborts it.
        return new Promise((_resolve,reject)=>{const stop=()=>reject(new DOMException('Offline declarations captured; preview cancelled before external dispatch.','AbortError'));if(args.signal?.aborted)stop();else args.signal.addEventListener('abort',stop,{once:true});});
       }
       if(signatureDigest!==declarations.digest)return refuse('Tool declarations changed from this candidate offline capture.');
      }
     }
     return fetch(input,args);
    };
    const start=AgentDraftPreviews.prototype.start;AgentDraftPreviews.prototype.start=async function(user,raw){
     const input=agentDraftPreviewInput(raw),state=s.builder87,policy=input.snapshot.behavior.policy,execution=input.snapshot.execution;
     if(user.id!==s.owner||input.sourceAgentId!==null||!input.creationId||!input.snapshot.builder||input.snapshot.provider!=='openai-oauth'||input.snapshot.model!==model||execution?.permission!=='chat'||execution.mode!=='chat'||execution.files.length||execution.skills?.length||execution.tools?.length||execution.windows?.length||execution.sources?.length||policy.tools===null||policy.tools.length||policy.delegation||policy.memory||policy.memoryWrite||policy.delegateAgents.length||policy.maxDepth!==0||policy.maxTurns!==1)return refuse('Builder request left the declared passive creation scope.');
     if(state.inputs.some(row=>row.requestId===input.requestId))return refuse('Automatic request replay is forbidden. Inspect the saved request.');
     if(retainedInput&&(input.text===initial||input.sessionId!==retainedInput.sessionId||input.creationId!==retainedInput.creationId))return refuse('A retained completed creation cannot be replayed or change scope.');
     let kind;
     if(state.inputs.length===0&&input.text===initial)kind='initial';
     else if(input.text===followup&&state.followupReady&&!state.kinds.includes('followup'))kind='followup';
     else if(state.inputs.length===1&&state.corrections===0){
      const first=state.inputs[0],rows=await this.read(user.id,first.sessionId),row=rows.find(row=>row.id===first.requestId);
      if(!row||row.status!=='completed')return refuse('A correction requires a definitely completed first response.');
      // Match the UI's completion protocol; capability assignment has its own validation.
      let full=null;try{full=helpers.builderProposal(row.output_text);}catch{}
      const coreOutput=full?JSON.stringify({...full,changes:Object.fromEntries(Object.entries(full.changes).filter(([field])=>field!=='apps'&&field!=='assignedSkills'))}):row.output_text;
      const issues=helpers.builderGenerationIssues(coreOutput,first.snapshot.builder,{creation:true});
      const correction='[Agent builder completion] Complete the agent configuration for the original request retained in this conversation. Fix these response issues: '+issues.join(' ').slice(0,10000)+' Return the complete purpose-built configuration in the required JSON format. Preserve the original intent and choose existing catalog entries only.\n\nOriginal request excerpt (use the full request in the conversation):\n'+initial.slice(0,30000)+'\n\nPrevious response excerpt:\n'+row.output_text.slice(0,30000);
      if(!issues.length||input.text!==correction)return refuse('Only the predeclared relevant complete-generation correction is allowed.');
      state.corrections++;kind='completion-correction';
     }else return refuse('Only the two declared user intents and one completion correction are allowed.');
     if(state.inputs.length&&input.sessionId!==state.inputs[0].sessionId)return refuse('Builder session changed.');
     // Register before original.start can reserve work or dispatch inference.
     s.cases[input.requestId]={kind:'preview',agent:input.sessionId,provider:'openai-oauth',model,readPaths:[],maximumResponses:2};
     state.inputs.push(input);state.kinds.push(kind);record();return start.call(this,user,input);
    };
   },{initial,followup,model:e.model,out,capture,declarations,retainedInput});
  },
  runReady:async({application,page})=>{
   const call=callFor(page),editor=()=>page.getByRole('region',{name:/^(Create an agent|Edit agent)$/}),builder=()=>editor().getByRole('complementary',{name:'Agent builder'});
   const inputs=()=>application.evaluate(()=>({inputs:globalThis.__validation76.builder87.inputs,kinds:globalThis.__validation76.builder87.kinds}));
   const checkNative=()=>application.evaluate(async()=>{
    const b=globalThis.__coordination.broker,s=globalThis.__validation76,summary=[];
    for(const input of [...s.builder87.retainedInputs,...s.builder87.inputs]){
     const result=await b.admin.from('desktop_preview_codex_turns').select('state').eq('request_id',input.requestId).eq('user_id',s.owner).single();if(result.error)throw Error(result.error.message);const state=result.data.state,types=(state.items??[]).map(entry=>entry.item.type);
     if(state.goal||state.composerGoalId||state.children?.length||state.reports?.length||state.namedAssignments?.length||state.tools?.length||state.approvals?.length||state.diffs?.length||types.some(type=>!['userMessage','agentMessage','reasoning','plan','contextCompaction'].includes(type)))throw Error('Native execution activity occurred in the passive builder acceptance.');
     summary.push({requestId:input.requestId,itemTypes:types,goal:null,children:0,executionItems:0});
    }
    return summary;
   });
   const parse=async(row,creation)=>application.evaluate(({app},{row,creation})=>{const h=globalThis.__durableProbeRequire(app.getAppPath()+'/build/agent-builder.js'),proposal=h.builderGenerationProposal(row.output_text,row.snapshot.builder,{creation});return {proposal,configuration:h.applyBuilderProposal(row.snapshot.builder,row.snapshot.builder,proposal)};},{row,creation});
   const settle=async kind=>{
    const deadline=Date.now()+300000;let cursor=0;
    while(Date.now()<deadline){
     const state=await inputs();
     for(let i=cursor;i<state.inputs.length;i++){
      const accepted=state.inputs[i],row=(await call('agentDraftPreview.read',{owner:e.owner,sessionId:accepted.sessionId})).find(row=>row.id===accepted.requestId);
      if(!row||row.status==='running')break;
      assert.equal(row.status,'completed',row.error??'Uncertain or failed outcome; inspect without replay.');assert.equal(row.user_id,e.owner);assert.equal(row.input_text,accepted.text);assert.deepEqual(row.snapshot,accepted.snapshot,'PostgreSQL must retain the actual submitted full snapshot.');
      e.requests[i]={kind:state.kinds[i],id:row.id,sessionId:accepted.sessionId,status:row.status,input:row.input_text,reply:row.output_text,snapshot:row.snapshot};cursor=i+1;await save();
      if(kind==='followup'&&state.kinds[i]==='followup')return {row,...await parse(row,false)};
      if(kind==='initial'&&['initial','completion-correction'].includes(state.kinds[i])){
       const issues=await application.evaluate(({app},{row})=>globalThis.__durableProbeRequire(app.getAppPath()+'/build/agent-builder.js').builderGenerationIssues(row.output_text,row.snapshot.builder,{creation:true}),{row});
       if(!issues.length)return {row,...await parse(row,true)};
       assert.equal(state.kinds[i],'initial','The single completion correction was incomplete.');e.initialGenerationIssues=issues;await save();
      }
     }
     const alerts=await builder().getByRole('alert').allTextContents();assert(!alerts.some(text=>/not acknowledged|interrupted|failed|uncertain/i.test(text)),alerts.join('\n'));
     await new Promise(resolve=>setTimeout(resolve,300));
    }
    throw Error('Bounded wait expired. Inspect saved requests and dispatches; do not resubmit.');
   };
   const checkFields=async configuration=>{
    await expect(editor().getByRole('textbox',{name:'Name',exact:true})).toBeVisible();await expect(editor().getByRole('textbox',{name:'Name',exact:true})).toHaveValue(configuration.name);await expect(editor().getByRole('textbox',{name:'Description',exact:true})).toHaveValue(configuration.description);
    await editor().getByRole('button',{name:'Instruction editing mode',exact:true}).click();await editor().getByRole('menuitemradio',{name:'Markdown source',exact:true}).click();await expect(editor().getByRole('textbox',{name:'Instructions',exact:true})).toHaveValue(configuration.instructions);
    await expect(builder().getByRole('button',{name:/Apply|Review/i})).toHaveCount(0);
    await editor().getByRole('button',{name:'Edit agent profile',exact:true}).click();const profile=page.getByRole('dialog',{name:'Agent profile',exact:true});await expect(profile.getByRole('button',{name:configuration.appearance.icon+' profile icon',exact:true})).toHaveAttribute('aria-pressed','true');await expect(profile.getByRole('button',{name:configuration.appearance.color+' profile color',exact:true})).toHaveAttribute('aria-pressed','true');await profile.getByRole('button',{name:'Done',exact:true}).click();
    await editor().getByRole('button',{name:'Conversation starters',exact:true}).click();const starters=page.getByRole('dialog',{name:'Conversation starters',exact:true});await expect(starters.locator('.agent-starter-edit')).toHaveCount(configuration.appearance.starters.length);
    for(const [index,starter]of configuration.appearance.starters.entries()){await expect(starters.getByRole('textbox',{name:'Starter '+(index+1)+' title',exact:true})).toHaveValue(starter.title);await expect(starters.getByRole('textbox',{name:'Starter '+(index+1)+' prompt',exact:true})).toHaveValue(starter.prompt);}await starters.getByRole('button',{name:'Done',exact:true}).click();
   };
   try{
    e.owner=await seedValidation76(application,page,out,access,retainedAccount);await call('terminal.revoke',{owner:e.owner});await page.reload();await page.waitForFunction(()=>!!window.agentopia);assert.equal((await call('auth.state')).identity.id,e.owner);const account=await json(path.join(out,'private-account.json'));await expect(page.getByRole('button',{name:'Account menu',exact:true})).toHaveAttribute('title',account.email);
    const before=(await call('agents.list')).map(row=>row.id);await page.goto('agentopia://app/agents');await page.getByRole('region',{name:'Agents directory',exact:true}).getByRole('button',{name:'Create',exact:true}).click();await page.getByRole('menuitem',{name:'Create agent',exact:true}).click();
    if(!retained){await expect(builder().getByRole('heading',{name:'What should your agent do?',exact:true})).toBeVisible();await expect(editor().getByRole('textbox',{name:'Name',exact:true})).toBeHidden();}
    if(!retained){await builder().getByRole('textbox',{name:'Message agent builder',exact:true}).fill(initial);await expect(builder().getByRole('button',{name:'Send to agent builder',exact:true})).toBeEnabled();e.phase='initial-submission';e.submitted=true;await save();await builder().getByRole('button',{name:'Send to agent builder',exact:true}).click();}
    if(capture){
     const deadline=Date.now()+120000;let captured;
     while(Date.now()<deadline){captured=await application.evaluate(()=>globalThis.__validation76.builder87.capture);if(captured)break;await new Promise(resolve=>setTimeout(resolve,100));}
     assert(captured,'No initial outgoing declaration body was intercepted.');const accepted=await inputs();assert.equal(accepted.inputs.length,1);assert.deepEqual(accepted.kinds,['initial']);
     e.capture=captured;await save();await call('agentDraftPreview.stop',{owner:e.owner,sessionId:accepted.inputs[0].sessionId});await expect.poll(async()=>(await call('agentDraftPreview.active',{owner:e.owner})).length,{timeout:15000}).toBe(0);
     e.capture=captured;e.native=await checkNative();assert.deepEqual((await call('agents.list')).map(row=>row.id),before);e.phase='captured-before-dispatch';e.checks.push('The exact initial UI request reached the qualified native runtime; its declarations were intercepted before external dispatch and the preview stopped normally.');await save();return {success:true,offlineCapture:true,providerRequests:0,externalBodyDispatched:false};
    }
    // The candidate's generation parser already validates nonempty uppercase Markdown sections.
    let first;if(retained){const row=(await call('agentDraftPreview.read',{owner:e.owner,sessionId:retainedInput.sessionId})).find(row=>row.id===retainedInput.requestId);assert(row&&row.status==='completed'&&row.output_text===retained.requests[0].reply);first={row,...await parse(row,true)};assert.deepEqual(first.configuration,retained.generated);e.inheritedInitial=retained.requests[0];}else first=await settle('initial');e.generated=first.configuration;e.firstProposal=first.proposal;assert(first.configuration.instructions.length>300);assert(/project|meeting/i.test(first.configuration.name+' '+first.configuration.instructions));
    await checkFields(first.configuration);assert.deepEqual((await call('agents.list')).map(row=>row.id),before);e.checks.push('A natural request crossed PostgreSQL and the real OAuth runtime, then automatically filled every visible core field.');await save();
    await application.evaluate(()=>globalThis.__validation76.builder87.followupReady=true);await builder().getByRole('textbox',{name:'Message agent builder',exact:true}).fill(followup);e.phase='followup-submission';await save();await builder().getByRole('button',{name:'Send to agent builder',exact:true}).click();const second=await settle('followup');assert.deepEqual(second.proposal.changes,{description:phrase});assert.deepEqual(core(second.row.snapshot.builder),core(first.configuration),'The followup must use every core field from the complete current draft.');assert.deepEqual(core(second.configuration),{...core(first.configuration),description:phrase});await checkFields(second.configuration);assert.deepEqual((await call('agents.list')).map(row=>row.id),before);e.checks.push('The exact requested description updates automatically while every other core field remains unchanged and unsaved.');e.finalConfiguration=second.configuration;await save();
    if(create){
     await editor().locator('.agent-editor-page-header').getByRole('button',{name:'Create agent',exact:true}).click();await expect(editor()).toHaveCount(0);const created=(await call('agents.list')).filter(row=>!before.includes(row.id));assert.equal(created.length,1);const agent=created[0];e.agentId=agent.id;assert.equal(agent.name,second.configuration.name);assert.equal(agent.description,phrase);assert.equal(agent.system_instructions,second.configuration.instructions);
     e.savedProfile=await call('agents.profile',{agentId:agent.id});e.savedPresentation=await call('agents.presentation.get',{owner:e.owner,agentId:agent.id});for(const key of ['icon','color','starters'])assert.deepEqual(e.savedPresentation[key],second.configuration.appearance[key]);for(const key of ['handle','role','sops','guardrails','skills','policy'])assert.deepEqual(e.savedProfile[key],second.configuration.behavior[key],key);
     e.savedOwner=await application.evaluate(async(_,{owner,id})=>{const result=await globalThis.__coordination.broker.admin.from('agents').select('user_id').eq('id',id).single();if(result.error)throw Error(result.error.message);if(result.data.user_id!==owner)throw Error('The saved agent belongs to another account.');return result.data.user_id;},{owner:e.owner,id:agent.id});e.checks.push('Explicit Create saves all generated fields exactly once under the temporary QA account.');
    }
    await expect.poll(async()=>(await call('agentDraftPreview.active',{owner:e.owner})).length,{timeout:15000}).toBe(0);e.native=await checkNative();e.phase='verified';await save();return {success:true,twoUserIntents:true,automaticFullConfiguration:true,created:create};
   }finally{
    try{e.cleanup=await releaseValidation76(application);}finally{await save();}
   }
  }
 });
 assert(result.success&&result.normalExit===0);e.appEvidence=path.join(result.out,'evidence.json');e.normalExit=true;assert(e.cleanup.leaseRemoved&&e.cleanup.oauthCredentialRemoved&&e.cleanup.routerCredentialRemoved);assert.deepEqual(e.cleanup.blocked,[]);assert.equal(e.cleanup.tools.length,0);e.newRealOAuthResponseCalls=e.cleanup.calls.length;e.realOAuthResponseCalls=e.cleanup.calls.length+(retained?.cleanup.calls.length??0);
 if(capture){assert.equal(e.cleanup.calls.length,0);assert(e.capture&&e.capture.providerRequests===0&&e.capture.externalBodyDispatched===false);}
 else{assert(e.cleanup.calls.length>=(retained?1:2)&&e.cleanup.calls.length<=(retained?3:4));assert(e.cleanup.calls.every(row=>row.provider==='openai-oauth'&&row.model===e.model&&row.images===0&&row.actor==='parent'&&row.status>=200&&row.status<300&&!row.outcome));assert.equal(e.requests.filter(row=>row.kind==='initial').length,retained?0:1);assert.equal(e.requests.filter(row=>row.kind==='followup').length,1);assert(e.requests.filter(row=>row.kind==='completion-correction').length<=1);}
 assert.equal(await hash(proof.image),proof.imageSha256);assert.equal(await hash(path.join(cfg.program,'resources/app.asar')),proof.imageSha256);assert.deepEqual({proofSha256:await hash(proofFile),imageSha256:proof.imageSha256,qaIntentSha256:await hash(proof.qaIntent)},bindingHashes);e.qaRuntimeStopped=!(await list(true)).includes(cfg.distribution);assert(e.qaRuntimeStopped);e.success=true;e.phase=capture?'captured':'accepted';await save();
 if(capture){e.declarationsFile=path.join(out,'declarations.json');await writeFile(e.declarationsFile,JSON.stringify({success:true,mode:'capture-declarations',attempt,binding:bindingHashes,...e.capture,normalExit:true,qaRuntimeStopped:true},null,2),{flag:'wx'});await save();}
}catch(error){e.success=false;e.error=error.cause?.message??error.stack??error.message;e.phase='stopped-inspect-without-replay';process.exitCode=1;await save();}
console.log(JSON.stringify({success:e.success,out,phase:e.phase,checks:e.checks.length,realOAuthResponseCalls:e.realOAuthResponseCalls,realOpenRouterRequests:0,normalExit:e.normalExit,declarationsFile:e.declarationsFile,created:e.agentId??null,error:e.error}));
