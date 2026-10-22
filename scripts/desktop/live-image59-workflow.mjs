import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {writeFile} from 'node:fs/promises';
import path from 'node:path';
import {expect} from '@playwright/test';

export async function runLiveImage({application,page,cfg,previous,out,evidence:e,save,check,access,requestId,model,prompt}){
 const call=(action,args)=>page.evaluate(({action,args})=>window.agentopia.call(action,args),{action,args});
 assert.equal((await call('auth.state')).identity?.id,cfg.owner);assert.deepEqual(await call('agents.profile',{agentId:cfg.compact.agent}),previous.agentProfile);
 const agent=await call('agents.save',{name:'Live image verification '+requestId.slice(0,8),description:'Generated, bounded image-provider verification',instructions:'Use the assigned image tool once and report its saved result.',provider:'openai-oauth',model:'gpt-6.1-sol'}),profile=await call('agents.profile',{agentId:agent});
 await call('agents.profile.save',{agentId:agent,value:{...profile,handle:'image-'+requestId.slice(0,8),policy:{...profile.policy,tools:['tools.generate_image'],delegation:false,memory:false,memoryWrite:false}}});await call('plugins.list');await call('plugins.assign',{name:'image-generation',agentId:agent,enabled:true});e.agentId=agent;await save();
 await application.evaluate(async(_,{envelope,privateKey,owner,requestId,model,prompt,journal})=>{
  const req=globalThis.__durableProbeRequire,crypto=req('node:crypto'),fs=req('node:fs'),b=globalThis.__coordination.broker,lease='live-image59-lease:'+owner;
  if(b.secrets.get(lease))throw Error('Inspect and restore the prior image lease before any further work');
  const oldRouter=b.secrets.get('openrouter');if(oldRouter&&oldRouter.key!=='CONTROLLED-NOT-A-ROUTER-KEY')throw Error('Only the generated QA connection may be replaced');
  const key=crypto.privateDecrypt({key:privateKey,oaepHash:'sha256'},Buffer.from(envelope.key,'base64')),decipher=crypto.createDecipheriv('aes-256-gcm',key,Buffer.from(envelope.iv,'base64'));decipher.setAuthTag(Buffer.from(envelope.tag,'base64'));
  const {router}=JSON.parse(Buffer.concat([decipher.update(Buffer.from(envelope.ciphertext,'base64')),decipher.final()]).toString('utf8'));key.fill(0);if(typeof router?.key!=='string'||!router.key)throw Error('The protected image connection is unavailable');
  await b.secrets.set(lease,{router:oldRouter,image:b.secrets.get('image-generation:'+owner)});await b.secrets.set('openrouter',router);
  const state=globalThis.__liveImage59={enabled:true,posts:[],metadata:[],blocked:[],requestId,model,prompt},real=globalThis.__durableProbeOriginalFetch;
  b.images.fetcher=async(input,args={})=>{
   const url=String(input),method=args.method??'GET',refuse=message=>{state.blocked.push({url,method,message});throw Error(message);};
   if(!state.enabled)return refuse('The live image lease has ended');
   if(url==='https://openrouter.ai/api/v1/images/models/'+model+'/endpoints'&&method==='GET'){
    if(args.headers||args.body)return refuse('Catalog access must not contain credentials');const response=await real(input,{...args,redirect:'error'});state.metadata.push({url,status:response.status});
    if(response.ok){const value=await response.clone().json(),endpoint=value.endpoints?.find(row=>row.provider_tag==='alibaba'),prices=endpoint?.pricing?.filter(row=>row.billable==='output_image');if(!endpoint||!prices?.length||prices.some(row=>row.unit!=='image'||typeof row.cost_usd!=='number'||row.cost_usd>0.02))return refuse('The previously inspected bounded image price changed');}return response;
   }
   if(url!=='https://openrouter.ai/api/v1/images'||method!=='POST'||args.headers?.Authorization!=='Bearer '+router.key)return refuse('Unrelated image traffic is refused');
   const body=JSON.parse(args.body);if(body.model!==model||body.prompt!==prompt||body.n!==1||body.input_references||body.provider?.allow_fallbacks!==false||body.provider?.only?.length!==1||body.provider.only[0]!=='alibaba'||state.posts.length||fs.existsSync(journal))return refuse('Only one exact generated image request is authorized by this verification');
   const saved=await b.admin.from('desktop_image_generations').select('id,status').eq('user_id',owner).eq('request_id',requestId);if(saved.error||saved.data.length!==1||saved.data[0].status!=='dispatched')return refuse('The exact image operation must be journaled before dispatch');
   const row={requestId,operationId:saved.data[0].id,submittedAt:new Date().toISOString(),model,bodySha256:crypto.createHash('sha256').update(args.body).digest('hex'),status:null};state.posts.push(row);fs.writeFileSync(journal,JSON.stringify({posts:state.posts},null,2),{flag:'wx'});
   try{const response=await real(input,{...args,redirect:'error'});row.status=response.status;row.providerRequestId=response.headers.get('x-request-id');return response;}catch(error){row.outcome='unconfirmed';throw error;}finally{fs.writeFileSync(journal,JSON.stringify({posts:state.posts},null,2));}
  };
  const code='const tool=ALL_TOOLS.find(t=>t.name.endsWith("generate_image"));if(!tool)throw Error("Missing image plugin tool");text(await tools[tool.name]('+JSON.stringify({prompt,transparent_background:false,references:[]})+'));';globalThis.__coordination.requests[requestId]={steps:[{kind:'exec',code},{text:'LIVE-IMAGE-SAVED-'+requestId,requireInput:'Image saved in this chat'}]};
 },{envelope:access.envelope,privateKey:access.privateKey,owner:cfg.owner,requestId,model,prompt,journal:path.join(out,'dispatch.json')});
 try{
  await call('images.connection.save',{connection:{enabled:true,provider:'openrouter',model}});e.request={id:requestId,phase:'intent-do-not-replay',agentId:agent};await save();
  const started=await call('chat.start',{requestId,agentId:agent,text:prompt,options:{harness:'codex',provider:'openai-oauth',model:'gpt-6.1-sol',thinking:'low',permission:'full',mode:'chat',files:[]}});e.request={...e.request,phase:'accepted',conversationId:started.conversation_id};await save();await page.goto('agentopia://app/conversations/'+started.conversation_id);
  await expect.poll(()=>application.evaluate(async(_,id)=>{const result=await globalThis.__coordination.broker.admin.from('desktop_requests').select('status,error').eq('id',id).single();if(result.error)throw Error('The generated request status could not be read');if(['failed','cancelled','interrupted'].includes(result.data.status))throw Error(result.data.error??result.data.status);return result.data.status;},requestId),{timeout:180000,intervals:[500,1000,2000]}).toBe('completed');
  const activities=(await call('messages.list',{conversationId:started.conversation_id})).flatMap(message=>message.metadata.tools??[]),activity=activities.find(row=>row.name==='generate_image'&&row.request_id===requestId);assert(activity?.status==='completed'&&activity.result?.image,'Inspect the saved image operation; generation did not return a confirmed image');
  const preview=await call('images.preview',{id:activity.id}),bytes=Buffer.from(preview.image.split(',')[1],'base64');assert.equal(createHash('sha256').update(bytes).digest('hex'),preview.asset.sha256);assert(preview.asset.width>0&&preview.asset.height>0);await writeFile(path.join(out,'generated-shapes.png'),bytes);
  await expect(page.locator('.message-body>.generated-images img')).toBeVisible({timeout:30000});await expect(page.getByRole('button',{name:'Approve tool call',exact:true})).toHaveCount(0);await page.screenshot({path:path.join(out,'live-image-saved.png')});
  const trace=await application.evaluate(()=>({posts:globalThis.__liveImage59.posts,metadata:globalThis.__liveImage59.metadata,blocked:globalThis.__liveImage59.blocked,controlledModelResponses:globalThis.__coordination.calls.length}));assert.equal(trace.posts.length,1);assert.equal(trace.posts[0].status,200);assert.deepEqual(trace.blocked,[]);
  e.request.phase='completed';e.asset={id:activity.id,...preview.asset,provider:activity.result.image.provider,model:activity.result.image.model,costUSD:activity.result.image.costUSD};e.network=trace;e.imageRequests=1;await save();await check('The actual packaged Codex tool sends one real OpenRouter image request in Full access, records its PostgreSQL result, stores the encrypted image and displays it in chat. Model replies are controlled.');
  return {liveImageProvider:true,actualCodex:true,actualPostgreSQL:true,controlledModelResponses:true,imageRequests:1,assetId:activity.id,sha256:preview.asset.sha256};
 }finally{
  e.leaseCleanup=await application.evaluate(async(_,owner)=>{const b=globalThis.__coordination.broker,s=globalThis.__liveImage59;if(s)s.enabled=false;const key='live-image59-lease:'+owner,old=b.secrets.get(key);if(!old)return {alreadyRestored:true};await b.secrets.setMany([['openrouter',old.router],['image-generation:'+owner,old.image],[key,undefined]]);return {restored:true,syntheticRouter:!b.secrets.get('openrouter')||b.secrets.get('openrouter').key==='CONTROLLED-NOT-A-ROUTER-KEY',imageConnection:b.imageConnections.connection(owner),posts:s.posts,blocked:s.blocked};},cfg.owner);await save();
 }
}
