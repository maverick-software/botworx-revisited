import {openModelCatalog,thinkingSlider} from './model-controls.mjs';
import {_electron} from 'playwright';
import {expect} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync,readFileSync,existsSync,readdirSync} from 'node:fs';
import {randomBytes} from 'node:crypto';
import path from 'node:path';

const repo=path.resolve(import.meta.dirname,'../..'),artifacts=path.join(repo,'.supabase/desktop-live-provider-switch');mkdirSync(artifacts,{recursive:true});
const development=process.env.AGENTOPIA_DESKTOP_SOURCE_TEST==='1',installation=path.join(process.env.LOCALAPPDATA,'AgentopiaDesktop');
const latest=existsSync(installation)?readdirSync(installation).filter(name=>/^app-\d+\.\d+\.\d+$/.test(name)).sort((a,b)=>b.localeCompare(a,undefined,{numeric:true}))[0]:undefined;
const executable=development?path.join(repo,'node_modules/electron/dist/electron.exe'):path.join(installation,latest??'missing','Agentopia.exe');
const environment={...process.env};delete environment.AGENTOPIA_TEST_PROFILE;
const resume=process.env.AGENTOPIA_LIVE_RESUME==='1',previous=resume?JSON.parse(readFileSync(path.join(artifacts,'evidence.json'),'utf8')):null;
const evidence=previous?{...previous,recheckedAt:new Date().toISOString(),error:undefined}:{at:new Date().toISOString(),simulated:false,requests:[],replies:[]};let app;
const marker=previous?.replies?.[0]?.text?.match(/CITRUS-[A-F0-9]{6}/)?.[0]??'CITRUS-'+randomBytes(3).toString('hex').toUpperCase();
try{
 app=await _electron.launch({executablePath:executable,args:development?[path.join(repo,'desktop/build/main.js')]:[],env:environment,cwd:repo,timeout:60000});const page=await app.firstWindow();
 for(let n=0;n<180;n++){const state=await page.evaluate(()=>window.agentopia?.call('runtime.status')??{});if(state.phase==='error')throw new Error(state.message);if(state.ready)break;await new Promise(r=>setTimeout(r,1000));}
 const auth=await page.evaluate(()=>window.agentopia.call('auth.state'));assert(auth.identity,'Sign in to the normal installation before running this check.');
 const status=await page.evaluate(()=>window.agentopia.call('providers.status'));assert(status.openrouter,'Configure OpenRouter in AI connections first.');assert(status.chatgpt?.authorized,'Authorize ChatGPT plan access first.');
 const [personalModels,routerModels,agents]=await Promise.all([page.evaluate(()=>window.agentopia.call('providers.models',{provider:'openai-oauth',refresh:true})),page.evaluate(()=>window.agentopia.call('providers.models',{provider:'openrouter',refresh:true})),page.evaluate(()=>window.agentopia.call('agents.list'))]);
 const router=routerModels.find(m=>m.id===status.defaultModel);assert(router,'The configured OpenRouter default is absent from its catalog.');
 const personal=personalModels.find(m=>m.id===router.id.replace(/^openai\//,''))??personalModels[0];assert(personal);assert(personal.thinking.includes('high'));assert(router.thinking.includes('high'));
 const agent=agents.find(a=>a.name==='ChatGPT Assistant')??agents[0];assert(agent,'Create an agent first.');
 await app.evaluate((_electron,marker)=>{const original=globalThis.fetch;globalThis.__liveProviderRequests=[];globalThis.fetch=async(input,options)=>{const url=String(input);if(url==='https://api.openai.com/v1/responses'||url==='https://openrouter.ai/api/v1/chat/completions'){const body=JSON.parse(options.body);globalThis.__liveProviderRequests.push({provider:url.includes('openrouter.ai')?'openrouter':'openai-oauth',model:body.model,thinking:body.reasoning?.effort??'default',historyMessages:(body.messages??body.input).length,markerInHistory:JSON.stringify(body.messages??body.input).includes(marker),...(body.store===false?{store:false}:{})});}return original(input,options);};},marker);
 if(!resume){
 await page.keyboard.press('Control+Shift+o');await page.getByRole('button',{name:'Choose agent',exact:true}).click();await page.getByRole('menuitem',{name:agent.name,exact:true}).click();
 await page.evaluate(options=>window.agentopia.call('composer.save',{options}),{provider:'openai-oauth',model:personal.id,thinking:'high',permission:'chat',mode:'chat',files:[]});await page.reload();await expect(page.getByRole('button',{name:'Account menu',exact:true})).toBeVisible({timeout:20000});
 const choose=async(provider,model)=>{
  await openModelCatalog(page);await page.getByRole('group',{name:'Model provider'}).getByRole('button',{name:provider,exact:true}).click();
  await page.getByLabel('Search models',{exact:true}).fill(model.id);const escaped=model.id.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),row=page.locator('.model-list button').filter({has:page.locator('small').filter({hasText:new RegExp('^'+escaped+'(?: · Images)?$')})});await expect(row).toBeVisible({timeout:30000});await row.click();
  const effort=['default',...model.thinking].indexOf('high'),slider=(await thinkingSlider(page));await slider.press('Home');for(let n=0;n<effort;n++)await slider.press('ArrowRight');await expect(page.locator('.model-trigger b')).toHaveText('High');await page.keyboard.press('Escape');
 };
 const send=async(text,count)=>{
  await page.getByLabel('Message',{exact:true}).fill(text);await page.getByRole('button',{name:'Send',exact:true}).click();
  for(let n=0;n<240;n++){
   const chats=await page.evaluate(()=>window.agentopia.call('conversations.list'));const chat=chats.find(c=>c.agent_id===agent.id&&c.title.includes(marker));
   if(chat){evidence.conversationId=chat.conversation_id;const messages=await page.evaluate(id=>window.agentopia.call('messages.list',{conversationId:id}),chat.conversation_id),replies=messages.filter(m=>m.role==='assistant');
    if(replies.length===count&&replies.at(-1).metadata.status&&replies.at(-1).metadata.status!=='running'){const reply=replies.at(-1);assert.equal(reply.metadata.status,'completed',reply.metadata.error);assert(reply.content.text.includes(marker),'The provider did not recall the marker.');evidence.replies.push({provider:messages.filter(m=>m.role==='user').at(-1).metadata.options.provider,text:reply.content.text});await expect(page.getByRole('button',{name:'Stop response',exact:true})).toHaveCount(0);return;}
   }await new Promise(r=>setTimeout(r,1000));
  }throw new Error('The live provider response timed out.');
 };
 await choose('ChatGPT',personal);await send(`Connection test ${marker}. Remember this exact verification marker: ${marker}. Reply with only that marker.`,1);
 await choose('OpenRouter',router);await expect(page.locator('.composer-caption')).toContainText('shared OpenRouter connection');await send('What is the verification marker from my first message? Reply with only that marker.',2);
 await choose('ChatGPT',personal);await send('Repeat the verification marker from the first message, with no other text.',3);
 evidence.requests=await app.evaluate(()=>globalThis.__liveProviderRequests);assert.deepEqual(evidence.requests.map(r=>r.provider),['openai-oauth','openrouter','openai-oauth']);assert(evidence.requests.every(r=>r.thinking==='high'&&r.markerInHistory));assert.equal(evidence.requests[1].model,status.defaultModel);
 }else{assert.equal(evidence.requests.length,3);assert.equal(evidence.replies.length,3);assert(evidence.conversationId);}
 await page.reload();await expect(page.getByRole('button',{name:'Account menu',exact:true})).toBeVisible({timeout:20000});await page.getByRole('region',{name:'Chat history'}).getByRole('button',{name:new RegExp('^Connection test '+marker)}).click();await expect(page.locator('.message-column')).toContainText(marker);const rows=await page.evaluate(id=>window.agentopia.call('messages.list',{conversationId:id}),evidence.conversationId);assert.equal(rows.length,6);assert(rows.filter(r=>r.role==='assistant').every(r=>r.metadata.status==='completed'));evidence.historyReopened=true;
 await page.screenshot({path:path.join(artifacts,'live-switch-conversation.png')});evidence.passed=true;evidence.version=await app.evaluate(({app})=>app.getVersion());
 console.log(`PASS: Actual ChatGPT → OpenRouter (${status.defaultModel}) → ChatGPT replies recalled one marker with High thinking, and all six messages reopened from PostgreSQL.`);
}catch(error){evidence.error=error.message;if(app){const page=await app.firstWindow();await page.screenshot({path:path.join(artifacts,'failure.png')}).catch(()=>{});}throw error;}
finally{writeFileSync(path.join(artifacts,'evidence.json'),JSON.stringify(evidence,null,2));if(app)await app.close();}
