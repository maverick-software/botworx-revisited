import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {expect} from '@playwright/test';

export async function prepareImageFixtureAccount({application,page,evidence,save}){
 const email='image-output-'+randomUUID()+'@fixture.invalid',password='Generated-'+randomUUID()+'-aA7!';
 await page.evaluate(({email,password})=>window.agentopia.call('auth.firstAdmin',{name:'Image output fixture',email,password}),{email,password});
 const identity=await page.evaluate(async()=>{const state=await window.agentopia.call('auth.state');return state.identity;});assert(identity?.admin);evidence.fixtureUser=identity.id;
 await application.evaluate(async(_,owner)=>{const b=globalThis.__coordination.broker;await b.secrets.set('openai:'+owner,{client_id:'controlled-private-client',subject:'controlled-subject',email:'controlled@example.invalid',id_token:'CONTROLLED',access_token:'CONTROLLED-NOT-A-PROVIDER-CREDENTIAL',refresh_token:'',scope:'chatgpt.tokens.use.direct',expires_at:Date.now()+3600000});const model={id:'gpt-6.1-sol',name:'GPT-6.1 Sol',thinking:['default','low','high'],supportsTools:true};await b.secrets.set('models:openai-oauth:'+owner,[model]);await b.secrets.set('prefer-chatgpt:'+owner,true);await b.secrets.set('chatgpt-welcome:'+owner,true);},identity.id);
 await page.reload();await expect(page.getByRole('button',{name:'Account menu',exact:true})).toBeVisible({timeout:30000});await save();
}

export async function verifyImageNativeOutput({application,page,out,evidence,save,check}){
 const asset=evidence.imagePlugin.assets[0],root=path.resolve(import.meta.dirname,'../..'),directory=path.join(root,'docs/desktop/workspace-demo'),destination=path.join(directory,'image-export-'+randomUUID()+'.png');await mkdir(directory,{recursive:true});
 await page.goto('agentopia://app/conversations/'+evidence.imagePlugin.conversation);await expect(page.locator('.message-body>.generated-images img')).toHaveCount(2);
 const pending={at:new Date().toISOString(),destination,assetId:asset.id,expectedSha256:asset.sha256,executable:path.join(out,'program/Agentopia.exe')};await writeFile(path.join(out,'native-save-pending.json'),JSON.stringify(pending,null,2),{flag:'wx'});
 await page.locator('.message-body>.generated-images').first().getByRole('button',{name:'Save generated image',exact:true}).click();console.log('NATIVE_SAVE_DIALOG_READY '+path.join(out,'native-save-pending.json'));
 await expect.poll(async()=>{try{return createHash('sha256').update(await readFile(destination)).digest('hex');}catch(error){if(error.code==='ENOENT')return null;throw error;}},{timeout:180000,intervals:[250,500,1000]}).toBe(asset.sha256);
 await expect(page.locator('.message-body>.generated-images').first().getByRole('button',{name:'Save generated image',exact:true})).toBeEnabled();
 evidence.imageOutput={destination,sha256:asset.sha256,nativeDialog:true};await save();await check('The real Windows Save dialog exports the owned generated PNG and its file hash matches the encrypted asset receipt.');
 await page.locator('.message-body>.generated-images').first().getByRole('button',{name:'Expand generated image',exact:true}).click();const viewer=page.getByRole('dialog',{name:'Generated image',exact:true});await expect(viewer).toBeVisible();assert.deepEqual(await viewer.locator('img').evaluate(image=>({width:image.naturalWidth,height:image.naturalHeight})),{width:640,height:360});await page.screenshot({path:path.join(out,'native-image-expanded.png')});await viewer.getByRole('button',{name:'Close dialog',exact:true}).click();await check('The packaged image viewer opens the saved raster at its original dimensions.');
 // The existing destination is selected by a controlled chooser for this
 // refusal test. The real IPC handler must preserve its bytes with wx.
 await application.evaluate(({dialog},destination)=>{globalThis.__imageOriginalSaveDialog=dialog.showSaveDialog;dialog.showSaveDialog=async()=>({canceled:false,filePath:destination});},destination);
 try{const outcome=await page.evaluate(async id=>{try{return await window.agentopia.call('images.export',{id});}catch(error){return {error:error.message};}},asset.id);assert(outcome.error?.includes('EEXIST'),JSON.stringify(outcome));assert.equal(createHash('sha256').update(await readFile(destination)).digest('hex'),asset.sha256);}finally{await application.evaluate(({dialog})=>{dialog.showSaveDialog=globalThis.__imageOriginalSaveDialog;delete globalThis.__imageOriginalSaveDialog;});}
 await check('The actual Save handler refuses an existing destination and preserves its original bytes.');
}

export async function verifyImageRevocation({application,page,out,evidence,save,check}){
 const call=(action,args)=>page.evaluate(({action,args})=>window.agentopia.call(action,args),{action,args}),options={harness:'codex',provider:'openai-oauth',model:'gpt-6.1-sol',thinking:'default',permission:'ask',mode:'chat',files:[]};
 await application.evaluate(()=>globalThis.__imageFixture.hold=false);
 for(const kind of ['connection','assignment']){
  if(kind==='assignment')await call('images.connection.save',{connection:{enabled:true,provider:'openai-api',model:'gpt-image-2.5-sunburst'}});
  const request=randomUUID(),before=await application.evaluate(()=>globalThis.__imageFixture.posts.length),args={prompt:'Controlled '+kind+' revocation fixture',transparent_background:false,references:[]};
  await application.evaluate((_,{request,args})=>{const code='const t=ALL_TOOLS.find(t=>t.name.endsWith("generate_image"));text(await tools[t.name]('+JSON.stringify(args)+'));';globalThis.__coordination.requests[request]={steps:[{kind:'exec',code},{text:'REVOCATION-FIXTURE-STOPPED'}]};},{request,args});
  const started=await call('chat.start',{requestId:request,agentId:evidence.imagePlugin.agent,conversationId:evidence.imagePlugin.conversation,text:'Prepare the controlled '+kind+' revocation check.',options});await page.goto('agentopia://app/conversations/'+started.conversation_id);await expect(page.getByRole('button',{name:'Approve tool call',exact:true})).toBeVisible({timeout:30000});
  const activity=(await call('messages.list',{conversationId:started.conversation_id})).flatMap(message=>message.metadata.tools??[]).find(tool=>tool.request_id===request&&tool.name==='generate_image');assert(activity?.status==='awaiting_approval');
  if(kind==='connection')await call('images.connection.save',{connection:{enabled:false,provider:'openai-api',model:'gpt-image-2.5-sunburst'}});else await call('plugins.assign',{name:'image-generation',agentId:evidence.imagePlugin.agent,enabled:false});
  await expect.poll(()=>application.evaluate(async(_,request)=>{const b=globalThis.__coordination.broker,r=await b.admin.from('desktop_requests').select('status').eq('id',request).single();return r.data?.status;},request),{timeout:30000}).not.toBe('running');
  const stale=await page.evaluate(async id=>{try{await window.agentopia.call('tools.decide',{id,approved:true});return {approved:true};}catch(error){return {error:error.message};}},activity.id);assert(stale.error);assert.equal(await application.evaluate(()=>globalThis.__imageFixture.posts.length),before);
  const definitions=await application.evaluate(async(_, {owner,agent,options})=>globalThis.__coordination.broker.tools.imageDefinitions(owner,agent,options),{owner:evidence.fixtureUser,agent:evidence.imagePlugin.agent,options});assert.deepEqual(definitions,[]);
  const preview=await call('images.preview',{id:evidence.imagePlugin.assets[0].id});assert.equal(preview.asset.sha256,evidence.imagePlugin.assets[0].sha256);
  (evidence.imageRevocations??=[]).push({kind,request,activity:activity.id,noImageDispatch:true,staleApprovalRejected:true,savedImageStillReadable:true});await save();await page.screenshot({path:path.join(out,'image-'+kind+'-revoked.png')});await check('Revoking the '+kind+' stops pending image work, rejects its stale approval and removes the tool while preserving access to owned completed images.');
 }
}
