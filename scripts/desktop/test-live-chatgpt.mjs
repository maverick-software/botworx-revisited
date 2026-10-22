import {_electron} from 'playwright';
import {expect} from '@playwright/test';
import {mkdirSync,writeFileSync} from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
const repo=path.resolve(import.meta.dirname,'../..');
const artifacts=path.join(repo,'.supabase/desktop-live-chatgpt');mkdirSync(artifacts,{recursive:true});
const executable=process.env.AGENTOPIA_LIVE_EXE??path.join(process.env.LOCALAPPDATA,'AgentopiaDesktop/app-0.4.0/Agentopia.exe');
let app;
const evidence={at:new Date().toISOString(),simulated:false};
try{
 const environment={...process.env};delete environment.AGENTOPIA_TEST_PROFILE;
 app=await _electron.launch({executablePath:executable,args:[],env:environment,cwd:repo,timeout:60000});
 const page=await app.firstWindow();let ready=false,last='';
 page.setDefaultTimeout(15000);
 for(let n=0;n<180;n++){
  const state=await page.evaluate(()=>window.agentopia?.call('runtime.status')??{phase:'loading'});
  if(state.phase!==last){console.log('Live app startup:',state.phase);last=state.phase;}
  if(state.phase==='error')throw new Error(state.message);
  if(state.ready){ready=true;break;}await new Promise(r=>setTimeout(r,1000));
 }
 assert(ready,'The installed runtime did not become ready.');
 const auth=await page.evaluate(()=>window.agentopia.call('auth.state'));
 assert(auth.identity,'Sign in to your Agentopia account before running the live check.');
 const status=await page.evaluate(()=>window.agentopia.call('providers.status'));
 assert(status.chatgpt?.authorized,'The signed-in Agentopia account has no ChatGPT plan authorization.');
 evidence.agentopiaUserId=auth.identity.id;evidence.planAuthorized=true;
 const models=await page.evaluate(()=>window.agentopia.call('providers.models',{provider:'openai-oauth',refresh:true}));
 assert(models.length,'The connected ChatGPT account returned no available models.');
 evidence.availableModels=models.map(m=>({id:m.id,name:m.name}));
 console.log('Authorized model catalog:',JSON.stringify(evidence.availableModels));
 const selected=models[0];
 let agents=await page.evaluate(()=>window.agentopia.call('agents.list'));
 let agent=agents.find(a=>a.provider==='openai-oauth');
 if(!agent){
  await page.getByRole('complementary',{name:'Workspace sidebar'}).getByRole('button',{name:'Create agent',exact:true}).click();
  await page.getByLabel('Name',{exact:true}).fill('ChatGPT Assistant');
  await page.getByLabel('Description',{exact:true}).fill('A personal assistant using your connected ChatGPT account.');
  await page.getByLabel('Instructions',{exact:true}).fill('You are a helpful, clear assistant. Follow the user’s instructions and use the conversation history when answering.');
  await page.getByLabel('AI provider',{exact:true}).selectOption('openai-oauth');
  await page.getByLabel('Model',{exact:true}).selectOption(selected.id);
  await page.getByRole('button',{name:'Save agent',exact:true}).click();
  await expect(page.getByRole('dialog',{name:'Create an agent',exact:true})).toHaveCount(0);
  agents=await page.evaluate(()=>window.agentopia.call('agents.list'));agent=agents.find(a=>a.name==='ChatGPT Assistant'&&a.provider==='openai-oauth');
 }
 assert(agent,'Agent creation did not complete.');evidence.agentId=agent.id;evidence.agentName=agent.name;evidence.model=agent.model;
 console.log('Live agent:',agent.name,'model:',agent.model);
 const priorIds=(await page.evaluate(()=>window.agentopia.call('conversations.list'))).map(c=>c.conversation_id);
 await page.keyboard.press('Control+Shift+o');
 await page.getByRole('button',{name:'Choose agent',exact:true}).click();await page.getByRole('menuitem',{name:agent.name,exact:true}).click();
 const marker='ORCHID-27';
 await page.getByLabel('Message',{exact:true}).fill('This is a connection check for Agentopia. Remember the marker '+marker+'. Briefly say hello and confirm the marker in your reply.');
 await page.getByRole('button',{name:'Send',exact:true}).click();
 console.log('Sent the first live ChatGPT request.');
 let conversationId;let firstReply;
 for(let n=0;n<180;n++){
  const conversations=await page.evaluate(()=>window.agentopia.call('conversations.list'));
  const conversation=conversations.find(c=>c.agent_id===agent.id&&!priorIds.includes(c.conversation_id));
  if(conversation){
   conversationId=conversation.conversation_id;
   const messages=await page.evaluate(id=>window.agentopia.call('messages.list',{conversationId:id}),conversationId);
   const reply=messages.filter(m=>m.role==='assistant').at(-1);
   if(reply&&reply.metadata.status!=='running'){
    if(reply.metadata.status!=='completed')throw new Error('Live reply '+reply.metadata.status+': '+(reply.metadata.error??''));
    firstReply=reply.content.text;break;
   }
  }
  const alerts=await page.getByRole('alert').allTextContents();if(alerts.length)throw new Error(alerts.join('\n'));
  await new Promise(r=>setTimeout(r,1000));
 }
 assert(firstReply,'The first live response did not complete.');assert(firstReply.includes(marker),'The reply did not acknowledge the marker.');
 evidence.conversationId=conversationId;evidence.firstReply=firstReply;console.log('First live reply:',firstReply);
 await page.getByLabel('Message',{exact:true}).fill('What marker did I ask you to remember? Reply with only the marker.');
 await page.getByRole('button',{name:'Send',exact:true}).click();
 let secondReply;
 for(let n=0;n<180;n++){
  const messages=await page.evaluate(id=>window.agentopia.call('messages.list',{conversationId:id}),conversationId);
  const replies=messages.filter(m=>m.role==='assistant');const reply=replies.at(-1);
  if(replies.length>=2&&reply.metadata.status!=='running'){
   if(reply.metadata.status!=='completed')throw new Error('Follow-up '+reply.metadata.status+': '+(reply.metadata.error??''));secondReply=reply.content.text;break;
  }
  await new Promise(r=>setTimeout(r,1000));
 }
 assert(secondReply?.includes(marker),'The live follow-up did not recall the marker.');evidence.secondReply=secondReply;console.log('Follow-up live reply:',secondReply);
 await page.reload();await expect(page.getByRole('button',{name:'Account menu',exact:true})).toBeVisible({timeout:20000});
 const saved=await page.evaluate(id=>window.agentopia.call('messages.list',{conversationId:id}),conversationId);
 assert.equal(saved.length,4);assert(saved.filter(m=>m.role==='assistant').every(m=>m.metadata.status==='completed'));evidence.savedMessages=4;
 const chats=await page.evaluate(()=>window.agentopia.call('conversations.list'));const chat=chats.find(c=>c.conversation_id===conversationId);
 await page.getByRole('region',{name:'Chat history'}).getByRole('button',{name:chat.title,exact:true}).click();
 await expect(page.getByText(secondReply,{exact:true})).toBeVisible();
 await page.screenshot({path:path.join(artifacts,'live-conversation.png')});evidence.reopenedHistory=true;
 console.log('PASS: Real ChatGPT replies, follow-up context, PostgreSQL persistence, and reopened conversation history.');
}catch(error){
 evidence.error=error.message;
 if(app){const page=await app.firstWindow();await page.screenshot({path:path.join(artifacts,'failure.png')}).catch(()=>{});}
 throw error;
}finally{
 writeFileSync(path.join(artifacts,'evidence.json'),JSON.stringify(evidence,null,2));
 if(app)await app.close();
}
