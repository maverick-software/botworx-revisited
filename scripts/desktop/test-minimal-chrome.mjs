import {_electron,expect} from '@playwright/test';
import {build} from 'esbuild';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {createServer} from 'node:http';
import path from 'node:path';
import assert from 'node:assert/strict';

// Real renderer components with an in-memory service. No accounts, files or inference are used.
const root=path.resolve(import.meta.dirname,'../..'),out=path.join(root,'.supabase/minimal-desktop-ui');
await mkdir(out,{recursive:true});
const fixture=String.raw`
import React from 'react';import {createRoot} from 'react-dom/client';
import {DesktopApp} from './desktop/ui/DesktopApp';
import {defaultChatOptions,defaultDesktopPreferences} from './desktop/src/contracts';
import './desktop/ui/style.css';
const agent={id:'agent',name:'Native Codex Assistant',provider:'chatgpt',model:'gpt-6.1-sol',active:true};
const reference={id:'folder',name:'Agentopia',kind:'folder',path:'D:/fixture'};
const tabs=Array.from({length:8},(_,i)=>({id:'tab-'+i,kind:'file',name:'workspace-document-'+i+'.md',referenceId:'folder',path:'workspace-document-'+i+'.md'}));
if(location.search.includes('reset'))localStorage.clear();
let preferences=JSON.parse(localStorage.getItem('fixture-preferences')??'null')??{...defaultDesktopPreferences,theme:'dark'},pane=JSON.parse(localStorage.getItem('fixture-pane')??'null')??{open:true,width:680,treeWidth:210,tree:true,tabs,active:'tab-7',referenceId:'folder'};
const markdown='# A quieter workspace\n\nSlimmer bars leave more room for your work. Drag any panel boundary to arrange your space.\n\n'+Array.from({length:12},(_,i)=>'## Section '+(i+1)+'\n\nYour documents, files, and conversations stay within reach. The workspace remembers your preferred panel widths.\n\n').join('');
window.fixture={calls:[],get preferences(){return preferences},get pane(){return pane}};
const noop=()=>()=>{};
window.agentopia=new Proxy({call:async(action,args)=>{
 window.fixture.calls.push({action,args});
 switch(action){
 case 'runtime.status':return {phase:'ready',message:'Ready',ready:true};
 case 'auth.state':return {identity:{id:'owner',email:'admin@example.com',admin:true},needsAdministrator:false,registrationEnabled:false};
 case 'agents.list':return [agent];
 case 'providers.status':return {preferChatGPT:true,chatgpt:{authorized:true},openrouter:false,selections:{chatgpt:{model:'gpt-6.1-sol',thinking:'high'}}};
 case 'conversations.list':return Array.from({length:25},(_,i)=>({conversation_id:'chat-'+i,agent_id:'agent',title:'A useful conversation '+(i+1),updated_at:new Date().toISOString(),created_at:new Date().toISOString()}));
 case 'preferences.get':return preferences;
 case 'preferences.save':preferences=args.preferences;localStorage.setItem('fixture-preferences',JSON.stringify(preferences));return;
 case 'composer.get':case 'composer.new':return {...defaultChatOptions,provider:'chatgpt',model:'gpt-6.1-sol'};
 case 'files.list':return [reference];
 case 'projects.list':return {projects:[],memberships:[]};
 case 'workspace.state':return pane;
 case 'workspace.save':pane=args.state;localStorage.setItem('fixture-pane',JSON.stringify(pane));return;
 case 'workspace.read':return {content:markdown,sha256:'fixture'};
 case 'workspace.list':return {entries:Array.from({length:45},(_,i)=>({name:'workspace-document-'+i+'.md',kind:'file'})),truncated:false};
 case 'drafts.get':case 'navigation.state':return null;
 case 'voice.preferences.get':return {};
 default:return [];
 }
},onRuntime:noop,onChat:noop,onCommand:noop,onBeforeClose:noop},{get:(target,key)=>target[key]??noop});
createRoot(document.getElementById('root')).render(<DesktopApp/>);`;
await build({stdin:{contents:fixture,resolveDir:root,loader:'tsx'},bundle:true,plugins:[{name:'asset-url',setup(builder){builder.onResolve({filter:/\?url$/},args=>({path:args.path,namespace:'asset-url'}));builder.onLoad({filter:/.*/,namespace:'asset-url'},()=>({contents:'export default "/capture-worklet.js"',loader:'js'}));}}],outfile:path.join(out,'fixture.js'),format:'iife',platform:'browser',define:{'process.env.NODE_ENV':'"production"'}});
await writeFile(path.join(out,'index.html'),'<html><head><link rel="stylesheet" href="/fixture.css"></head><body><div id="root"></div><script src="/fixture.js"></script></body></html>');
const server=createServer(async(req,res)=>{const file=req.url==='/fixture.js'?'fixture.js':req.url==='/fixture.css'?'fixture.css':'index.html';res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html');res.end(await readFile(path.join(out,file)));});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
await writeFile(path.join(out,'main.cjs'),`const {app,BrowserWindow}=require('electron');app.setPath('userData',${JSON.stringify(path.join(out,'profile'))});app.whenReady().then(()=>{const w=new BrowserWindow({width:1600,height:950,show:false,titleBarStyle:'hidden',titleBarOverlay:{color:'#151515',symbolColor:'#ececec',height:32},webPreferences:{sandbox:true,contextIsolation:true,nodeIntegration:false,backgroundThrottling:false}});w.showInactive();w.loadURL('http://127.0.0.1:${server.address().port}/?reset');});`);
let app,page;const evidence={inference:false,isolated:true};
try{
 app=await _electron.launch({executablePath:path.join(root,'node_modules/electron/dist/electron.exe'),args:[path.join(out,'main.cjs')]});page=await app.firstWindow();page.setDefaultTimeout(10000);
 const errors=[];page.on('pageerror',e=>{errors.push(e.message);console.error('Renderer:',e.message);});
 await expect(page.getByRole('button',{name:'Account menu',exact:true})).toBeVisible();
 await expect(page.locator('.markdown-preview h1')).toBeVisible();
 const win=await app.browserWindow(page);
 const drag=async(label,delta)=>{const handle=page.getByRole('separator',{name:label,exact:true}),box=await handle.boundingBox();assert(box);await page.mouse.move(box.x+box.width/2+2,box.y+box.height/2);await page.mouse.down();await page.mouse.move(box.x+box.width/2+2+delta,box.y+box.height/2,{steps:10});await page.mouse.up();};
 await expect(page.locator('.sidebar')).toHaveCSS('width','244px');
 await drag('Resize chat sidebar',50);await expect(page.locator('.sidebar')).toHaveCSS('width','294px');
 await expect.poll(()=>page.evaluate(()=>window.fixture.preferences.sidebarWidth)).toBe(294);
 const sidebarWrites=await page.evaluate(()=>window.fixture.calls.filter(c=>c.action==='preferences.save').length);assert.equal(sidebarWrites,1);
 await page.getByRole('separator',{name:'Resize chat sidebar',exact:true}).press('ArrowLeft');await expect(page.locator('.sidebar')).toHaveCSS('width','284px');
 await drag('Resize workspace pane',-60);await expect(page.locator('.workspace-pane')).toHaveCSS('width','740px');
 await drag('Resize folder navigation',-30);await expect(page.locator('.folder-navigation')).toHaveCSS('width','240px');
 await expect.poll(()=>page.evaluate(()=>window.fixture.pane.treeWidth)).toBe(240);
 await page.reload();await expect(page.locator('.sidebar')).toHaveCSS('width','284px');
 await expect(page.locator('.workspace-pane')).toHaveCSS('width','740px');await expect(page.locator('.folder-navigation')).toHaveCSS('width','240px');evidence.restoredWidthsAfterReload=true;
 await page.getByRole('separator',{name:'Resize chat sidebar',exact:true}).press('End');
 await page.getByRole('button',{name:'Collapse sidebar',exact:true}).click();
 await expect(page.getByRole('separator',{name:'Resize chat sidebar',exact:true})).toHaveCount(0);
 await page.getByRole('button',{name:'Toggle chat sidebar',exact:true}).click();await expect(page.locator('.sidebar')).toHaveCSS('width','400px');
 await page.getByRole('separator',{name:'Resize chat sidebar',exact:true}).press('Home');
 await expect(page.locator('.sidebar')).toHaveCSS('width','200px');
 await page.getByRole('separator',{name:'Resize chat sidebar',exact:true}).press('ArrowRight');
 evidence.dragAndKeyboard=true;evidence.singleSidebarSavePerDrag=sidebarWrites===1;
 for(const [theme,width] of [['dark',1600],['light',1280],['dark',960]]){
  await win.evaluate((w,width)=>w.setSize(width,950),width);await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme);
  const metrics=await page.evaluate(()=>({width:innerWidth,overflow:document.documentElement.scrollWidth>innerWidth,bar:document.querySelector('.desktop-bar').getBoundingClientRect().height,header:document.querySelector('.workspace-header').getBoundingClientRect().height,tabs:document.querySelector('.workspace-tabs').getBoundingClientRect().height,dividers:[...document.querySelectorAll('.pane-resizer')].map(e=>e.getBoundingClientRect().width),scrollbar:getComputedStyle(document.querySelector('.document-content'),'::-webkit-scrollbar').width}));
  assert(!metrics.overflow,JSON.stringify(metrics));assert.equal(metrics.bar,32);assert.equal(metrics.header,44);assert.equal(metrics.tabs,44);assert.equal(metrics.scrollbar,'6px');assert(metrics.dividers.every(w=>w===1||w===0));
  if(width===960)await expect(page.getByRole('separator',{name:'Resize chat sidebar',exact:true})).toBeHidden();
  await page.evaluate(()=>document.activeElement?.blur());await page.mouse.move(100,16);
  evidence[theme+'-'+width]=metrics;await page.screenshot({path:path.join(out,theme+'-'+width+'.png')});
 }
 // A pane constrained by the window should respond immediately when dragged narrower.
 await win.evaluate(w=>w.setSize(1280,950));
 const before=await page.locator('.workspace-pane').evaluate(e=>e.getBoundingClientRect().width);
 await drag('Resize workspace pane',40);
 const after=await page.locator('.workspace-pane').evaluate(e=>e.getBoundingClientRect().width);assert(Math.abs(after-(before-40))<2);
 assert.equal(await page.evaluate(()=>document.body.classList.contains('resizing-pane')),false);
 assert.deepEqual(errors,[]);evidence.success=true;console.log('PASS: full renderer; three draggable dividers; keyboard and limits; one save per sidebar drag; light/dark; 960/1280/1600 widths; constrained pane resize; slim bars and scrollbars.');
}catch(error){evidence.error=error.message;if(page){console.error(await page.locator('body').innerText());await page.screenshot({path:path.join(out,'failure.png'),timeout:3000}).catch(()=>{});}throw error;}
finally{await writeFile(path.join(out,'evidence.json'),JSON.stringify(evidence,null,2));if(app)await app.close();server.close();}
