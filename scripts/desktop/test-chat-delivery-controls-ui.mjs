import {_electron,expect} from '@playwright/test';
import {build} from 'esbuild';
import {createServer} from 'node:http';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import path from 'node:path';
import assert from 'node:assert/strict';
import {desktopOperation} from './operation-lock.mjs';

desktopOperation('isolated incoming chat queue and permission controls');
const require=createRequire(import.meta.url),root=path.resolve(import.meta.dirname,'../..'),out=path.join(root,'.supabase/desktop-chat-delivery','controls-ui-'+Date.now());
await mkdir(out,{recursive:true});
const sources=['desktop/ui/ChatQueue.tsx','desktop/ui/ChatOrigin.tsx','desktop/ui/ChatCoordinationSettings.tsx','desktop/ui/ChatDeliveryReview.tsx','desktop/ui/WorkspaceViews.tsx','desktop/ui/NativeTurn.tsx','desktop/ui/chat-delivery.css'];
const fingerprints=async()=>Object.fromEntries(await Promise.all(sources.map(async name=>[name,createHash('sha256').update(await readFile(path.join(root,name))).digest('hex')])));
const evidence={at:new Date().toISOString(),sourceSha256:await fingerprints(),actualQueue:true,actualSavedMessage:true,actualNativeTurn:true,actualSettings:true,controlledBridge:true,installed:false,productionAccess:false,inferenceRequests:0,checks:[],failures:[]};
await build({stdin:{contents:`
import React,{useState} from 'react';import {createRoot} from 'react-dom/client';
import {QueuedMessages} from './desktop/ui/ChatQueue';import {ChatCoordinationSettings} from './desktop/ui/ChatCoordinationSettings';import {ChatMessage} from './desktop/ui/WorkspaceViews';import {WorkspaceLinks} from './desktop/ui/WorkspaceLinks';import './desktop/ui/style.css';
const owner='owner-one',chat='target-chat',id='incoming-message',source={id,sourceConversationId:'source-chat',sourceMessageId:'source-message',sourceAgentId:'researcher',sourceAgentName:'Research assistant',citation:'agentopia-chat://source-chat/message/source-message'};
const review={source:'Chat coordination',tool:'Queue a message in another chat',coordination:{deliveryId:id},description:'The receiving chat keeps its selected connection and inherits the narrower tool and file permissions.',arguments:{from:'Research assistant',to:'Build the site',agent:'Builder',connection:'ChatGPT',model:'gpt-6.1-sol',permission:'ask',delivery:'queue',message:'Review the approved draft and report the findings.'}};
const row={id,deliveryId:id,conversationId:chat,agentId:'builder',text:review.arguments.message,options:{provider:'openai-oauth',model:'gpt-6.1-sol',thinking:'high',permission:'ask',mode:'chat',files:[]},createdAt:'2026-10-18T00:00:00Z',status:'queued',incoming:{source,requiresAuthorization:false,uncertain:false,canSteer:true}};
let current={mode:'queue',owner,rows:[row],request:'receiving-request',turnId:'receiving-turn'},refresh,generation=0,listener;
window.calls=[];window.links=[];window.errors=[];window.failRevoke=false;window.hold=false;
const grants=[{id:'pair-grant',firstConversationId:'source-chat',firstTitle:'Research findings',secondConversationId:chat,secondTitle:'Build the site'}];
window.agentopia={onChat:fn=>{listener=fn;return()=>{if(listener===fn)listener=null;};},call:async(action,args)=>{
 window.calls.push({action,args});
 if(action==='chat.queue.list')return structuredClone(current.rows);
 if(action==='chat.delivery.grants')return structuredClone(grants);
 if(window.hold)await new Promise(resolve=>window.release=resolve);
 if(action==='chat.delivery.revoke'){if(window.failRevoke)throw Error('Permission changed before revocation. Refresh the settings.');return;}
 if(action==='chat.queue.change'&&args.action==='edit')current.rows=current.rows.map(r=>({...r,text:args.text}));else current.rows=[];
 }};
window.resetFixture=(kind='queued',theme='dark')=>{
 generation++;document.documentElement.dataset.theme=theme;window.calls=[];window.links=[];window.errors=[];window.failRevoke=false;window.hold=false;
 current={mode:kind==='settings'?'settings':kind==='messages'?'messages':'queue',owner,rows:[structuredClone(row)],request:'receiving-request',turnId:'receiving-turn'};
 const r=current.rows[0];
 if(kind==='review'){r.status='held';r.incoming.requiresAuthorization=true;r.incoming.review=review;current.request=null;}
 if(kind==='resume'){r.status='held';current.request=null;}
 if(kind==='uncertain'){r.status='held';r.incoming.uncertain=true;r.error='Agentopia closed while delivering. Inspect the receiving chat before sending again.';current.request=null;}
 if(kind==='starting'){r.status='starting';r.incoming.receivingRequestId='actual-steered-request';}
 if(kind==='broad'){r.incoming.canSteer=false;}
 if(kind==='human'){delete r.incoming;delete r.deliveryId;r.id='human-message';}
 refresh({...current});
};
const sent={id:'received-message',role:'user',content:{text:'Review the approved draft.'},metadata:{chat_delivery:source}},own={id:'own-message',role:'user',content:{text:'My own message'},metadata:{}},native={id:'assistant-message',role:'assistant',content:{text:''},metadata:{status:'running',native:{version:'0.163.0',threadId:'native-root',turnId:'native-turn',items:[],approvals:[],steering:[{id:'steering-message',text:'Use the research findings.',source}]}}};
function Fixture(){const [value,setValue]=useState(current);refresh=setValue;return <WorkspaceLinks.Provider value={{link:href=>window.links.push(href)}}><div className="workspace-columns" style={{display:'block'}}><main key={generation} style={{display:'flex',flexDirection:'column',maxWidth:720,margin:'36px auto',padding:'0 20px'}}>{value.mode==='settings'?<ChatCoordinationSettings owner={value.owner}/>:value.mode==='messages'?<><ChatMessage message={sent} agentName="Builder"/><ChatMessage message={own} agentName="Builder"/><ChatMessage message={native} agentName="Builder" showAgentName={false}/></>:<QueuedMessages owner={value.owner} conversation={chat} request={value.request} turnId={value.turnId} error={error=>window.errors.push(error)}/>}</main></div></WorkspaceLinks.Provider>;}
document.documentElement.dataset.theme='dark';createRoot(document.getElementById('root')).render(<Fixture/>);
`,loader:'tsx',resolveDir:root},bundle:true,platform:'browser',format:'iife',outfile:path.join(out,'app.js'),define:{'process.env.NODE_ENV':'"production"'}});
await writeFile(path.join(out,'index.html'),'<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/app.css"></head><body><div id="root"></div><script src="/app.js"></script></body></html>');
const server=createServer((req,res)=>{void(async()=>{const name=new URL(req.url,'http://localhost').pathname,file=path.join(out,['/app.js','/app.css'].includes(name)?name.slice(1):'index.html');res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html');res.end(await readFile(file));})().catch(()=>{res.statusCode=404;res.end();});});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
await writeFile(path.join(out,'main.cjs'),`const {app,BrowserWindow}=require('electron');app.setPath('userData',${JSON.stringify(path.join(out,'profile'))});app.whenReady().then(()=>new BrowserWindow({show:false,width:940,height:850,useContentSize:true,webPreferences:{contextIsolation:true,sandbox:true,backgroundThrottling:false}}).loadURL('about:blank'));app.on('window-all-closed',()=>app.quit());`);
let app,page;const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
async function check(name,run){try{await run();evidence.checks.push(name);console.log('PASS '+name);}catch(error){evidence.failures.push({name,error:error.message});console.log('FAIL '+name+': '+error.message);}}
const reset=async(kind,theme='dark')=>{await page.evaluate(args=>window.resetFixture(...args),[kind,theme]);if(kind==='settings')await expect(page.getByRole('button',{name:'Revoke',exact:true})).toBeVisible();else if(kind==='messages')await expect(page.getByRole('article',{name:'Message from Research assistant',exact:true})).toBeVisible();else await expect(page.getByLabel('Queued messages')).toBeVisible();};
const mutations=()=>page.evaluate(()=>window.calls.filter(call=>!['chat.queue.list','chat.delivery.grants'].includes(call.action)));
try{
 app=await _electron.launch({executablePath:require('electron'),args:[path.join(out,'main.cjs')],env});page=await app.firstWindow();page.setDefaultTimeout(5000);
 await app.evaluate(({BrowserWindow})=>{const window=BrowserWindow.getAllWindows()[0];window.show();window.focus();});await page.setViewportSize({width:940,height:850});
 await page.route('**/*',route=>new URL(route.request().url()).hostname==='127.0.0.1'?route.continue():route.abort());await page.goto('http://127.0.0.1:'+server.address().port);
 await check('Incoming queue messages show their source, remain unedited and steer only the exact visible turn',async()=>{
  await reset('queued');await expect(page.getByRole('button',{name:'Edit queued message',exact:true})).toHaveCount(0);await page.getByRole('button',{name:'Open message from Research assistant in its source chat'}).click();assert.deepEqual(await page.evaluate(()=>window.links),['agentopia-chat://source-chat/message/source-message']);await page.screenshot({path:path.join(out,'incoming-dark.png')});await page.getByRole('button',{name:'Steer queued message',exact:true}).click();await expect(page.getByLabel('Queued messages')).toHaveCount(0);assert.deepEqual(await mutations(),[{action:'chat.queue.steer',args:{id:'incoming-message',requestId:'receiving-request',turnId:'receiving-turn'}}]);
 });
 for(const [label,decision] of [["Don't send",'deny'],['Send once','once'],['Allow these chats','pair']])await check('Target-side '+label+' makes one explicit delivery decision',async()=>{
  await reset('review');await expect(page.getByRole('dialog')).toHaveCount(0);await page.getByText('Review incoming message',{exact:true}).click();await expect(page.getByLabel('Message to send')).toHaveText('Review the approved draft and report the findings.');await page.getByRole('button',{name:label,exact:true}).click();await expect(page.getByLabel('Queued messages')).toHaveCount(0);assert.deepEqual(await mutations(),[{action:'chat.delivery.authorize',args:{id:'incoming-message',decision}}]);
 });
 await check('A valid saved authorization resumes without a new approval and an uncertain send offers no retry',async()=>{
  await reset('resume');await expect(page.getByText('Review incoming message',{exact:true})).toHaveCount(0);await page.getByRole('button',{name:'Resume queued message'}).click();await expect(page.getByLabel('Queued messages')).toHaveCount(0);assert.deepEqual(await mutations(),[{action:'chat.queue.change',args:{id:'incoming-message',action:'resume'}}]);await reset('uncertain');await expect(page.getByRole('button',{name:'Resume queued message'})).toHaveCount(0);await expect(page.getByRole('button',{name:'Send once',exact:true})).toHaveCount(0);await expect(page.getByLabel('Queued messages')).toContainText('Inspect the receiving chat');
 });
 await check('An incompatible running scope does not offer steering',async()=>{await reset('broad');await expect(page.getByRole('button',{name:'Steer queued message'})).toHaveCount(0);await expect(page.getByRole('button',{name:'Remove queued message'})).toBeEnabled();});
 await check('Stop while steering targets the actual receiving request',async()=>{await reset('starting');await page.getByRole('button',{name:'Stop sending queued message'}).click();await expect(page.getByLabel('Queued messages')).toHaveCount(0);assert.deepEqual(await mutations(),[{action:'chat.cancel',args:{requestId:'actual-steered-request'}}]);});
 await check('Human queued messages retain editing and removal',async()=>{await reset('human');await page.getByRole('button',{name:'Edit queued message'}).click();await page.getByRole('textbox',{name:'Edit queued message'}).fill('My revised follow-up');await page.getByRole('button',{name:'Save',exact:true}).click();await expect(page.getByLabel('Queued messages')).toContainText('My revised follow-up');await page.getByRole('button',{name:'Remove queued message'}).click();await expect(page.getByLabel('Queued messages')).toHaveCount(0);assert.deepEqual(await mutations(),[{action:'chat.queue.change',args:{id:'human-message',action:'edit',text:'My revised follow-up'}},{action:'chat.queue.change',args:{id:'human-message',action:'remove'}}]);});
 await check('Received and steered messages identify the sender while ordinary messages keep their own attribution',async()=>{
  await reset('messages');await expect(page.getByRole('article',{name:'Your message',exact:true})).toContainText('My own message');await expect(page.getByRole('button',{name:'Open message from Research assistant in its source chat'})).toHaveCount(2);await expect(page.getByText('You steered this turn',{exact:true})).toHaveCount(0);await page.screenshot({path:path.join(out,'messages-dark.png')});await page.getByRole('button',{name:'Open message from Research assistant in its source chat'}).last().click();assert.deepEqual(await page.evaluate(()=>window.links),['agentopia-chat://source-chat/message/source-message']);
 });
 await check('Chat-pair permission settings retain scope, explain revocation and submit the owned grant',async()=>{await reset('settings','light');await expect(page.getByLabel('Chat coordination permissions')).toContainText('Research findings');await expect(page.getByLabel('Chat coordination permissions')).toContainText('Build the site');await page.screenshot({path:path.join(out,'permissions-light.png')});await page.getByRole('button',{name:'Revoke',exact:true}).click();await expect(page.getByText('No chat pairs have ongoing permission.')).toBeVisible();assert.deepEqual(await mutations(),[{action:'chat.delivery.revoke',args:{owner:'owner-one',id:'pair-grant'}}]);});
 await check('Failed revocation remains visible, retains its grant and prevents duplicate clicks in flight',async()=>{await reset('settings');await page.evaluate(()=>{window.failRevoke=true;window.hold=true;});await page.getByRole('button',{name:'Revoke',exact:true}).click();await expect(page.getByRole('button',{name:'Revoking…',exact:true})).toBeDisabled();assert.equal((await mutations()).length,1);await page.evaluate(()=>window.release());await expect(page.getByRole('alert')).toHaveText('Permission changed before revocation. Refresh the settings.');await expect(page.getByRole('button',{name:'Revoke',exact:true})).toBeEnabled();});
 await check('The expanded review and controls fit a narrow chat without horizontal overflow',async()=>{await page.setViewportSize({width:450,height:850});await reset('review');await page.getByText('Review incoming message',{exact:true}).click();for(const label of ["Don't send",'Send once','Allow these chats']){const box=await page.getByRole('button',{name:label,exact:true}).boundingBox();assert(box.x>=0&&box.x+box.width<=450);}assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:path.join(out,'queue-narrow.png')});});
 assert.deepEqual(await fingerprints(),evidence.sourceSha256,'Sources changed during interface qualification');evidence.success=evidence.failures.length===0;
}catch(error){evidence.success=false;evidence.error=error.stack;}finally{if(page&&!evidence.success)await page.screenshot({path:path.join(out,'failure.png')}).catch(()=>{});await writeFile(path.join(out,'evidence.json'),JSON.stringify(evidence,null,2));if(app)await app.close();await new Promise(resolve=>server.close(resolve));}
console.log(JSON.stringify({success:evidence.success,checks:evidence.checks.length,failures:evidence.failures,error:evidence.error,out},null,2));if(!evidence.success)process.exitCode=1;
