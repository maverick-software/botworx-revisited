// Inspect the actual installed application through its own developer protocols.
// No profile substitution, provider interception, injected replies or model calls.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,readdir} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import path from 'node:path';
import WebSocket from 'ws';
import {chromium,expect} from '@playwright/test';
import {desktopOperation} from './operation-lock.mjs';
import {hash,closed} from './phased-backup-control.mjs';
const root=path.resolve(import.meta.dirname,'../..'),exec=promisify(execFile),json=async p=>JSON.parse(await readFile(p,'utf8'));
desktopOperation('verify ordinary installed Composio plugin connection and document UI');
const maintenance=path.resolve(process.argv[2]??'');assert.equal(path.dirname(maintenance),path.join(root,'.supabase/desktop-normal-maintenance'));
const update=await json(path.join(maintenance,'evidence.json'));assert(update.success&&update.installed);const resume=process.argv[3];if(!resume)await closed();
const intent=await json(path.join(maintenance,'intent.json')),program='C:/Users/charl/AppData/Local/AgentopiaDesktop/app-0.44.53',exe=path.join(program,'Agentopia.exe');
assert.equal(await hash(path.join(program,'resources/app.asar')),intent.targetImageSha256);
const out=path.join(root,'.supabase/desktop-ordinary-connection53',String(Date.now()));assert.equal(path.dirname(out),path.join(root,'.supabase/desktop-ordinary-connection53'));await mkdir(out,{recursive:true});
if(resume)assert.equal(path.dirname(path.resolve(resume)),path.join(root,'.supabase/desktop-ordinary-connection53'));
const sid=(await exec('powershell.exe',['-NoProfile','-NonInteractive','-Command','[Security.Principal.WindowsIdentity]::GetCurrent().User.Value'],{windowsHide:true,encoding:'utf8'})).stdout.trim();assert(/^S-1-5-[0-9-]+$/.test(sid));
await exec('icacls.exe',[out,'/inheritance:r','/grant:r','*'+sid+':(OI)(CI)F','*S-1-5-18:(OI)(CI)F','/Q'],{windowsHide:true});
const settings=await json(path.join(maintenance,'recovery/Agentopia-application-update-recovery/portable-settings.json'));const frozen=await json(intent.packageProof);assert.equal(frozen.version,'0.44.53');for(const [name,digest]of Object.entries(frozen.uiFiles))assert.equal(await hash(path.join(program,'resources/resources/ui',name)),digest);
const evidence={success:false,at:new Date().toISOString(),out,version:'0.44.53',maintenance,actualInstalledArchive:true,uiRevision:'composio-connection-card-1',profileSubstituted:false,providerInterception:false,promptsSent:0,checks:[]};
const save=()=>writeFile(path.join(out,'evidence.json'),JSON.stringify(evidence,null,2)),check=async name=>{evidence.checks.push(name);await save();console.log('PASS '+name);};
const wait=async(predicate,timeout=30000)=>{const until=Date.now()+timeout;while(Date.now()<until){const value=await predicate();if(value)return value;await new Promise(resolve=>setTimeout(resolve,200));}throw Error('Application observation timed out');};
const launch=path.join(out,'Open-Installed-Agentopia.cmd');
await mkdir(path.join(out,'temp'),{recursive:true});await writeFile(launch,['@echo off','setlocal','set "ELECTRON_RUN_AS_NODE="','set "NODE_OPTIONS="','set "AGENTOPIA_TEST_PROFILE="','set "TEMP='+path.join(out,'temp')+'"','set "TMP='+path.join(out,'temp')+'"','"'+exe+'" --inspect=0 --remote-debugging-port=0 1>"'+path.join(out,'private-stdout.log')+'" 2>"'+path.join(out,'private-stderr.log')+'"','exit /b %errorlevel%',''].join('\r\n'));
// Explorer may return 1 after handing the request to the existing shell. The
// debugger endpoint and final process check establish actual launch success.
const explore=target=>exec('explorer.exe',[target],{windowsHide:true}).catch(error=>{if(error.code!==1||error.stdout||error.stderr)throw error;});
await save();if(!resume)await explore(launch);
let socket,browser,page,original,originalPane,originalNavigation,scope,owner,contextChoice,restored=false,sequence=0;
const pending=new Map();
const rpc=(method,params={})=>new Promise((resolve,reject)=>{const id=++sequence,timer=setTimeout(()=>{pending.delete(id);reject(Error('Owned application '+method+' timed out'));},30000);pending.set(id,{resolve,reject,timer});socket.send(JSON.stringify({id,method,params}));});
const main=async expression=>{const value=await rpc('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});assert(!value.exceptionDetails,JSON.stringify(value.exceptionDetails));return value.result?.value;};
const windowExpression="process.mainModule.require('electron').BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().startsWith('agentopia://app/'))";
const call=(action,args)=>page.evaluate(({action,args})=>window.agentopia.call(action,args),{action,args});
async function restore(){
 if(restored)return;
 if(!original){if(page&&originalNavigation?.view==='plugins'&&owner){await page.getByRole('button',{name:'Plugins and connections',exact:true}).click();await expect.poll(()=>call('navigation.state',{owner}),{timeout:60000}).toEqual(originalNavigation);}return;}
 if(page&&owner){
  const chat=(await call('conversations.list')).find(row=>row.conversation_id===scope);assert(chat);await page.locator('button.history-open').and(page.getByTitle(chat.title,{exact:true})).click();await expect(page.getByRole('textbox',{name:'Message',exact:true})).toBeVisible({timeout:60000});
  await page.evaluate(({key,value})=>value===null?localStorage.removeItem(key):localStorage.setItem(key,value),contextChoice);
  // Flush current display writes before restoring the saved pane through the same app API.
  await page.waitForTimeout(400);await call('workspace.save',{owner,scope,state:originalPane});await page.reload();
  await expect(page.getByRole('textbox',{name:'Message',exact:true})).toHaveValue(original.draft,{timeout:60000});
  assert.deepEqual(await call('workspace.state',{owner,scope}),originalPane);
  assert.equal(await page.getByRole('button',{name:'Model and thinking',exact:true}).getAttribute('title'),original.modelTitle);
  assert.equal((await call('auth.state')).identity.id,owner);
 }
 await main(`(()=>{const w=${windowExpression};w.unmaximize();w.setBounds(${JSON.stringify(original.window.normal)});${original.window.maximized?'w.maximize();':''}return true;})()`);
 if(originalNavigation.view!=='chat'){await page.getByRole('button',{name:'Plugins and connections',exact:true}).click();await expect(page.getByRole('heading',{name:'Plugins',exact:true})).toBeVisible({timeout:60000});await expect.poll(()=>call('navigation.state',{owner}),{timeout:60000}).toEqual(originalNavigation);}
 restored=true;evidence.restoredOriginalPaneDraftModelAndWindow=true;evidence.originalNavigationRestored=true;await save();
}
async function finishOrdinary(app){
 await main(`${windowExpression}.close();true`);socket.close();socket=null;await browser.close();browser=null;await wait(async()=>{try{process.kill(app.pid,0);return false;}catch(error){if(error.code==='ESRCH')return true;throw error;}},60000);evidence.normalExit=true;await closed();
 assert.equal(await hash(path.join(program,'resources/app.asar')),intent.targetImageSha256);await explore('C:\\Users\\charl\\AppData\\Local\\AgentopiaDesktop\\Agentopia.exe');evidence.ordinaryReopenWithoutDebugFlagsRequested=true;evidence.success=true;await save();await writeFile(path.join(root,'.supabase/desktop-ordinary-connection53/current.json'),JSON.stringify({success:true,out,evidence:path.join(out,'evidence.json')},null,2));console.log(JSON.stringify({success:true,out,checks:evidence.checks.length,promptsSent:0}));
}

try{
 const logs=await wait(async()=>{let value='';try{value=await readFile(path.join(resume?path.resolve(resume):out,'private-stderr.log'),'utf8');}catch{}return /Debugger listening on ws:/.test(value)&&/DevTools listening on ws:/.test(value)?value:null;},60000);
 const nodeUrl=logs.match(/Debugger listening on (ws:\/\/[^\s]+)/)[1],chromeUrl=logs.match(/DevTools listening on (ws:\/\/[^\s]+)/)[1];
 socket=new WebSocket(nodeUrl);await new Promise((resolve,reject)=>{socket.once('open',resolve);socket.once('error',reject);});socket.on('message',bytes=>{const value=JSON.parse(String(bytes)),request=pending.get(value.id);if(request){clearTimeout(request.timer);pending.delete(value.id);value.error?request.reject(Error(value.error.message)):request.resolve(value.result);}});
 browser=await chromium.connectOverCDP(chromeUrl);page=await wait(()=>browser.contexts()[0].pages().find(p=>p.url().startsWith('agentopia://app/')));
 await page.waitForFunction(()=>window.agentopia?.call);await wait(async()=>{const status=await call('runtime.status');if(status.phase==='error')throw Error(status.message);return status.ready;},300000);
 const app=await main("(()=>{const {app}=process.mainModule.require('electron');return {version:app.getVersion(),profile:app.getPath('userData'),packaged:app.isPackaged,pid:process.pid};})()");
 assert.equal(app.version,'0.44.53');assert(app.packaged);assert.equal(path.resolve(app.profile).toLowerCase(),path.resolve('C:/Users/charl/.agentopia/desktop/profile').toLowerCase());evidence.application=app;
 const auth=await call('auth.state');assert(auth.identity);owner=auth.identity.id;const expected=settings.accounts.find(row=>row.owner===owner);assert(expected);assert(!auth.needsAdministrator);
 const navigation=await call('navigation.state',{owner});originalNavigation=structuredClone(navigation);assert(navigation.conversationId);scope=navigation.conversationId;evidence.originalNavigation=originalNavigation;
 if(navigation.view!=='chat'){assert.equal(navigation.view,'plugins','Extend the actual saved-view check before changing another view');await expect(page.getByRole('heading',{name:'Plugins',exact:true})).toBeVisible();await page.screenshot({path:path.join(out,'ordinary-saved-plugins.png')});const chat=(await call('conversations.list')).find(row=>row.conversation_id===scope);assert(chat);await page.locator('button.history-open').and(page.getByTitle(chat.title,{exact:true})).click();}
 await expect(page.getByRole('textbox',{name:'Message',exact:true})).toBeVisible({timeout:60000});
 const providers=await call('providers.status');assert(providers.chatgpt?.authorized);assert(providers.openrouter);evidence.beforeProviderChoices={preferChatGPT:providers.preferChatGPT,selections:providers.selections};
 const draft=await page.getByRole('textbox',{name:'Message',exact:true}).inputValue();
 originalPane=await call('workspace.state',{scope,owner});
 original={draft,modelTitle:await page.getByRole('button',{name:'Model and thinking',exact:true}).getAttribute('title'),window:await main(`(()=>{const w=${windowExpression};return {bounds:w.getBounds(),normal:w.getNormalBounds(),maximized:w.isMaximized()};})()`)};
 contextChoice=await page.evaluate(owner=>{const key='agentopia.chat-context.'+owner;return {key,value:localStorage.getItem(key)};},owner);
 await writeFile(path.join(out,'private-before.json'),JSON.stringify({original,originalPane,navigation,contextChoice},null,2));
 evidence.savedAccountRestored=true;evidence.chatGPTAuthorized=true;evidence.openRouterPresent=true;evidence.originalTabCount=originalPane.tabs.length;evidence.fileReferences=(await call('files.list')).length;
 await page.screenshot({path:path.join(out,'ordinary-restored.png')});await check('The actual installed app opens the original profile, saved account, conversation, draft, model choices, provider connections and document tabs.');
 await page.getByRole('button',{name:'Plugins and connections',exact:true}).first().click();await expect(page.getByRole('heading',{name:'Plugins',exact:true})).toBeVisible();const card=page.getByRole('article',{name:'Composio connection',exact:true});await expect(card).toContainText('Not connected');await expect(card).toContainText('Configured separately for each user');await page.screenshot({path:path.join(out,'ordinary-composio-plugin-card.png')});await card.getByRole('button',{name:'Connect Composio',exact:true}).click();await expect(page.getByRole('heading',{name:'Connect your Composio project',exact:true})).toBeVisible();const composio=await call('composio.status');assert.deepEqual(composio,{configured:false,connections:[]});await expect(page.getByLabel('Composio project API key',{exact:true})).toHaveValue('');await expect(page.getByLabel('Composio project API key',{exact:true})).toHaveAttribute('type','password');await expect(page.getByText('Each user configures their own connection.',{exact:false})).toBeVisible();await expect(page.getByRole('button',{name:'Connect project',exact:true})).toBeDisabled();await page.screenshot({path:path.join(out,'ordinary-composio-private-key-setup.png')});evidence.composioSetup={pluginConnection:true,perUser:true,configured:false,credentialsEntered:false,liveConnectorVerified:false};await check('The ordinary installed Plugins page has a Composio connection card that opens protected per-user setup.');
 const chat=(await call('conversations.list')).find(row=>row.conversation_id===scope);assert(chat);await page.locator('button.history-open').and(page.getByTitle(chat.title,{exact:true})).click();await expect(page.getByRole('textbox',{name:'Message',exact:true})).toBeVisible({timeout:60000});evidence.formattedDocuments=[];
 let docScope=scope,docPane=originalPane;if(!docPane.tabs.some(t=>/\.docx$/i.test(t.name))||!docPane.tabs.some(t=>/\.pdf$/i.test(t.name))){const saved=(await call('conversations.list')).find(c=>c.title==='Can you make word documents?');assert(saved);docScope=saved.conversation_id;docPane=await call('workspace.state',{owner,scope:docScope});await page.locator('button.history-open').and(page.getByTitle(saved.title,{exact:true})).click();await expect(page.locator('.header-title')).toHaveText(saved.title,{timeout:60000});await expect.poll(()=>call('navigation.state',{owner})).toMatchObject({view:'chat',conversationId:docScope});await expect(page.getByRole('textbox',{name:'Message',exact:true})).toBeVisible({timeout:60000});}await writeFile(path.join(out,'private-document-before.json'),JSON.stringify({scope:docScope,pane:docPane},null,2));
 try{const candidates=[docPane.tabs.findLast(tab=>tab.kind==='file'&&/\.docx$/i.test(tab.name)),docPane.tabs.find(tab=>tab.kind==='file'&&/\.pdf$/i.test(tab.name))];assert(candidates.every(Boolean));await page.getByRole('button',{name:'Open files and browser',exact:true}).click();await expect(page.getByRole('tablist',{name:'Workspace tabs',exact:true})).toBeVisible();for(const tab of candidates){const control=page.getByRole('tab',{name:tab.name,exact:true});evidence.documentUiTabs=await page.getByRole('tablist',{name:'Workspace tabs',exact:true}).innerText();await save();await (/\.docx$/i.test(tab.name)?control.last():control.first()).click();const frame=page.frameLocator('iframe[title="Formatted preview: '+tab.name+'"]');if(/\.docx$/i.test(tab.name)){await expect(frame.locator('section.docx').first()).toBeVisible({timeout:60000});assert(await frame.locator('table').count()>0);}else{await expect(frame.locator('canvas').first()).toBeVisible({timeout:60000});assert(await frame.locator('canvas').first().evaluate(c=>c.width>100&&c.height>100));}await page.screenshot({path:path.join(out,'ordinary-formatted-'+tab.name+'.png')});evidence.formattedDocuments.push(tab.name);}}finally{assert.notEqual(docScope,scope);await page.locator('button.history-open').and(page.getByTitle(chat.title,{exact:true})).click();await expect(page.locator('.header-title')).toHaveText(chat.title,{timeout:60000});await expect(page.getByRole('textbox',{name:'Message',exact:true})).toBeVisible({timeout:60000});await page.waitForTimeout(400);await call('workspace.save',{owner,scope:docScope,state:docPane});assert.deepEqual(await call('workspace.state',{owner,scope:docScope}),docPane);evidence.documentChatPaneRestored=true;}
 assert(evidence.formattedDocuments.some(name=>/\.docx$/i.test(name))&&evidence.formattedDocuments.some(name=>/\.pdf$/i.test(name)),'The original Word and PDF tabs must both render');await check('The actual installed app renders the saved Word and PDF tabs through the restored isolated document viewer.');
 await restore();await check('The original pane, document tabs, unsent draft, model and window placement are restored after the layout check.');
 const after=await call('providers.status');assert.deepEqual({preferChatGPT:after.preferChatGPT,selections:after.selections},evidence.beforeProviderChoices);await finishOrdinary(app);
}catch(error){evidence.error=error.stack;try{await restore();}catch(restoreError){evidence.restoreError=restoreError.stack;}await save();console.error(error.stack);process.exitCode=1;}
finally{socket?.close();for(const entry of pending.values())clearTimeout(entry.timer);await browser?.close().catch(()=>{});await save();}
