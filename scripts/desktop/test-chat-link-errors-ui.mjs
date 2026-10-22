import {_electron,expect} from '@playwright/test';
import {build} from 'esbuild';
import {createServer} from 'node:http';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import path from 'node:path';
import assert from 'node:assert/strict';
import ts from 'typescript';

const require=createRequire(import.meta.url),root=path.resolve(import.meta.dirname,'../..'),out=path.join('C:/Users/charl/AgentopiaQA/chat-link-errors',String(Date.now()));await mkdir(out,{recursive:true});
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
  if(window.failWorkspaceLink)throw Error('The generated output is unavailable.');
  if(args.href.startsWith('https:'))return {kind:'web',url:args.href};
  const name=args.href.split('/').pop(),id='abababab-abab-4bab-8bab-'+String(['Sample.docx','Sample.pdf','Sample.xlsx','Sample.pptx','sample.py','sample.html'].indexOf(name)+1).padStart(12,'0');
  if(!refs.some(r=>r.id===id))refs.push({id,name,path:args.href,kind:'file'});
  return {kind:'file',referenceId:id,path:'',name};
 }
 if(action==='workspace.read'){if(window.failWorkspaceRead)throw Error('The document changed while opening.');const ref=refs.find(row=>row.id===args.referenceId);if(ref.name.endsWith('.html'))return {content:'<h1>Readable HTML site</h1>',sha256:'a'.repeat(64)};if(ref.name.endsWith('.py'))return {content:'print("Readable code")',sha256:'a'.repeat(64)};const kind=ref.name.endsWith('.pdf')?'pdf':ref.name.endsWith('.xlsx')?'spreadsheet':ref.name.endsWith('.pptx')?'presentation':'word';return {document:{kind,totalUnits:1,unitsRead:1,truncated:false,hasText:true,text:'Readable '+ref.name,sections:[{label:'Section 1',text:'Readable '+ref.name}]}};}
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
 await expect(page.getByRole('link',{name:'Sample.docx',exact:true})).toBeVisible();await message().fill('Keep this unsent draft');
 await check('a failed link opening a closed pane keeps its error visible after pane persistence',async()=>{await page.evaluate(()=>window.failWorkspaceLink=true);await page.getByRole('link',{name:'Sample.docx',exact:true}).click();await expect(page.getByRole('alert')).toContainText('The generated output is unavailable.');await expect.poll(()=>page.evaluate(()=>window.acceptanceCalls.filter(row=>row.action==='workspace.save'&&row.args.state?.open===true).length)).toBeGreaterThan(0);await expect(page.getByRole('alert')).toContainText('The generated output is unavailable.');await expect(message()).toHaveValue('Keep this unsent draft');await page.screenshot({path:path.join(out,'closed-pane-error.png')});});
 await check('a subsequent valid link opens its preview and clears the previous link failure',async()=>{await page.evaluate(()=>window.failWorkspaceLink=false);await page.getByRole('link',{name:'Sample.docx',exact:true}).click();await expect(page.getByRole('region',{name:'Workspace preview',exact:true})).toContainText('Readable Sample.docx');await expect(page.getByRole('alert')).toHaveCount(0);});
 await check('a failed link retains its error when reopening an existing preview',async()=>{const openedBefore=await page.evaluate(()=>window.acceptanceCalls.filter(row=>row.action==='workspace.save'&&row.args.state?.open===true).length);await page.getByRole('button',{name:'Close workspace pane',exact:true}).click();await page.evaluate(()=>window.failWorkspaceLink=true);await page.getByRole('link',{name:'Sample.pdf',exact:true}).click();await expect.poll(()=>page.evaluate(()=>window.acceptanceCalls.filter(row=>row.action==='workspace.save'&&row.args.state?.open===true).length)).toBeGreaterThan(openedBefore);await expect(page.getByRole('alert')).toContainText('The generated output is unavailable.');await expect(page.getByRole('region',{name:'Workspace preview',exact:true})).toContainText('Readable Sample.docx');await page.screenshot({path:path.join(out,'existing-preview-error.png')});await page.evaluate(()=>window.failWorkspaceLink=false);});
 await check('read failures remain visible and the next successful read restores the preview without sending the draft',async()=>{await page.evaluate(()=>window.failWorkspaceRead=true);await page.getByRole('link',{name:'Sample.pdf',exact:true}).click();await expect(page.getByRole('alert')).toContainText('The document changed while opening.');await page.evaluate(()=>window.failWorkspaceRead=false);await page.getByRole('link',{name:'Sample.docx',exact:true}).click();await expect(page.getByRole('region',{name:'Workspace preview',exact:true})).toContainText('Readable Sample.docx');await expect(page.getByRole('alert')).toHaveCount(0);await expect(message()).toHaveValue('Keep this unsent draft');assert.equal(await page.evaluate(()=>window.acceptanceCalls.filter(row=>row.action==='chat.start').length),0);});
 await expect(page.getByRole('alert')).toHaveCount(0);assert.deepEqual(evidence.rendererErrors,[]);assert.deepEqual(await hashes(),sourceSha256);evidence.success=true;
}catch(error){evidence.success=false;evidence.error=error.stack;if(page){evidence.failureCalls=await page.evaluate(()=>window.acceptanceCalls.slice(-30)).catch(()=>[]);evidence.dom=await page.locator('body').innerText({timeout:2000}).catch(()=>null);await page.screenshot({path:path.join(out,'failure.png'),timeout:2000,animations:'disabled'}).catch(()=>{});}process.exitCode=1;}
finally{await writeFile(path.join(out,'evidence.json'),JSON.stringify(evidence,null,2));if(app)await app.close();await new Promise(resolve=>server.close(resolve));}
console.log(JSON.stringify({success:evidence.success,checks:evidence.checks.length,out,error:evidence.error},null,2));
