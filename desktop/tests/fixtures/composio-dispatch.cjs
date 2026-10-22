const assert=require('node:assert/strict'),path=require('node:path'),{randomUUID}=require('node:crypto');
const build=process.env.AGENTOPIA_COMPOSIO_TEST_BUILD,{ComposioConnections}=require(path.join(build,'composio-connections.js')),{AgentAssignments}=require(path.join(build,'agent-assignments.js')),{defaultAgentPolicy}=require(path.join(build,'agent-contracts.js')),{ScheduledTaskExecution}=require(path.join(build,'scheduled-task-execution.js')),{PostgresScheduledTasks}=require(path.join(build,'scheduled-task-store.js')),{TaskScheduler}=require(path.join(build,'task-scheduler.js'));

/** SQL-shaped test responses exercise the actual service and broker paths.
 * PostgreSQL transaction/RLS behavior requires separate full-application proof. */
async function dispatch(f){
 const {db,receiver:broker,user,harness,tools}=f,root=f.otherAgent,specialist=f.agent,profiles=new Map(),calls=[],table=name=>db.tables[name]??=[],copy=structuredClone;
 const policy={...defaultAgentPolicy,memory:false,memoryWrite:false,tools:['mcp_search','mcp_call']};
 for(const [id,handle,allowed]of [[root,'coordinator',{...policy,tools:['invoke_agent','read_agent_instance','mcp_search','mcp_call'],delegateAgents:[specialist]}],[specialist,'connector-specialist',policy]]){
  profiles.set(id,{agent_id:id,user_id:f.owner,handle,role:id===root?'Coordinate specialist assignments':'Use the assigned GitHub account',sops:'Keep the selected account pinned.',guardrails:'Report only saved tool results.',skills:[],policy:allowed,revision:1,definition:{name:handle,active:true}});
  const row=table('agents').find(row=>row.id===id);if(row)Object.assign(row,{name:handle,agent_llm_preferences:[{provider:'openai-oauth',model:'gpt-6.1-sol'}]});else table('agents').push({id,user_id:f.owner,name:handle,active:true,metadata:{},agent_llm_preferences:[{provider:'openai-oauth',model:'gpt-6.1-sol'}]});
 }
 const connections=new ComposioConnections(f.store,async()=>f.owner,async(owner,agent)=>{assert.equal(owner,f.owner);assert(profiles.has(agent),'Agent is outside the fixture owner');},async()=>{},()=>f.client);f.service=connections;f.remote.composio=connections;broker.composio=connections;await connections.assign(f.owner,f.connection.id,[root,specialist]);
 const own=(name,id,key='id')=>{const row=table(name).find(row=>row[key]===id&&row.user_id===f.owner);assert(row,'Missing owned '+name);return row;};
 function instance(agent,conversation,parent=null,request=null,ceiling=null,chain=[]){const row={id:randomUUID(),user_id:f.owner,agent_id:agent,agent_revision:profiles.get(agent).revision,conversation_id:conversation,project_id:null,parent_instance_id:parent,assignment:'Controlled connector assignment',status:request?'running':'queued',checkpoint:'',request_id:request,depth:parent?1:0,policy_ceiling:ceiling,authority_chain:chain};table('desktop_agent_instances').push(row);return row;}
 const rootChat=randomUUID(),rootRequest={id:randomUUID(),user_id:f.owner,agent_id:root,conversation_id:rootChat,user_message_id:randomUUID(),assistant_message_id:randomUUID(),status:'running'},rootInstance=instance(root,rootChat,null,rootRequest.id);rootRequest.agent_instance_id=rootInstance.id;table('desktop_requests').push(rootRequest);table('conversation_sessions').push({conversation_id:rootChat,user_id:f.owner,agent_id:root});table('chat_messages_v2').push({id:rootRequest.user_message_id,conversation_id:rootChat,role:'user',content:{text:'Ask the connector specialist to inspect the connected account.'},metadata:{project:null}});
 db.rpc=async(name,args={})=>{
  calls.push({name,args:copy(args)});if(args.p_user!==undefined)assert.equal(args.p_user,f.owner,'RPC uses the current owner');let value=null;
  if(name==='desktop_agent_profile'){assert(profiles.has(args.p_agent));value=copy(profiles.get(args.p_agent));}
  else if(name==='desktop_agent_request_scope'){const request=own('desktop_requests',args.p_request),row=own('desktop_agent_instances',request.agent_instance_id);value={instance:copy(row),profile:copy(profiles.get(row.agent_id))};}
  else if(name==='desktop_agent_instance_snapshot')value=copy(own('desktop_agent_instances',args.p_instance));
  else if(['desktop_validate_agent_references','desktop_validate_chat_inspection_receipts'].includes(name)){}
  else if(name==='desktop_reserve_agent_invocation'){
   const existing=table('desktop_agent_invocations').find(row=>row.origin_request_id===args.p_request&&row.call_id===args.p_call);if(existing)value={...copy(existing),existing:true};else{
    const caller=own('desktop_requests',args.p_request),parent=own('desktop_agent_instances',caller.agent_instance_id),conversation=randomUUID(),chain=[...(parent.authority_chain??[]),{agent_id:parent.agent_id,revision:parent.agent_revision,instance_id:parent.id,project_id:null}],child=instance(args.p_target,conversation,parent.id,args.p_child_request,args.p_ceiling,chain);child.status='queued';table('conversation_sessions').push({conversation_id:conversation,user_id:f.owner,agent_id:args.p_target});
    const row={user_id:f.owner,request_id:args.p_child_request,child_instance_id:child.id,caller_instance_id:parent.id,target_agent_id:args.p_target,target_revision:args.p_target_revision,caller_revision:parent.agent_revision,origin_request_id:args.p_request,status:'queued',call_id:args.p_call,payload:{assignment:args.p_assignment,options:copy(args.p_options),ceiling:copy(args.p_ceiling),origin_request_id:args.p_request}};table('desktop_agent_invocations').push(row);value=copy(row);
   }
  }
  else if(name==='desktop_claim_agent_invocation'){const row=own('desktop_agent_invocations',args.p_request,'request_id'),claimed=row.status==='queued';if(claimed)row.status='starting';value={...copy(row),claimed};}
  else if(name==='desktop_begin_agent_chat'){
   const previous=table('desktop_requests').find(row=>row.id===args.p_request);if(previous)value={...copy(previous),existing:true};else{
    const conversation=args.p_conversation??randomUUID();if(!table('conversation_sessions').some(row=>row.conversation_id===conversation))table('conversation_sessions').push({conversation_id:conversation,user_id:f.owner,agent_id:args.p_agent});
    const named=table('desktop_agent_instances').find(row=>row.request_id===args.p_request),active=named??instance(args.p_agent,conversation,null,args.p_request);active.status='running';
    const row={id:args.p_request,user_id:f.owner,agent_id:args.p_agent,conversation_id:conversation,user_message_id:randomUUID(),assistant_message_id:randomUUID(),agent_instance_id:active.id,status:'running'};table('desktop_requests').push(row);table('chat_messages_v2').push({id:row.user_message_id,conversation_id:conversation,role:'user',content:{text:args.p_text},metadata:{project:null}},{id:row.assistant_message_id,conversation_id:conversation,role:'assistant',content:{text:''},metadata:{}});value=copy(row);
   }
  }
  else if(name==='desktop_checkpoint_chat'){
   const request=own('desktop_requests',args.p_request);Object.assign(request,{status:args.p_status,error:args.p_error});const active=own('desktop_agent_instances',request.agent_instance_id);Object.assign(active,{status:args.p_status,checkpoint:args.p_text,result:args.p_text});const invocation=table('desktop_agent_invocations').find(row=>row.request_id===request.id);if(invocation)invocation.status=args.p_status;const message=table('chat_messages_v2').find(row=>row.id===request.assistant_message_id);if(message)message.content.text=args.p_text;
  }
  else if(name==='desktop_save_schedule'){const row={id:args.p_id,user_id:f.owner,revision:1,status:args.p_status,cadence:args.p_value.cadence,anchor:args.p_value.anchor,next_at:args.p_next,missed:args.p_value.missed,snapshot:copy(args.p_value.snapshot)};table('desktop_scheduled_tasks').push(row);value=copy(row);}
  else if(name==='desktop_recover_schedule_runs'){for(const run of table('desktop_scheduled_runs'))if(['starting','running'].includes(run.status))run.status='held';}
  else if(name==='desktop_stage_schedule_run'){
   const task=own('desktop_scheduled_tasks',args.p_id);if(table('desktop_scheduled_runs').some(row=>row.task_id===task.id&&row.scheduled_for===args.p_due))return {data:null,error:null};const row={id:randomUUID(),task_id:task.id,user_id:f.owner,task_revision:task.revision,request_id:randomUUID(),scheduled_for:args.p_due,trigger:'schedule',status:args.p_skip?'skipped':'pending',snapshot:copy(task.snapshot),conversation_id:task.snapshot.conversationId,error:null,unread:false};table('desktop_scheduled_runs').push(row);task.next_at=args.p_next;value=copy(row);
  }
  else if(name==='desktop_claim_schedule_run'){const run=own('desktop_scheduled_runs',args.p_run);if(run.status==='pending'){run.status='starting';value=copy(run);}}
  else if(name==='desktop_activate_scheduled_request'){const run=own('desktop_scheduled_runs',args.p_run);assert.equal(run.status,'starting');const request=own('desktop_requests',run.request_id);run.status='running';run.conversation_id=request.conversation_id;request.scheduled_run_id=run.id;}
  else if(name==='desktop_validate_scheduled_request'){const request=own('desktop_requests',args.p_request),run=table('desktop_scheduled_runs').find(row=>row.request_id===request.id);value=run?[copy(run.snapshot)]:[];}
  else if(name==='desktop_finish_schedule_run'){const run=own('desktop_scheduled_runs',args.p_run);Object.assign(run,{status:args.p_status,error:args.p_error,conversation_id:args.p_conversation??run.conversation_id});}
  else if(name==='desktop_defer_schedule_run')value=false;
  else throw Error('Unexpected dispatch fixture RPC '+name);
  return {data:value,error:null};
 };

 const terminal={definitions:()=>[],authorize:()=>{},permissions:()=>({enabled:false,full:true}),sessions:{finishRequest:async()=>{}}};tools.terminal=terminal;
 Object.assign(broker,{admin:db,currentOwner:f.owner,signedOut:false,closing:false,backingUp:false,scopeChanging:false,agentMutations:new Set(),active:new Map(),startingChats:new Map(),goals:new Map(),startingGoals:new Set(),pausedGoals:new Set(),goalScopes:new Map(),cancelledQueued:new Set(),tools,terminal,files:{list:()=>[],context:async()=>[]},providers:f.providers,catalog:async()=>[{id:'gpt-6.1-sol',thinking:['default'],supportsTools:true}],loadMessages:async id=>copy(table('chat_messages_v2').filter(row=>row.conversation_id===id)),emit:event=>f.events.push(event),chatQueue:{list:()=>[],pump(){},hold:async()=>{}}});
 const assignments=new AgentAssignments(db,tools.agents,()=>!broker.closing&&harness.freeWorkers>0,(...args)=>broker.launchNamedAgent(...args));broker.assignments=assignments;tools.agents.invoke=(...args)=>assignments.invoke(...args);
 const store=new PostgresScheduledTasks(db);broker.scheduled={store,scheduler:{busy:false}};broker.scheduledExecution=new ScheduledTaskExecution({db,files:broker.files,agents:tools.agents,defaults:async(_user,options)=>({...options,provider:'openai-oauth',model:'gpt-6.1-sol'}),models:broker.catalog,connection:async()=>{},full:()=>{}});
 const options={...f.options,provider:'openai-oauth',model:'gpt-6.1-sol',harness:'codex'},scheduler=()=>new TaskScheduler(store,{owner:()=>f.owner,available:run=>broker.scheduledAvailable(run),launch:(run,signal)=>broker.launchScheduledNow(run,signal),changed(){},now:()=>new Date('2026-10-21T06:00:01.000Z')});
 return {root,specialist,profiles,rootRequest,rootInstance,calls,broker,assignments,store,options,scheduler,connections,table,async task(){const snapshot=await broker.scheduledExecution.prepare(user,{name:'Controlled connector task',instructions:'@coordinator List the repositories through the saved connector.',agentId:specialist,projectId:null,conversationId:null,options});return store.save(f.owner,randomUUID(),null,{snapshot,cadence:{kind:'once',at:'2026-10-21T06:00:00.000Z'},missed:'latest',status:'active'},new Date('2026-10-21T05:59:00.000Z'));},async close(){broker.closing=true;await harness.close();await assignments.queue.close();await assignments.queue.settled();}};
}
module.exports={dispatch};
