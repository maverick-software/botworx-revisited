import assert from 'node:assert/strict';
import path from 'node:path';
import {hash} from './phased-backup-control.mjs';

// Preserve the original receipt assertions, with current retirement/archive
// cleanup in the signed-in isolated account instead of legacy physical deletes.
export async function verifyChromeReceipts60({application,cfg,proof,out,check}){
 const file=path.join(proof.source,'tests/chrome-receipts.test.cjs');assert.equal(await hash(file),proof.sourceHashes['tests/chrome-receipts.test.cjs']);
 const result=await application.evaluate(async(_,{file,out,owner,distribution})=>{
  const broker=globalThis.__coordination.broker,load=globalThis.__durableProbeRequire,root=globalThis.__durableProbeElectron.app.getAppPath(),fs=load('node:fs/promises'),path=load('node:path'),vm=load('node:vm'),assert=load('node:assert/strict'),{randomUUID}=load('node:crypto'),{chromeConnectionId}=load(root+'/build/chrome-contracts.js');
  const identity=await broker.identity(),db=broker.admin;
  if(identity.id!==owner||distribution==='AgentopiaRuntime-a91a4800-e08f-4440-a4ec-588762d01bfd'||broker.active.size||broker.native.busy)throw Error('Receipt acceptance requires the idle owned isolated account/runtime.');
  const source=await fs.readFile(file,'utf8'),start=source.indexOf('  broker.tools.remote.prepare='),end=source.indexOf('\n }finally');
  if(start<0||end<=start)throw Error('The expected original Chrome receipt assertions are unavailable.');
  const core=source.slice(start,end),check=result=>{if(result.error)throw Error(result.error.message);return result.data;},original=broker.tools.remote.prepare;
  const options={permission:'ask',mode:'chat',files:[]},args={connection_id:chromeConnectionId,tool_name:'click',arguments_json:'{"pageId":2,"uid":"1_5"}'},plan={sources:[],definitions:[{name:'mcp_call',namespace:'tools',parameters:{type:'object',properties:{connection_id:{type:'string'},tool_name:{type:'string'},arguments_json:{type:'string'}}}}],denied:new Set()};
  let agent,request,completed=false;const stages=[];
  try{
   agent=await broker.call('agents.save',{name:'Chrome receipt60 '+randomUUID().slice(0,8),description:'Owned isolated receipt verification',instructions:'Temporary acceptance fixture',provider:'openai-oauth',model:'gpt-6.1-sol'});stages.push({stage:'agent-created',success:true});
   request=check(await db.rpc('desktop_begin_chat',{p_user:owner,p_request:randomUUID(),p_agent:agent,p_conversation:null,p_text:'Owned Chrome receipt verification'}));
   const result=await vm.runInNewContext('(async()=>{let dispatched=0;'+core+';return {dispatched};})()',{
    broker,db,request,identity,options,args,plan,agent,user:{id:owner},chromeConnectionId,randomUUID,assert,check,setTimeout,AbortController
   },{filename:file+'#receipt-assertions',timeout:10000});
   assert.equal(result.dispatched,2);completed=true;stages.push({stage:'original-receipt-assertions',success:true});
   return {success:true,actualDatabase:true,originalReceiptAssertionsRetained:true,currentRetirementCleanup:true,controlledToolDispatches:result.dispatched,requestId:request.id,conversationId:request.conversation_id,agentId:agent,newModelRequests:0};
  }catch(error){stages.push({stage:'receipt-assertions',error:String(error.message).slice(0,1000)});throw error;}
  finally{
   broker.tools.remote.prepare=original;
   if(request){
    const rows=check(await db.from('desktop_tool_calls').select('id').eq('request_id',request.id).eq('status','awaiting_approval'));for(const row of rows)await broker.tools.decide(owner,row.id,false);
    if(!completed)check(await db.rpc('desktop_checkpoint_chat',{p_user:owner,p_request:request.id,p_text:'Receipt verifier stopped; inspect retained evidence.',p_status:'failed',p_error:'Receipt verifier did not complete.'}));
    await broker.call('conversations.manage',{conversationId:request.conversation_id,action:'archive'});
   }
   if(agent)await broker.call('agents.delete',{id:agent});
   await fs.writeFile(path.join(out,'receipt-fixture-stages.json'),JSON.stringify(stages,null,2));
  }
 },{file,out,owner:cfg.owner,distribution:cfg.distribution});
 assert(result.success&&result.actualDatabase&&result.originalReceiptAssertionsRetained);await check('The original Chrome receipt assertions pass against the real isolated database, including one review, exact arguments, duplicate suppression and child-thread receipts; current archive/retirement cleanup preserves history.');
 return result;
}
