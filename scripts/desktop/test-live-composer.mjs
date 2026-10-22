import {openModelCatalog,thinkingSlider} from './model-controls.mjs';
import {_electron} from 'playwright';
import {expect} from '@playwright/test';
import {mkdirSync,writeFileSync} from 'node:fs';
import path from 'node:path';import assert from 'node:assert/strict';
const repo=path.resolve(import.meta.dirname,'../..'),artifacts=path.join(repo,'.supabase/desktop-live-composer');mkdirSync(artifacts,{recursive:true});
const note=path.join(repo,'docs/desktop/composer-demo.md');writeFileSync(note,'# Composer demo\n\nThe project marker is PINEAPPLE-628. The project is an indoor orchid garden.\n');
const environment={...process.env};delete environment.AGENTOPIA_TEST_PROFILE;
const source=process.env.AGENTOPIA_DESKTOP_SOURCE_TEST==='1';
const executable=source?path.join(repo,'node_modules/electron/dist/electron.exe'):path.join(process.env.LOCALAPPDATA,'AgentopiaDesktop/app-0.5.0/Agentopia.exe');
let app;const evidence={at:new Date().toISOString(),simulated:false};
try{
 app=await _electron.launch({executablePath:executable,args:source?[path.join(repo,'desktop/build/main.js')]:[],env:environment,cwd:repo,timeout:60000});const page=await app.firstWindow();
 for(let n=0;n<180;n++){const state=await page.evaluate(()=>window.agentopia?.call('runtime.status')??{});if(state.phase==='error')throw new Error(state.message);if(state.ready)break;await new Promise(r=>setTimeout(r,1000));}
 const identity=(await page.evaluate(()=>window.agentopia.call('auth.state'))).identity;assert(identity,'Sign in first.');
 const agents=await page.evaluate(()=>window.agentopia.call('agents.list'));const agent=agents.find(a=>a.name==='ChatGPT Assistant'&&a.provider==='openai-oauth');assert(agent,'The connected ChatGPT Assistant is missing.');
 const models=await page.evaluate(()=>window.agentopia.call('providers.models',{provider:'openai-oauth',refresh:true}));const model=models[0];assert(model.thinking.includes('high'));
 await page.keyboard.press('Control+Shift+o');await page.getByRole('button',{name:'Choose agent',exact:true}).click();await page.getByRole('menuitem',{name:agent.name,exact:true}).click();
 await openModelCatalog(page);await page.locator('.model-list').getByRole('button',{name:new RegExp(model.name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'))}).click();
 const index=['default',...model.thinking].indexOf('high');await (await thinkingSlider(page)).fill(String(index)).catch(async()=>{await (await thinkingSlider(page)).press('Home');for(let n=0;n<index;n++)await (await thinkingSlider(page)).press('ArrowRight');});await page.keyboard.press('Escape');
 await app.evaluate(({dialog},file)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[file]});},note);
 await page.getByRole('button',{name:'Add to chat',exact:true}).click();await page.getByRole('menuitem',{name:'Files and folders',exact:true}).click();await page.getByRole('button',{name:'Add files',exact:true}).click();await page.getByRole('button',{name:'Done',exact:true}).click();
 await page.getByRole('button',{name:'Permissions',exact:true}).click();await page.getByRole('menuitem',{name:/^Selected files access/}).click();
 await page.getByRole('button',{name:'Add to chat',exact:true}).click();await page.getByRole('menuitem',{name:'Plan mode',exact:true}).click();
 const previous=(await page.evaluate(()=>window.agentopia.call('conversations.list'))).map(c=>c.conversation_id);
 await page.getByLabel('Message',{exact:true}).fill('Read the attached demo note. State its exact project marker and propose a concise three-step plan for its project. Do not carry out any actions.');await page.getByRole('button',{name:'Send',exact:true}).click();
 let conversation,messages;
 for(let n=0;n<180;n++){const chats=await page.evaluate(()=>window.agentopia.call('conversations.list'));conversation=chats.find(c=>c.agent_id===agent.id&&!previous.includes(c.conversation_id));if(conversation){messages=await page.evaluate(id=>window.agentopia.call('messages.list',{conversationId:id}),conversation.conversation_id);const last=messages.filter(m=>m.role==='assistant').at(-1);if(last?.metadata.status&&last.metadata.status!=='running'){assert.equal(last.metadata.status,'completed',last.metadata.error);break;}}await new Promise(r=>setTimeout(r,1000));}
 const reply=messages?.filter(m=>m.role==='assistant').at(-1);assert(reply?.content.text.includes('PINEAPPLE-628'));assert.equal(messages[0].metadata.options.thinking,'high');assert.equal(messages[0].metadata.options.mode,'plan');assert.equal(messages[0].metadata.options.model,model.id);evidence.model=model.id;evidence.thinking='high';evidence.planReply=reply.content.text;evidence.conversationId=conversation.conversation_id;evidence.attachmentContextVerified=true;
 await page.screenshot({path:path.join(artifacts,'live-plan-and-file.png')});
 await page.getByRole('button',{name:'Turn plan mode off',exact:true}).click();
 const goal=await page.evaluate(id=>window.agentopia.call('goals.create',{agentId:id,objective:'Write a one-sentence greeting for an indoor orchid-gardening project.',maxTurns:1,conversationId:null}),agent.id);
 await page.evaluate(({id,model})=>window.agentopia.call('goals.start',{id,options:{provider:'openai-oauth',model,thinking:'high',permission:'chat',mode:'chat',files:[]}}),{id:goal.id,model:model.id});
 for(let n=0;n<180;n++){const state=(await page.evaluate(()=>window.agentopia.call('goals.list'))).find(g=>g.id===goal.id);if(state.status!=='running'){assert(state.status==='completed'||state.status==='paused');assert.equal(state.turns_used,1);evidence.goalStatus=state.status;evidence.goalTurns=state.turns_used;break;}await new Promise(r=>setTimeout(r,1000));}
 assert(evidence.goalTurns===1);evidence.passed=true;console.log('PASS: Real ChatGPT high reasoning, per-chat model choice, selected-file context, plan output, and one-turn goal execution.');
}catch(error){evidence.error=error.message;if(app){const p=await app.firstWindow();await p.screenshot({path:path.join(artifacts,'failure.png')}).catch(()=>{});}throw error;}
finally{writeFileSync(path.join(artifacts,'evidence.json'),JSON.stringify(evidence,null,2));if(app)await app.close();}
