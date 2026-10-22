import {_electron,expect} from '@playwright/test';
import {build} from 'esbuild';
import {createServer} from 'node:http';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createRequire} from 'node:module';
import path from 'node:path';
import assert from 'node:assert/strict';
import ts from 'typescript';

const require=createRequire(import.meta.url),root=path.resolve(import.meta.dirname,'../..');
const delivered=process.env.AGENTOPIA_TOOL_SETTINGS_UI_RESOURCES;
const out=path.join('C:/Users/charl/AgentopiaQA/tool-settings',String(Date.now()));await mkdir(out,{recursive:true});
if(!delivered)await build({stdin:{contents:`import React from 'react';import {createRoot} from 'react-dom/client';import {DesktopApp} from './desktop/ui/DesktopApp';import './desktop/ui/style.css';createRoot(document.getElementById('root')).render(<DesktopApp/>);`,loader:'tsx',resolveDir:root},bundle:true,platform:'browser',format:'iife',outfile:path.join(out,'app.js'),define:{'process.env.NODE_ENV':'"production"'},plugins:[{name:'worklet-url',setup(b){b.onResolve({filter:/\?url$/},args=>({path:path.resolve(args.resolveDir,args.path.slice(0,-4)),namespace:'url'}));b.onLoad({filter:/.*/,namespace:'url'},async args=>({contents:'export default '+JSON.stringify('data:text/javascript,'+encodeURIComponent(await readFile(args.path,'utf8'))),loader:'js'}));}}]});
const fixture=await readFile(path.join(root,'scripts/desktop/workspace-agent-ui-fixture.tsx'),'utf8'),{defaultAgentPolicy}=require(path.join(root,'.supabase/desktop-goal-queue/build/agent-contracts.js'));
const injection=ts.transpileModule('const defaultAgentPolicy='+JSON.stringify(defaultAgentPolicy)+';\n'+fixture.slice(fixture.indexOf('const mira='),fixture.indexOf('function Fixture(){'))+String.raw`
appFixture=true;window.toolSettingsCalls=[];const original=window.agentopia.call;
window.agentopia.call=async(action,args={})=>{
 window.toolSettingsCalls.push({action,args:structuredClone(args)});
 if(action==='preferences.get')return {theme:'dark',textSize:'standard',sendWith:'enter',sidebarCollapsed:false};
 if(action==='plugins.list'||action==='chat.delivery.grants'||action==='chat.queue.list')return [];
 if(action==='settings.connections')return [{id:'existing',connection_name:'Existing service',credential_type:'oauth',connection_status:'active',service_providers:{display_name:'Existing provider',name:'existing'}}];
 if(action==='settings.connection.providers')return [{id:'provider',name:'example',display_name:'Example service'}];
 if(action==='settings.connection.save')return;
 return original(action,args);
};if(location.pathname==='/')history.replaceState(null,'','/conversations/'+chatId);
`,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText;
await writeFile(path.join(out,'index.html'),'<html><head><link rel="stylesheet" href="/app.css"></head><body><div id="root"></div><script src="/app.js"></script></body></html>');
const server=createServer((req,res)=>{void(async()=>{const pathname=new URL(req.url,'http://localhost').pathname,file=delivered?path.resolve(delivered,pathname.startsWith('/assets/')?pathname.slice(1):'index.html'):path.join(out,['/app.js','/app.css'].includes(pathname)?pathname.slice(1):'index.html');if(delivered)assert(file.startsWith(path.resolve(delivered)+path.sep));res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html');res.end(await readFile(file));})().catch(()=>{res.statusCode=404;res.end();});});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
await writeFile(path.join(out,'main.cjs'),`const {app,BrowserWindow}=require('electron');app.setPath('userData',${JSON.stringify(path.join(out,'profile'))});app.whenReady().then(()=>new BrowserWindow({show:false,width:1360,height:900,useContentSize:true,webPreferences:{contextIsolation:true,sandbox:true,backgroundThrottling:false}}).loadURL('about:blank'));app.on('window-all-closed',()=>app.quit());`);
const evidence={at:new Date().toISOString(),delivered:delivered??null,controlledBridge:true,actualDesktopApp:true,productionAccess:false,inferenceRequests:0,checks:[],rendererErrors:[]},env={...process.env};delete env.ELECTRON_RUN_AS_NODE;let app,page;
const check=async(name,fn)=>{await fn();evidence.checks.push(name);console.log('PASS '+name);};
async function openTools(){await page.getByRole('button',{name:'Account menu',exact:true}).click();await page.getByRole('menuitem',{name:/^Settings/}).click();await page.getByRole('navigation',{name:'Settings sections'}).getByRole('button',{name:'Tools & credentials',exact:true}).click();}
try{
 app=await _electron.launch({executablePath:require('electron'),args:[path.join(out,'main.cjs')],env});page=await app.firstWindow();page.setDefaultTimeout(7000);page.on('pageerror',error=>evidence.rendererErrors.push(error.message));await page.addInitScript(injection);await page.goto('http://127.0.0.1:'+server.address().port);await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].showInactive());
 await check('Tools settings prioritizes plugins and leaves legacy credentials unloaded until expanded',async()=>{
  await expect(page.getByRole('textbox',{name:'Message',exact:true})).toHaveValue('Keep this unsent draft');await openTools();
  await expect(page.getByRole('button',{name:'Manage plugins',exact:true})).toBeVisible();await expect(page.getByLabel('API key',{exact:true})).toHaveCount(0);
  assert(!(await page.evaluate(()=>window.toolSettingsCalls)).some(c=>c.action==='settings.connections'||c.action==='settings.connection.providers'));
  await expect(page.getByRole('region',{name:'Chat coordination permissions'})).toBeVisible();await expect(page.getByText(/does not yet execute external tools/)).toHaveCount(0);await expect(page.getByRole('alert')).toHaveCount(0);await page.screenshot({path:path.join(out,'tools-primary-dark.png')});
 });
 await check('Manage plugins closes settings, navigates to the actual plugin page and preserves the unsent chat draft and model',async()=>{
  await page.getByRole('button',{name:'Manage plugins',exact:true}).click();await expect(page).toHaveURL(/\/plugins$/);await expect(page.getByRole('dialog',{name:'Settings',exact:true})).toHaveCount(0);await expect(page.getByRole('textbox',{name:'Search plugins',exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'Add plugin',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Chats',exact:true}).click();await expect(page.getByRole('textbox',{name:'Message',exact:true})).toHaveValue('Keep this unsent draft');await expect(page.getByRole('button',{name:'Model and thinking',exact:true})).toContainText('Fixture selected model');await expect(page.getByRole('button',{name:'Model and thinking',exact:true})).toContainText('Low');
 });
 await check('Expanding saved credentials retains existing services and API editing; save clears the password field and runs once',async()=>{
  await openTools();const summary=page.getByText('Saved integration credentials',{exact:true});await summary.focus();await page.keyboard.press('Enter');await expect(page.getByText('Existing service',{exact:true})).toBeVisible();
  await expect(page.getByLabel('API key',{exact:true})).toHaveAttribute('type','password');await page.getByLabel('Integration provider',{exact:true}).selectOption('provider');await page.getByLabel('Connection name',{exact:true}).fill('Generated test credential');await page.getByLabel('API key',{exact:true}).fill('GENERATED-LOCAL-FIXTURE-KEY');
  await summary.click();await expect(page.getByLabel('API key',{exact:true})).toBeHidden();await summary.click();await expect(page.getByLabel('API key',{exact:true})).toHaveValue('GENERATED-LOCAL-FIXTURE-KEY');
  await page.getByRole('button',{name:'Save credential',exact:true}).click();await expect(page.getByText('Credential stored. Provider access has not been tested.',{exact:true})).toBeVisible();await expect(page.getByLabel('API key',{exact:true})).toHaveValue('');
  const calls=await page.evaluate(()=>window.toolSettingsCalls.filter(c=>c.action==='settings.connection.save'));assert.equal(calls.length,1);assert.deepEqual(calls[0].args,{id:undefined,providerId:'provider',name:'Generated test credential',key:'GENERATED-LOCAL-FIXTURE-KEY'});
  await page.evaluate(()=>document.documentElement.dataset.theme='light');await page.screenshot({path:path.join(out,'tools-credentials-light.png')});
 });
 await expect(page.getByRole('alert')).toHaveCount(0);assert.deepEqual(evidence.rendererErrors,[]);assert(!(await page.evaluate(()=>window.toolSettingsCalls)).some(c=>c.action==='chat.start'));evidence.success=true;
}catch(error){evidence.success=false;evidence.error=error.stack;if(page)await page.screenshot({path:path.join(out,'failure.png')}).catch(()=>{});process.exitCode=1;}
finally{await writeFile(path.join(out,'evidence.json'),JSON.stringify(evidence,null,2));if(app)await app.close();await new Promise(resolve=>server.close(resolve));}
console.log(JSON.stringify({success:evidence.success,checks:evidence.checks.length,out,error:evidence.error},null,2));
