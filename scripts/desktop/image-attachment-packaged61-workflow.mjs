import assert from 'node:assert/strict';
import path from 'node:path';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
export async function verifyImageAttachments61({application,page,cfg,out,cold,evidence,save,check}){
 const source=path.resolve(import.meta.dirname,'../../.supabase/desktop-live-image-edit60/1792620802834/edited-shapes.png'),original=await readFile(source);
 assert.equal(sha(original),'82cd40d85e51369f1ad103914dfa210159b610d7629c0560db63e972f5213e9c');
 if(!cold&&!evidence.imageAttachments){
  const padded=Buffer.concat([original,Buffer.alloc(20*1024**2-original.length)]);
  const selected=await page.evaluate(async({owner,original,padded})=>{
   const bytes=value=>Uint8Array.from(atob(value),char=>char.charCodeAt(0));
   return window.agentopia.attach([new File([bytes(original)],'Original-image61.png',{type:'image/png'}),new File([bytes(padded)],'Boundary-image61.png',{type:'image/png'})],owner);
  },{owner:cfg.owner,original:original.toString('base64'),padded:padded.toString('base64')});
  assert.equal(selected.selected.length,2);evidence.imageAttachments={ids:selected.selected,originalSha256:sha(original),boundarySha256:sha(padded),originalBytes:original.length,boundaryBytes:padded.length};await save();
 }
 const result=await application.evaluate(async(_,{owner,ids,cold,request})=>{
  const broker=globalThis.__coordination.broker,load=globalThis.__durableProbeRequire,{createHash,randomUUID}=load('node:crypto'),{nativeMcpResult}=load(globalThis.__durableProbeElectron.app.getAppPath()+'/build/mcp-content.js'),sha=bytes=>createHash('sha256').update(bytes).digest('hex'),must=result=>{if(result.error)throw Error(result.error.message);return result.data;};
  if((await broker.identity()).id!==owner||broker.active.size||broker.native.busy)throw Error('Only the idle owned QA account may run this fixture.');
  const context=await broker.files.context(owner,ids,'full'),hashes=context.map(row=>sha(Buffer.from(row.image.split(',')[1],'base64')));
  const tool=nativeMcpResult(await broker.files.preview(owner,ids[1]));if(tool.content[1]?.type!=='image'||tool.content[0].text.length>200)throw Error('The actual native image result is missing or duplicated as text.');
  let saved=request;
  if(!cold){
   let agent,started;
   try{
    agent=await broker.call('agents.save',{name:'Image persistence61 '+randomUUID().slice(0,8),description:'Owned database fixture; no model requests',instructions:'Temporary image persistence acceptance fixture.',provider:'openai-oauth',model:'gpt-6.1-sol'});
    const profile=await broker.tools.agents.profile(owner,agent),options={permission:'full',mode:'chat',thinking:'default',files:ids};
    started=must(await broker.admin.rpc('desktop_begin_agent_chat',{p_user:owner,p_request:randomUUID(),p_agent:agent,p_conversation:null,p_text:'Generated image persistence fixture; no model request.',p_options:options,p_files:context,p_project:null,p_revision:null,p_plan:null,p_plan_revision:null,p_agent_revision:profile.revision,p_parent:null}));
    must(await broker.admin.rpc('desktop_checkpoint_chat',{p_user:owner,p_request:started.id,p_text:'Database fixture completed without inference.',p_status:'completed',p_error:null}));saved={id:started.id,message:started.user_message_id,conversation:started.conversation_id};
   }finally{
    if(started){const status=must(await broker.admin.from('desktop_requests').select('status').eq('id',started.id).single());if(['running','queued'].includes(status.status))must(await broker.admin.rpc('desktop_checkpoint_chat',{p_user:owner,p_request:started.id,p_text:'Generated fixture stopped; inspect evidence.',p_status:'failed',p_error:'Fixture interrupted'}));await broker.call('conversations.manage',{conversationId:started.conversation_id,action:'archive'});}
    if(agent)await broker.call('agents.delete',{id:agent});
   }
  }
  const message=must(await broker.admin.from('chat_messages_v2').select('content').eq('id',saved.message).single()),persisted=message.content.files.map(row=>sha(Buffer.from(row.image.split(',')[1],'base64')));
  if(globalThis.__coordination.calls.length)throw Error('No model dispatch is allowed in image persistence acceptance.');
  return {hashes,persisted,request:saved,toolSha256:sha(Buffer.from(tool.content[1].data,'base64'))};
 },{owner:cfg.owner,ids:evidence.imageAttachments.ids,cold,request:evidence.imageAttachments.request});
 const expected=[evidence.imageAttachments.originalSha256,evidence.imageAttachments.boundarySha256];assert.deepEqual(result.hashes,expected);assert.deepEqual(result.persisted,expected);assert.equal(result.toolSha256,expected[1]);evidence.imageAttachments.request=result.request;await save();
 await check((cold?'Cold reopening retains':'Packaged main IPC accepts')+' the unchanged original 2.68 MB image and 20 MB boundary image, protected references, real PostgreSQL message bytes and native tool image content without inference.');
}
