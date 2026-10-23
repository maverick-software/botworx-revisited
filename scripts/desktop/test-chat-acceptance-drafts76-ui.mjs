import {_electron,expect} from '@playwright/test';
import {build} from 'esbuild';
import {createServer} from 'node:http';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import path from 'node:path';
import assert from 'node:assert/strict';
import ts from 'typescript';

import {desktopOperation} from './operation-lock.mjs';
desktopOperation('offscreen queue and steering draft regression against current renderer');
const require=createRequire(import.meta.url),root=path.resolve(import.meta.dirname,'../..'),out=path.join('F:/Agentopia-Acceptance/chat-acceptance-drafts',String(Date.now()));await mkdir(out,{recursive:true});
const delivered=process.env.AGENTOPIA_DRAFT_UI_RESOURCES;
const sourceFiles=['desktop/ui/DesktopApp.tsx','desktop/ui/useChatDrafts.ts','desktop/ui/Composer.tsx'],hashes=async()=>Object.fromEntries(await Promise.all(sourceFiles.map(async name=>[name,createHash('sha256').update(await readFile(path.join(root,name))).digest('hex')]))),sourceSha256=await hashes();
if(!delivered)await build({stdin:{contents:`import React from 'react';import {createRoot} from 'react-dom/client';import {DesktopApp} from './desktop/ui/DesktopApp';import './desktop/ui/style.css';createRoot(document.getElementById('root')).render(<DesktopApp/>);`,loader:'tsx',resolveDir:root},bundle:true,platform:'browser',format:'iife',outfile:path.join(out,'app.js'),define:{'process.env.NODE_ENV':'"production"'},plugins:[{name:'worklet-url',setup(b){b.onResolve({filter:/\?url$/},args=>({path:path.resolve(args.resolveDir,args.path.slice(0,-4)),namespace:'url'}));b.onLoad({filter:/.*/,namespace:'url'},async args=>({contents:'export default '+JSON.stringify('data:text/javascript,'+encodeURIComponent(await readFile(args.path,'utf8'))),loader:'js'}));}}]});
const fixture=await readFile(path.join(root,'scripts/desktop/workspace-agent-ui-fixture.tsx'),'utf8'),{defaultAgentPolicy}=require(path.join(root,'.supabase/desktop-goal-queue/build/agent-contracts.js'));
const injection=ts.transpileModule('const defaultAgentPolicy='+JSON.stringify(defaultAgentPolicy)+';\n'+fixture.slice(fixture.indexOf('const mira='),fixture.indexOf('function Fixture(){'))+String.raw`
appFixture=true;const secondId='12121212-1212-4212-8212-121212121212',requestId='34343434-3434-4434-8434-343434343434',turnId='56565656-5656-4656-8656-565656565656';
appChat.title='Acceptance chat A';const second={...appChat,conversation_id:secondId,title:'Acceptance chat B'};appDrafts.set('conversation:'+secondId,{text:'Independent unsent B draft',options:{...appOptions,thinking:'high'}});
const native={version:'0.163.0',threadId:'78787878-7878-4787-8787-787878787878',turnId,items:[],approvals:[],steering:[]};appMessages[1].metadata={...appMessages[1].metadata,status:'running',native,timing:{requestId,startedAt:new Date().toISOString()}};
let working=true,queue=[];window.acceptanceCalls=[];const original=window.agentopia.call;
const emit=event=>{for(const listener of chatListeners)listener({ownerId:appOwner,conversationId:chatId,requestId,...event});};
window.finishOriginal=()=>{working=false;appMessages[1].metadata.status='completed';emit({status:'completed'});};
window.agentopia.call=async(action,args={})=>{
 window.acceptanceCalls.push({action,args:structuredClone(args)});
 if(action==='preferences.get')return {theme:'dark',textSize:'standard',sendWith:'enter',sidebarCollapsed:false};
 if(action==='conversations.list')return [structuredClone(appChat),structuredClone(second)];
 if(action==='messages.list')return args.conversationId===secondId?[]:structuredClone(appMessages);
 if(action==='native.active')return working?[{requestId,conversationId:chatId,threadId:native.threadId,turnId}]:[];
 if(action==='drafts.save'&&window.rejectDraftClear&&args.draft.text==='')throw Error('Controlled local draft storage failure');
 if(action==='drafts.get'&&args.scope==='conversation:'+chatId&&window.holdNextADraftRead){window.holdNextADraftRead=false;const captured=await original(action,args);await new Promise(resolve=>{window.draftReadPending=true;window.releaseDraftRead=()=>{window.draftReadPending=false;resolve();};});return captured;}
 if(action==='chat.queue.list')return args.conversationId===secondId?[]:structuredClone(queue);
 if(action==='chat.queue.add'||action==='native.steer'){
  await new Promise((resolve,reject)=>{window.acceptancePending=true;window.releaseAcceptance=error=>{window.acceptancePending=false;delete window.releaseAcceptance;error?reject(Error(error)):resolve();};});
  if(action==='chat.queue.add'){queue.push({...args,status:'queued',createdAt:new Date().toISOString()});emit({kind:'queue'});return structuredClone(queue);}
  native.steering.push({id:args.id,text:args.text});emit({kind:'native',native:structuredClone(native)});return;
 }
 return original(action,args);
};history.replaceState(null,'','/conversations/'+chatId);
`,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText;
await writeFile(path.join(out,'index.html'),'<html><head><link rel="stylesheet" href="/app.css"></head><body><div id="root"></div><script src="/app.js"></script></body></html>');
const server=createServer((req,res)=>{void(async()=>{const pathname=new URL(req.url,'http://localhost').pathname,file=delivered?path.resolve(delivered,pathname.startsWith('/assets/')?pathname.slice(1):'index.html'):path.join(out,['/app.js','/app.css'].includes(pathname)?pathname.slice(1):'index.html');if(delivered)assert(file.startsWith(path.resolve(delivered)+path.sep));res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html');res.end(await readFile(file));})().catch(()=>{res.statusCode=404;res.end();});});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
await writeFile(path.join(out,'main.cjs'),`const {app,BrowserWindow}=require('electron');app.setPath('userData',${JSON.stringify(path.join(out,'profile'))});app.whenReady().then(()=>new BrowserWindow({show:false,width:1360,height:900,useContentSize:true,webPreferences:{contextIsolation:true,sandbox:true,backgroundThrottling:false,offscreen:true}}).loadURL('about:blank'));app.on('window-all-closed',()=>app.quit());`);
const evidence={at:new Date().toISOString(),sourceSha256,rendererFromPackagedResources:!!delivered,rendererResources:delivered??null,controlledBridge:true,actualDesktopApp:true,productionAccess:false,inferenceRequests:0,checks:[],rendererErrors:[]},env={...process.env};delete env.ELECTRON_RUN_AS_NODE;let app,page;
const message=()=>page.getByRole('textbox',{name:'Message',exact:true}),openChat=async letter=>{await page.locator('.history-open').filter({hasText:'Acceptance chat '+letter}).click();await expect(message()).toBeEnabled();};
async function begin(kind){await page.reload();await expect(page.getByRole('button',{name:'Stop response',exact:true})).toBeVisible();await message().fill('Submitted '+kind+' input');await expect(page.getByRole('button',{name:'Queue message',exact:true})).toBeEnabled();if(kind==='queue')await message().press('Enter');else await page.getByRole('button',{name:'Steer',exact:true}).click();await page.waitForFunction(()=>window.acceptancePending===true);}
async function released(error){await page.evaluate(error=>window.releaseAcceptance(error),error);await expect.poll(async()=>page.evaluate(()=>window.acceptancePending)).toBe(false);}
const check=async(name,fn)=>{await fn();evidence.checks.push(name);console.log('PASS '+name);};
try{
 app=await _electron.launch({executablePath:require('electron'),args:[path.join(out,'main.cjs')],env});page=await app.firstWindow();page.setDefaultTimeout(3000);page.on('pageerror',error=>evidence.rendererErrors.push(error.message));await page.addInitScript(injection);await page.goto('http://127.0.0.1:'+server.address().port);
 for(const kind of ['queue','steer']){
  await check(kind+' acceptance after switching chats preserves B and clears only the unchanged submitted A draft',async()=>{await begin(kind);await openChat('B');await expect(message()).toHaveValue('Independent unsent B draft');await released();await expect(message()).toHaveValue('Independent unsent B draft');await openChat('A');await expect(message()).toHaveValue('');await expect(page.getByRole('alert')).toHaveCount(0);});
  await check(kind+' acceptance preserves newer text typed in the same composer while pending',async()=>{await begin(kind);await message().fill('New unsent A message');await released();await expect(message()).toHaveValue('New unsent A message');await openChat('B');await openChat('A');await expect(message()).toHaveValue('New unsent A message');});
 }
 await check('reopening A during acknowledgement cannot restore its stale already-submitted draft',async()=>{await begin('queue');await openChat('B');await page.evaluate(()=>window.holdNextADraftRead=true);const opening=page.locator('.history-open').filter({hasText:'Acceptance chat A'}).click();await page.waitForFunction(()=>window.draftReadPending===true);await released();await page.waitForFunction(()=>window.acceptanceCalls.some(c=>c.action==='drafts.save'&&c.args.scope==='conversation:99999999-9999-4999-8999-999999999999'&&c.args.draft.text===''));await page.evaluate(()=>window.releaseDraftRead());await opening;await expect(message()).toBeEnabled();await expect(message()).toHaveValue('');await openChat('B');await expect(message()).toHaveValue('Independent unsent B draft');});
 await check('completion before queue acknowledgement retains the next draft and sends exactly the captured model/options once',async()=>{await begin('queue');await message().fill('Next draft after completion');await page.evaluate(()=>window.finishOriginal());await expect(page.getByRole('button',{name:'Stop response',exact:true})).toHaveCount(0);await released();await expect(message()).toHaveValue('Next draft after completion');const calls=await page.evaluate(()=>window.acceptanceCalls.filter(c=>c.action==='chat.queue.add'));assert.equal(calls.length,1);assert.equal(calls[0].args.text,'Submitted queue input');assert.equal(calls[0].args.options.model,'fixture-model');assert.equal(calls[0].args.options.provider,'openai-oauth');assert.equal(calls[0].args.options.thinking,'low');assert.equal(calls[0].args.options.permission,'files');assert.deepEqual(calls[0].args.options.files,[]);assert(!(await page.evaluate(()=>window.acceptanceCalls)).some(c=>c.action==='chat.start'));await page.screenshot({path:path.join(out,'completion-preserved-draft.png')});});
 await check('a refused queue acknowledgement leaves the submitted draft available to review',async()=>{await begin('queue');await released('Controlled queue refusal');await expect(page.getByRole('alert')).toContainText('Controlled queue refusal');await expect(message()).toHaveValue('Submitted queue input');});
 await check('an accepted queue remains accepted when local draft cleanup fails, with a clear notice and no repeated send',async()=>{await begin('queue');await page.evaluate(()=>window.rejectDraftClear=true);await released();await expect(page.getByRole('alert')).toContainText('The message was accepted, but its local draft could not be cleared: Controlled local draft storage failure');assert.equal((await page.evaluate(()=>window.acceptanceCalls.filter(c=>c.action==='chat.queue.add'))).length,1);await expect(page.getByRole('region',{name:'Queued messages',exact:true})).toContainText('Submitted queue input');});
 assert.deepEqual(evidence.rendererErrors,[]);assert.deepEqual(await hashes(),sourceSha256);evidence.success=true;
}catch(error){evidence.success=false;evidence.error=error.stack;if(page){await page.screenshot({path:path.join(out,'failure.png')}).catch(()=>{});evidence.visibleDraft=await message().inputValue().catch(()=>null);}process.exitCode=1;}
finally{await writeFile(path.join(out,'evidence.json'),JSON.stringify(evidence,null,2));if(app)await app.close();await new Promise(resolve=>server.close(resolve));}
console.log(JSON.stringify({success:evidence.success,checks:evidence.checks.length,out,error:evidence.error},null,2));
