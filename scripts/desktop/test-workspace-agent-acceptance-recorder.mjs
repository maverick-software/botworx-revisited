import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm,realpath,mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import {assessWorkspaceAgentRecords,recordWorkspaceAgentAcceptance} from './record-workspace-agent-acceptance.mjs';

function fixture(){
 const imageSha256=createHash('sha256').update('synthetic archived app').digest('hex'),owner='fixture-owner',mira={id:'mira',profile:{handle:'mira',revision:2}},specialist={id:'inspector',profile:{revision:3}},starter={id:'starter'};
 const evidence={fixtureUser:owner,version:'0.44.8',imageSha256,agents:{starter,mira,specialist},projects:{a:'project-a',b:'project-b'},markers:{marker:'LIVE-marker',sop:'SOP-code',skill:'SKILL-code',specialistCode:'SPECIALIST-code'},authorization:{bothConfigured:true,refreshCredentialCopied:false},namedAssignment:{requestId:'child',instanceId:'child-instance'}};
 const turn=(id,agent,conversation,prompt,answer,revision)=>({request:{id,user_id:owner,agent_id:agent,conversation_id:conversation,user_message_id:id+'-user',assistant_message_id:id+'-reply',status:'completed'},user:{id:id+'-user',role:'user',sender_user_id:owner,conversation_id:conversation,content:{text:prompt}},reply:{id:id+'-reply',role:'assistant',conversation_id:conversation,metadata:{agent:{id:agent,revision}},content:{text:answer}},native:{request_id:id,thread_id:conversation+'-native',runtime_version:'0.163.0',options:{provider:'openai-oauth',harness:'codex',model:'gpt-6.1-sol'}}});
 const turns={first:turn('first','starter','chat-a','Reply with exactly STARTED-LIVE-marker. Use no tools.','STARTED-LIVE-marker',1),switched:turn('switched','mira','chat-a','@mira, save LIVE-marker','Release research analyst SOP-code SKILL-code',2),recalled:turn('recalled','mira','chat-b','What is the approved release marker saved by this agent?','LIVE-marker [source](agentopia-chat://chat-a/message/switched-user)',2),delegated:turn('delegated','mira','chat-b','Use invoke_agent to assign saved agent inspector this task','SPECIALIST-code',2),child:turn('child','inspector','child-chat','Inspect current assignments','SPECIALIST-code',3)};
 const records={turns,memberships:[{user_id:owner,conversation_id:'chat-a',project_id:'project-a'},{user_id:owner,conversation_id:'chat-b',project_id:'project-b'}],memories:[{id:'memory',user_id:owner,agent_id:'mira',project_id:'project-a',content:'LIVE-marker',authored_by:'agent',source_message_id:'switched-user',source_conversation_id:'chat-a'}],profiles:[{agent_id:'mira',revision:2,role:'Release research analyst',sops:'SOP-code',skills:[{content:'SKILL-code'}]},{agent_id:'inspector',revision:3,policy:{tools:['list_agent_instances'],delegation:false,memoryWrite:false}}],invocations:[{user_id:owner,origin_request_id:'delegated',target_agent_id:'inspector',request_id:'child',child_instance_id:'child-instance',caller_instance_id:'caller-instance',status:'completed'}],instances:[{id:'child-instance',user_id:owner,agent_id:'inspector',agent_revision:3,request_id:'child',project_id:'project-b',parent_instance_id:'caller-instance',status:'completed'},{id:'caller-instance',user_id:owner,agent_id:'mira',request_id:'delegated'}],tools:{switched:[{name:'save_agent_memory',status:'completed',result:{memory:{id:'memory'}}}],child:[{name:'list_agent_instances',status:'completed'}],delegated:[{name:'invoke_agent',status:'completed',arguments:{agent_id:'inspector'},result:{instance:{id:'child-instance'}}},{name:'read_agent_instance',status:'completed',arguments:{instance_id:'child-instance'},result:{instance:{id:'child-instance',status:'completed'},transcript:'SPECIALIST-code'}}]},connections:{openrouter:true,chatgptAuthorized:true,preferChatGPT:true}};
 evidence.liveRequests=Object.entries(turns).filter(([key])=>key!=='child').map(([,turn])=>({requestId:turn.request.id,text:turn.user.content.text}));
 return {records,evidence,release:{success:true,version:'0.44.8',imageSha256}};
}
test('accepts complete exact-image saved-record proof for all four outcomes',()=>{const f=fixture(),result=assessWorkspaceAgentRecords(f.records,f.evidence,f.release);assert.equal(result.success,true);assert.equal(result.checks.length,4);assert.equal(result.requestIds.length,5);});
const failures=[
 ['an image mismatch',f=>f.evidence.imageSha256='b'.repeat(64)],
 ['changed earlier authorship',f=>f.records.turns.first.reply.metadata.agent.id='mira'],
 ['an unsaved procedure revision',f=>f.records.profiles[0].revision=99],
 ['a different recall identity',f=>f.records.turns.recalled.request.agent_id='starter'],
 ['a recall chat still in project A',f=>f.records.memberships[1].project_id='project-a'],
 ['recall in the original conversation',f=>f.records.turns.recalled.request.conversation_id='chat-a'],
 ['a repeated marker in the recall prompt',f=>f.records.turns.recalled.user.content.text+=' LIVE-marker'],
 ['a source conversation without the exact message citation',f=>f.records.turns.recalled.reply.content.text='LIVE-marker chat-a'],
 ['a human-authored memory',f=>f.records.memories[0].authored_by='user'],
 ['a missing memory-save receipt',f=>f.records.tools.switched=[]],
 ['invocation without a separate result read',f=>f.records.tools.delegated.pop()],
 ['a read of the wrong instance',f=>f.records.tools.delegated[1].arguments.instance_id='other-instance'],
 ['a read that saw only running work',f=>f.records.tools.delegated[1].result.instance.status='running'],
 ['a completed read without the specialist result',f=>f.records.tools.delegated[1].result.transcript='No saved answer yet'],
 ['a specialist with unrestricted tools',f=>f.records.profiles[1].policy.tools=null],
 ['a forbidden specialist operation',f=>f.records.tools.child.push({name:'exec_command',status:'completed'})],
 ['an absent second provider',f=>f.records.connections.openrouter=false],
 ['a fixture with a usable copied refresh credential',f=>f.evidence.authorization.refreshCredentialCopied=true]
];
for(const [name,mutate] of failures)test('rejects '+name,()=>{const f=fixture();mutate(f);assert.throws(()=>assessWorkspaceAgentRecords(f.records,f.evidence,f.release));});

function database(f){
 const {records,evidence}=f,owner=evidence.fixtureUser,turns=Object.values(records.turns);
 const tables={desktop_requests:turns.map(t=>t.request),chat_messages_v2:turns.flatMap(t=>[t.user,t.reply]),desktop_codex_turns:turns.map(t=>({...t.native,user_id:owner,context:{options:t.native.options}})),desktop_agent_invocations:records.invocations,desktop_agent_instances:records.instances,desktop_project_chats:records.memberships,desktop_agent_memories:records.memories,desktop_agent_profiles:records.profiles.map(p=>({...p,user_id:owner})),desktop_tool_calls:Object.entries(records.tools).flatMap(([key,tools])=>tools.map(t=>({...t,user_id:owner,request_id:records.turns[key].request.id})))};
 const reads=[];return {reads,from(table){reads.push(table);let rows=structuredClone(tables[table]);assert(rows,'Unexpected table read');const query={select(){return query;},eq(key,value){rows=rows.filter(row=>row[key]===value);return query;},in(key,values){rows=rows.filter(row=>values.includes(row[key]));return query;},async single(){return rows.length===1?{data:rows[0]}:{error:{message:'Expected one saved row'}};},then(resolve,reject){return Promise.resolve({data:rows}).then(resolve,reject);}};return query;}};
}
async function temporary(run){const out=await mkdtemp(path.join(os.tmpdir(),'agentopia-agent-recorder-test-'));try{await mkdir(path.join(out,'program/resources'),{recursive:true});await writeFile(path.join(out,'program/resources/app.asar'),'synthetic archived app');await run(out);}finally{const target=await realpath(out),parent=await realpath(os.tmpdir());assert(path.dirname(target).toLowerCase()===parent.toLowerCase()&&path.basename(target).startsWith('agentopia-agent-recorder-test-'));await rm(target,{recursive:true,force:true});}}
test('collector reads saved records and status and writes a successful proof without mutation or inference APIs',()=>temporary(async out=>{const f=fixture(),db=database(f),calls=[];const call=async action=>{calls.push(action);assert.equal(action,'providers.status');return {openrouter:true,chatgpt:{authorized:true},preferChatGPT:true};};const result=await recordWorkspaceAgentAcceptance({...f,db,call,out});assert(result.success);assert.deepEqual(calls,['providers.status']);assert(db.reads.includes('desktop_tool_calls'));const saved=JSON.parse(await readFile(path.join(out,'independent-agent-evidence.json'),'utf8'));assert.equal(saved.inferenceDispatched,0);assert.equal(saved.credentialReads,0);}));
test('collector saves failed proof before rejecting a missing parent result read',()=>temporary(async out=>{const f=fixture();f.records.tools.delegated.pop();await assert.rejects(recordWorkspaceAgentAcceptance({...f,db:database(f),call:async()=>({openrouter:true,chatgpt:{authorized:true},preferChatGPT:true}),out}),/parent read receipt/);const saved=JSON.parse(await readFile(path.join(out,'independent-agent-evidence.json'),'utf8'));assert.equal(saved.success,false);assert(saved.records.turns.child.request.id);}));
test('collector rejects a different application archive before reading any database records',()=>temporary(async out=>{const f=fixture(),db=database(f);await writeFile(path.join(out,'program/resources/app.asar'),'a different application');await assert.rejects(recordWorkspaceAgentAcceptance({...f,db,call:async()=>assert.fail('Status read must not run'),out}),/does not match the release image/);assert.deepEqual(db.reads,[]);}));
