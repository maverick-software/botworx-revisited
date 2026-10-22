import {verifyStreamHandoffUI} from './stream-handoff-workflow.mjs';
import {verifyPluginsUI} from './plugin-workflow.mjs';
import {verifyProjectMemoryUI,cleanupProjectMemoryUI,prepareProjectMemoryRecovery,verifyProjectMemoryRecovery} from './project-memory-workflow.mjs';
import {beginSourceNavigationRecovery,verifySourceNavigationRecovery,setSourceNavigationRecoveryColumn,cleanupSourceNavigationRecovery} from './source-navigation-recovery.mjs';
import {verifySourceNavigationUI} from './source-navigation-workflow.mjs';
import {verifyWorkspaceReaderUI} from './workspace-reader-workflow.mjs';
import {beginDocumentNavigationRecovery,verifyDocumentNavigationRecovery,cleanupDocumentNavigationRecovery} from './document-navigation-recovery.mjs';
import {verifyDocumentNavigationUI} from './document-navigation-workflow.mjs';
import {verifyOrganizationUI,verifyOrganizationRestart,cleanupOrganization} from './organization-workflow.mjs';
import {beginFileOperationRecovery,verifyFileOperationRecovery,cleanupFileOperationRecovery} from './file-operation-recovery.mjs';
import {verifyFileOperationsUI} from './file-operations-workflow.mjs';
import {verifyInteractiveUI,beginInteractiveRecovery,verifyInteractiveRecovery} from './interactive-workflow.mjs';
import {_electron} from 'playwright';
import {verifySettingsUI} from './settings-workflow.mjs';
import {verifyComposerUI} from './composer-workflow.mjs';
import {verifyProviderSwitchUI} from './provider-switch-workflow.mjs';
import {verifyExternalToolsUI} from './external-tools-workflow.mjs';
import {verifyContinuityUI,beginChatDraftRecovery,verifyChatDraftRecovery} from './continuity-workflow.mjs';
import {verifyTerminalUI,beginTerminalRecovery,verifyTerminalRecovery} from './terminal-workflow.mjs';
import {verifyNavigationUI} from './navigation-workflow.mjs';
import {verifyProjectContextUI} from './project-context-workflow.mjs';
import {verifyVoiceUI} from './voice-workflow.mjs';
import {verifyMenuDialogs} from './menu-dialog-workflow.mjs';
import {verifyAttachmentsUI,beginAttachmentRecovery,verifyAttachmentRecovery} from './attachments-workflow.mjs';
import {verifyEditorUI,beginEditorRecovery,verifyEditorRecovery,cleanupEditorRecovery,beginEditorCloseRecovery,verifyEditorCloseRecovery} from './editor-workflow.mjs';
import {verifyPlansUI,beginPlanRecovery,verifyPlanRecovery} from './plans-workflow.mjs';
import {verifyDocumentsUI} from './documents-workflow.mjs';
import {verifyWorkspaceToolsUI} from './workspace-tools-workflow.mjs';
import {beginInterruptedExternal,verifyInterruptedExternal,cleanupInterruptedExternal} from './interrupted-external-workflow.mjs';
import {beginInterruptedReview,verifyInterruptedReview,cleanupInterruptedReview} from './interrupted-review-workflow.mjs';
import {expect} from '@playwright/test';
import {createClient} from '@supabase/supabase-js';
import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync,existsSync,mkdirSync,readdirSync} from 'node:fs';
import {randomBytes,randomUUID} from 'node:crypto';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import {desktopOperation} from './operation-lock.mjs';desktopOperation('desktop UI verification');
const repo=path.resolve(import.meta.dirname,'../..');
const development=process.env.AGENTOPIA_DESKTOP_SOURCE_TEST==='1';
const installation=path.join(process.env.LOCALAPPDATA,'AgentopiaDesktop');
const latest=existsSync(installation)?readdirSync(installation).filter(name=>/^app-\d+\.\d+\.\d+$/.test(name)).sort((a,b)=>b.localeCompare(a,undefined,{numeric:true}))[0]:undefined;
const executable=development?path.join(repo,'node_modules/electron/dist/electron.exe'):(process.env.AGENTOPIA_INSTALLED_EXE??path.join(installation,latest??'app-0.2.1','Agentopia.exe'));
assert(existsSync(executable),'Install the generated Windows installer, or set AGENTOPIA_INSTALLED_EXE to the packaged Agentopia.exe.');
const artifacts=path.join(repo,process.env.AGENTOPIA_INSTALLED_OUTPUT??'.supabase/desktop-installed-test');mkdirSync(artifacts,{recursive:true});
const profile='installed-verification';
const secret='fixture-key-'+randomUUID(),password=randomBytes(24).toString('base64url')+'Aa1!';
const agentName='Desktop verification '+randomUUID().slice(0,8);
let application,service,adminUser,standardUser,createdUser,agentId,conversationId,pendingReview,pendingExternal,pendingAttachment,pendingEditor,pendingPlan,pendingChatDraft,pendingTerminal,pendingInteractive,pendingFileOperation,pendingOrganization,pendingDocumentNavigation,pendingSourceNavigation,pendingProjectMemory;
function check(result){if(result.error)throw new Error(result.error.message);return result.data;}
async function launch(){
 const app=await _electron.launch({executablePath:executable,args:[...(development?[path.join(repo,'desktop/build/main.js')]:[]),'--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream','--use-file-for-fake-audio-capture='+path.join(repo,'.supabase/desktop-poc/voice-test.wav')],cwd:os.tmpdir(),env:{...process.env,PATH:process.env.SystemRoot+'\\System32;'+process.env.SystemRoot,AGENTOPIA_TEST_PROFILE:profile},timeout:60000});
 const page=await app.firstWindow();let last='';
 for(let attempt=0;attempt<240;attempt++){
  const state=await page.evaluate(()=>window.agentopia?.call('runtime.status')??{phase:'loading',ready:false});
  if(state.phase!==last){console.log('Desktop startup:',state.phase);last=state.phase;}
  if(state.phase==='error')throw new Error(state.message);
  if(state.ready)return {app,page};
  await new Promise(resolve=>setTimeout(resolve,1000));
 }
 throw new Error('Installed runtime startup timed out.');
}
async function signIn(page,email){
 await page.getByLabel('Email address',{exact:true}).fill(email);
 await page.getByLabel('Password',{exact:true}).fill(password);
 await page.getByRole('button',{name:'Sign in',exact:true}).click();
 await expect(page.getByRole('region',{name:'Chat workspace',exact:true})).toBeVisible({timeout:20000});
}
async function settings(page,section='General'){
 await page.getByRole('button',{name:'Account menu',exact:true}).click();
 await page.getByRole('menuitem',{name:/^Settings/}).click();
 await page.getByRole('navigation',{name:'Settings sections'}).getByRole('button',{name:section,exact:true}).click();
}
async function signOut(page){await page.getByRole('button',{name:'Account menu',exact:true}).click();await page.getByRole('menuitem',{name:'Sign out',exact:true}).click();}
async function createAgent(page){await page.getByRole('complementary',{name:'Workspace sidebar'}).getByRole('button',{name:'Create agent',exact:true}).click();}
const historyButton=(page,title)=>page.getByRole('region',{name:'Chat history'}).getByRole('button',{name:title,exact:true});
async function mockProvider(app){
 await app.evaluate(({app,ipcMain},key)=>{
  // These controlled adapter fixtures exercise the preserved legacy loop.
  // Native execution is separately qualified with real Codex/provider runs.
  if(!globalThis.__installedLegacyFixture){const handler=ipcMain._invokeHandlers.get('agentopia:call');if(!handler)throw new Error('The desktop fixture bridge is unavailable.');ipcMain.removeHandler('agentopia:call');ipcMain.handle('agentopia:call',(event,action,args)=>handler(event,action,['chat.start','goals.start'].includes(action)?{...args,options:{...args?.options,harness:'legacy'}}:args));globalThis.__installedLegacyFixture=true;}
  const real=globalThis.fetch;
  globalThis.fetch=async(input,options)=>{
   const url=String(input);
   if(url==='https://openrouter.ai/api/v1/models')return new Response(JSON.stringify({data:[{id:'fixture/model',name:'Verification model',supported_parameters:['tools'],supported_reasoning_efforts:['low','medium','high']}]}),{headers:{'Content-Type':'application/json'}});
   if(url==='https://openrouter.ai/api/v1/key')return new Response('{"data":{"is_free_tier":true}}',{headers:{'Content-Type':'application/json'}});
   if(url==='https://openrouter.ai/api/v1/chat/completions'){
    const body=JSON.parse(options.body);globalThis.__composerLastRequest=body;
    if(body.messages.at(-1).content.includes('cancel')||body.messages.at(-1).content.includes('interrupt'))return new Response(new ReadableStream({start(controller){
     controller.enqueue(new TextEncoder().encode('data: {"choices":[{"delta":{"content":"Partial response saved"}}]}\n\n'));
     if(body.messages.at(-1).content.includes('interrupt'))setTimeout(()=>controller.enqueue(new TextEncoder().encode('data: {"choices":[{"delta":{"content":" before interruption"}}]}\n\n')),650);
     options.signal.addEventListener('abort',()=>controller.error(new DOMException('Cancelled','AbortError')),{once:true});
    }}));
    return new Response('data: {"choices":[{"delta":{"content":"Saved verification answer"}}]}\n\ndata: {"choices":[{"finish_reason":"stop"}]}\n\ndata: [DONE]\n\n');
   }
   return real(input,options);
  };
 },secret);
}
try{
 ({app:application,page:globalThis.desktopPage}=await launch());let page=globalThis.desktopPage;
 const isolation=await page.evaluate(()=>({node:typeof require,process:typeof process}));assert.deepEqual(isolation,{node:'undefined',process:'undefined'});
 const state=JSON.parse(execFileSync('wsl.exe',['--distribution','AgentopiaRuntime','--user','agentopia','--cd','/home/agentopia/app','--exec','supabase','stack','status','--output-format','json'],{encoding:'utf8',windowsHide:true}));assert.equal(state.runtime,'native');
 const developmentSecret=process.env.AGENTOPIA_DEVELOPMENT_SECRET;assert(developmentSecret,'Set AGENTOPIA_DEVELOPMENT_SECRET to the public development key before this verification.');
 assert.notEqual(state.env.SECRET_KEY,developmentSecret,'The installed runtime retained a public development secret.');
 const signing=JSON.parse(Buffer.from(state.env.SERVICE_ROLE_KEY.split('.')[0],'base64url').toString());
 assert.equal(signing.alg,'ES256');assert.notEqual(signing.kid,'b81269f1-21d8-4f2e-b719-c2240a840d90','The installed runtime retained the development signing key.');
 service=createClient(state.env.API_URL,state.env.SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
 adminUser=check(await service.auth.admin.createUser({email:`installed-admin-${randomUUID()}@example.com`,password,email_confirm:true})).user;
 standardUser=check(await service.auth.admin.createUser({email:`installed-user-${randomUUID()}@example.com`,password,email_confirm:true})).user;
 const role=check(await service.from('roles').select('id').eq('name','admin').single());check(await service.from('user_roles').insert({user_id:adminUser.id,role_id:role.id}));
 const auth=await page.evaluate(()=>window.agentopia.call('auth.state'));if(auth.identity)await page.evaluate(()=>window.agentopia.call('auth.signOut'));await page.reload();
 await signIn(page,adminUser.email);await mockProvider(application);
 await settings(page,'Administration');
 const createdEmail=`installed-created-${randomUUID()}@example.com`;
 await page.getByLabel('Email',{exact:true}).fill(createdEmail);await page.getByLabel('Temporary password',{exact:true}).fill(password);
 await page.getByRole('button',{name:'Create account',exact:true}).click();
 const row=page.locator('.user-row').filter({hasText:createdEmail});await expect(row).toBeVisible();
 createdUser=check(await service.auth.admin.listUsers({perPage:1000})).users.find(user=>user.email===createdEmail);assert(createdUser);
 await row.getByRole('button',{name:'Make admin',exact:true}).click();await expect(row.getByText('Administrator · Active',{exact:true})).toBeVisible();
 await row.getByRole('button',{name:'Make standard',exact:true}).click();await expect(row.getByText('Standard user · Active',{exact:true})).toBeVisible();
 await row.getByRole('button',{name:'Suspend',exact:true}).click();await expect(row.getByText('Standard user · Suspended',{exact:true})).toBeVisible();
 await row.getByRole('button',{name:'Reactivate',exact:true}).click();await expect(row.getByText('Standard user · Active',{exact:true})).toBeVisible();
 await page.getByRole('navigation',{name:'Settings sections'}).getByRole('button',{name:'Appearance',exact:true}).click();
 await page.getByRole('button',{name:'Dark',exact:true}).click();assert.equal(await page.locator('html').getAttribute('data-theme'),'dark');
 await page.screenshot({path:path.join(artifacts,'settings-dark.png')});
 await page.getByRole('button',{name:'Light',exact:true}).click();
 await page.getByLabel('Text size',{exact:true}).selectOption('large');
 await page.getByRole('navigation',{name:'Settings sections'}).getByRole('button',{name:'General',exact:true}).click();
 await page.getByLabel('Send messages with',{exact:true}).selectOption('ctrl-enter');
 await page.keyboard.press('Tab');assert(await page.evaluate(()=>!!document.activeElement.closest('[role="dialog"]')),'Settings did not keep keyboard focus');
 await page.getByRole('navigation',{name:'Settings sections'}).getByRole('button',{name:'AI connections',exact:true}).click();
 await page.getByLabel('OpenRouter API key',{exact:true}).fill(secret);
 await page.getByRole('button',{name:'Load available models',exact:true}).click();
 await page.getByLabel('Default model',{exact:true}).selectOption('fixture/model');
 await page.getByRole('button',{name:'Validate and save',exact:true}).click();
 await expect(page.getByText('An administrator has configured the shared connection.',{exact:true})).toBeVisible();
 await expect(page.getByLabel('OpenRouter API key',{exact:true})).toHaveValue('');await page.getByRole('button',{name:'Save default model',exact:true}).click();await expect(page.getByText('An administrator has configured the shared connection.',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Close dialog',exact:true}).click();
 await createAgent(page);
 await page.getByLabel('Name',{exact:true}).fill(agentName);await page.getByLabel('Description',{exact:true}).fill('Installed application verification');
 await page.getByLabel('Instructions',{exact:true}).fill('Give clear answers.');await page.getByLabel('Model',{exact:true}).selectOption('fixture/model');
 await page.getByRole('button',{name:'Save agent',exact:true}).click();
 await page.getByRole('button',{name:'Agents',exact:true}).click();await expect(page.getByRole('heading',{name:agentName,exact:true})).toBeVisible();
 agentId=check(await service.from('agents').select('id').eq('user_id',adminUser.id).single()).id;
 await page.getByRole('button',{name:'Edit '+agentName,exact:true}).click();
 await page.getByLabel('Instructions',{exact:true}).fill('Edited instructions from the desktop.');await page.getByRole('button',{name:'Save agent',exact:true}).click();
 await expect(page.getByRole('dialog',{name:'Edit agent',exact:true})).toHaveCount(0);
 assert.equal(check(await service.from('agents').select('system_instructions').eq('id',agentId).single()).system_instructions,'Edited instructions from the desktop.');
 if(process.env.AGENTOPIA_PROJECT_MEMORY_RECOVERY_ONLY==='1'){await verifyProviderSwitchUI(application,page,artifacts,async(app,page,artifacts)=>{pendingProjectMemory=await verifyProjectMemoryUI(app,page,artifacts,true);});await prepareProjectMemoryRecovery(page,pendingProjectMemory);const actualPid=await application.evaluate(()=>process.pid);await application.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].close());await expect.poll(()=>{try{process.kill(actualPid,0);return false;}catch{return true;}},{timeout:45000}).toBe(true);await application.close().catch(()=>{});application=undefined;({app:application,page}=await launch());await verifyProjectMemoryRecovery(page,pendingProjectMemory);console.log('PASS: Normal close restored the project conversation source preview, private draft, provider choices and saved recall/tool records without inference replay.');execFileSync('taskkill.exe',['/PID',String(await application.evaluate(()=>process.pid)),'/F'],{windowsHide:true,stdio:'ignore'});await application.close().catch(()=>{});application=undefined;({app:application,page}=await launch());await verifyProjectMemoryRecovery(page,pendingProjectMemory);console.log('PASS: Parent-only termination retained the acknowledged project source preview, conversation, draft and cross-provider memory history without replay.');await cleanupProjectMemoryUI(page,pendingProjectMemory);pendingProjectMemory=undefined;}else if(process.env.AGENTOPIA_STREAM_HANDOFF_ONLY==='1'){await verifyProviderSwitchUI(application,page,artifacts,verifyStreamHandoffUI);}else if(process.env.AGENTOPIA_PLUGINS_ONLY==='1'){await verifyProviderSwitchUI(application,page,artifacts,verifyPluginsUI);}else if(process.env.AGENTOPIA_PROJECT_MEMORY_ONLY==='1'){await verifyProviderSwitchUI(application,page,artifacts,verifyProjectMemoryUI);}else if(process.env.AGENTOPIA_SOURCE_RECOVERY_ONLY==='1'){pendingSourceNavigation=await beginSourceNavigationRecovery(application,page);const actualPid=await application.evaluate(()=>process.pid);await application.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].close());await expect.poll(()=>{try{process.kill(actualPid,0);return false;}catch{return true;}},{timeout:45000}).toBe(true);await application.close().catch(()=>{});application=undefined;({app:application,page}=await launch());await verifySourceNavigationRecovery(page,pendingSourceNavigation);console.log('PASS: Normal close flushed source-tab ordering and reopened the renamed source at its saved line range without changing file bytes.');await setSourceNavigationRecoveryColumn(page,pendingSourceNavigation);execFileSync('taskkill.exe',['/PID',String(await application.evaluate(()=>process.pid)),'/F'],{windowsHide:true,stdio:'ignore'});await application.close().catch(()=>{});application=undefined;({app:application,page}=await launch());await verifySourceNavigationRecovery(page,pendingSourceNavigation,true);console.log('PASS: Parent-only termination restored the acknowledged source line/column, tab order and renamed path without editing or executing the file.');await cleanupSourceNavigationRecovery(page,pendingSourceNavigation);pendingSourceNavigation=undefined;}else if(process.env.AGENTOPIA_SOURCE_NAVIGATION_ONLY==='1'){await verifyProviderSwitchUI(application,page,artifacts,verifySourceNavigationUI);}else if(process.env.AGENTOPIA_READER_ONLY==='1'){await verifyWorkspaceReaderUI(application,page,artifacts);}else if(process.env.AGENTOPIA_DOCUMENT_RECOVERY_ONLY==='1'){pendingDocumentNavigation=await beginDocumentNavigationRecovery(application,page);const actualPid=await application.evaluate(()=>process.pid);await application.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].close());await expect.poll(()=>{try{process.kill(actualPid,0);return false;}catch{return true;}},{timeout:45000}).toBe(true);await application.close().catch(()=>{});application=undefined;({app:application,page}=await launch());await verifyDocumentNavigationRecovery(page,pendingDocumentNavigation);console.log('PASS: Normal close flushed a pending folder-tab reorder and retained directory tabs and document sections.');const saved=await page.evaluate(()=>window.agentopia.call('workspace.state',{scope:'home'}));await expect.poll(()=>page.evaluate(()=>window.agentopia.call('workspace.state',{scope:'home'}))).toMatchObject({active:saved.tabs.find(tab=>tab.kind==='folder').id});execFileSync('taskkill.exe',['/PID',String(await application.evaluate(()=>process.pid)),'/F'],{windowsHide:true,stdio:'ignore'});await application.close().catch(()=>{});application=undefined;({app:application,page}=await launch());await verifyDocumentNavigationRecovery(page,pendingDocumentNavigation);console.log('PASS: Parent-only termination retained acknowledged directory tabs, tab order, and a Markdown section bookmark without filesystem or model replay.');await cleanupDocumentNavigationRecovery(page,pendingDocumentNavigation);pendingDocumentNavigation=undefined;}else if(process.env.AGENTOPIA_DOCUMENT_NAVIGATION_ONLY==='1'){await verifyDocumentNavigationUI(application,page,artifacts);}else if(process.env.AGENTOPIA_ORGANIZATION_ONLY==='1'){pendingOrganization=await verifyOrganizationUI(application,page,artifacts,true);const actualPid=await application.evaluate(()=>process.pid);await application.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].close());await expect.poll(()=>{try{process.kill(actualPid,0);return false;}catch{return true;}},{timeout:45000}).toBe(true);await application.close().catch(()=>{});application=undefined;({app:application,page}=await launch());await verifyOrganizationRestart(page,pendingOrganization);console.log('PASS: Normal desktop close flushed the latest folder filter and restored expanded folders and tabs.');await expect.poll(()=>page.evaluate(({owner,scope})=>window.agentopia.call('workspace.state',{owner,scope}),{owner:pendingOrganization.owner,scope:pendingOrganization.first})).toMatchObject({treeViews:{[pendingOrganization.reference]:{filter:'kept-close'}}});execFileSync('taskkill.exe',['/PID',String(await application.evaluate(()=>process.pid)),'/F'],{windowsHide:true,stdio:'ignore'});await application.close().catch(()=>{});application=undefined;({app:application,page}=await launch());await verifyOrganizationRestart(page,pendingOrganization);console.log('PASS: Parent-only desktop termination preserved acknowledged folder expansion, filter, follow preference and tab state.');await cleanupOrganization(page,pendingOrganization);pendingOrganization=undefined;}else if(process.env.AGENTOPIA_CONTINUITY_ONLY==='1'){await verifyProviderSwitchUI(application,page,artifacts,verifyContinuityUI);}else if(process.env.AGENTOPIA_FILE_RECOVERY_ONLY==='1'){pendingFileOperation=await beginFileOperationRecovery(application,page,true);execFileSync('taskkill.exe',['/PID',String(await application.evaluate(()=>process.pid)),'/F'],{windowsHide:true,stdio:'ignore'});await application.close().catch(()=>{});application=undefined;({app:application,page}=await launch());await verifyFileOperationRecovery(application,page,pendingFileOperation);pendingFileOperation=undefined;}else if(process.env.AGENTOPIA_FILE_OPERATIONS_ONLY==='1'){await verifyFileOperationsUI(application,page,artifacts);}else if(process.env.AGENTOPIA_INTERACTIVE_RECOVERY_ONLY==='1'){pendingInteractive=await beginInteractiveRecovery(application,page);const actualPid=await application.evaluate(()=>process.pid),launcherPid=application.process().pid,before=await service.from('desktop_terminal_sessions').select('status,output,ended_at').eq('id',pendingInteractive.id).single();console.log('Recovery before kill:',{actualPid,launcherPid,status:before.data?.status,ended:before.data?.ended_at});assert.equal(before.data.status,'running');execFileSync('taskkill.exe',['/PID',String(actualPid),'/F'],{windowsHide:true,stdio:'ignore'});await new Promise(r=>setTimeout(r,500));console.log('Recovery after kill:',(await service.from('desktop_terminal_sessions').select('status,ended_at').eq('id',pendingInteractive.id).single()).data);await application.close().catch(()=>{});application=undefined;({app:application,page}=await launch());await expect(page.getByRole('button',{name:'Account menu',exact:true})).toBeVisible({timeout:20000});await verifyInteractiveRecovery(page,pendingInteractive);pendingInteractive=undefined;}else if(process.env.AGENTOPIA_INTERACTIVE_ONLY==='1'){await verifyProviderSwitchUI(application,page,artifacts,verifyInteractiveUI);pendingInteractive=await beginInteractiveRecovery(application,page);execFileSync('taskkill.exe',['/PID',String(await application.evaluate(()=>process.pid)),'/F'],{windowsHide:true,stdio:'ignore'});await application.close().catch(()=>{});application=undefined;({app:application,page}=await launch());await verifyInteractiveRecovery(page,pendingInteractive);pendingInteractive=undefined;}else if(process.env.AGENTOPIA_TERMINAL_ONLY==='1'){await verifyProviderSwitchUI(application,page,artifacts,verifyTerminalUI);await verifyProjectContextUI(application,page,artifacts);pendingTerminal=await beginTerminalRecovery(application,page);execFileSync('taskkill.exe',['/PID',String(await application.evaluate(()=>process.pid)),'/T','/F'],{windowsHide:true,stdio:'ignore'});await application.close().catch(()=>{});application=undefined;({app:application,page}=await launch());await verifyTerminalRecovery(page,pendingTerminal);pendingTerminal=undefined;}else if(process.env.AGENTOPIA_CONTINUITY_ONLY==='1'){await verifyProviderSwitchUI(application,page,artifacts,verifyContinuityUI);await page.getByRole('button',{name:'Start chat',exact:true}).click();pendingChatDraft=await beginChatDraftRecovery(page);const expectedBounds={x:80,y:70,width:1210,height:810};await application.evaluate(({BrowserWindow},bounds)=>BrowserWindow.getAllWindows()[0].setBounds(bounds),expectedBounds);const closed=new Promise(resolve=>application.process().once('exit',resolve));await application.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].close());await Promise.race([closed,new Promise((_,reject)=>{const timer=setTimeout(()=>reject(new Error('Normal desktop close timed out')),45000);timer.unref();})]);await application.close().catch(()=>{});application=undefined;({app:application,page}=await launch());await verifyChatDraftRecovery(page,pendingChatDraft);const bounds=await application.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].getNormalBounds());assert.deepEqual(bounds,expectedBounds);console.log('PASS: Normal close flushed the chat draft and restored window placement.');}else if(process.env.AGENTOPIA_PLANS_ONLY==='1'){await verifyProviderSwitchUI(application,page,artifacts,(a,p,d)=>verifyPlansUI(a,p,d,service));}else if(process.env.AGENTOPIA_EDITOR_ONLY==='1'){await verifyProviderSwitchUI(application,page,artifacts,verifyEditorUI);pendingEditor=await beginEditorCloseRecovery(application,page);const closed=new Promise(resolve=>application.process().once('exit',resolve));await application.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].close());await Promise.race([closed,new Promise((_,reject)=>{const timer=setTimeout(()=>reject(new Error('Normal editor close did not finish')),45000);timer.unref();})]);await application.close().catch(()=>{});application=undefined;({app:application,page}=await launch());await verifyEditorCloseRecovery(page,pendingEditor);pendingEditor=undefined;}else if(process.env.AGENTOPIA_DOCUMENTS_ONLY==='1'){await verifyProviderSwitchUI(application,page,artifacts,verifyDocumentsUI);}else if(process.env.AGENTOPIA_ATTACHMENTS_ONLY==='1'){await verifyProviderSwitchUI(application,page,artifacts,verifyAttachmentsUI);}else if(process.env.AGENTOPIA_CHAT_NAVIGATION_ONLY==='1'){await verifyProjectContextUI(application,page,artifacts);await verifyNavigationUI(application,page,artifacts);await verifyMenuDialogs(page,artifacts);}else if(process.env.AGENTOPIA_MENU_ONLY==='1'){await verifyMenuDialogs(page,artifacts);}else if(process.env.AGENTOPIA_WORKSPACE_ONLY==='1'){await verifyWorkspaceToolsUI(application,page,artifacts);}else if(process.env.AGENTOPIA_VOICE_ONLY==='1'){await verifyVoiceUI(application,page,service,agentId,artifacts);}else if(process.env.AGENTOPIA_PROJECT_CONTEXT_ONLY==='1'){await verifyProjectContextUI(application,page,artifacts);}else if(process.env.AGENTOPIA_NAVIGATION_ONLY==='1'){await verifyNavigationUI(application,page,artifacts);}else if(process.env.AGENTOPIA_EXTERNAL_TOOLS_ONLY==='1'){await verifyExternalToolsUI(application,page,service,agentId,artifacts);}else{
 if(process.env.AGENTOPIA_PLUGIN_RELEASE_ONLY==='1'){await verifyProviderSwitchUI(application,page,artifacts,async(app,page,artifacts)=>{await verifyPluginsUI(app,page,artifacts);await verifyStreamHandoffUI(app,page);});}else if(process.env.AGENTOPIA_CHAT_INTERFACE_RELEASE_ONLY==='1'){
 await verifyProviderSwitchUI(application,page,artifacts,async(app,page,artifacts)=>{await verifyProjectMemoryUI(app,page,artifacts);await verifyPluginsUI(app,page,artifacts);await verifyStreamHandoffUI(app,page);});
 await verifyProjectContextUI(application,page,artifacts);await verifyNavigationUI(application,page,artifacts);await verifyMenuDialogs(page,artifacts);
 await verifyWorkspaceToolsUI(application,page,artifacts);
 await verifyExternalToolsUI(application,page,service,agentId,artifacts);
}else if(process.env.AGENTOPIA_CORE_ONLY!=='1'){
 await verifySettingsUI(page,service,agentId,artifacts);
 await verifyComposerUI(application,page,service,agentId,artifacts);
 await verifyVoiceUI(application,page,service,agentId,artifacts);
 await verifyProviderSwitchUI(application,page,artifacts,async(app,page,artifacts)=>{await verifyAttachmentsUI(app,page,artifacts);await verifyDocumentsUI(app,page,artifacts);await verifyEditorUI(app,page,artifacts);await verifyPlansUI(app,page,artifacts,service);await verifyContinuityUI(app,page,artifacts);await verifyTerminalUI(app,page,artifacts);await verifyInteractiveUI(app,page,artifacts);await verifyFileOperationsUI(app,page,artifacts);await verifyOrganizationUI(app,page,artifacts);await verifyDocumentNavigationUI(app,page,artifacts);await verifyWorkspaceReaderUI(app,page,artifacts);await verifySourceNavigationUI(app,page,artifacts);await verifyProjectMemoryUI(app,page,artifacts);await verifyPluginsUI(app,page,artifacts);await verifyStreamHandoffUI(app,page);});
 await verifyProjectContextUI(application,page,artifacts);
 await verifyNavigationUI(application,page,artifacts);
 await verifyMenuDialogs(page,artifacts);
 await verifyWorkspaceToolsUI(application,page,artifacts);
 await verifyExternalToolsUI(application,page,service,agentId,artifacts);
 }
 await page.getByRole('button',{name:'Start chat',exact:true}).click();
 await page.getByLabel('Message',{exact:true}).fill('Preserve this draft when choosing an agent');
 await page.getByRole('button',{name:'Choose agent',exact:true}).click();await page.getByRole('menuitem',{name:agentName,exact:true}).click();
 assert.equal(await page.getByLabel('Message',{exact:true}).inputValue(),'Preserve this draft when choosing an agent');
 await page.getByLabel('Message',{exact:true}).fill('Hello from the installed desktop');await page.getByLabel('Message',{exact:true}).press('Enter');
 await expect(page.getByText('Saved verification answer',{exact:true})).toHaveCount(0);
 await page.getByLabel('Message',{exact:true}).press('Control+Enter');
 await expect(page.getByText('Saved verification answer',{exact:true})).toBeVisible({timeout:15000});
 await expect(page.getByRole('button',{name:'Stop response',exact:true})).toHaveCount(0);
 await page.getByLabel('Message',{exact:true}).fill('Please cancel this response');await page.getByRole('button',{name:'Send',exact:true}).click();
 await expect(page.getByText('Partial response saved',{exact:true})).toBeVisible({timeout:15000});await page.getByRole('button',{name:'Stop response',exact:true}).click();
 await expect(page.getByText(/^cancelled/)).toBeVisible({timeout:15000});
 conversationId=check(await service.from('conversation_sessions').select('conversation_id').eq('agent_id',agentId).single()).conversation_id;
 const messages=check(await service.from('chat_messages_v2').select('role,content,metadata').eq('conversation_id',conversationId).order('desktop_sequence'));
 assert.equal(messages.length,4);assert.equal(messages[1].metadata.status,'completed');assert.equal(messages[3].metadata.status,'cancelled');assert.equal(messages[3].content.text,'Partial response saved');
 await page.screenshot({path:path.join(artifacts,'conversation.png')});
 await page.getByRole('button',{name:'Chat options',exact:true}).click();await page.getByRole('menuitem',{name:'Rename',exact:true}).click();
 await page.getByLabel('Chat title',{exact:true}).fill('Saved desktop conversation');await page.getByRole('button',{name:'Save title',exact:true}).click();
 await expect(historyButton(page,'Saved desktop conversation')).toBeVisible();
 await page.getByRole('button',{name:'Chat options',exact:true}).click();await page.getByRole('menuitem',{name:'Pin chat',exact:true}).click();
 await expect(page.getByText('Pinned',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Chat options',exact:true}).click();await page.getByRole('menuitem',{name:'Archive',exact:true}).click();
 await expect(historyButton(page,'Saved desktop conversation')).toHaveCount(0);
 await settings(page,'Data controls');await page.getByRole('button',{name:'Restore Saved desktop conversation',exact:true}).click();
 await expect(page.getByText('Archived chats',{exact:true})).toBeVisible();await page.getByRole('button',{name:'Close dialog',exact:true}).click();
 await page.keyboard.press('Control+k');await page.getByRole('textbox',{name:'Search chats',exact:true}).fill('Saved desktop');
 await page.getByRole('dialog',{name:'Search chats',exact:true}).getByRole('button').filter({hasText:'Saved desktop conversation'}).click();
 await expect(page.getByText('Saved verification answer',{exact:true})).toBeVisible();
 await page.keyboard.press('Control+b');await expect(page.getByRole('button',{name:'Expand sidebar',exact:true})).toBeVisible();
 await page.keyboard.press('Control+b');await expect(page.getByRole('button',{name:'Account menu',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Plugins',exact:true}).click();await expect(page.getByRole('heading',{name:'Plugins',exact:true})).toBeVisible();
 await expect(page.getByText('Connected',{exact:true})).toBeVisible();
 await page.keyboard.press('Control+Shift+o');await expect(page.getByRole('heading',{name:'What can I help with?',exact:true})).toBeVisible();
 await page.getByLabel('Message',{exact:true}).fill('Private unsent administrator draft');
 const data=await application.evaluate(({app})=>app.getPath('userData'));
 const encrypted=readFileSync(path.join(data,'credentials.bin'));assert(!encrypted.includes(Buffer.from(secret)));assert(!encrypted.includes(Buffer.from(password)));
 await signOut(page);await signIn(page,standardUser.email);
 await expect(page.getByRole('heading',{name:agentName,exact:true})).toHaveCount(0);
 await assert.rejects(page.evaluate(()=>window.agentopia.call('admin.users')),/Administrator/);
 await assert.rejects(page.evaluate(()=>window.agentopia.call('providers.saveOpenRouter',{key:'forged',model:'fixture/model'})),/Administrator/);
 await assert.rejects(page.evaluate(()=>window.agentopia.call('runtime.backup')),/Administrator/);
 const own=await page.evaluate(()=>window.agentopia.call('agents.list'));assert.equal(own.length,0);
 await assert.rejects(page.evaluate(id=>window.agentopia.call('messages.list',{conversationId:id}),conversationId));
 assert.equal((await page.evaluate(()=>window.agentopia.call('conversations.list'))).length,0);
 await assert.rejects(page.evaluate(id=>window.agentopia.call('conversations.manage',{conversationId:id,action:'delete'}),conversationId));
 await createAgent(page);await page.getByLabel('Name',{exact:true}).fill('Standard user private agent');
 await page.getByLabel('Model',{exact:true}).selectOption('fixture/model');await page.getByRole('button',{name:'Save agent',exact:true}).click();
 assert.equal(await page.getByLabel('Message',{exact:true}).inputValue(),'');
 await settings(page,'AI connections');await expect(page.getByLabel('OpenRouter API key',{exact:true})).toHaveCount(0);
 await expect(page.getByRole('navigation',{name:'Settings sections'}).getByRole('button',{name:'Administration',exact:true})).toHaveCount(0);
 for(const title of ['System API keys','Integrations','Stripe billing','System prompts'])await expect(page.getByRole('navigation',{name:'Settings sections'}).getByRole('button',{name:title,exact:true})).toHaveCount(0);
 await assert.rejects(page.evaluate(()=>window.agentopia.call('settings.admin.keys')),/Administrator/);
 await assert.rejects(page.evaluate(id=>window.agentopia.call('agentSettings.get',{agentId:id}),agentId));
 await page.getByRole('button',{name:'Close dialog',exact:true}).click();await signOut(page);await signIn(page,adminUser.email);
 pendingChatDraft=await beginChatDraftRecovery(page);
 await historyButton(page,'Saved desktop conversation').click();
 await page.getByLabel('Message',{exact:true}).fill('Please interrupt this response');await page.getByRole('button',{name:'Send',exact:true}).click();
 let partial;
 for(let attempt=0;attempt<40;attempt++){
  partial=check(await service.from('chat_messages_v2').select('content,metadata').eq('conversation_id',conversationId).eq('role','assistant').order('desktop_sequence',{ascending:false}).limit(1))[0];
  if(partial?.content.text==='Partial response saved before interruption')break;
  await new Promise(resolve=>setTimeout(resolve,200));
 }
 assert.equal(partial.content.text,'Partial response saved before interruption');assert.equal(partial.metadata.status,'running');
 const savedVoice=await page.evaluate(()=>window.agentopia.call('voice.preferences.get'));await page.evaluate(({owner,preferences})=>window.agentopia.call('voice.preferences.save',{owner,preferences:{...preferences,rate:2,mode:'push'}}),{owner:adminUser.id,preferences:savedVoice});
 pendingTerminal=await beginTerminalRecovery(application,page);
 pendingInteractive=await beginInteractiveRecovery(application,page);
 pendingPlan=await beginPlanRecovery(application,page,agentId);
 pendingEditor=await beginEditorRecovery(application,page);
 pendingAttachment=await beginAttachmentRecovery(application,page);
 pendingReview=await beginInterruptedReview(application,page,agentId);
 pendingExternal=await beginInterruptedExternal(application,page,agentId);
 pendingFileOperation=await beginFileOperationRecovery(application,page);
 execFileSync('taskkill.exe',['/PID',String(await application.evaluate(()=>process.pid)),'/T','/F'],{windowsHide:true,stdio:'ignore'});
 await application.close().catch(()=>{});application=undefined;
 ({app:application,page}=await launch());
 assert.equal((await page.evaluate(()=>window.agentopia.call('voice.preferences.get'))).rate,2);await page.evaluate(({owner,preferences})=>window.agentopia.call('voice.preferences.save',{owner,preferences}),{owner:adminUser.id,preferences:savedVoice});console.log('PASS: Windows-protected voice preferences survived forced process termination and session restoration.');
 await verifyChatDraftRecovery(page,pendingChatDraft);pendingChatDraft=undefined;
 await verifyFileOperationRecovery(application,page,pendingFileOperation);pendingFileOperation=undefined;
 await verifyTerminalRecovery(page,pendingTerminal);pendingTerminal=undefined;
 await verifyInteractiveRecovery(page,pendingInteractive);pendingInteractive=undefined;
 await verifyPlanRecovery(page,pendingPlan,artifacts);pendingPlan=undefined;
 await verifyEditorRecovery(page,pendingEditor);pendingEditor=undefined;
 await verifyAttachmentRecovery(page,pendingAttachment);pendingAttachment=undefined;
 await verifyInterruptedReview(page,pendingReview,artifacts);pendingReview=undefined;
 await verifyInterruptedExternal(page,pendingExternal,artifacts);pendingExternal=undefined;
 await application.evaluate(()=>{const real=globalThis.fetch;globalThis.fetch=(input,options)=>String(input).startsWith('https:')?Promise.reject(new Error('Offline provider test')):real(input,options);});
 await expect(historyButton(page,'Saved desktop conversation')).toBeVisible({timeout:15000});
 assert.equal(await page.locator('html').getAttribute('data-theme'),'light');assert.equal(await page.locator('html').getAttribute('data-text-size'),'large');
 await historyButton(page,'Saved desktop conversation').click();
 await expect(page.getByText('Saved verification answer',{exact:true})).toBeVisible();await expect(page.getByText('Partial response saved',{exact:true})).toBeVisible();
 await expect(page.getByText('Partial response saved before interruption',{exact:true})).toBeVisible();await expect(page.getByText(/^interrupted/)).toBeVisible();
 const backup=await page.evaluate(()=>window.agentopia.call('runtime.backup'));assert(existsSync(path.join(backup,'database.dump')));assert(existsSync(path.join(backup,'pgsodium_root.key')));
 await page.screenshot({path:path.join(artifacts,'restored-history.png')});
 await application.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setSize(1000,700));
 await expect(page.getByRole('button',{name:'Voice mode',exact:true})).toBeVisible();
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'The compact window overflowed horizontally');
 await page.screenshot({path:path.join(artifacts,'compact-chat.png')});
 await application.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setSize(1360,900));
 await page.getByRole('button',{name:'Chat options',exact:true}).click();await page.getByRole('menuitem',{name:'Delete chat',exact:true}).click();
 await page.getByRole('dialog',{name:'Delete chat?',exact:true}).getByRole('button',{name:'Delete chat',exact:true}).click();
 await expect(page.getByRole('dialog',{name:'Delete chat?',exact:true})).toHaveCount(0);
 await expect(historyButton(page,'Saved desktop conversation')).toHaveCount(0);
 assert.equal(check(await service.from('chat_messages_v2').select('id').eq('conversation_id',conversationId)).length,0);
 await page.getByRole('button',{name:'Agents',exact:true}).click();await page.getByRole('button',{name:'Edit '+agentName,exact:true}).click();page.once('dialog',dialog=>dialog.accept());
 await page.getByRole('button',{name:'Delete agent',exact:true}).click();await expect(page.getByRole('dialog',{name:'Edit agent',exact:true})).toHaveCount(0);await expect(page.getByRole('heading',{name:agentName,exact:true})).toHaveCount(0);
 await signOut(page);
 // Remove only the disposable verification records before the runtime stops.
 for(const account of [adminUser,standardUser,createdUser]){
  check(await service.from('agents').delete().eq('user_id',account.id));check(await service.auth.admin.deleteUser(account.id));
 }
 adminUser=standardUser=createdUser=undefined;
 console.log(`PASS: ${development?'Development desktop':'Installed desktop'} resources, renderer isolation, account administration and permissions, Windows-encrypted credentials, agent creation/edit/deletion, streamed persistence, cancellation, forced-termination/session/history recovery, and backup export.`);
 console.log('Provider responses in this installed test were simulated. Live OpenRouter and ChatGPT authorization remain separate release checks.');
 console.log('PASS: Chat-first navigation, account settings menu, settings focus, themes, send-key preference, sidebar toggle, plugins/agents navigation, global history search, rename/pin/archive/restore/delete, and cross-account history/draft isolation.');
}
}catch(error){
 console.error('Desktop verification failed:',error);if(service&&agentId){const rows=await service.from('conversation_sessions').select('conversation_id').eq('agent_id',agentId);const messages=rows.data?.length?await service.from('chat_messages_v2').select('role,content,metadata').in('conversation_id',rows.data.map(row=>row.conversation_id)):{data:[]};writeFileSync(path.join(artifacts,'stream-diagnostic.json'),JSON.stringify({messages:messages.data,lastRequest:application?await application.evaluate(()=>globalThis.__composerLastRequest).catch(()=>null):null},null,2));}
 if(application&&application.windows().length){const page=application.windows()[0];console.error('Application alerts:',await page.getByRole('alert').allTextContents());await page.screenshot({path:path.join(artifacts,'failure.png')});}
 throw error;
}finally{
 await cleanupProjectMemoryUI(application?.windows()[0],pendingProjectMemory);
 await cleanupSourceNavigationRecovery(application?.windows()[0],pendingSourceNavigation);
 await cleanupDocumentNavigationRecovery(application?.windows()[0],pendingDocumentNavigation);
 await cleanupOrganization(application?.windows()[0],pendingOrganization);
 await cleanupFileOperationRecovery(pendingFileOperation,application);cleanupEditorRecovery(pendingEditor);cleanupInterruptedReview(pendingReview);await cleanupInterruptedExternal(pendingExternal);
 // These accounts and this profile are disposable. End their session before deleting
 // them so final window cleanup cannot request a save for an already deleted user.
 if(service&&(adminUser||standardUser||createdUser)&&application&&application.windows().length){const page=application.windows()[0];await page.evaluate(()=>window.agentopia.call('auth.signOut')).catch(()=>{});await page.reload().catch(()=>{});}
 if(service&&(adminUser||standardUser||createdUser))for(const account of [adminUser,standardUser,createdUser])if(account){await service.from('agents').delete().eq('user_id',account.id);await service.auth.admin.deleteUser(account.id);}
 if(application)await application.close();
}
