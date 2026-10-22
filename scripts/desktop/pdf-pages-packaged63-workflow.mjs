import assert from 'node:assert/strict';
import path from 'node:path';
import {readFile,writeFile,mkdir,copyFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {randomUUID} from 'node:crypto';
import {expect} from '@playwright/test';

const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
export async function verifyPdfPages63({application,page,cfg,out,cold,evidence,save}){
 const source=path.resolve(import.meta.dirname,'../../desktop/tests/fixtures/pdf-pages');
 if(!cold){
  const originals=await Promise.all(['scanned-3-pages.pdf','mixed-4-pages.pdf'].map(name=>readFile(path.join(source,name))));
  const folder=path.join('F:/Agentopia-Acceptance',path.basename(out)+'-pdf63');await mkdir(folder,{recursive:true});const paths=['Scanned-pages63.pdf','Mixed-pages63.pdf'].map(name=>path.join(folder,name));for(let index=0;index<paths.length;index++)await copyFile(path.join(source,index?'mixed-4-pages.pdf':'scanned-3-pages.pdf'),paths[index]);
  const selected=await application.evaluate(async(_,{owner,paths})=>globalThis.__coordination.broker.attach(owner,paths.map(path=>({path}))),{owner:cfg.owner,paths});
  assert.equal(selected.selected.length,2);evidence.pdfPages={ids:selected.selected,originals:originals.map(sha)};await save();
 }
 const result=await application.evaluate(async(_,{owner,ids,cold,request})=>{
  const broker=globalThis.__coordination.broker,load=globalThis.__durableProbeRequire,{createHash,randomUUID}=load('node:crypto'),{nativeMcpResult}=load(globalThis.__durableProbeElectron.app.getAppPath()+'/build/mcp-content.js'),sha=value=>createHash('sha256').update(value).digest('hex'),must=result=>{if(result.error)throw Error(result.error.message);return result.data;};
  if((await broker.identity()).id!==owner||broker.active.size||broker.native.busy)throw Error('Only the idle owned QA account may run this fixture.');
  const context=await broker.files.context(owner,ids,'full');
  if(JSON.stringify(context.map(row=>row.pageImages.map(image=>image.page)))!==JSON.stringify([[1,2],[2,4]]))throw Error('Selected scan and mixed PDF pages were not rasterized.');
  const options={permission:'full',mode:'chat',thinking:'default',files:ids},later=await broker.tools.workspace.read(owner,options,{reference_id:ids[0],path:'',pages:[3]}),digital=await broker.tools.workspace.read(owner,options,{reference_id:ids[1],path:'',pages:[1]}),native=nativeMcpResult(later);
  if(later.pageImages?.[0]?.page!==3||digital.pageImages?.[0]?.page!==1||native.content[1]?.type!=='image')throw Error('Requested later/digital PDF page is missing.');
  if(native.content[0].text.includes(later.pageImages[0].image.split(',')[1]))throw Error('PDF image bytes were duplicated into text.');
  let saved=request;
  if(!cold){let agent,started;try{
   agent=await broker.call('agents.save',{name:'PDF persistence63 '+randomUUID().slice(0,8),description:'Owned database fixture; no model requests',instructions:'Temporary PDF persistence acceptance fixture.',provider:'openai-oauth',model:'gpt-6.1-sol'});
   const profile=await broker.tools.agents.profile(owner,agent);
   started=must(await broker.admin.rpc('desktop_begin_agent_chat',{p_user:owner,p_request:randomUUID(),p_agent:agent,p_conversation:null,p_text:'Generated PDF persistence fixture; no model request.',p_options:options,p_files:context,p_project:null,p_revision:null,p_plan:null,p_plan_revision:null,p_agent_revision:profile.revision,p_parent:null}));
   must(await broker.admin.rpc('desktop_checkpoint_chat',{p_user:owner,p_request:started.id,p_text:'Database PDF fixture completed without inference.',p_status:'completed',p_error:null}));saved={id:started.id,message:started.user_message_id,conversation:started.conversation_id};
  }finally{if(started){const status=must(await broker.admin.from('desktop_requests').select('status').eq('id',started.id).single());if(['running','queued'].includes(status.status))must(await broker.admin.rpc('desktop_checkpoint_chat',{p_user:owner,p_request:started.id,p_text:'Generated fixture stopped; inspect evidence.',p_status:'failed',p_error:'Fixture interrupted'}));await broker.call('conversations.manage',{conversationId:started.conversation_id,action:'archive'});}if(agent)await broker.call('agents.delete',{id:agent});}}
  const persisted=must(await broker.admin.from('chat_messages_v2').select('content').eq('id',saved.message).single()).content.files,hashes=rows=>rows.map(row=>row.pageImages.map(image=>({page:image.page,sha256:sha(Buffer.from(image.image.split(',')[1],'base64'))})));
  let denied=false;try{await broker.files.context(owner,ids,'chat');}catch{denied=true;}if(!denied)throw Error('Chat only allowed PDF file context.');
  if(globalThis.__coordination.calls.length)throw Error('No model dispatch is allowed in PDF persistence acceptance.');
  return {hashes:hashes(context),persisted:hashes(persisted),request:saved,laterSha256:sha(Buffer.from(native.content[1].data,'base64')),laterImage:later.pageImages[0].image,digitalImage:digital.pageImages[0].image,scanHasText:context[0].text??'',mixedHasText:context[1].text??'',nativeImageCount:native.content.filter(row=>row.type==='image').length,chatOnlyDenied:denied};
 },{owner:cfg.owner,ids:evidence.pdfPages.ids,cold,request:evidence.pdfPages.request});
 assert.deepEqual(result.persisted,result.hashes);assert.equal(result.nativeImageCount,1);assert(result.chatOnlyDenied);assert(result.mixedHasText.includes('DIGITAL-63-START')&&result.mixedHasText.includes('DIGITAL-63-END'));assert(!result.scanHasText.includes('WH-63-ORCHID'));
 if(cold){assert.deepEqual(result.hashes,evidence.pdfPages.hashes);assert.equal(result.laterSha256,evidence.pdfPages.laterSha256);}else{evidence.pdfPages.hashes=result.hashes;evidence.pdfPages.laterSha256=result.laterSha256;}
 evidence.pdfPages.request=result.request;
 for(const [name,image]of [['later-page',result.laterImage],['digital-page',result.digitalImage]])await writeFile(path.join(out,(cold?'cold-':'warm-')+name+'.jpg'),Buffer.from(image.split(',')[1],'base64'));
 evidence.checks.push((cold?'Cold reopening preserves':'Packaged PDF attachment IPC and real PostgreSQL preserve')+' first scanned pages, mixed selectable text, exact later-page/native image transport, digital-page rendering and Chat only exclusion without model requests.');await save();
 return {actualPdfRenderer:true,actualPostgreSQL:true,nativeToolImageContent:true,chatOnlyDenied:true,noInference:true};
}

export async function verifyNativePdf63({application,page,cfg,out,cold,evidence,save}){
 const call=(action,args)=>page.evaluate(({action,args})=>window.agentopia.call(action,args),{action,args});
 if(!cold){
  await application.evaluate(async(_,owner)=>{const b=globalThis.__coordination.broker,connection=b.secrets.get('openai:'+owner);if(connection?.access_token!=='CONTROLLED-NOT-A-PROVIDER-CREDENTIAL')throw Error('Only the generated QA connection may be renewed locally.');await b.secrets.setMany([['openai:'+owner,{...connection,expires_at:Date.now()+3600000,refresh_token:''}],['openai-issue:'+owner,undefined],['openai-renewal:'+owner,undefined]]);},cfg.owner);
  const requestId=randomUUID(),marker='CONTROLLED-PDF63-'+randomUUID().slice(0,8),agentId=await call('agents.save',{name:marker,description:'Generated native PDF tool integration fixture',instructions:'Use only the selected PDF with the requested read-only tool.',provider:'openai-oauth',model:'gpt-6.1-sol'}),profile=await call('agents.profile',{agentId});
  await call('agents.profile.save',{agentId,value:{...profile,role:marker,sops:'Read the requested page from the selected PDF. Do not change files.',skills:[],policy:{...profile.policy,tools:['read_file'],delegation:false,delegateAgents:[],memory:false,memoryWrite:false,maxDepth:0,maxTurns:2}}});
  evidence.controlledPdf={requestId,agentId,marker};await save();
  await application.evaluate((_,{requestId,referenceId,marker})=>{
   const state=globalThis.__coordination,original=globalThis.fetch,crypto=globalThis.__durableProbeRequire('node:crypto');state.pdfInputs=[];
   globalThis.fetch=async(input,args)=>{const url=new URL(typeof input==='string'?input:input.url??String(input));if(url.href==='https://api.openai.com/v1/responses'){
    const body=JSON.parse(args.body),images=[];const visit=value=>{if(!value||typeof value!=='object')return;if(value.type==='input_image'&&typeof value.image_url==='string')images.push(crypto.createHash('sha256').update(value.image_url).digest('hex'));for(const child of Object.values(value))if(Array.isArray(child))child.forEach(visit);else if(child&&typeof child==='object')visit(child);};visit(body.input);state.pdfInputs.push({images});
   }return original(input,args);};
   state.requests[requestId]={steps:[{kind:'exec',code:'const tool=ALL_TOOLS.find(t=>t.name.endsWith("read_file")); if(!tool)throw Error("Missing PDF read tool"); const result=await tools[tool.name]('+JSON.stringify({reference_id:referenceId,path:'',pages:[3]})+'); for(const content of result.content??[]) {if(content.type==="image") image(content);else if(content.type==="text") text(content.text);} ',requireInput:marker},{text:marker+' completed generated PDF read.',requireInput:'input_image'}]};
  },{requestId,referenceId:evidence.pdfPages.ids[0],marker});
  try{
   const started=await call('chat.start',{requestId,agentId,text:marker+' Read page three of the selected PDF using read_file with pages [3].',options:{provider:'openai-oauth',model:'gpt-6.1-sol',thinking:'low',permission:'files',mode:'chat',files:[evidence.pdfPages.ids[0]]}});assert(!started.existing);evidence.controlledPdf.conversation=started.conversation_id;await save();
   await expect.poll(async()=>application.evaluate(async(_,id)=>{const result=await globalThis.__coordination.broker.admin.from('desktop_requests').select('status,error').eq('id',id).single();if(result.error)throw Error(result.error.message);if(['failed','cancelled'].includes(result.data.status))throw Error(result.data.error??result.data.status);return result.data.status;},requestId),{timeout:90000,intervals:[200,500,1000]}).toBe('completed');
   const observed=await application.evaluate(async(_,id)=>{const b=globalThis.__coordination.broker,result=await b.admin.from('desktop_tool_calls').select('name,arguments,result,status').eq('request_id',id);if(result.error)throw Error(result.error.message);return {tools:result.data,inputs:globalThis.__coordination.pdfInputs,calls:globalThis.__coordination.calls};},requestId);
   assert.equal(observed.tools.length,1);assert.equal(observed.tools[0].status,'completed');assert.deepEqual(observed.tools[0].arguments.pages,[3]);assert.equal(observed.tools[0].result.pageImages[0].page,3);assert.equal(observed.calls.length,2);assert.equal(observed.inputs.length,2);assert.equal(observed.inputs[0].images.length,2);assert(observed.inputs[1].images.some(image=>!observed.inputs[0].images.includes(image)),'The requested later PDF image must reach the next native response input.');
   evidence.controlledPdf.inputImages=observed.inputs;evidence.controlledPdf.controlledResponses=2;await save();
  }finally{if(evidence.controlledPdf.conversation)await call('conversations.manage',{conversationId:evidence.controlledPdf.conversation,action:'archive'});await call('agents.delete',{id:agentId});}
 }else{
  const observed=await application.evaluate(async(_,id)=>{const b=globalThis.__coordination.broker,result=await b.admin.from('desktop_requests').select('status').eq('id',id).single(),tools=await b.admin.from('desktop_tool_calls').select('status,result').eq('request_id',id);if(result.error||tools.error)throw Error('The saved PDF tool request could not be read.');return {status:result.data.status,tools:tools.data,calls:globalThis.__coordination.calls.length};},evidence.controlledPdf.requestId);
  assert.equal(observed.status,'completed');assert.equal(observed.tools.length,1);assert.equal(observed.tools[0].status,'completed');assert.equal(observed.tools[0].result.pageImages[0].page,3);assert.equal(observed.calls,0);
 }
 evidence.checks.push((cold?'Cold reopening retains':'The actual native Codex process executes')+' one read_file page-three tool, persists its image receipt and forwards the new image to the next controlled model input; no real inference is used.');await save();
}
