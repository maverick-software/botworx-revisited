import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import path from 'node:path';
import {expect} from '@playwright/test';

export async function auditReportStatus({application,page,cfg,account,marker,evidence,save,check,helpers}){
 const h=helpers(application,page),identity=(await h.call('auth.state')).identity;
 assert.equal(identity?.id,cfg.owner);await h.continuity();
 const pending=await h.read('desktop_requests','id,status',{user_id:cfg.owner,status:'running'});assert.equal(pending.length,0,'Inspect pre-existing QA work before creating another request');
 for(const prior of evidence.priorAttempt?.requests??[]){assert.equal((await h.status(prior.id)).status,'completed');const saved=(await h.read('desktop_codex_turns','state',{request_id:prior.id}))[0].state;assert(saved.reports?.length&&saved.reports.every(row=>['cancelled','interrupted','completed','failed'].includes(row.status)),'A prior report is still unfinished');}
 await application.evaluate(async(_,owner)=>{const b=globalThis.__coordination.broker,key=b.secrets.get('openai:'+owner);if(key?.access_token!=='CONTROLLED-NOT-A-PROVIDER-CREDENTIAL')throw Error('Expected only the retained generated connection');await b.secrets.set('openai:'+owner,{...key,expires_at:Date.now()+3600000});},cfg.owner);
 const child=await h.call('agents.save',{name:'Status specialist '+marker,description:'Generated current-report status audit',instructions:'Return the generated status result.',provider:'openai-oauth',model:'gpt-6.1-sol'}),cp=await h.call('agents.profile',{agentId:child});
 await h.call('agents.profile.save',{agentId:child,value:{...cp,handle:'status-child-'+marker,policy:{...cp.policy,tools:[],delegation:false,memory:false,memoryWrite:false,maxDepth:2}}});
 const parent=await h.call('agents.save',{name:'Status coordinator '+marker,description:'Generated current-report status audit',instructions:'Inspect your own real assignments before reporting.',provider:'openai-oauth',model:'gpt-6.1-sol'}),pp=await h.call('agents.profile',{agentId:parent});
 await h.call('agents.profile.save',{agentId:parent,value:{...pp,handle:'status-parent-'+marker,policy:{...pp.policy,tools:['invoke_agent','list_agent_instances','read_agent_instance'],delegation:true,delegateAgents:[child],memory:true,memoryWrite:false,maxDepth:2}}});
 evidence.agents={parent,child};await save();
 await application.evaluate((_,marker)=>{const s=globalThis.__coordination,launch=s.broker.assignments.launch;s.statusCases={};s.broker.assignments.launch=async function(record,instance,...rest){const rule=s.statusCases[record.origin_request_id];if(!rule)throw Error('Unexpected generated delegation');rule.child=record.request_id;s.requests[record.request_id]={steps:[{text:'STATUS-CHILD-'+marker,hold:rule.childHold}]};return launch.call(this,record,instance,...rest);};},marker);
 async function start(kind){
  const id=randomUUID(),childHold='status-child-'+kind+'-'+marker,reportHold='status-report-'+kind+'-'+marker;
  await application.evaluate((_,{id,child,kind,marker,childHold,reportHold})=>{const s=globalThis.__coordination,invoke='const target=ALL_TOOLS.find(t=>t.name.endsWith("invoke_agent"));text(await tools[target.name]('+JSON.stringify({agent_id:child,assignment:'Return the generated status result '+marker,wait_seconds:0})+'));',list='const target=ALL_TOOLS.find(t=>t.name.endsWith("list_agent_instances"));text(await tools[target.name]({limit:100,offset:0}));';s.statusCases[id]={childHold};s.requests[id]={steps:[{kind:'exec',code:invoke},{text:'STATUS-PARENT-'+kind+'-'+marker,requireInput:'invocation_id'}],report:{steps:[{kind:'exec',code:list},{text:'STATUS-REPORT-'+kind+'-'+marker,hold:reportHold,requireInput:'running'}]}};},{id,child,kind,marker,childHold,reportHold});
  const chat=await h.call('chat.start',{requestId:id,agentId:parent,text:'Delegate this generated task '+marker+' to the permitted specialist.',options:{provider:'openai-oauth',model:'gpt-6.1-sol',thinking:'default',permission:'full',mode:'chat',files:[],tools:[]}});
  evidence.requests.push({kind,id,conversation:chat.conversation_id});await save();await h.held(childHold);await h.finished(id);await h.release(childHold);await h.held(reportHold);
  const raw=(await h.read('desktop_requests','agent_instance_id,status',{id}))[0],instanceId=raw.agent_instance_id;assert.equal(raw.status,'completed');
  const tool=(await h.read('desktop_tool_calls','status,result',{request_id:id,name:'list_agent_instances'}))[0];assert.equal(tool?.status,'completed');assert.equal(tool.result.instances.find(row=>row.id===instanceId)?.status,'running','The actual agent tool must observe the running report');
  const list=await h.call('agents.instances',{agentId:parent,limit:100,offset:0}),detail=await h.call('agents.instance.read',{instanceId,offset:0,characters:12000});assert.equal(list.find(row=>row.id===instanceId)?.status,'running');assert.equal(detail.instance.status,'running');assert.equal(detail.instance.primary_status,'completed');
  const live=await h.call('native.reports.active');assert(live.some(row=>row.requestId===id&&row.conversationId===chat.conversation_id));
  return {id,chat,instanceId,reportHold};
 }
 const first=await start('stop'),second=await start('keep');
 await check('Two actual Codex report continuations inspect their own working status through list_agent_instances after their initial requests completed; the SQL-backed settings list and detail agree.');
 await page.goto('agentopia://app/conversations/'+second.chat.conversation_id);await page.getByRole('textbox',{name:'Message',exact:true}).fill('PRESERVED-STATUS-DRAFT-'+marker);await expect(page.locator('.history-row.active').getByLabel('Working',{exact:true})).toBeVisible();
 await h.call('agents.instance.cancel',{instanceId:first.instanceId});
 await expect.poll(async()=>{const active=await h.call('native.reports.active');return active.some(row=>row.requestId===first.id);},{timeout:30000}).toBe(false);
 assert((await h.call('native.reports.active')).some(row=>row.requestId===second.id));assert.equal((await h.delivery(first.id))[0].status,'cancelled');
 const firstSaved=(await h.read('desktop_codex_turns','state',{request_id:first.id}))[0].state;evidence.scopedStop={first:first.id,second:second.id,reportStatus:firstSaved.reports.find(row=>row.assignments?.length)?.status,otherActive:(await h.call('native.reports.active')).some(row=>row.requestId===second.id)};await save();assert.equal(evidence.scopedStop.reportStatus,'cancelled');assert(evidence.scopedStop.otherActive);assert.equal((await h.call('agents.instance.read',{instanceId:first.instanceId,offset:0,characters:12000})).instance.status,'completed');
 await expect(page.locator('.history-row.active').getByLabel('Working',{exact:true})).toBeVisible();await expect(page.getByRole('textbox',{name:'Message',exact:true})).toHaveValue('PRESERVED-STATUS-DRAFT-'+marker);await page.screenshot({path:path.join(evidence.out,'one-report-stopped-other-working.png')});
 await check('Stopping one saved assignment interrupts only its automatic report, preserves the completed initial result, and leaves the second report and unsent draft working.');
 await h.release(second.reportHold);await h.settled(second.id);await expect(page.locator('.history-row.active').getByLabel('Working',{exact:true})).toHaveCount(0);await expect(page.getByRole('textbox',{name:'Message',exact:true})).toHaveValue('PRESERVED-STATUS-DRAFT-'+marker);
 const rows=await h.call('agents.instances',{agentId:parent,limit:100,offset:0});assert.equal(rows.find(row=>row.id===second.instanceId)?.status,'completed');
 const saved=(await h.read('desktop_codex_turns','state',{request_id:second.id}))[0].state;assert.equal(saved.reports.find(row=>row.assignments?.length)?.status,'completed');assert.match((await h.call('agents.instance.read',{instanceId:second.instanceId,offset:0,characters:12000})).transcript,/STATUS-REPORT-keep-/);
 evidence.calls=await application.evaluate(()=>globalThis.__coordination.calls);assert.equal(evidence.calls.filter(row=>row.actor==='report'&&row.kind==='exec').length,2);
 await check('The other report completes once, its saved continuation is readable, and assignment/sidebar status return to completed while the draft is retained.');
 return {ownStatusTool:true,sqlSnapshot:true,scopedStop:true,otherReportCompleted:true,draftPreserved:true};
}
