import {_electron,expect} from '@playwright/test';
import {build} from 'esbuild';
import {createServer} from 'node:http';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createRequire} from 'node:module';
import path from 'node:path';
import assert from 'node:assert/strict';
import {desktopOperation} from './operation-lock.mjs';
desktopOperation('isolated inline chat delivery review interface');
const require=createRequire(import.meta.url),root=path.resolve(import.meta.dirname,'../..'),out=path.join(root,'.supabase/desktop-chat-delivery','ui-'+Date.now());
await mkdir(out,{recursive:true});
await build({stdin:{contents:`
import React,{useState} from 'react';import {createRoot} from 'react-dom/client';import {ToolTimeline} from './desktop/ui/ToolActivity';import './desktop/ui/style.css';
let refresh,generation=0;window.decisions=[];window.failDecision=false;window.holdDecision=false;
const make=(provider='ChatGPT',long=false)=>({id:'11111111-1111-4111-8111-111111111111',request_id:'22222222-2222-4222-8222-222222222222',conversation_id:'33333333-3333-4333-8333-333333333333',assistant_message_id:'44444444-4444-4444-8444-444444444444',name:'send_message_to_chat',label:'Message to Build the site',status:'awaiting_approval',arguments:{},approval:{source:'Chat coordination',tool:'Queue a message in another chat',coordination:{deliveryId:'55555555-5555-4555-8555-555555555555'},description:'Allow this message once, or allow both chats to coordinate in their current projects. The receiving chat keeps its selected connection and inherits the narrower tool and file permissions.',arguments:{from:'Research assistant',to:long?'Build the site with the approved accessible landscaping design and current requirements':'Build the site',agent:'Builder',connection:provider,model:'gpt-6.1-sol',permission:'ask',delivery:'queue',message:long?'Review the approved draft and report the findings. '.repeat(150):'Review the homepage draft. Report any accessibility issues in this chat before changing files.',...(provider==='OpenRouter'?{cost_notice:'Replies use the configured OpenRouter connection’s paid allowance.'}:{})}}});
let current=make();window.agentopia={call:async(action,args)=>{window.decisions.push({action,args});if(window.holdDecision)await new Promise(resolve=>window.releaseDecision=resolve);if(window.failDecision)throw Error('The sending task changed. Review a fresh message.');current={...current,status:args.approved?'completed':'denied',result:{status:args.approved?'queued':'denied'}};refresh({...current});},onChat:()=>()=>{}};
window.resetReview=(theme='dark',provider='ChatGPT',long=false)=>{generation++;document.documentElement.dataset.theme=theme;window.decisions=[];window.failDecision=false;window.holdDecision=false;current=make(provider,long);refresh({...current});};
function Fixture(){const [row,setRow]=useState(current);refresh=setRow;return <main style={{maxWidth:720,margin:'40px auto',padding:'0 24px'}}><ToolTimeline key={generation} activities={[row]} active/></main>;}document.documentElement.dataset.theme='dark';createRoot(document.getElementById('root')).render(<Fixture/>);
`,loader:'tsx',resolveDir:root},bundle:true,platform:'browser',format:'iife',outfile:path.join(out,'app.js'),define:{'process.env.NODE_ENV':'"production"'}});
await writeFile(path.join(out,'index.html'),'<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/app.css"></head><body><div id="root"></div><script src="/app.js"></script></body></html>');
const server=createServer((req,res)=>{void(async()=>{const name=new URL(req.url,'http://localhost').pathname,file=path.join(out,['/app.js','/app.css'].includes(name)?name.slice(1):'index.html');res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html');res.end(await readFile(file));})().catch(()=>{res.statusCode=404;res.end();});});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
await writeFile(path.join(out,'main.cjs'),`const {app,BrowserWindow}=require('electron');app.setPath('userData',${JSON.stringify(path.join(out,'profile'))});app.whenReady().then(()=>new BrowserWindow({show:false,width:940,height:850,useContentSize:true,webPreferences:{contextIsolation:true,sandbox:true,backgroundThrottling:false}}).loadURL('about:blank'));app.on('window-all-closed',()=>app.quit());`);
const evidence={at:new Date().toISOString(),actualToolTimeline:true,controlledBridge:true,installed:false,productionAccess:false,inferenceRequests:0,checks:[],failures:[]},env={...process.env};delete env.ELECTRON_RUN_AS_NODE;let app,page;
async function check(name,run){try{await run();evidence.checks.push(name);console.log('PASS '+name);}catch(error){evidence.failures.push({name,error:error.message});console.log('FAIL '+name+': '+error.message);}}
const reset=async(...args)=>{await page.evaluate(args=>window.resetReview(...args),args);await expect(page.getByRole('button',{name:'Send once',exact:true})).toBeEnabled();};
try{
 app=await _electron.launch({executablePath:require('electron'),args:[path.join(out,'main.cjs')],env});page=await app.firstWindow();page.setDefaultTimeout(5000);
 await app.evaluate(({BrowserWindow})=>{const window=BrowserWindow.getAllWindows()[0];window.show();window.focus();});await page.setViewportSize({width:940,height:850});
 await page.route('**/*',route=>{const url=new URL(route.request().url());return url.hostname==='127.0.0.1'?route.continue():route.abort();});
 await page.goto('http://127.0.0.1:'+server.address().port);
 await check('The review is inline with its exact destination, connection and message; no dialog or JSON argument dump',async()=>{
  await expect(page.getByRole('dialog')).toHaveCount(0);await expect(page.getByLabel('Chat message review')).toContainText('Build the site');await expect(page.getByLabel('Chat message review')).toContainText('ChatGPT');await expect(page.getByLabel('Message to send')).toHaveText('Review the homepage draft. Report any accessibility issues in this chat before changing files.');await expect(page.getByLabel('External tool arguments')).toHaveCount(0);await expect(page.getByText('Default permissions',{exact:true})).toBeVisible();await expect(page.getByText(/paid allowance/)).toHaveCount(0);await page.screenshot({path:path.join(out,'inline-dark.png')});
 });
 for(const [label,expected] of [["Don't send",{approved:false}],['Send once',{approved:true}],['Allow these chats',{approved:true,rememberChatPair:true}]])await check(label+' submits one trusted decision against the tool review',async()=>{
  await reset();await page.getByRole('button',{name:label,exact:true}).click();await expect(page.getByRole('button',{name:'Send once',exact:true})).toHaveCount(0);const calls=await page.evaluate(()=>window.decisions);assert.deepEqual(calls,[{action:'tools.decide',args:{id:'11111111-1111-4111-8111-111111111111',...expected}}]);
 });
 await check('Rapid clicks cannot submit two choices while a decision is pending',async()=>{
  await reset();await page.evaluate(()=>window.holdDecision=true);await page.getByRole('button',{name:'Send once',exact:true}).click();for(const label of ["Don't send",'Send once','Allow these chats'])await expect(page.getByRole('button',{name:label,exact:true})).toBeDisabled();assert.equal(await page.evaluate(()=>window.decisions.length),1);await page.evaluate(()=>window.releaseDecision());await expect(page.getByRole('button',{name:'Send once',exact:true})).toHaveCount(0);
 });
 await check('A stale authorization shows its error and keeps the review available',async()=>{
  await reset();await page.evaluate(()=>window.failDecision=true);await page.getByRole('button',{name:'Send once',exact:true}).click();await expect(page.getByRole('alert')).toHaveText('The sending task changed. Review a fresh message.');await expect(page.getByRole('button',{name:'Send once',exact:true})).toBeEnabled();
 });
 await check('OpenRouter cost information and all choices remain readable in the light theme',async()=>{
  await reset('light','OpenRouter');await expect(page.getByText(/paid allowance/)).toBeVisible();for(const label of ["Don't send",'Send once','Allow these chats'])await expect(page.getByRole('button',{name:label,exact:true})).toBeInViewport();await page.screenshot({path:path.join(out,'inline-light-openrouter.png')});
 });
 await check('Long messages scroll independently and controls wrap within a narrow chat pane',async()=>{
  await page.setViewportSize({width:450,height:850});await reset('dark','ChatGPT',true);const message=page.getByLabel('Message to send');await message.focus();await expect(message).toBeFocused();evidence.scrollGeometry=await message.evaluate(e=>({height:e.clientHeight,total:e.scrollHeight,focused:document.activeElement===e,documentFocused:document.hasFocus(),visibility:document.visibilityState}));await message.press('PageDown');await expect.poll(()=>message.evaluate(e=>e.scrollTop)).toBeGreaterThan(0);assert(await message.evaluate(e=>e.clientHeight<=220&&e.scrollHeight>e.clientHeight));for(const label of ["Don't send",'Send once','Allow these chats']){const bounds=await page.getByRole('button',{name:label,exact:true}).boundingBox();assert(bounds.x>=0&&bounds.x+bounds.width<=450);}await page.screenshot({path:path.join(out,'inline-narrow.png')});
 });
 for(const name of ['inline-dark.png','inline-light-openrouter.png','inline-narrow.png']){const png=await readFile(path.join(out,name));assert(png.readUInt32BE(16)>=450&&png.readUInt32BE(20)>=800,'Capture must show the complete review: '+name);}evidence.success=evidence.failures.length===0;
}catch(error){evidence.success=false;evidence.error=error.stack;}finally{if(page&&!evidence.success)await page.screenshot({path:path.join(out,'failure.png')}).catch(()=>{});await writeFile(path.join(out,'evidence.json'),JSON.stringify(evidence,null,2));if(app)await app.close();await new Promise(resolve=>server.close(resolve));}
console.log(JSON.stringify({success:evidence.success,checks:evidence.checks.length,failures:evidence.failures,out},null,2));if(!evidence.success)process.exitCode=1;
