import {_electron,chromium,expect} from '@playwright/test';
import {build} from 'esbuild';
import {createServer} from 'node:http';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createRequire} from 'node:module';
import path from 'node:path';
import assert from 'node:assert/strict';
import ts from 'typescript';
const require=createRequire(import.meta.url),root=path.resolve(import.meta.dirname,'../..'),out=process.env.AGENTOPIA_QA_OUT??path.join('F:/Agentopia-QA/consolidation-ui',String(Date.now()));
await mkdir(out,{recursive:true});
await build({entryPoints:[path.join(root,'desktop/src/agent-contracts.ts')],bundle:true,platform:'node',format:'cjs',outfile:path.join(out,'agent-contracts.cjs')});
const {defaultAgentPolicy}=require(path.join(out,'agent-contracts.cjs'));
await build({entryPoints:['desktop/src/agent-saved-editor-draft.ts','desktop/src/desktop-location.ts','desktop/src/startup-location.ts','desktop/ui/consolidation-navigation.ts'].map(file=>path.join(root,file)),outdir:path.join(out,'contracts'),outbase:path.join(root,'desktop'),bundle:true,platform:'node',format:'cjs',outExtension:{'.js':'.cjs'}});
const {agentSavedEditorDraft}=require(path.join(out,'contracts/src/agent-saved-editor-draft.cjs')),{desktopLocation}=require(path.join(out,'contracts/src/desktop-location.cjs')),{startupLocation}=require(path.join(out,'contracts/src/startup-location.cjs')),{canonicalAgentSection}=require(path.join(out,'contracts/ui/consolidation-navigation.cjs'));
for(const [section,target] of Object.entries({channels:'mcp',sources:'mcp',team:'capabilities',contacts:'capabilities',schedule:'automations',workflows:'automations'})){
 const draft={format:'agent-editor-1',section,basic:{name:'Retained name',description:'',instructions:'Retained instructions',provider:'openai-oauth',model:''},configurationLoaded:true,identity:{personality:'Retained personality',mbtiType:'INTJ',purpose:'Retained purpose'},settings:{web_search_enabled:false,use_account_graph:true,context_history_size:50},channels:{email_enabled:true},selected:{memory:['11111111-1111-4111-8111-111111111111'],sources:['22222222-2222-4222-8222-222222222222'],team:[],contacts:[],documents:[]},contactMode:'specific_contacts',dirty:[section],profile:null,definitionDirty:false,presentation:null,memory:null,task:{name:'Unfinished old schedule',instructions:'Do retained work',cron:'0 9 * * 1-5',timezone:'America/Los_Angeles'},taskId:null};
 assert.deepEqual(agentSavedEditorDraft(draft),draft);assert.equal(canonicalAgentSection(section),target);
}
const saved={view:'tools',agentId:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'};assert.deepEqual(desktopLocation(saved),{...saved,view:'plugins'});assert.deepEqual(startupLocation('/login',saved),{...saved,view:'plugins'});

console.log('Bundling actual desktop UI');
await build({logLevel:'info',stdin:{contents:`import React from 'react';import {createRoot} from 'react-dom/client';import {DesktopApp} from './desktop/ui/DesktopApp';import {AgentEditor} from './desktop/ui/AgentSettings';import {AgentAutomations} from './desktop/ui/AgentAutomations';import './desktop/ui/style.css';import './desktop/ui/agent-style.css';const auto=new URLSearchParams(location.search).has('automations'),section=new URLSearchParams(location.search).get('editor');createRoot(document.getElementById('root')).render(auto?<AgentAutomations owner='88888888-8888-4888-8888-888888888888' agent={window.testAgent} connections={null} administrator={false} configure={()=>{}} openChat={async()=>{}}/>:section?<AgentEditor agent={window.testAgent} initialSection={section} defaultModel='fixture-model' connections={null} run={async task=>{try{await task()}catch(error){window.fixtureErrors.push(error.message)}}} close={()=>{}} saved={async()=>{}}/>:<DesktopApp/>);`,loader:'tsx',resolveDir:root},bundle:true,platform:'browser',format:'iife',outfile:path.join(out,'app.js'),define:{'process.env.NODE_ENV':'"production"'},plugins:[{name:'worklet-url',setup(b){b.onResolve({filter:/\?url$/},args=>({path:path.resolve(args.resolveDir,args.path.slice(0,-4)),namespace:'url'}));b.onLoad({filter:/.*/,namespace:'url'},async args=>({contents:'export default '+JSON.stringify('data:text/javascript,'+encodeURIComponent(await readFile(args.path,'utf8'))),loader:'js'}));}}]});
const fixture=await readFile(path.join(root,'scripts/desktop/workspace-agent-ui-fixture.tsx'),'utf8');
const injection=ts.transpileModule('const defaultAgentPolicy='+JSON.stringify(defaultAgentPolicy)+';\n'+fixture.slice(fixture.indexOf('const mira='),fixture.indexOf('function Fixture(){'))+String.raw`
appFixture=true;window.fixtureErrors=[];window.testAgent=mira;window.consolidationCalls=[];window.command=command=>window.commandListener?.(command);window.agentopia.onCommand=listener=>{window.commandListener=listener;return()=>{}};
const original=window.agentopia.call;
const plugin=(name,bundled,kind='mcp')=>({name,description:name+' fixture',kind,bundled,enabled:true,configured:true,validation:'reviewed',version:'1.0.0',digest:'a'.repeat(64),package:{manifest:{name,version:'1.0.0',description:name+' fixture'}},assignments:[{agent_id:starter.id,enabled:true,connection_ids:[]}]});
const plugins=[plugin('bundled-tool',true),plugin('imported-tool',false),plugin('codex-skills-01',false,'skills')];
appOptions.tools=['mcp:fixture'];
window.agentopia.call=async(action,args={})=>{
 window.consolidationCalls.push({action,args:structuredClone(args)});
 if(action==='tasks.list'&&args.agentId)return {tasks:[],runs:[],error:null,legacy:[{id:'12121212-1212-4212-8212-121212121212',agentId:mira.id,name:'Earlier retained task',instructions:'Do retained work',cadence:{kind:'cron',expression:'0 9 * * 1-5',timezone:'America/Los_Angeles'},updatedAt:'2026-10-24T00:00:00.000Z'}]};
 if(action==='plugins.list')return structuredClone(plugins);
 if(action==='plugins.enable'){plugins.find(row=>row.name===args.name).enabled=args.enabled;return;}
 if(action==='tools.catalog')return [{id:'mcp:fixture',name:'Fixture app',kind:'mcp',ready:true,enabled:true,detail:'Controlled connection'}];
 if(action==='composio.status')return {configured:false,connections:[],available:true};
 if(action==='composioMcp.status')return {configured:false,connections:[],available:true};
 if(action==='chat.delivery.grants'||action==='chat.queue.list'||action==='agents.memory'||action==='agents.instances')return [];
 if(action==='credentials.list')return [];
 if(action==='storage.summary')return {chats:[],children:[],copies:[],warnings:[],busy:false,contentBytes:0,workingBytes:0};
 if(action==='editorRecovery.list')return {rows:[],next:null,total:0};
 if(action==='agentSettings.get')return {agent:{...mira,personality:'',mbtiType:'INTJ',purpose:'Retained purpose',settings:{web_search_enabled:false,use_account_graph:true,context_history_size:50}},datastores:[],datastoreIds:['11111111-1111-4111-8111-111111111111'],documents:[],documentIds:[],connections:[],connectionIds:[],teams:[],teamIds:[],contacts:[],contactMode:'no_access',contactIds:[],mcp:[],tasks:[]};
 if(action==='agents.profile')return structuredClone(profile);
 if(action==='agents.profile.save'){profile={...profile,...args.value,revision:profile.revision+1};return structuredClone(profile);}
 if(action==='agentSettings.save')return;
 if(action==='native.skills')return {skills:[],errors:[]};
 return original(action,args);
};
`,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText;
await writeFile(path.join(out,'index.html'),'<html><head><link rel="stylesheet" href="/app.css"></head><body><div id="root"></div><script src="/app.js"></script></body></html>');
const server=createServer((req,res)=>{void(async()=>{const pathname=new URL(req.url,'http://localhost').pathname;res.setHeader('Content-Type',pathname.endsWith('.js')?'text/javascript':pathname.endsWith('.css')?'text/css':'text/html');res.end(await readFile(path.join(out,['/app.js','/app.css'].includes(pathname)?pathname.slice(1):'index.html')));})().catch(()=>{res.statusCode=404;res.end()});});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
await writeFile(path.join(out,'main.cjs'),`const {app,BrowserWindow}=require('electron');app.setPath('userData',${JSON.stringify(path.join(out,'profile'))});app.whenReady().then(()=>new BrowserWindow({show:false,width:1360,height:900,useContentSize:true,webPreferences:{contextIsolation:true,sandbox:true,backgroundThrottling:false}}).loadURL('about:blank'));app.on('window-all-closed',()=>app.quit());`);
const evidence={success:false,controlledBridge:true,actualDesktopApp:true,browserRuntime:process.env.AGENTOPIA_QA_ELECTRON?'Electron':'Installed Chrome in isolated profile',productionAccess:false,providerRequests:0,checks:['Legacy drafts preserve retired fields, restrictions, selections and unfinished schedule text while sections map to current destinations','Saved Tools location and ordinary startup restore canonically to Plugins'],rendererErrors:[]},env={...process.env};delete env.ELECTRON_RUN_AS_NODE;let app,page;
const check=async(name,fn)=>{await fn();evidence.checks.push(name);console.log('PASS '+name)};
const address='http://127.0.0.1:'+server.address().port;
const settingsNav=()=>page.getByRole('navigation',{name:'Settings sections'});
const openSettings=async()=>{await page.getByRole('button',{name:'Account menu',exact:true}).click();await page.getByRole('menuitem',{name:/^Settings/}).click()};
try{
 if(process.env.AGENTOPIA_QA_ELECTRON){app=await _electron.launch({executablePath:require('electron'),args:[path.join(out,'main.cjs')],env,timeout:30000});page=await app.firstWindow();}else{app=await chromium.launchPersistentContext(path.join(out,'browser-profile'),{channel:'chrome',headless:true,viewport:{width:1360,height:900},env:{...env,TEMP:out,TMP:out},timeout:30000});page=app.pages()[0]??await app.newPage();}page.setDefaultTimeout(10000);page.on('pageerror',error=>evidence.rendererErrors.push(error.message));await page.addInitScript(injection);await page.goto(address+'/conversations/99999999-9999-4999-8999-999999999999');
 await check('Integrated includes bundled and imported plugins; skill wrappers and Tools navigation are absent',async()=>{
  await expect(page.getByRole('textbox',{name:'Message',exact:true})).toHaveValue('Keep this unsent draft');await page.getByRole('button',{name:'Plugins',exact:true}).first().click();
  await expect(page.getByRole('tab',{name:'Integrated',exact:true})).toHaveAttribute('aria-selected','true');await expect(page.getByRole('tab')).toHaveCount(2);await expect(page.locator('.plugin-catalog-row')).toHaveCount(2);await expect(page.locator('.customize-installed').getByRole('button')).toHaveCount(2);await expect(page.getByRole('navigation',{name:'Customize'}).getByRole('button',{name:'Tools',exact:true})).toHaveCount(0);
  await page.getByRole('tab',{name:'Integrated',exact:true}).focus();await page.keyboard.press('ArrowRight');await expect(page.getByRole('tab',{name:'Composio',exact:true})).toBeFocused();await page.keyboard.press('Home');await expect(page.getByRole('tab',{name:'Integrated',exact:true})).toHaveAttribute('aria-selected','true');await page.screenshot({path:path.join(out,'integrated-plugins.png')});
 });
 await check('Installed selection opens actual plugin management and disable is saved once',async()=>{
  await page.locator('.customize-installed').getByRole('button',{name:'Bundled Tool',exact:true}).click();await page.getByRole('checkbox',{name:'Enable plugin Bundled Tool',exact:true}).uncheck();await expect(page.getByRole('checkbox',{name:'Enable plugin Bundled Tool',exact:true})).not.toBeChecked();await page.getByRole('dialog').getByRole('button',{name:'Close dialog',exact:true}).click();assert.equal((await page.evaluate(()=>window.consolidationCalls.filter(c=>c.action==='plugins.enable'))).length,1);
 });
 await check('Current-chat plugin chooser remains reachable and draft/model/history survive navigation',async()=>{
  await page.getByRole('button',{name:'Home',exact:true}).click();await expect(page.getByRole('textbox',{name:'Message',exact:true})).toHaveValue('Keep this unsent draft');await expect(page.getByRole('button',{name:'Model and thinking',exact:true})).toContainText('Fixture selected model');await expect(page.getByText('Starter historical answer',{exact:true})).toBeVisible();
  await page.locator('.plugin-context-name').first().click();await expect(page.getByRole('heading',{name:'Plugins for this chat',exact:true})).toBeVisible();await page.getByRole('button',{name:'Done',exact:true}).click();
 });
 await check('Settings exposes canonical Credentials, Permissions and AI usage; Data owns archive and recovery links',async()=>{
  await openSettings();const nav=settingsNav();for(const name of ['Tools & credentials','System API keys','Integrations','Stripe billing','System prompts','Skills','Chat tools','Plugins & apps','Agent settings','Archived chats'])await expect(nav.getByRole('button',{name,exact:true})).toHaveCount(0);
  await nav.getByRole('button',{name:'Credentials',exact:true}).click();await expect(page.getByRole('heading',{name:'Credentials',exact:true})).toBeVisible();await nav.getByRole('button',{name:'Permissions',exact:true}).click();await expect(page.getByRole('region',{name:'Chat coordination permissions'})).toBeVisible();await nav.getByRole('button',{name:'AI usage',exact:true}).click();await expect(page.getByRole('button',{name:'Manage usage',exact:true})).toBeVisible();
  await nav.getByRole('button',{name:'Data controls',exact:true}).click();await expect(page.getByRole('heading',{name:'Archived chats',exact:true})).toHaveCount(0);await page.getByRole('button',{name:'Archived chats',exact:true}).click();await expect(page.getByRole('tab',{name:/Archived chats/})).toHaveAttribute('aria-selected','true');await page.getByRole('button',{name:'Back to Data controls',exact:true}).click();await expect(page.getByRole('button',{name:'Storage cleanup',exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'Draft recovery',exact:true})).toBeVisible();await page.getByRole('button',{name:'Draft recovery',exact:true}).click();await expect(page.getByRole('heading',{name:'Draft recovery',exact:true})).toBeVisible();await page.getByRole('button',{name:'Back to Data controls',exact:true}).click();await expect(page.getByRole('heading',{name:'Data controls',exact:true})).toBeVisible();await page.screenshot({path:path.join(out,'settings-data-controls.png')});await page.getByRole('button',{name:'Back to chat',exact:true}).click();
 });
 await check('Old Tools startup redirects to Plugins and Back/Forward preserve current chat',async()=>{
  await page.goto(address+'/tools');await expect(page).toHaveURL(/\/plugins$/);await page.getByRole('button',{name:'Home',exact:true}).click();await expect(page).toHaveURL(/\/chats$/);await page.evaluate(()=>window.command('back'));await expect(page).toHaveURL(/\/plugins$/);await page.evaluate(()=>window.command('forward'));await expect(page).toHaveURL(/\/chats$/);
 });
 await check('Old agent Team section opens working Permissions; Behavior and Permissions share unsaved profile state',async()=>{
  await page.goto(address+'/?editor=team');const nav=page.getByRole('navigation',{name:'Agent settings sections'});await expect(nav.getByRole('button',{name:'Permissions',exact:true})).toHaveAttribute('aria-current','page');for(const name of ['Channels','Sources','Team','Contacts','Schedule','Workflows','Capabilities'])await expect(nav.getByRole('button',{name,exact:true})).toHaveCount(0);
  await expect(page.getByLabel('Allow delegation to named agents',{exact:true})).toBeVisible();await page.getByLabel('Allow delegation to named agents',{exact:true}).uncheck();await nav.getByRole('button',{name:'Behavior',exact:true}).click();await page.getByLabel('Agent role',{exact:true}).fill('Updated role');await nav.getByRole('button',{name:'Permissions',exact:true}).click();await expect(page.getByLabel('Allow delegation to named agents',{exact:true})).not.toBeChecked();await page.getByRole('button',{name:'Save agent definition',exact:true}).click();
  const save=(await page.evaluate(()=>window.consolidationCalls.filter(c=>c.action==='agents.profile.save'))).at(-1);assert.equal(save.args.value.role,'Updated role');assert.equal(save.args.value.policy.delegation,false);
  await nav.getByRole('button',{name:'Memory',exact:true}).click();await expect(page.getByLabel('Conversation context',{exact:true})).toBeVisible();await expect(page.getByText('Vector knowledge sources',{exact:true})).toHaveCount(0);await expect(page.getByText(/Use account knowledge graph/)).toHaveCount(0);
  await page.getByLabel('Conversation context',{exact:true}).selectOption('100');await page.getByRole('button',{name:'Save settings',exact:true}).click();const memory=(await page.evaluate(()=>window.consolidationCalls.filter(c=>c.action==='agentSettings.save'))).at(-1);assert.equal(memory.args.value.use_account_graph,true);assert.deepEqual(memory.args.value.datastores,['11111111-1111-4111-8111-111111111111']);
 });
 await check('Old Sources section opens canonical plugin assignments and has no raw MCP creation form',async()=>{
  await page.goto(address+'/?editor=sources');await expect(page.getByRole('navigation',{name:'Agent settings sections'}).getByRole('button',{name:'Plugins',exact:true})).toHaveAttribute('aria-current','page');await expect(page.getByRole('tab',{name:'Integrated',exact:true})).toBeVisible();await expect(page.getByRole('heading',{name:'Add MCP server',exact:true})).toHaveCount(0);
 });

 await check('Automations retains reviewed paused import through the shared scheduler',async()=>{
  await page.goto(address+'/?automations');await page.getByRole('button',{name:'Advanced tasks and run history',exact:true}).click();await page.getByText('Earlier paused schedules',{exact:true}).click();await page.getByRole('button',{name:'Review import',exact:true}).click();await expect(page.getByRole('dialog',{name:'Import paused task',exact:true})).toBeVisible();await expect(page.getByLabel('Task name',{exact:true})).toHaveValue('Earlier retained task');await expect(page.getByLabel('Instructions',{exact:true})).toHaveValue('Do retained work');await expect(page.getByLabel('Schedule status')).toHaveValue('paused');await expect(page.getByLabel('Schedule status')).toBeDisabled();assert(!(await page.evaluate(()=>window.consolidationCalls)).some(c=>c.action==='tasks.import'||c.action==='tasks.save'||c.action==='agentSettings.task.save'));await page.getByRole('button',{name:'Cancel',exact:true}).click();
 });
 assert.deepEqual(evidence.rendererErrors,[]);assert.deepEqual(await page.evaluate(()=>window.fixtureErrors),[]);assert(!(await page.evaluate(()=>window.consolidationCalls)).some(c=>c.action==='chat.start'));await page.screenshot({path:path.join(out,'consolidated-automations.png')});evidence.success=true;
}catch(error){evidence.error=error.stack;if(page)await page.screenshot({path:path.join(out,'failure.png')}).catch(()=>{});process.exitCode=1}
finally{if(app)await app.close();await new Promise(resolve=>server.close(resolve));await writeFile(path.join(out,'evidence.json'),JSON.stringify(evidence,null,2))}
console.log(JSON.stringify({success:evidence.success,out,checks:evidence.checks,error:evidence.error},null,2));
