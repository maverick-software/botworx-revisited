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
desktopOperation('verify ordinary installed responsive application');
const maintenance=path.resolve(process.argv[2]??'');assert.equal(path.dirname(maintenance),path.join(root,'.supabase/desktop-normal-maintenance'));
const update=await json(path.join(maintenance,'evidence.json'));assert(update.success&&update.installed);const resume=process.argv[3];if(!resume)await closed();
const intent=await json(path.join(maintenance,'intent.json')),program='C:/Users/charl/AppData/Local/AgentopiaDesktop/app-0.44.48',exe=path.join(program,'Agentopia.exe');
assert.equal(await hash(path.join(program,'resources/app.asar')),intent.targetImageSha256);
const out=resume?path.resolve(resume):path.join(root,'.supabase/desktop-ordinary-responsive48',String(Date.now()));assert.equal(path.dirname(out),path.join(root,'.supabase/desktop-ordinary-responsive48'));await mkdir(out,{recursive:true});
const sid=(await exec('powershell.exe',['-NoProfile','-NonInteractive','-Command','[Security.Principal.WindowsIdentity]::GetCurrent().User.Value'],{windowsHide:true,encoding:'utf8'})).stdout.trim();assert(/^S-1-5-[0-9-]+$/.test(sid));
await exec('icacls.exe',[out,'/inheritance:r','/grant:r','*'+sid+':(OI)(CI)F','*S-1-5-18:(OI)(CI)F','/Q'],{windowsHide:true});
const settings=await json(path.join(maintenance,'recovery/Agentopia-application-update-recovery/portable-settings.json'));
const evidence={success:false,at:new Date().toISOString(),out,version:'0.44.48',maintenance,actualInstalledArchive:true,profileSubstituted:false,providerInterception:false,promptsSent:0,checks:[]};
const save=()=>writeFile(path.join(out,'evidence.json'),JSON.stringify(evidence,null,2)),check=async name=>{evidence.checks.push(name);await save();console.log('PASS '+name);};
const wait=async(predicate,timeout=30000)=>{const until=Date.now()+timeout;while(Date.now()<until){const value=await predicate();if(value)return value;await new Promise(resolve=>setTimeout(resolve,200));}throw Error('Application observation timed out');};
const launch=path.join(out,'Open-Installed-Agentopia.cmd');
await mkdir(path.join(out,'temp'),{recursive:true});await writeFile(launch,['@echo off','setlocal','set "ELECTRON_RUN_AS_NODE="','set "NODE_OPTIONS="','set "AGENTOPIA_TEST_PROFILE="','set "TEMP='+path.join(out,'temp')+'"','set "TMP='+path.join(out,'temp')+'"','"'+exe+'" --inspect=0 --remote-debugging-port=0 1>"'+path.join(out,'private-stdout.log')+'" 2>"'+path.join(out,'private-stderr.log')+'"','exit /b %errorlevel%',''].join('\r\n'));
// Explorer may return 1 after handing the request to the existing shell. The
// debugger endpoint and final process check establish actual launch success.
const explore=target=>exec('explorer.exe',[target],{windowsHide:true}).catch(error=>{if(error.code!==1||error.stdout||error.stderr)throw error;});
await save();if(!resume)await explore(launch);
let socket,browser,page,original,originalPane,scope,owner,contextChoice,restored=false,sequence=0;
const pending=new Map();
const rpc=(method,params={})=>new Promise((resolve,reject)=>{const id=++sequence,timer=setTimeout(()=>{pending.delete(id);reject(Error('Owned application '+method+' timed out'));},30000);pending.set(id,{resolve,reject,timer});socket.send(JSON.stringify({id,method,params}));});
const main=async expression=>{const value=await rpc('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});assert(!value.exceptionDetails,JSON.stringify(value.exceptionDetails));return value.result?.value;};
const windowExpression="process.mainModule.require('electron').BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().startsWith('agentopia://app/'))";
const call=(action,args)=>page.evaluate(({action,args})=>window.agentopia.call(action,args),{action,args});
async function restore(){
 if(restored||!original)return;
 if(page&&owner){
  await page.evaluate(({key,value})=>value===null?localStorage.removeItem(key):localStorage.setItem(key,value),contextChoice);
  // Flush current display writes before restoring the saved pane through the same app API.
  await page.waitForTimeout(400);await call('workspace.save',{owner,scope,state:originalPane});await page.reload();
  await expect(page.getByRole('textbox',{name:'Message',exact:true})).toHaveValue(original.draft,{timeout:60000});
  assert.deepEqual(await call('workspace.state',{owner,scope}),originalPane);
  assert.equal(await page.getByRole('button',{name:'Model and thinking',exact:true}).getAttribute('title'),original.modelTitle);
  assert.equal((await call('auth.state')).identity.id,owner);
 }
 await main(`(()=>{const w=${windowExpression};w.unmaximize();w.setBounds(${JSON.stringify(original.window.normal)});${original.window.maximized?'w.maximize();':''}return true;})()`);
 restored=true;evidence.restoredOriginalPaneDraftModelAndWindow=true;await save();
}
try{
 const logs=await wait(async()=>{let value='';try{value=await readFile(path.join(out,'private-stderr.log'),'utf8');}catch{}return /Debugger listening on ws:/.test(value)&&/DevTools listening on ws:/.test(value)?value:null;},60000);
 const nodeUrl=logs.match(/Debugger listening on (ws:\/\/[^\s]+)/)[1],chromeUrl=logs.match(/DevTools listening on (ws:\/\/[^\s]+)/)[1];
 socket=new WebSocket(nodeUrl);await new Promise((resolve,reject)=>{socket.once('open',resolve);socket.once('error',reject);});socket.on('message',bytes=>{const value=JSON.parse(String(bytes)),request=pending.get(value.id);if(request){clearTimeout(request.timer);pending.delete(value.id);value.error?request.reject(Error(value.error.message)):request.resolve(value.result);}});
 browser=await chromium.connectOverCDP(chromeUrl);page=await wait(()=>browser.contexts()[0].pages().find(p=>p.url().startsWith('agentopia://app/')));
 await page.waitForFunction(()=>window.agentopia?.call);await wait(async()=>{const status=await call('runtime.status');if(status.phase==='error')throw Error(status.message);return status.ready;},300000);
 await expect(page.getByRole('textbox',{name:'Message',exact:true})).toBeVisible({timeout:60000});
 const app=await main("(()=>{const {app}=process.mainModule.require('electron');return {version:app.getVersion(),profile:app.getPath('userData'),packaged:app.isPackaged,pid:process.pid};})()");
 assert.equal(app.version,'0.44.48');assert(app.packaged);assert.equal(path.resolve(app.profile).toLowerCase(),path.resolve('C:/Users/charl/.agentopia/desktop/profile').toLowerCase());evidence.application=app;
 const auth=await call('auth.state');assert(auth.identity);owner=auth.identity.id;const expected=settings.accounts.find(row=>row.owner===owner);assert(expected);assert(!auth.needsAdministrator);
 const navigation=await call('navigation.state',{owner});assert.equal(navigation.view,'chat');assert(navigation.conversationId);scope=navigation.conversationId;assert.equal(navigation.conversationId,expected.settings['desktop-location'].conversationId);
 const providers=await call('providers.status');assert(providers.chatgpt?.authorized);assert(providers.openrouter);assert.equal(providers.preferChatGPT,expected.settings['prefer-chatgpt']);assert.deepEqual(providers.selections,expected.settings['model-choices']);
 const draft=await page.getByRole('textbox',{name:'Message',exact:true}).inputValue(),expectedDraft=expected.settings['chat-drafts']?.['conversation:'+scope];if(expectedDraft)assert.equal(draft,expectedDraft.text);
 originalPane=await call('workspace.state',{scope,owner});
 original={draft,modelTitle:await page.getByRole('button',{name:'Model and thinking',exact:true}).getAttribute('title'),window:await main(`(()=>{const w=${windowExpression};return {bounds:w.getBounds(),normal:w.getNormalBounds(),maximized:w.isMaximized()};})()`)};
 contextChoice=await page.evaluate(owner=>{const key='agentopia.chat-context.'+owner;return {key,value:localStorage.getItem(key)};},owner);
 await writeFile(path.join(out,'private-before.json'),JSON.stringify({original,originalPane,navigation,contextChoice},null,2));
 evidence.savedAccountRestored=true;evidence.chatGPTAuthorized=true;evidence.openRouterPresent=true;evidence.originalTabCount=originalPane.tabs.length;evidence.fileReferences=(await call('files.list')).length;
 await page.screenshot({path:path.join(out,'ordinary-restored.png')});await check('The actual installed app opens the original profile, saved account, conversation, draft, model choices, provider connections and document tabs.');
 if(originalPane.open){await page.getByRole('button',{name:'Close workspace pane',exact:true}).click();await expect(page.locator('.workspace-pane')).toHaveCount(0);}
 const resize=width=>main(`(()=>{const w=${windowExpression};w.unmaximize();w.setSize(${width},950);return w.getSize();})()`),toggle=page.getByRole('button',{name:'Chat details',exact:true});
 await resize(1900);await expect(toggle).toBeVisible();if(await toggle.getAttribute('aria-expanded')!=='true')await toggle.click();await expect(toggle).toHaveAttribute('aria-expanded','true');await expect(page.getByRole('complementary',{name:'Chat details',exact:true})).toBeVisible();
 const area=page.locator('.chat-stage');assert((await area.boundingBox()).width>=700);await page.screenshot({path:path.join(out,'ordinary-wide-details.png')});
 await resize(1280);await expect(toggle).toHaveAttribute('aria-expanded','false');await expect(page.getByRole('complementary',{name:'Chat details',exact:true})).toHaveCount(0);const before=await area.boundingBox();await page.screenshot({path:path.join(out,'ordinary-narrow-collapsed.png')});
 await toggle.click();await expect(toggle).toHaveAttribute('aria-expanded','true');const after=await area.boundingBox();assert.equal(Math.round(after.width),Math.round(before.width));await page.screenshot({path:path.join(out,'ordinary-narrow-overlay.png')});
 await toggle.click();await resize(1900);await expect(toggle).toHaveAttribute('aria-expanded','true');await expect(page.getByRole('textbox',{name:'Message',exact:true})).toHaveValue(draft);assert.equal(await page.locator('.messages').evaluate(element=>getComputedStyle(element).scrollbarWidth),'none');
 evidence.responsive={wide:1900,narrow:1280,chatWidthBeforeOverlay:before.width,chatWidthWithOverlay:after.width,roomyChoiceRestored:true,transcriptScrollbarHidden:true};await check('The installed details card collapses at 1280 pixels, opens over the chat without shrinking it, and returns to its saved docked choice at 1900 pixels.');
 await restore();await check('The original pane, document tabs, unsent draft, model and window placement are restored after the layout check.');
 await main(`${windowExpression}.close();true`);socket.close();socket=null;await browser.close();browser=null;await wait(async()=>{try{process.kill(app.pid,0);return false;}catch(error){if(error.code==='ESRCH')return true;throw error;}},60000);evidence.normalExit=true;await closed();
 assert.equal(await hash(path.join(program,'resources/app.asar')),intent.targetImageSha256);await explore('C:\\Users\\charl\\AppData\\Local\\AgentopiaDesktop\\Agentopia.exe');evidence.ordinaryReopenWithoutDebugFlagsRequested=true;evidence.success=true;await save();await writeFile(path.join(root,'.supabase/desktop-ordinary-responsive48/current.json'),JSON.stringify({success:true,out,evidence:path.join(out,'evidence.json')},null,2));console.log(JSON.stringify({success:true,out,checks:evidence.checks.length,promptsSent:0}));
}catch(error){evidence.error=error.stack;try{await restore();}catch(restoreError){evidence.restoreError=restoreError.stack;}await save();console.error(error.stack);process.exitCode=1;}
finally{socket?.close();for(const entry of pending.values())clearTimeout(entry.timer);await browser?.close().catch(()=>{});await save();}
