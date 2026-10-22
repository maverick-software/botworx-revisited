// Full DesktopApp with a controlled bridge: no saved account or provider access.
import {_electron,expect} from '@playwright/test';
import {build} from 'esbuild';
import {createServer} from 'node:http';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createRequire} from 'node:module';
import path from 'node:path';
import assert from 'node:assert/strict';
import ts from 'typescript';
// This isolated Electron fixture has its own profile and a controlled bridge;
// it does not share application resources, Agentopia processes or runtime disks.
const require=createRequire(import.meta.url),root=path.resolve(import.meta.dirname,'../..'),out=path.join(root,'.supabase/desktop-plugin-catalog55-ui',String(Date.now()));await mkdir(out,{recursive:true});
const delivered=process.env.AGENTOPIA_PLUGIN_UI_RESOURCES;
if(!delivered)await build({stdin:{contents:`import React from 'react';import {createRoot} from 'react-dom/client';import {DesktopApp} from './desktop/ui/DesktopApp';import './desktop/ui/style.css';createRoot(document.getElementById('root')).render(<DesktopApp/>);`,loader:'tsx',resolveDir:root},bundle:true,platform:'browser',format:'iife',outfile:path.join(out,'app.js'),define:{'process.env.NODE_ENV':'"production"'},plugins:[{name:'worklet-url',setup(b){b.onResolve({filter:/\?url$/},args=>({path:path.resolve(args.resolveDir,args.path.slice(0,-4)),namespace:'url'}));b.onLoad({filter:/.*/,namespace:'url'},async args=>({contents:'export default '+JSON.stringify('data:text/javascript,'+encodeURIComponent(await readFile(args.path,'utf8'))),loader:'js'}));}}]});
const fixture=await readFile(path.join(root,'scripts/desktop/workspace-agent-ui-fixture.tsx'),'utf8'),{defaultAgentPolicy}=require(path.join(root,'.supabase/desktop-goal-queue/build/agent-contracts.js'));
const injection=ts.transpileModule('const defaultAgentPolicy='+JSON.stringify(defaultAgentPolicy)+';\n'+fixture.slice(fixture.indexOf('const mira='),fixture.indexOf('function Fixture(){'))+String.raw`
appFixture=true;window.catalogCalls=[];const original=window.agentopia.call;
const plugin=(name,bundled,description)=>({name,bundled,description,kind:'mcp',version:'1.0.0',enabled:true,updatable:true,digest:'a'.repeat(64),validation:'Schema validated',configured:true,assignments:[],package:{manifest:{name,version:'1.0.0',description}}});
const plugins=[plugin('exa-web-search',true,'Search the web and research sources'),plugin('chrome-devtools',true,'Inspect browser pages'),plugin('Personal research',false,'My reviewed connection')];
window.agentopia.call=async(action,args={})=>{
 window.catalogCalls.push({action,args:structuredClone(args)});
 if(action==='preferences.get')return {theme:'dark',textSize:'standard',sendWith:'enter',sidebarCollapsed:false};
 if(action==='plugins.pickPackage')return {package:{manifest:{name:'generated-import',version:'1.0.0',description:'Generated package review'}},digest:'f'.repeat(64),notice:'Generated schema validation',sourceName:'generated.zip'};
 if(action==='plugins.list')return structuredClone(plugins);
 if(action==='composio.configure')throw Error("Error invoking remote method 'agentopia:call': Error: Composio rejected this project key or its permissions.");
 if(action==='composio.status')return {configured:false,connections:[],available:true};
 if(action==='native.skills')return {skills:[{name:'Research workflow',path:'fixture/research/SKILL.md',description:'Read and compare saved evidence',enabled:true,scope:'workspace'}],errors:[]};
 if(action==='chat.delivery.grants'||action==='chat.queue.list')return [];
 if(action==='plugins.enable'){plugins.find(p=>p.name===args.name).enabled=args.enabled;return;}
 if(action==='settings.connections')return [];
 if(action==='settings.connection.providers')return [];
 return original(action,args);
};if(location.pathname==='/')history.replaceState(null,'','/conversations/'+chatId);
`,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText;
await writeFile(path.join(out,'index.html'),'<html><head><link rel="stylesheet" href="/app.css"></head><body><div id="root"></div><script src="/app.js"></script></body></html>');
const server=createServer((req,res)=>{void(async()=>{const pathname=new URL(req.url,'http://localhost').pathname;res.setHeader('Content-Type',pathname.endsWith('.js')?'text/javascript':pathname.endsWith('.css')?'text/css':'text/html');const file=delivered?path.resolve(delivered,pathname.startsWith('/assets/')?pathname.slice(1):'index.html'):path.join(out,['/app.js','/app.css'].includes(pathname)?pathname.slice(1):'index.html');if(delivered)assert(file.startsWith(path.resolve(delivered)+path.sep));res.end(await readFile(file));})().catch(()=>{res.statusCode=404;res.end();});});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
await writeFile(path.join(out,'main.cjs'),`const {app,BrowserWindow}=require('electron');app.setPath('userData',${JSON.stringify(path.join(out,'profile'))});app.whenReady().then(()=>new BrowserWindow({show:false,width:1360,height:900,useContentSize:true,webPreferences:{contextIsolation:true,sandbox:true,backgroundThrottling:false}}).loadURL('about:blank'));app.on('window-all-closed',()=>app.quit());`);
const e={success:false,out,delivered:delivered??null,controlledBridge:true,productionAccess:false,realProviderRequests:0,checks:[],rendererErrors:[]},env={...process.env};delete env.ELECTRON_RUN_AS_NODE;let app,page;
const check=async(name,fn)=>{await fn();e.checks.push(name);console.log('PASS '+name);};
try{
 app=await _electron.launch({executablePath:require('electron'),args:[path.join(out,'main.cjs')],env});page=await app.firstWindow();page.setDefaultTimeout(10000);page.on('pageerror',err=>e.rendererErrors.push(err.message));await page.addInitScript(injection);await page.goto('http://127.0.0.1:'+server.address().port,{waitUntil:'domcontentloaded',timeout:30000});
 await check('Plugin browsing replaces chat sidebar with Customize and keeps raw tools and AI connections off the page',async()=>{
  await expect(page.getByRole('textbox',{name:'Message',exact:true})).toHaveValue('Keep this unsent draft');await page.getByRole('button',{name:'Plugins and connections',exact:true}).click();await expect(page).toHaveURL(/\/plugins$/);
  await expect(page.getByRole('navigation',{name:'Customize',exact:true})).toBeVisible();await expect(page.getByRole('tab',{name:'Public',exact:true})).toHaveAttribute('aria-selected','true');await expect(page.getByRole('tab',{name:'Personal',exact:true})).toBeVisible();
  await expect(page.locator('.customize-installed').getByRole('button',{name:/^exa-web-search(?: Off)?$/})).toBeVisible();await expect(page.locator('.plugin-catalog-row')).toHaveCount(3);await expect(page.getByRole('heading',{name:'Agent tools',exact:true})).toHaveCount(0);await expect(page.getByRole('heading',{name:'AI connections',exact:true})).toHaveCount(0);await page.screenshot({path:path.join(out,'plugins-dark-wide.png')});
 });
 await check('Public and Personal tabs, search and installed selection open the actual plugin management workflow',async()=>{
  await page.getByRole('tab',{name:'Personal',exact:true}).click();await expect(page.locator('.plugin-catalog-row')).toHaveCount(1);await page.getByRole('textbox',{name:'Search plugins',exact:true}).fill('missing');await expect(page.getByText('No matching plugins.',{exact:true})).toBeVisible();await page.getByRole('textbox',{name:'Search plugins',exact:true}).fill('');
  await page.locator('.customize-installed').getByRole('button',{name:/^exa-web-search(?: Off)?$/}).click();await expect(page.getByRole('dialog',{name:'Plugin · exa-web-search',exact:true})).toBeVisible();await page.getByRole('checkbox',{name:'Enable plugin exa-web-search',exact:true}).uncheck();await expect(page.getByRole('checkbox',{name:'Enable plugin exa-web-search',exact:true})).not.toBeChecked();await page.getByRole('dialog').getByRole('button',{name:'Close dialog',exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button',{name:'Add plugin',exact:true}).click();await expect(page.getByRole('menuitem',{name:'Install from file…',exact:true})).toBeVisible();await page.getByRole('menuitem',{name:'Paste plugin package…',exact:true}).click();await expect(page.getByRole('dialog',{name:'Add a plugin',exact:true})).toBeVisible();await page.getByRole('dialog').getByRole('button',{name:'Close dialog',exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(0);
 });
 await check('Add from file starts a new import after a cancelled plugin update',async()=>{
  await page.locator('.customize-installed').getByRole('button',{name:/^exa-web-search(?: Off)?$/}).click();await page.getByRole('button',{name:'Update plugin',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'Close dialog',exact:true}).click();await page.getByRole('dialog',{name:'Plugin · exa-web-search',exact:true}).getByRole('button',{name:'Close dialog',exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button',{name:'Add plugin',exact:true}).click();await page.getByRole('menuitem',{name:'Install from file…',exact:true}).click();await expect(page.getByRole('dialog',{name:'Add a plugin',exact:true})).toBeVisible();await expect(page.getByText('Schema validated · generated-import v1.0.0',{exact:true})).toBeVisible();assert(!(await page.evaluate(()=>window.catalogCalls)).some(c=>c.action==='plugins.reviewUpdate'));await page.getByRole('dialog').getByRole('button',{name:'Close dialog',exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(0);
 });
 await check('Composio remains a per-user connection with protected key setup on its subpage',async()=>{
  await page.getByRole('tab',{name:'Public',exact:true}).click();await page.getByRole('button',{name:'Connect Composio',exact:true}).click();await expect(page.getByLabel('Composio project API key',{exact:true})).toHaveAttribute('type','password');await page.getByLabel('Composio project API key',{exact:true}).fill('GENERATED-INVALID-FIXTURE-KEY');await page.getByRole('button',{name:'Connect project',exact:true}).click();await expect(page.getByRole('alert')).toContainText('Toolkits read access');await expect(page.getByRole('alert')).not.toContainText('Error invoking remote method');await expect(page.getByLabel('Composio project API key',{exact:true})).toHaveValue('');await page.getByRole('button',{name:'Plugins',exact:true}).last().click();
 });
 await check('Tools and Skills have separate full pages and preserve the existing chat draft, model and history',async()=>{
  const nav=page.getByRole('navigation',{name:'Customize',exact:true});await nav.getByRole('button',{name:'Tools',exact:true}).click();await expect(page).toHaveURL(/\/tools$/);await expect(page.getByRole('heading',{name:'Agent tools',exact:true})).toBeVisible();await expect(page.getByRole('region',{name:'Chat coordination permissions'})).toBeVisible();await expect(page.locator('.plugin-catalog')).toHaveCount(0);
  await nav.getByRole('button',{name:'Skills',exact:true}).click();await expect(page).toHaveURL(/\/skills$/);await expect(page.getByRole('checkbox',{name:'Select skill Research workflow',exact:true})).toBeVisible();await page.getByRole('checkbox',{name:'Select skill Research workflow',exact:true}).check();await expect(page.getByRole('checkbox',{name:'Select skill Research workflow',exact:true})).toBeChecked();
  await page.getByRole('button',{name:'Chats',exact:true}).click();await expect(page.getByRole('textbox',{name:'Message',exact:true})).toHaveValue('Keep this unsent draft');await expect(page.getByRole('button',{name:'Model and thinking',exact:true})).toContainText('Fixture selected model');await expect(page.getByText('Starter historical answer',{exact:true})).toBeVisible();
 });
 await check('Compact plugin rows fit a smaller window and light theme without horizontal overflow',async()=>{
  await page.getByRole('button',{name:'Plugins and connections',exact:true}).click();await page.setViewportSize({width:900,height:760});await page.screenshot({path:path.join(out,'plugins-dark-narrow.png')});assert(await page.locator('.plugins-catalog-page').evaluate(el=>el.scrollWidth<=el.clientWidth+1));await page.evaluate(()=>document.documentElement.dataset.theme='light');await page.screenshot({path:path.join(out,'plugins-light-narrow.png')});
 });
 assert.deepEqual(e.rendererErrors,[]);await expect(page.getByRole('alert')).toHaveCount(0);assert(!(await page.evaluate(()=>window.catalogCalls)).some(c=>c.action==='chat.start'));e.success=true;
}catch(error){e.error=error.stack;if(page)await page.screenshot({path:path.join(out,'failure.png')}).catch(()=>{});process.exitCode=1;}
finally{if(app)await app.close();await new Promise(resolve=>server.close(resolve));await writeFile(path.join(out,'evidence.json'),JSON.stringify(e,null,2));}
console.log(JSON.stringify({success:e.success,out,checks:e.checks.length,error:e.error},null,2));
