import assert from 'node:assert/strict';
import {randomUUID,createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {expect} from '@playwright/test';

// Every image response below is a locally generated fixture. Never forward a
// credential or image request to a provider during this packaged rehearsal.
export async function installImageGuard(application){
 await application.evaluate(({app})=>{
  const require=process.getBuiltinModule('module').createRequire(process.getBuiltinModule('path').join(app.getAppPath(),'package.json')),{Broker}=require('./build/broker.js'),initialize=Broker.prototype.initialize;
  const state=globalThis.__imageFixture={posts:[],unexpected:[],png:null,hold:false};
  Broker.prototype.initialize=async function(...args){
   this.images.fetcher=async(url,options)=>{
    if(!['https://api.openai.com/v1/images/generations','https://api.openai.com/v1/images/edits'].includes(url)||options.method!=='POST'||options.headers.Authorization!=='Bearer CONTROLLED-IMAGE-API-KEY'||!state.png){state.unexpected.push({url,method:options?.method});throw Error('Image access is disabled outside the controlled fixture');}
    const edit=options.body instanceof FormData,body=edit?null:JSON.parse(options.body);
    state.posts.push({url,model:edit?options.body.get('model'):body.model,references:edit?options.body.getAll('image[]').length:0,aborted:false});
    if(state.hold){const row=state.posts.at(-1);return new Promise((resolve,reject)=>{const abort=()=>{row.aborted=true;reject(new DOMException('Controlled image request cancelled','AbortError'));};if(options.signal.aborted)abort();else options.signal.addEventListener('abort',abort,{once:true});});}
    return Response.json({data:[{b64_json:state.png}],usage:{cost:0.01}});
   };
   return initialize.apply(this,args);
  };
 });
}

export async function runImagePackaged({application,page,out,evidence,save,check,resumeRequest,baseOnly=false}){
 const call=(action,args)=>page.evaluate(({action,args})=>window.agentopia.call(action,args),{action,args}),png=await readFile(path.resolve('D:/Users/charl/software/Agentopia/.supabase/desktop-artifact-authoring/delivered-1792364116490/outputs/preview.png'));
 let agent,prior;
 if(resumeRequest){
  prior=await application.evaluate(async(_,id)=>{const broker=globalThis.__coordination.broker,user=await broker.identity(),result=await broker.admin.from('desktop_requests').select('id,agent_id,conversation_id,status').eq('id',id).eq('user_id',user.id).single();if(result.error)throw Error(result.error.message);if(result.data.status!=='completed')throw Error('The adopted image request must already be completed.');return result.data;},resumeRequest);agent=prior.agent_id;
  const current=await call('images.connection.status');assert.equal(current.connection.provider,'openai-api');assert(current.connection.enabled&&current.openAIKeyAvailable);
 }else{
 const initial=await call('images.connection.status');assert.equal(initial.connection.enabled,false);assert.equal(initial.openAIKeyAvailable,false);
 agent=await call('agents.save',{name:'Image verification',description:'Controlled packaged image tools',instructions:'Use the requested image tool and report confirmed saved results.',provider:'openai-oauth',model:'gpt-6.1-sol'});const profile=await call('agents.profile',{agentId:agent});
 await call('agents.profile.save',{agentId:agent,value:{...profile,handle:'image-'+randomUUID().slice(0,8),policy:{...profile.policy,tools:['tools.generate_image'],delegation:false,memory:false,memoryWrite:false}}});
 await call('plugins.list');await call('plugins.assign',{name:'image-generation',agentId:agent,enabled:true});
 await call('images.key.save',{key:'CONTROLLED-IMAGE-API-KEY'});await call('images.connection.save',{connection:{enabled:true,provider:'openai-api',model:'gpt-image-2.5-sunburst'}});
 }
 await application.evaluate((_,png)=>globalThis.__imageFixture.png=png,png.toString('base64'));
 const options={harness:'codex',provider:'openai-oauth',model:'gpt-6.1-sol',thinking:'default',permission:'ask',mode:'chat',files:[]};
 const plan=async(id,args,final)=>application.evaluate((_,{id,args,final})=>{const code='const tool=ALL_TOOLS.find(t=>t.name.endsWith("generate_image"));if(!tool)throw Error("Missing image plugin tool");text(await tools[tool.name]('+JSON.stringify(args)+'));';globalThis.__coordination.requests[id]={steps:[{kind:'exec',code},{text:final,requireInput:'Image saved in this chat'}]};},{id,args,final});
 const finish=async(id)=>expect.poll(()=>application.evaluate(async(_,id)=>{const result=await globalThis.__coordination.broker.admin.from('desktop_requests').select('status,error').eq('id',id).single();if(result.error)throw Error(result.error.message);if(['failed','cancelled','interrupted'].includes(result.data.status))throw Error(result.data.error??result.data.status);return result.data.status;},id),{timeout:45000}).toBe('completed');
 const open=async conversation=>{await page.goto('agentopia://app/conversations/'+conversation);await expect(page.getByRole('textbox',{name:'Message',exact:true})).toBeVisible({timeout:30000});};
 const request=resumeRequest??randomUUID();let started;
 if(resumeRequest){started={conversation_id:prior.conversation_id};await open(started.conversation_id);await finish(request);}else{
 await plan(request,{prompt:'Create the controlled packaged verification image',transparent_background:false,references:[]},'IMAGE-GENERATION-CONFIRMED');
 started=await call('chat.start',{requestId:request,agentId:agent,text:'Create the requested verification image using the image plugin.',options});await open(started.conversation_id);
 await expect(page.getByRole('button',{name:'Approve tool call',exact:true})).toBeVisible({timeout:30000});assert.equal((await application.evaluate(()=>globalThis.__imageFixture.posts)).length,0);
 await expect(page.getByLabel('External tool arguments')).toContainText('gpt-image-2.5-sunburst');await page.screenshot({path:path.join(out,'image-inline-review.png')});await page.getByRole('button',{name:'Approve tool call',exact:true}).click();await finish(request);
 }
 await expect(page.locator('.message-body>.generated-images img')).toBeVisible();const activities=(await call('messages.list',{conversationId:started.conversation_id})).flatMap(message=>message.metadata.tools??[]),activity=activities.find(row=>row.name==='generate_image'&&row.request_id===request);assert(activity?.result?.image);assert.equal(activity.status,'completed');assert(!JSON.stringify(activity).includes(png.toString('base64')));
 const preview=await call('images.preview',{id:activity.id}),bytes=Buffer.from(preview.image.split(',')[1],'base64');assert.equal(createHash('sha256').update(bytes).digest('hex'),preview.asset.sha256);assert.equal(preview.asset.width,640);assert.equal(preview.asset.height,360);const basePosts=resumeRequest?0:1;assert.equal((await application.evaluate(()=>globalThis.__imageFixture.posts)).length,basePosts);
 evidence.imagePlugin={adoptedCompletedRequest:resumeRequest??null,agent,conversation:started.conversation_id,request,assets:[{id:activity.id,sha256:preview.asset.sha256}],cancelRequest:null};await save();await page.screenshot({path:path.join(out,'image-generated-result.png')});await check(resumeRequest?'The completed packaged image is recovered from its existing PostgreSQL receipt and encrypted PNG without another generation request.':'The real packaged Codex turn waits for image approval, sends one controlled Images request, commits its PostgreSQL receipt and displays its encrypted saved PNG.');
 if(baseOnly)return;
 const edit=randomUUID();await plan(edit,{prompt:'Edit the previously generated verification image',transparent_background:false,references:[{kind:'generated',id:activity.id}]},'IMAGE-EDIT-CONFIRMED');await call('chat.start',{requestId:edit,agentId:agent,conversationId:started.conversation_id,text:'Edit the saved image '+activity.id+' using its generated reference.',options});evidence.imagePlugin.pendingEdit=edit;await save();await open(started.conversation_id);
 await expect(page.getByRole('button',{name:'Approve tool call',exact:true})).toBeVisible({timeout:30000});await page.getByRole('button',{name:'Approve tool call',exact:true}).click();await finish(edit);await expect(page.locator('.message-body>.generated-images img')).toHaveCount(2);
 const edited=(await call('messages.list',{conversationId:started.conversation_id})).flatMap(message=>message.metadata.tools??[]).find(row=>row.request_id===edit&&row.name==='generate_image');assert(edited?.result?.image);const posts=await application.evaluate(()=>globalThis.__imageFixture.posts);assert.equal(posts.length,basePosts+1);assert.equal(posts.at(-1).url,'https://api.openai.com/v1/images/edits');assert.equal(posts.at(-1).references,1);evidence.imagePlugin.assets.push({id:edited.id,sha256:edited.result.image.sha256});await save();await check('A separate packaged edit reads the owned generated reference and uses the multipart Images edit endpoint exactly once.');
 const cancelled=randomUUID();await plan(cancelled,{prompt:'Controlled cancellation fixture',transparent_background:false,references:[]},'THIS-CANCELLED-RESULT-MUST-NOT-APPEAR');await application.evaluate(()=>globalThis.__imageFixture.hold=true);await call('chat.start',{requestId:cancelled,agentId:agent,conversationId:started.conversation_id,text:'Begin the controlled cancellation fixture.',options});evidence.imagePlugin.pendingCancellation=cancelled;await save();await open(started.conversation_id);await expect(page.getByRole('button',{name:'Approve tool call',exact:true})).toBeVisible({timeout:30000});await page.getByRole('button',{name:'Approve tool call',exact:true}).click();await expect.poll(()=>application.evaluate(()=>globalThis.__imageFixture.posts.length),{timeout:30000}).toBe(basePosts+2);await page.getByRole('button',{name:'Stop response',exact:true}).click();
 await expect.poll(()=>application.evaluate(async(_,request)=>{const result=await globalThis.__coordination.broker.admin.from('desktop_image_generations').select('status').eq('request_id',request).single();return result.data?.status;},cancelled),{timeout:30000}).toBe('uncertain');assert.equal((await application.evaluate(()=>globalThis.__imageFixture.posts)).at(-1).aborted,true);await expect(page.getByText('THIS-CANCELLED-RESULT-MUST-NOT-APPEAR',{exact:true})).toHaveCount(0);evidence.imagePlugin.cancelRequest=cancelled;evidence.imagePlugin.controlledPosts=await application.evaluate(()=>globalThis.__imageFixture.posts);await save();await check('Stopping the packaged turn cancels its in-flight image HTTP operation and retains an uncertain journal outcome without a confirmed image or retry.');
 assert.deepEqual(await application.evaluate(()=>globalThis.__imageFixture.unexpected),[]);
}

export async function verifyImagePackagedReopen({application,page,out,evidence,check}){
 const call=(action,args)=>page.evaluate(({action,args})=>window.agentopia.call(action,args),{action,args});await page.goto('agentopia://app/conversations/'+evidence.imagePlugin.conversation);await expect(page.locator('.message-body>.generated-images img')).toHaveCount(2,{timeout:30000});
 for(const asset of evidence.imagePlugin.assets){const preview=await call('images.preview',{id:asset.id});assert.equal(createHash('sha256').update(Buffer.from(preview.image.split(',')[1],'base64')).digest('hex'),asset.sha256);}
 const connection=await call('images.connection.status');assert.equal(connection.connection.provider,'openai-api');assert.equal(connection.connection.enabled,true);assert.equal(connection.openAIKeyAvailable,true);
 const uncertain=await application.evaluate(async(_,request)=>{const result=await globalThis.__coordination.broker.admin.from('desktop_image_generations').select('status').eq('request_id',request).single();if(result.error)throw Error(result.error.message);return result.data.status;},evidence.imagePlugin.cancelRequest);assert.equal(uncertain,'uncertain');assert.deepEqual(await application.evaluate(()=>globalThis.__imageFixture.posts),[]);assert.deepEqual(await application.evaluate(()=>globalThis.__imageFixture.unexpected),[]);await page.screenshot({path:path.join(out,'image-cold-reopen.png')});await check('Cold reopening preserves both encrypted images, their hashes, the separate image connection and the uncertain cancellation receipt without replaying an image request.');
}
