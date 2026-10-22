import {_electron,expect} from '@playwright/test';
import {build} from 'esbuild';
import {createServer} from 'node:http';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import path from 'node:path';
import assert from 'node:assert/strict';
import ts from 'typescript';

const require=createRequire(import.meta.url),root=path.resolve(import.meta.dirname,'../..'),out=path.join('C:/Users/charl/AgentopiaQA/chat-polish',String(Date.now()));await mkdir(out,{recursive:true});
const delivered=process.env.AGENTOPIA_DRAFT_UI_RESOURCES;
const sourceFiles=['desktop/ui/DesktopApp.tsx','desktop/ui/Composer.tsx','desktop/ui/WorkspaceViews.tsx','desktop/ui/ChatActivity.tsx','desktop/ui/ChatLink.tsx','desktop/ui/WorkspacePane.tsx','desktop/ui/style.css'],hashes=async()=>Object.fromEntries(await Promise.all(sourceFiles.map(async name=>[name,createHash('sha256').update(await readFile(path.join(root,name))).digest('hex')]))),sourceSha256=await hashes();
if(!delivered)await build({stdin:{contents:`import React from 'react';import {createRoot} from 'react-dom/client';import {DesktopApp} from './desktop/ui/DesktopApp';import './desktop/ui/style.css';createRoot(document.getElementById('root')).render(<DesktopApp/>);`,loader:'tsx',resolveDir:root},bundle:true,platform:'browser',format:'iife',outfile:path.join(out,'app.js'),define:{'process.env.NODE_ENV':'"production"'},plugins:[{name:'worklet-url',setup(b){b.onResolve({filter:/\?url$/},args=>({path:path.resolve(args.resolveDir,args.path.slice(0,-4)),namespace:'url'}));b.onLoad({filter:/.*/,namespace:'url'},async args=>({contents:'export default '+JSON.stringify('data:text/javascript,'+encodeURIComponent(await readFile(args.path,'utf8'))),loader:'js'}));}}]});
const fixture=await readFile(path.join(root,'scripts/desktop/workspace-agent-ui-fixture.tsx'),'utf8'),{defaultAgentPolicy}=require(path.join(root,'.supabase/desktop-goal-queue/build/agent-contracts.js'));
const injection=ts.transpileModule('const defaultAgentPolicy='+JSON.stringify(defaultAgentPolicy)+';\n'+fixture.slice(fixture.indexOf('const mira='),fixture.indexOf('function Fixture(){'))+String.raw`
appFixture=true;const secondId='12121212-1212-4212-8212-121212121212',requestId='34343434-3434-4434-8434-343434343434';
appChat.title='Document chat';const second={...appChat,conversation_id:secondId,title:'Background chat'};
appMessages[1].content.text='Created [Sample.docx](C:/generated/Sample.docx), [Sample.pdf](C:/generated/Sample.pdf), [Sample.xlsx](C:/generated/Sample.xlsx), [Sample.pptx](C:/generated/Sample.pptx), [site](https://example.invalid), and [code](C:/generated/sample.py) and [HTML page](C:/generated/sample.html).';
appMessages[1].metadata.native={version:'0.163.0',threadId:'78787878-7878-4787-8787-787878787878',turnId:'56565656-5656-4656-8656-565656565656',items:[{threadId:'78787878-7878-4787-8787-787878787878',turnId:'56565656-5656-4656-8656-565656565656',completed:true,item:{type:'agentMessage',id:'final',phase:'final_answer',text:appMessages[1].content.text}}],approvals:[],steering:[]};
let working=sessionStorage.getItem("polish-completed")!=="yes",refs=[],preferences={theme:'dark',textSize:'standard',sendWith:'enter',sidebarCollapsed:false};window.acceptanceCalls=[];
const original=window.agentopia.call;
window.finishBackground=()=>{working=false;sessionStorage.setItem("polish-completed","yes");for(const listener of chatListeners)listener({ownerId:appOwner,conversationId:secondId,requestId,status:'completed'});};
window.agentopia.call=async(action,args={})=>{
 window.acceptanceCalls.push({action,args:structuredClone(args)});
 if(action==='preferences.get')return preferences;
 if(action==='preferences.save'){preferences={...preferences,...args};return preferences;}
 if(action==='conversations.list')return [structuredClone(appChat),structuredClone(second)];
 if(action==='messages.list')return args.conversationId===secondId?[]:structuredClone(appMessages);
 if(action==='native.active')return working?[{requestId,conversationId:secondId,threadId:'78787878-7878-4787-8787-787878787878',turnId:'56565656-5656-4656-8656-565656565656'}]:[];
 if(action==='files.list')return refs;
 if(action==='chat.queue.list')return [];
 if(action==='workspace.link'){
  if(args.href.startsWith('https:'))return {kind:'web',url:args.href};
  const name=args.href.split('/').pop(),id='abababab-abab-4bab-8bab-'+String(['Sample.docx','Sample.pdf','Sample.xlsx','Sample.pptx','sample.py','sample.html'].indexOf(name)+1).padStart(12,'0');
  if(!refs.some(r=>r.id===id))refs.push({id,name,path:args.href,kind:'file'});
  return {kind:'file',referenceId:id,path:'',name};
 }
 if(action==='workspace.read'){const ref=refs.find(row=>row.id===args.referenceId);if(ref.name.endsWith('.html'))return {content:'<h1>Readable HTML site</h1>',sha256:'a'.repeat(64)};if(ref.name.endsWith('.py'))return {content:'print("Readable code")',sha256:'a'.repeat(64)};const kind=ref.name.endsWith('.pdf')?'pdf':ref.name.endsWith('.xlsx')?'spreadsheet':ref.name.endsWith('.pptx')?'presentation':'word';return {document:{kind,totalUnits:1,unitsRead:1,truncated:false,hasText:true,text:'Readable '+ref.name,sections:[{label:'Section 1',text:'Readable '+ref.name}]}};}
 if(action==='workspace.fileAction')return args.action==='google'?{url:'https://drive.google.com/drive/u/0/my-drive',notice:'Choose New → File upload to import this local document.'}:{saved:true};
 if(action==='browser.resolve')return {id:args.id};
 if(action.startsWith('browser.'))return {url:args.url??'https://example.invalid/',title:'Fixture browser',loading:false,canGoBack:false,canGoForward:false};
 return original(action,args);
};history.replaceState(null,'','/conversations/'+chatId);
`,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText;
await writeFile(path.join(out,'index.html'),'<html><head><link rel="stylesheet" href="/app.css"></head><body><div id="root"></div><script src="/app.js"></script></body></html>');
const server=createServer((req,res)=>{void(async()=>{const pathname=new URL(req.url,'http://localhost').pathname,file=delivered?path.resolve(delivered,pathname.startsWith('/assets/')?pathname.slice(1):'index.html'):path.join(out,['/app.js','/app.css'].includes(pathname)?pathname.slice(1):'index.html');if(delivered)assert(file.startsWith(path.resolve(delivered)+path.sep));res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html');res.end(await readFile(file));})().catch(()=>{res.statusCode=404;res.end();});});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
await writeFile(path.join(out,'main.cjs'),`const {app,BrowserWindow}=require('electron');app.setPath('userData',${JSON.stringify(path.join(out,'profile'))});app.whenReady().then(()=>new BrowserWindow({show:false,width:1360,height:900,useContentSize:true,webPreferences:{contextIsolation:true,sandbox:true,backgroundThrottling:false}}).loadURL('about:blank'));app.on('window-all-closed',()=>app.quit());`);
const evidence={at:new Date().toISOString(),sourceSha256,rendererFromPackagedResources:!!delivered,rendererResources:delivered??null,controlledBridge:true,actualDesktopApp:true,productionAccess:false,inferenceRequests:0,checks:[],rendererErrors:[]},env={...process.env};delete env.ELECTRON_RUN_AS_NODE;let app,page;
const message=()=>page.getByRole('textbox',{name:'Message',exact:true});
const check=async(name,fn)=>{await fn();evidence.checks.push(name);console.log('PASS '+name);};
try{
 app=await _electron.launch({executablePath:require('electron'),args:[path.join(out,'main.cjs')],env});page=await app.firstWindow();page.setDefaultTimeout(5000);page.on('pageerror',error=>evidence.rendererErrors.push(error.message));await page.addInitScript(injection);await page.goto('http://127.0.0.1:'+server.address().port);
 await check('composer and sent messages have identical font sizes at standard/large scales and narrow/wide widths',async()=>{
  await expect(page.getByRole('article',{name:'Your message'})).toBeVisible();
  for(const width of [1360,800]){await page.setViewportSize({width,height:900});for(const size of ['standard','large']){await page.evaluate(size=>document.documentElement.dataset.textSize=size,size);await message().fill('Message sizing');const values=await page.evaluate(()=>[document.querySelector('.enhanced-composer textarea'),document.querySelector('.user-message-text'),document.querySelector('.message.assistant p')].map(node=>getComputedStyle(node).fontSize));assert.equal(values[0],values[1]);assert.equal(values[1],values[2]);}}
  await page.setViewportSize({width:1360,height:900});await page.evaluate(()=>document.documentElement.dataset.textSize='standard');
 });
 await check('working chat uses a neutral rotating spinner and completion becomes an unread blue dot until opened',async()=>{
  const row=page.locator('.history-row').filter({hasText:'Background chat'});await expect(row.getByLabel('Working',{exact:true})).toBeVisible();const style=await row.locator('.native-running-dot').evaluate(node=>({background:getComputedStyle(node).backgroundColor,animation:getComputedStyle(node).animationName}));assert.equal(style.background,'rgba(0, 0, 0, 0)');assert.equal(style.animation,'spin');await page.evaluate(()=>window.finishBackground());await expect(row.getByLabel('Completed response',{exact:true})).toBeVisible();
  await page.reload();await expect(row.getByLabel('Completed response',{exact:true})).toBeVisible();await row.locator('.history-open').click();await expect(row.getByLabel('Completed response',{exact:true})).toHaveCount(0);await page.locator('.history-open').filter({hasText:'Document chat'}).click();
 });
 await check('new chat has no recent-chat list and history remains in the sidebar',async()=>{await page.getByRole('button',{name:/^New chat/}).click();await expect(page.locator('.chat-home')).toBeVisible();await expect(page.getByRole('region',{name:'Recent chats',exact:true})).toHaveCount(0);await expect(page.locator('.recent-chats')).toHaveCount(0);await expect(page.locator('.history-open').filter({hasText:'Document chat'})).toBeVisible();await page.screenshot({path:path.join(out,'new-chat.png')});await page.locator('.history-open').filter({hasText:'Document chat'}).click();});
 await check('newly resolved DOCX/PDF/XLSX/PPTX/code links open right-side previews without stale reference errors',async()=>{
  for(const name of ['Sample.docx','Sample.pdf','Sample.xlsx','Sample.pptx','code']){await page.getByRole('link',{name,exact:true}).click();await expect(page.getByRole('region',{name:'Workspace preview',exact:true})).toContainText(name==='code'?'Readable code':'Readable '+name);await expect(page.locator('.pane-error')).toHaveCount(0);}
  await page.getByRole('link',{name:'Sample.docx',exact:true}).click();await page.screenshot({path:path.join(out,'document-preview.png')});
 });
 await check('right-click exposes file actions and dispatches save/default-app/Explorer actions once',async()=>{
  for(const [label,action] of [['Save a copy…','download'],['Open in Word / default app','open'],['Show in File Explorer','reveal']]){await page.getByRole('link',{name:'Sample.docx',exact:true}).click({button:'right'});await page.getByRole('menuitem',{name:label,exact:true}).click();await expect.poll(()=>page.evaluate(action=>window.acceptanceCalls.filter(c=>c.action==='workspace.fileAction'&&c.args.action===action).length,action)).toBe(1);}
  await page.getByRole('link',{name:'Sample.docx',exact:true}).click({button:'right'});await expect(page.getByRole('menuitem',{name:'Import into Google Docs…',exact:true})).toBeVisible();await page.screenshot({path:path.join(out,'file-context-menu.png')});await page.keyboard.press('Escape');
 });
 await check('website links open browser tabs and HTML links select the canvas automatically',async()=>{await page.getByRole('link',{name:'site',exact:true}).click();await expect.poll(()=>page.evaluate(()=>window.acceptanceCalls.some(c=>c.action==='browser.open'&&c.args.url?.startsWith('https://example.invalid')))).toBe(true);await page.getByRole('link',{name:'HTML page',exact:true}).click();await expect.poll(()=>page.evaluate(()=>window.acceptanceCalls.some(c=>c.action==='browser.open'&&c.args.html?.includes('Readable HTML site')))).toBe(true);});
 await check('keyboard link menu offers Google import with an explicit local-file upload instruction',async()=>{await page.getByRole('link',{name:'Sample.docx',exact:true}).focus();await page.keyboard.press('Shift+F10');await page.getByRole('menuitem',{name:'Import into Google Docs…',exact:true}).click();await expect(page.getByRole('status').filter({hasText:'Choose New → File upload'})).toBeVisible();});
 await expect(page.getByRole('alert')).toHaveCount(0);assert.deepEqual(evidence.rendererErrors,[]);assert.deepEqual(await hashes(),sourceSha256);evidence.success=true;
}catch(error){evidence.success=false;evidence.error=error.stack;if(page){evidence.failureCalls=await page.evaluate(()=>window.acceptanceCalls.slice(-30)).catch(()=>[]);evidence.dom=await page.locator('body').innerText({timeout:2000}).catch(()=>null);await page.screenshot({path:path.join(out,'failure.png'),timeout:2000,animations:'disabled'}).catch(()=>{});}process.exitCode=1;}
finally{await writeFile(path.join(out,'evidence.json'),JSON.stringify(evidence,null,2));if(app)await app.close();await new Promise(resolve=>server.close(resolve));}
console.log(JSON.stringify({success:evidence.success,checks:evidence.checks.length,out,error:evidence.error},null,2));
