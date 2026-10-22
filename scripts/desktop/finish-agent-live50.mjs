import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {expect} from '@playwright/test';
import {desktopOperation} from './operation-lock.mjs';
import {closed} from './phased-backup-control.mjs';
import {connectInstalledAgent50,waitFor} from './connect-agent-live50.mjs';
desktopOperation('retire generated verification identities and restore ordinary installed app');
const root=path.resolve(import.meta.dirname,'../..'),json=async p=>JSON.parse(await readFile(p,'utf8')),pointer=await json(path.join(root,'.supabase/desktop-agent-live50/current.json')),intent=await json(pointer.intent),setup=await json(path.join(intent.out,'setup.json')),assessment=await json(path.join(intent.out,'live-assessment.json')),original=await json(path.join(intent.out,'private-original.json'));
assert(assessment.success&&assessment.completedRequests===3&&assessment.originalDefinitionsChanged===false);
const local=assessment.capture.replace('/mnt/f/','F:/'),records=await json(local),chatIds=[...new Set(records.requests.map(r=>r.conversation_id))];assert(chatIds.length===3&&chatIds.every(id=>id!==original.navigation.conversationId));
assert(!intent.originalAgents.includes(setup.coordinator)&&!intent.originalAgents.includes(setup.specialist));
const file=path.join(intent.out,'finish-progress.json'),report={at:new Date().toISOString(),success:false,originalsChanged:false,retiredGeneratedAgents:[],archivedGeneratedChats:[],promptsSent:0};await writeFile(file,JSON.stringify(report,null,2),{flag:'wx'});const save=()=>writeFile(file,JSON.stringify(report,null,2));
const app=await connectInstalledAgent50(intent);let detached=false;
try{
 assert.equal(app.owner,original.owner);
 for(const id of [setup.specialist,setup.coordinator]){const instances=await app.call('agents.instances',{agentId:id,limit:100});assert(instances.every(i=>['completed','failed','cancelled','interrupted'].includes(i.status)));await app.call('agents.delete',{id});report.retiredGeneratedAgents.push(id);await save();}
 for(const id of chatIds){await app.call('conversations.manage',{conversationId:id,action:'archive'});report.archivedGeneratedChats.push(id);await save();}
 await app.page.goto(original.url,{waitUntil:'domcontentloaded',timeout:90000});await app.call('workspace.save',{owner:app.owner,scope:original.navigation.conversationId,state:original.pane});await app.page.reload({waitUntil:'domcontentloaded'});
 await expect(app.page.getByRole('textbox',{name:'Message',exact:true})).toHaveValue(original.draft,{timeout:60000});assert.equal(await app.page.getByRole('button',{name:'Model and thinking',exact:true}).getAttribute('title'),original.modelTitle);
 assert.deepEqual(await app.call('workspace.state',{owner:app.owner,scope:original.navigation.conversationId}),original.pane);assert.equal((await app.call('navigation.state',{owner:app.owner})).conversationId,original.navigation.conversationId);
 const agents=await app.call('agents.list');for(const before of original.agents)assert.deepEqual(agents.find(a=>a.id===before.id),before);
 assert(agents.filter(a=>a.active).every(a=>intent.originalAgents.includes(a.id)));
 const providers=await app.call('providers.status');assert.equal(providers.preferChatGPT,original.providers.preferChatGPT);assert(providers.chatgpt?.authorized&&providers.openrouter);for(const [key,value]of Object.entries(original.providers.selections))assert.deepEqual(providers.selections[key],value);
 await app.page.screenshot({path:path.join(intent.out,'original-restored-after-agent-verification.png')});report.originalChatDraftModelPaneAndProvidersRestored=true;await save();
 const window="process.mainModule.require('electron').BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().startsWith('agentopia://app/'))";await app.main(window+'.close();true');await app.detach();detached=true;
 await waitFor(async()=>{try{await closed();return true;}catch{return false;}},90000);report.normalClosure=true;await save();await app.explore('C:\\Users\\charl\\AppData\\Local\\AgentopiaDesktop\\Agentopia.exe');report.normalReopenWithoutDebugFlagsRequested=true;report.success=true;await save();console.log(JSON.stringify({success:true,out:intent.out,retiredGeneratedAgents:report.retiredGeneratedAgents.length,archivedGeneratedChats:report.archivedGeneratedChats.length,originalStateRestored:true,promptsSent:0}));
}catch(error){report.error=error.stack;await save();console.error(error.stack);process.exitCode=1;}finally{if(!detached)await app.detach().catch(()=>{});}
