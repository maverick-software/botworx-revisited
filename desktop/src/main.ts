import {maxAttachmentRequestBytes} from './image-limits';
import {desktopContentPolicy} from './desktop-content-policy';
import {presentationFullscreenAllowed} from './presentation-permission';
import {selectedBrowserSnapshot} from './selected-context';
import {desktopRequestLimit} from './request-limits';
import {ScheduledNotifications} from './scheduled-notifications';
import {ResponseNotifications} from './response-notifications';
import {readNotificationPreferences} from './notification-preferences';
import {ComputerService} from './computer-service';
import {ComputerIndicator} from './computer-indicator';
import {desktopProfile} from './desktop-profile';
import {registeredPrivateRuntimeStorage} from './private-runtime-storage';
import {ChromeRuntime} from './chrome-runtime';
import {chromePluginName,chromeConnectionId} from './chrome-contracts';
import {spawn} from 'node:child_process';
import {AgentBrowser} from './agent-browser';
import {app,BrowserWindow,Notification,protocol,ipcMain,dialog,shell,screen,Menu,globalShortcut,powerMonitor} from 'electron';
import {LocalRuntimeConnection,localRuntimeError} from './local-runtime-connection';
import {readFile,writeFile,mkdir,realpath} from 'node:fs/promises';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {Runtime} from './runtime';
import {Secrets} from './secrets';
import {Providers} from './providers';
import {Broker} from './broker';
import {LocalVoice} from './voice';
import {ManagedVoice} from './managed-voice';
import {WorkspaceBrowser} from './workspace-browser';
import {loadWindow,saveWindow} from './window-state';
import {commandDisclosure} from './terminal-contracts';
import {queuedRecovery,runQueuedRecovery,type QueuedRecovery} from './recovery-bootstrap';
import {BackupControl} from './backup-control';
import {StorageControl} from './storage-control';
import {cleanDisplaySnapshot} from './display-state';
import {createPortableBackup} from './portable-backup';
import {captureAutomaticUpgradeRecovery} from './upgrade-workspace-backup';
import {UpgradeRecoverySession} from './upgrade-recovery-session';
import {EditorJournalInventory,preserveEditorJournalStorage} from './editor-journal-inventory';
import {exportEditorJournal} from './editor-journal-export';
import {legacySlug} from './legacy-brand';
import {migrateBrandBrowserStorage} from './brand-storage-migration';
app.setName('Sylvana');
app.setAppUserModelId('com.squirrel.SylvanaDesktop.Sylvana');
const squirrelStartup=require('electron-squirrel-startup') as boolean;
let profileProblem:Error|undefined;
let pendingRecovery:QueuedRecovery|undefined;
let recoveryController:AbortController|undefined;
if(process.env.SYLVANA_TEST_PROFILE){
 const name=process.env.SYLVANA_TEST_PROFILE;if(!/^[a-z0-9-]+$/.test(name))throw new Error('Invalid test profile');
 app.setPath('userData',path.join(app.getPath('appData'),'Sylvana','test-profiles',name));
}else if(!squirrelStartup){
 try{
  const current=app.getPath('userData'),directory=desktopProfile({platform:process.platform,packaged:app.isPackaged,testProfile:false,exe:app.getPath('exe'),appData:app.getPath('appData'),home:app.getPath('home'),current});
  if(directory!==current){app.setPath('userData',directory);app.setPath('sessionData',directory);}
  pendingRecovery=queuedRecovery(app.getPath('home'),app.getPath('appData'),directory);
  if(pendingRecovery){app.setPath('userData',pendingRecovery.bootstrap);app.setPath('sessionData',pendingRecovery.bootstrap);}
 }catch(error){profileProblem=new Error('Sylvana could not open its saved profile or recovery request. '+(error instanceof Error?error.message:'Existing data has been preserved.'));}
}
protocol.registerSchemesAsPrivileged(['sylvana',legacySlug].map(scheme=>({scheme,privileges:{standard:true,secure:true,supportFetchAPI:true,corsEnabled:true}})));
let window:BrowserWindow|undefined;
let runtime:Runtime|undefined;
let broker:Broker|undefined;
let upgradeReview:UpgradeRecoverySession|undefined;
let voice:LocalVoice|undefined;let managedVoice:ManagedVoice|undefined;let microphoneUntil=0;
async function stopVoice(){await Promise.all([voice?.stop(),managedVoice?.stop()]);}
let computer:ComputerService|undefined;
let workspaceBrowser:WorkspaceBrowser|undefined;let chromeRuntime:ChromeRuntime|undefined;
let browserOperations:Promise<unknown>=Promise.resolve();
let shuttingDown=false,starting=false,preparingClose=false;
let closeReady:((value:boolean)=>void)|undefined,closeToken:string|undefined;
let startupTask:Promise<void>|undefined;
let sessionReady=false;
let localConnection:LocalRuntimeConnection|undefined;
let activeLocalCalls=0;
function localCallSettled(){activeLocalCalls--;if(!activeLocalCalls&&localConnection?.available===false&&!preparingClose&&!shuttingDown)void localConnection.activitySettled().catch(()=>{});}
async function observeLocalFailure(error:unknown){if(localConnection)return localConnection.failed(error);throw error;}
let journalInventory:EditorJournalInventory|undefined,journalInventoryError:unknown;
const storageControl=new StorageControl();
const backupControl=new BackupControl({
 identity:()=>broker!.identity(),
 choose:async()=>{const result=await dialog.showOpenDialog(window!,{title:'Choose a private backup folder',properties:['openDirectory','createDirectory']});return result.canceled?undefined:result.filePaths[0];},
 locked:work=>broker!.backup(work),
 flush:async()=>{await browserOperations;await workspaceBrowser?.flush();if(journalInventory&&window)await preserveEditorJournalStorage(journalInventory,window.webContents);},
 capture:(parent,progress,display)=>createPortableBackup({parent,windowsCredentials:process.platform==='win32',minimumRecoveryCapability:17,name:'Sylvana-backup-'+new Date().toISOString().replaceAll(':','-')+'-'+randomUUID().slice(0,8),profile:app.getPath('userData'),publicRoot:path.join(app.getPath('home'),'Sylvana Files'),restoreHelper:path.join(resources,'runtime/Restore-Sylvana.ps1'),database:destination=>runtime!.databaseBackup(destination).then(()=>{}),references:owner=>broker!.backupReferences(owner),workspaces:(destination,owners,databaseSha)=>broker!.backupWorkspaces(destination,owners,databaseSha),image:(owner,id)=>broker!.backupImage(owner,id),settings:owner=>broker!.backupSettings(owner),checkExternalPath:file=>broker!.backupSourcePath(file),panes:owner=>broker!.backupLayouts(owner),display,window:window?{bounds:window.getNormalBounds(),maximized:window.isMaximized()}:undefined,progress}),
});
const ownsInstance=!squirrelStartup&&app.requestSingleInstanceLock();
if(!ownsInstance&&!squirrelStartup)app.quit();
app.on('second-instance',()=>{if(window?.isMinimized())window.restore();window?.show();window?.focus();});
const resources=app.isPackaged?path.join(process.resourcesPath,'resources'):path.resolve(__dirname,'../resources');
async function start(){
 if(starting)return;starting=true;sessionReady=false;
 try{
  if(journalInventoryError){await preserveEditorJournalStorage(journalInventory!,window!.webContents,true);journalInventoryError=undefined;}
  if(pendingRecovery){
   recoveryController=new AbortController();
   await runQueuedRecovery(pendingRecovery,resources,message=>{runtime!.state={phase:'migration',message,ready:false};window?.webContents.send('sylvana:runtime',runtime!.state);},{signal:recoveryController.signal});
   recoveryController.signal.throwIfAborted();
   app.relaunch();app.quit();return;
  }
  const state=await runtime!.start();
  const secrets=new Secrets(app.getPath('userData'));await secrets.load();computer?.configure(secrets);
  if(state.recoveryOnly){
   upgradeReview=new UpgradeRecoverySession({openBrowser:url=>shell.openExternal(url),env:state.env,profile:app.getPath('userData'),home:app.getPath('home'),secrets,privatePaths:[path.join(app.getPath('appData'),'Sylvana'),resources,path.dirname(app.getPath('exe')),...await registeredPrivateRuntimeStorage()],reveal:async folder=>{const error=await shell.openPath(folder);if(error)throw Error(error);}});
   await upgradeReview.initialize();sessionReady=true;window?.webContents.send('sylvana:runtime',runtime!.state);return;
  }
  await voice?.recover();
  workspaceBrowser!.attachStore(secrets);await workspaceBrowser!.uploads?.ready().catch(()=>{});
  let host=secrets.get<string>('host-id');if(!host){host='urn:uuid:'+randomUUID();await secrets.set('host-id',host);}
  const providers=new Providers(secrets,host);
  const showNotification=(owner:string,conversationId:string|undefined,title:string,body:string,child?:{requestId:string;threadId:string})=>{
   if(!Notification.isSupported()||broker?.notificationOwner!==owner)return;
   const notice=new Notification({title,body});notice.on('click',()=>{if(broker?.notificationOwner!==owner)return;window?.show();window?.focus();if(conversationId)window?.webContents.send('sylvana:notification',{owner,conversationId,...(child?{child}:{})});});notice.show();
  };
  const notifications=new ScheduledNotifications(secrets,{owner:()=>broker?.notificationOwner??null,runs:owner=>broker!.scheduled.store.runs(owner),enabled:owner=>readNotificationPreferences(secrets,owner).tasks,show:(name,status,conversationId,owner)=>{if(owner)showNotification(owner,conversationId,name,status==='completed'?'Your scheduled task has a new result.':'Your scheduled task needs attention.');}});
  const responses=new ResponseNotifications(secrets,{owner:()=>broker?.notificationOwner??null,foreground:()=>!!window?.isFocused()&&!window.isMinimized(),scheduled:async(owner,id)=>(await broker!.scheduled.store.runs(owner)).some(run=>run.requestId===id),show:alert=>showNotification(alert.owner,alert.conversationId,alert.kind==='permission'?'Permission needed':alert.kind==='question'?'Answer needed':alert.kind==='goal'?'Goal complete':alert.status==='completed'?'Response ready':'Response needs attention',alert.status==='pending'?'Open Sylvana to review the waiting request.':'Open Sylvana to review the saved result.',alert.child)});
  broker=new Broker(state.env,secrets,providers,event=>{if(event.kind==='session-ended'){void broker?.tools.stopComputer(event.ownerId);microphoneUntil=0;void stopVoice();workspaceBrowser?.closeAll();void chromeRuntime?.close();}if(!event.kind&&event.ownerId&&['completed','failed','interrupted','cancelled'].includes(event.status??'')){computer?.finishRequest(event.ownerId,event.requestId);if(localConnection?.available===false&&!preparingClose&&!shuttingDown)void localConnection.activitySettled().catch(()=>{});}window?.webContents.send('sylvana:chat',event);if(!event.kind&&['completed','failed','interrupted'].includes(event.status??'')||event.kind==='goal'||event.kind==='native'||event.kind==='native-background'||event.kind==='tool')void responses.changed(event).catch(error=>console.warn('Response notification unavailable:',error.message));if(event.kind==='schedule'&&event.ownerId)void notifications.changed(event.ownerId).catch(error=>console.warn('Scheduled notification unavailable:',error.message));},[app.getPath('userData'),path.join(app.getPath('appData'),'Sylvana'),path.dirname(app.getPath('exe')),resources,...await registeredPrivateRuntimeStorage()],path.join(app.getPath('userData'),'attachments'),path.join(resources,'runtime/terminal.ps1'));broker.tools.browser=new AgentBrowser(workspaceBrowser!);workspaceBrowser!.configureAgents(async(owner,conversation,scope)=>{if((await broker!.identity()).id!==owner)return false;const preview=scope==='agent-draft-preview',result=await broker!.admin.from(preview?'desktop_preview_sessions':'conversation_sessions').select(preview?'id':'conversation_id').eq(preview?'id':'conversation_id',conversation).eq('user_id',owner).maybeSingle();if(result.error)throw new Error('This browser conversation could not be checked.');return (await broker!.identity()).id===owner&&!!result.data;},async(owner,id)=>{const result=await broker!.admin.from('desktop_tool_calls').select('conversation_id').eq('user_id',owner).eq('name','browser_open').eq('status','completed').eq('result->>tab_id',id).limit(1).maybeSingle();if(result.error)throw new Error('Saved browser ownership could not be checked.');return result.data?.conversation_id;},async(owner,ids)=>{const result=await broker!.admin.from('conversation_sessions').select('conversation_id,title').eq('user_id',owner).in('conversation_id',ids);if(result.error)throw new Error('Browser chat titles could not be checked.');return Object.fromEntries((result.data??[]).map(row=>[row.conversation_id,(row.title||'Untitled chat').split('\n')[0].slice(0,100)]));});broker.tools.remote!.chrome=chromeRuntime;broker.tools.computer=computer;if(computer)computer.accessChanged=owner=>broker?.tools.invalidateComputer(owner);broker.native.commandIndicator={show:async(owner,key)=>{if(!computer?.indicator)throw Error('The native command indicator is unavailable.');await computer.indicator.showDesktop(owner,key);},end:(owner,key)=>computer?.indicator?.end(owner,key)};broker.previewRunner.native.commandIndicator=broker.native.commandIndicator;await broker.initialize();
  localConnection?.close();localConnection=new LocalRuntimeConnection({health:()=>runtime!.connectionHealthy(),recover:async()=>{if(preparingClose||backupControl.busy||storageControl.busy||activeLocalCalls)throw Error('Finish pending local requests or workspace maintenance before reconnecting.');await broker!.recoverLocalRuntime(()=>runtime!.reconnectExisting());},publish:(available,message)=>runtime!.connectionState(available,message)});
  sessionReady=true;window?.webContents.send('sylvana:runtime',runtime!.state);
 }catch(error){if(upgradeReview&&!sessionReady){await upgradeReview.shutdown();upgradeReview=undefined;}runtime!.state={phase:'error',message:(error as Error).message,ready:false};window?.webContents.send('sylvana:runtime',runtime!.state);}
 finally{starting=false;}
}
if(ownsInstance)app.whenReady().then(async()=>{
  if(profileProblem){dialog.showErrorBox('Could not open Sylvana data',profileProblem.message);app.quit();return;}
 const assets=path.join(resources,'ui');
 const serve=async(request:Request)=>{
  const url=new URL(request.url);
  if(url.hostname!=='app'||request.method!=='GET')return new Response('Not found',{status:404});
  if(url.pathname==='/draft-recovery-bootstrap')return new Response('<!doctype html><meta charset="utf-8"><title>Sylvana</title><p>Preserving your local drafts…</p>',{headers:{'Content-Type':'text/html','Content-Security-Policy':"default-src 'none'; base-uri 'none'; form-action 'none'"}});
  if(url.protocol!=='sylvana:')return new Response('Not found',{status:404});
  let relative:string;try{relative=decodeURIComponent(url.pathname);}catch{return new Response('Bad path',{status:400});}
  const requested=path.resolve(assets,'.'+relative);
  if(requested!==assets&&!requested.startsWith(assets+path.sep))return new Response('Forbidden',{status:403});
  const file=path.extname(requested)?requested:path.join(assets,'index.html');
  try{
   const bytes=await readFile(file);
   const types:Record<string,string>={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.ico':'image/x-icon','.woff2':'font/woff2','.ttf':'font/ttf','.otf':'font/otf','.wasm':'application/wasm'};
   return new Response(bytes,{headers:{'Content-Type':types[path.extname(file)]??'application/octet-stream',
    'Access-Control-Allow-Origin':'*',
    'Content-Security-Policy':desktopContentPolicy(relative==='/document-viewer.html')}});
  }catch{return new Response('Not found',{status:404});}
 };
 protocol.handle('sylvana',serve);
 protocol.handle(legacySlug,serve);
 await mkdir(app.getPath('userData'),{recursive:true});
 Menu.setApplicationMenu(null);
 const savedWindow=await loadWindow(app.getPath('userData'),[screen.getPrimaryDisplay(),...screen.getAllDisplays().filter(d=>d.id!==screen.getPrimaryDisplay().id)].map(d=>d.workArea));
 window=new BrowserWindow({...savedWindow.bounds,minWidth:960,minHeight:640,title:'Sylvana',backgroundColor:'#ffffff',show:false,autoHideMenuBar:true,titleBarStyle:'hidden',titleBarOverlay:{color:'#eef1f4',symbolColor:'#202123',height:32},
  webPreferences:{preload:path.join(__dirname,'preload.js'),contextIsolation:true,nodeIntegration:false,sandbox:true,webviewTag:false}});
 window.webContents.setWindowOpenHandler(()=>({action:'deny'}));
 computer=new ComputerService(resources);computer.indicator=new ComputerIndicator(undefined,signal=>computer!.client.watchEscape(()=>{const owner=broker?.notificationOwner;if(owner)void broker?.tools.stopComputer(owner,true).catch(()=>{});window?.webContents.send('sylvana:command','computer-stopped');},signal));computer.shortcut=process.platform==='win32';
 workspaceBrowser=new WorkspaceBrowser(window,undefined,path.join(app.getPath('userData'),'browser-uploads'));chromeRuntime=new ChromeRuntime(resources,app.getPath('userData'));
 window.webContents.on('did-start-navigation',(_event,_url,inPlace,main)=>{if(main&&!inPlace){broker?.workspaceMonitor.close();broker?.editor.clearLeases();workspaceBrowser?.closeAll();microphoneUntil=0;void stopVoice();}});
 window.webContents.on('render-process-gone',()=>{void broker?.tools.stopComputer().catch(()=>{});broker?.workspaceMonitor.close();broker?.editor.clearLeases();});
 window.webContents.on('will-navigate',(event,url)=>{const target=new URL(url);if(target.protocol!=='sylvana:'||target.hostname!=='app')event.preventDefault();});
 window.webContents.on('will-attach-webview',event=>event.preventDefault());
 runtime=new Runtime(resources,app.getPath('userData'),state=>{if(!state.ready&&!state.recoveryOnly||sessionReady&&state.available!==undefined)window?.webContents.send('sylvana:runtime',state);},destination=>captureAutomaticUpgradeRecovery({profile:app.getPath('userData'),home:app.getPath('home'),databaseBackup:destination,restoreHelper:path.join(resources,'runtime/Restore-Sylvana.ps1'),privatePaths:[resources,path.dirname(app.getPath('exe'))],progress:message=>{runtime!.state={phase:'backup',message,ready:false};window?.webContents.send('sylvana:runtime',runtime!.state);}}));
 const checkConnection=()=>{if(sessionReady&&!preparingClose&&!shuttingDown)void localConnection?.check().catch(()=>{});};
 powerMonitor.on('resume',checkConnection);window.on('focus',checkConnection);
 voice=new LocalVoice(resources,app.getPath('userData'),runtime);
 managedVoice=new ManagedVoice(()=>broker!.providers.account,async owner=>{if((await broker!.identity()).id!==owner)throw Error('Your Sylvana account changed during the voice request.');});
 window.webContents.session.setPermissionRequestHandler((contents,permission,callback,details)=>{
  const trusted=contents===window?.webContents&&details.requestingUrl.startsWith('sylvana://app/');
  callback(presentationFullscreenAllowed(permission,contents===window?.webContents,details)||trusted&&(permission==='clipboard-sanitized-write'||permission==='media'&&Date.now()<microphoneUntil&&'mediaTypes' in details&&!!details.mediaTypes?.length&&details.mediaTypes.every((type:string)=>type==='audio')));
 });
 window.webContents.session.setPermissionCheckHandler((contents,permission,origin,details)=>presentationFullscreenAllowed(permission,contents===window?.webContents,details)||contents===window?.webContents&&(origin==='sylvana://app'||origin.startsWith('sylvana://app/'))&&(permission==='clipboard-sanitized-write'||permission==='media'&&Date.now()<microphoneUntil&&details.mediaType!=='video'));
 ipcMain.handle('sylvana:attach',async(event,args:unknown)=>{
  if(event.senderFrame!==window?.webContents.mainFrame||!event.senderFrame?.url.startsWith('sylvana://app/'))throw new Error('Untrusted desktop caller.');
  if(!broker||!args||typeof args!=='object'||JSON.stringify(args).length>maxAttachmentRequestBytes)throw new Error('Invalid attachment request.');
  if(backupControl.busy||preparingClose)throw new Error('Wait for the backup or close operation before attaching files.');
  try{await localConnection?.require();activeLocalCalls++;try{const value=args as {owner:unknown;items:import('./contracts').AttachmentInput[]};return await broker.attach(value.owner,value.items);}finally{localCallSettled();}}catch(error){return observeLocalFailure(error);}
 });
 const desktopCall=async(event:Electron.IpcMainInvokeEvent,action:unknown,args:unknown)=>{
  if(event.senderFrame!==window?.webContents.mainFrame||!event.senderFrame?.url.startsWith('sylvana://app/'))throw new Error('Untrusted desktop caller.');
  if(typeof action!=='string'||action.length>80||args===null||(args!==undefined&&(typeof args!=='object'||Array.isArray(args)))||JSON.stringify(args??{}).length>(action==='voice.transcribe'?5500000:action==='runtime.backup'?4*1024**2+64:action.startsWith('workspace.editor.')?1000000:desktopRequestLimit(action)))throw new Error('Invalid desktop request.');
  if(action==='window.theme'){const dark=(args as Record<string,unknown>)?.dark;if(typeof dark!=='boolean')throw new Error('Invalid window theme.');window!.setTitleBarOverlay({color:dark?'#1a2226':'#eef1f4',symbolColor:dark?'#ececec':'#202123',height:32});return;}
  if(action==='window.menu'){
   const kind=(args as Record<string,unknown>)?.kind;
   const command=(name:string)=>()=>window?.webContents.send('sylvana:command',name);
   const templates:Record<string,Electron.MenuItemConstructorOptions[]>={
    file:[{label:'New chat',accelerator:'Control+Shift+O',click:command('new-chat')},{label:'Settings',accelerator:'Control+,',click:command('settings')},{type:'separator'},{label:'Close window',accelerator:'Alt+F4',click:()=>window?.close()}],
    edit:[{role:'undo'},{role:'redo'},{type:'separator'},{role:'cut'},{role:'copy'},{role:'paste'},{role:'selectAll'}],
    view:[{label:'Back',click:command('back')},{label:'Forward',click:command('forward')},{type:'separator'},{label:'Toggle chat sidebar',click:command('sidebar')},{label:'Files, canvas & browser',click:command('workspace')},{type:'separator'},{role:'resetZoom'},{role:'zoomIn'},{role:'zoomOut'},{role:'togglefullscreen'}],
    help:[{label:'About Sylvana '+app.getVersion(),click:()=>void dialog.showMessageBox(window!,{title:'Sylvana',message:'Sylvana '+app.getVersion(),detail:'Private AI workspace with PostgreSQL and Supabase.'})},{label:'Export diagnostics',click:command('diagnostics')}],
   };
   if(typeof kind!=='string'||!Object.hasOwn(templates,kind))throw new Error('Unknown application menu.');Menu.buildFromTemplate(templates[kind]).popup({window});return;
  }
  if(action==='app.version')return app.getVersion();
  if(action==='runtime.status')return (runtime!.state.ready||runtime!.state.recoveryOnly)&&!sessionReady?{phase:'session',message:'Restoring your local session…',ready:false}:runtime!.state;
  if(action==='runtime.backup.status'){if(!broker||(await broker.identity()).admin!==true)throw new Error('Administrator access is required.');return backupControl.status();}
  if(backupControl.busy)throw new Error('Wait for the workspace backup to finish before changing application data.');
  if(action==='runtime.retry'){if(upgradeReview)throw Error('Finish workspace recovery before continuing the upgrade.');if(runtime!.state.ready&&localConnection){if(!await localConnection.check(true,true))throw localRuntimeError();}else if(!runtime!.state.ready&&!starting)startupTask=start();return;}
  if(action==='runtime.prerequisites'){await shell.openExternal('https://learn.microsoft.com/windows/wsl/install');return;}
  if(action==='runtime.diagnostics'){
   const result=await dialog.showSaveDialog(window!,{title:'Export diagnostics',defaultPath:'sylvana-diagnostics.json'});
   if(result.canceled||!result.filePath)return;
   await writeFile(result.filePath,JSON.stringify({version:app.getVersion(),platform:process.platform,architecture:process.arch,runtime:runtime!.state,at:new Date().toISOString()},null,2));return result.filePath;
  }
  if(upgradeReview){
   if(!sessionReady)throw Error('The local recovery sign-in is still being restored. Wait for startup to finish.');
   if(preparingClose)throw Error('Sylvana is closing. Reopen it before reviewing recovery.');const selected=upgradeReview;
   if(action==='recovery.upgrade.cancel')return selected.call(action);
   if(action==='recovery.upgrade.continue')return storageControl.run(async()=>{await selected.beginUpgrade();await selected.shutdown();if(upgradeReview!==selected)throw Error('The recovery session changed.');upgradeReview=undefined;sessionReady=false;startupTask=start();await startupTask;});
   return storageControl.run(()=>selected.call(action,args as Record<string,unknown>|undefined));
  }
  if(!broker)throw new Error('The local database is still starting.');
  if(localConnection?.available===false){
   if(action==='computer.stop'||action==='voice.stop'){const owner=broker.notificationOwner;if(!owner)throw Error('Sign in to the account that started this work before stopping it.');if(action==='computer.stop'){await broker.tools.stopComputer(owner,true);window?.webContents.send('sylvana:command','computer-stopped');return computer!.status(owner);}microphoneUntil=0;await stopVoice();return;}
   const stopped=await broker.offlineControl(action,args as Record<string,unknown>|undefined);if(stopped.handled){void localConnection.check(true,true).catch(()=>{});return stopped.value;}
  }
  await localConnection?.require();
  activeLocalCalls++;try{return await(async()=>{
  if(action==='notifications.status'){await broker.identity();return {supported:Notification.isSupported()};}
  if(action==='permissions.commands'||action==='permissions.full'){
   const owner=await broker.identity();if(!owner.admin)throw new Error('Administrator access is required for Windows commands.');const full=action==='permissions.full';
   const answer=await dialog.showMessageBox(window!,{type:'warning',title:full?'Enable Full access?':'Enable Windows commands?',message:full?'Allow automatic file changes and Windows commands for Full access requests?':'Enable Windows commands for this Sylvana administrator?',detail:commandDisclosure+' '+(full?'Selected file context is shared with the chosen AI provider and selected file edits and commands run without individual approval. Browser, selected-window input and assigned plugin tools also follow Full access and their current grants.':'Default permissions show each agent command for review before execution. Commands you type and run in Terminal are your direct instruction.'),buttons:['Cancel',full?'Enable Full access':'Enable commands'],defaultId:0,cancelId:0});
   if(answer.response!==1)return broker.terminal.permissions(owner);const current=await broker.identity();if(current.id!==owner.id)throw new Error('Your account changed.');return broker.terminal.grant(current,full);
  }
  if(action.startsWith('computer.')){
   const owner=await broker.identity(),values=(value:unknown)=>{if(!Array.isArray(value)||value.length>5||value.some(id=>typeof id!=='string'||!/^[a-f0-9-]{36}$/i.test(id)))throw new Error('Choose up to five shared windows.');return value as string[];},input=(args??{}) as Record<string,unknown>,guard=async()=>{const current=await broker!.identity();if(current.id!==owner.id||!current.admin)throw new Error('Your computer-use permission changed.');};
   await guard();if(args!==undefined&&(args===null||typeof args!=='object'||Array.isArray(args)))throw Error('Invalid computer settings request.');
   if(action==='computer.settings')return computer!.settings(owner.id);
   if(action==='computer.settings.update')return computer!.updateSettings(owner,input,guard);
   if(action==='computer.apps')return computer!.availableApps(owner,guard);
   if(action==='computer.apps.allow')return computer!.allowApp(owner,input.id,guard);
   if(action==='computer.apps.remove')return computer!.removeApp(owner,input.id,guard);
   if(action==='computer.resume')return computer!.resume(owner,guard);
   if(action==='computer.status')return computer!.status(owner.id);
   if(action==='computer.stop'){await broker.tools.stopComputer(owner.id,true);window?.webContents.send('sylvana:command','computer-stopped');return computer!.status(owner.id);}
   if(action==='computer.preview'){if(typeof input.id!=='string'||!/^[a-f0-9-]{36}$/i.test(input.id))throw new Error('Choose an observed window.');return computer!.preview(owner,input.id);}
   if(action==='computer.references')return computer!.references(owner.id,values(input.ids));
   if(action==='computer.choices')return computer!.choicesFor(owner,values(input.existing??[]),guard);
   if(action==='computer.select')return computer!.select(owner,input.ids,input.existing,guard);
   if(action==='computer.revoke'){if(typeof input.id!=='string'||!/^[a-f0-9-]{36}$/i.test(input.id))throw new Error('Choose a shared window.');broker.tools.revokeComputer(owner.id,input.id);return;}
   throw new Error('Unsupported computer-use operation.');
  }
  if(action==='chrome.context.list'||action==='chrome.context'){
   const owner=await broker.identity(),enabled=async()=>{if((await broker!.identity()).id!==owner.id)throw Error('Your Sylvana account changed.');const plugins=await broker!.call('plugins.list') as any[];if((await broker!.identity()).id!==owner.id)throw Error('Your Sylvana account changed.');return plugins.some(plugin=>plugin.name===chromePluginName&&plugin.enabled);};
   if(!await enabled()){if(action==='chrome.context.list')return {tabs:[]};throw Error('Enable and connect Chrome before selecting its page context.');}
   const guard=async()=>{if(!await enabled())throw Error('The Chrome plugin was disabled. Select context again after reconnecting.');},signal=AbortSignal.timeout(30000);
   if(action==='chrome.context.list')return chromeRuntime!.context.list(owner.id,signal,guard);
   const value=args as any;if(typeof value?.id!=='string'||typeof value?.url!=='string')throw Error('Choose an available Chrome page.');
   return selectedBrowserSnapshot(owner.id,await chromeRuntime!.context.read(owner.id,value.id,value.url,signal,guard));
  }
  if(action.startsWith('chrome.')){const owner=await broker.identity();if(action==='chrome.status')return chromeRuntime!.status(owner.id);if(action==='chrome.disconnect'||action==='chrome.cancel'){await broker.remoteConnectionChange(owner.id,{connectionId:'mcp:'+chromeConnectionId},()=>chromeRuntime!.disconnect(owner.id));return chromeRuntime!.status(owner.id);}if(action==='chrome.connect')return broker.remoteConnectionChange(owner.id,{connectionId:'mcp:'+chromeConnectionId},()=>chromeRuntime!.connect(owner.id,(args as any)?.mode,async()=>{if((await broker!.identity()).id!==owner.id)throw new Error('Your Sylvana account changed.');const plugins=await broker!.call('plugins.list') as any[];if(!plugins.some(p=>p.name===chromePluginName&&p.enabled))throw new Error('Enable the Chrome DevTools plugin before connecting Chrome.');}));if(action==='chrome.settings'){const executable=await chromeRuntime!.chrome();if(!executable)throw new Error('Install Google Chrome first.');const child=spawn(executable,['chrome://inspect/#remote-debugging'],{windowsHide:false,detached:true,stdio:'ignore'});child.unref();return;}throw new Error('Unsupported Chrome connection operation.');}
  if(action==='browser.preview'){const owner=await broker.identity(),value=await broker.tools.browser!.pointer.preview(owner.id,(args as any)?.id);if((await broker.identity()).id!==owner.id)throw new Error('Your Sylvana account changed.');return value;}
  if(action==='browser.context'){const owner=await broker.identity(),value=args as any;if(typeof value?.id!=='string'||typeof value?.url!=='string')throw new Error('Choose an available browser page.');return selectedBrowserSnapshot(owner.id,await broker.tools.browser!.context(owner.id,value.id,value.url,AbortSignal.timeout(15000),async()=>{if((await broker!.identity()).id!==owner.id)throw new Error('Your Sylvana account changed.');}));}
  if(action.startsWith('browser.')){const operation=browserOperations.catch(()=>{}).then(async()=>{const owner=await broker!.identity();return workspaceBrowser!.call(action,args as Record<string,unknown>??{},owner.id,async()=>{if((await broker!.identity()).id!==owner.id)throw new Error('Your Sylvana account changed.');});});browserOperations=operation;return operation;}
  if(action==='auth.signOut'||action==='auth.signIn'||action==='auth.sylvanaSignIn'||action==='account.sylvanaConnect'){await broker.tools.stopComputer();await chromeRuntime?.close();workspaceBrowser?.closeAll();microphoneUntil=0;await stopVoice();}
  if(action.startsWith('voice.')){
   const owner=await broker.identity();const value=args as Record<string,unknown>|undefined;
   if(action==='voice.preferences.get'||action==='voice.preferences.save')return broker.call(action,value);
   const preferences=await broker.call('voice.preferences.get');
   const connection=preferences.connection,tier=preferences.tier;if(value?.connection!==undefined&&value.connection!==connection||value?.tier!==undefined&&value.tier!==tier)throw Error('Voice configuration is managed by your workspace administrator on the web.');
   if(!['local','sylvana'].includes(connection as string))throw Error('Choose a valid voice connection.');
   if(action==='voice.catalog')return connection==='sylvana'?managedVoice!.voices(owner.id,tier as string):voice!.voices();
   if(action==='voice.status')return connection==='sylvana'?managedVoice!.status(owner.id,preferences):voice!.status();
   if(action==='voice.prepare')return connection==='sylvana'?managedVoice!.prepare(owner.id,preferences):voice!.prepare();
   if(action==='voice.capture'){microphoneUntil=Date.now()+30000;return;}
   if(action==='voice.transcribe'){microphoneUntil=0;const result=preferences.connection==='sylvana'?await managedVoice!.transcribe(owner.id,value?.audio,preferences):await voice!.transcribe(value?.audio);if((await broker.identity()).id!==owner.id)throw new Error('Your account changed during transcription.');return result;}
   if(action==='voice.synthesize'){const result=preferences.connection==='sylvana'?await managedVoice!.synthesize(owner.id,value?.text,preferences):await voice!.synthesize(value?.text,preferences);if((await broker.identity()).id!==owner.id)throw new Error('Your account changed during speech synthesis.');return result;}
   if(action==='voice.speak'){if(connection!=='local')throw Error('Use the workspace Sylvana voice connection.');return voice!.speak(value?.text);}
   if(action==='voice.stop'){microphoneUntil=0;await stopVoice();return;}
   throw new Error('Unsupported voice operation.');
  }
  if(action==='editorRecovery.export'){
   if(preparingClose)throw Error('Sylvana is closing. Reopen it before exporting recovery.');return storageControl.run(async()=>{
    const value=args as Record<string,unknown>,owner=await broker!.identity();if(value.owner!==owner.id)throw Error('This recovery copy belongs to another account.');return exportEditorJournal({owner:owner.id,read:()=>broker!.call('editorRecovery.read',{owner:owner.id,id:value.id}),guard:async()=>{if((await broker!.identity()).id!==owner.id)throw Error('Your recovery account changed.');},checkPath:file=>broker!.files.checkPath(file),choose:async copy=>{const choice=await dialog.showSaveDialog(window!,{title:'Export retained draft',defaultPath:'Sylvana-draft-version-'+copy.id+'.json',filters:[{name:'JSON recovery copy',extensions:['json']}]});return choice.canceled?undefined:choice.filePath;}});
   });
  }
  if(action==='images.export'){
   const owner=await broker.identity(),id=(args as any)?.id;if(typeof id!=='string')throw new Error('Choose a saved generated image.');
   const image=await broker.images.asset(owner.id,id),choice=await dialog.showSaveDialog(window!,{title:'Save generated image',defaultPath:'generated-image.png',filters:[{name:'PNG image',extensions:['png']}]});
   if(choice.canceled||!choice.filePath)return {saved:false};
   if((await broker.identity()).id!==owner.id)throw new Error('Your Sylvana account changed.');
   broker.files.checkPath(choice.filePath);broker.files.checkPath(await realpath(path.dirname(choice.filePath)));const current=await broker.images.asset(owner.id,id);if(current.asset.sha256!==image.asset.sha256)throw new Error('The generated image changed.');
   await writeFile(choice.filePath,current.bytes,{flag:'wx'});return {saved:true};
  }
  if(action==='runtime.backup')return backupControl.start(cleanDisplaySnapshot((args as any)?.display??{}));
  if(action==='plugins.enable'&&(args as any)?.name===chromePluginName&&(args as any)?.enabled===false){const owner=await broker.identity(),result=await broker.call(action,args as Record<string,unknown>);await chromeRuntime?.disconnect(owner.id);return result;}
  if(action==='tasks.workspaces.cancel')return broker.call(action,args as Record<string,unknown>);
  if(action.startsWith('recovery.workspaces.')){if(preparingClose)throw Error('Sylvana is closing. Reopen it before inspecting recovery.');return storageControl.run(()=>broker!.call(action,args as Record<string,unknown>));}
  if(action.startsWith('storage.')||action.startsWith('tasks.workspaces.')){
   if(preparingClose)throw Error('Sylvana is closing. Reopen it before changing Storage.');
   return storageControl.run(async()=>{
    const owner=await broker!.identity(),result=await broker!.call(action,args as Record<string,unknown>);
    if(action==='storage.commit'&&result.kind==='chat')await workspaceBrowser!.forgetConversation(owner.id,String(result.itemId),async()=>{if((await broker!.identity()).id!==owner.id)throw Error('Your Sylvana account changed.');});
    if(action==='storage.commitChats')for(const deleted of result.deleted){try{if((await broker!.identity()).id!==owner.id)throw Error('Your Sylvana account changed.');await workspaceBrowser!.forgetConversation(owner.id,String(deleted.itemId),async()=>{if((await broker!.identity()).id!==owner.id)throw Error('Your Sylvana account changed.');});}catch{(result.workspaceWarnings??=[]).push(String(deleted.itemId));}}
    return result;
   });
  }
  if(action==='conversations.manage'&&(args as any)?.action==='delete'){const owner=await broker.identity(),result=await broker.call(action,args as Record<string,unknown>);await workspaceBrowser!.forgetConversation(owner.id,String((args as any).conversationId),async()=>{if((await broker!.identity()).id!==owner.id)throw new Error('Your Sylvana account changed.');});return result;}
  return await broker.call(action,args as Record<string,unknown>|undefined);
  })();}finally{localCallSettled();}
 };
 ipcMain.handle('sylvana:call',async(event,action:unknown,args:unknown)=>{try{return await desktopCall(event,action,args);}catch(error){return observeLocalFailure(error);}});
 // Inspect the existing private origin before app scripts or a runtime upgrade
 // can change it. A capture failure holds startup and leaves the source intact.
 if(!pendingRecovery){await migrateBrandBrowserStorage(app.getPath('userData'),{getURL:()=>window!.webContents.getURL(),loadURL:url=>window!.loadURL(url),webContents:window.webContents});journalInventory=new EditorJournalInventory(app.getPath('userData'));await window.loadURL('sylvana://app/draft-recovery-bootstrap');try{await preserveEditorJournalStorage(journalInventory,window.webContents,true);}catch(error){journalInventoryError=error;}}
 if(savedWindow.maximized)window.maximize();await window.loadURL('sylvana://app/login');window.show();
 ipcMain.on('sylvana:close-ready',(event,value)=>{if(event.senderFrame===window?.webContents.mainFrame&&value?.token===closeToken)closeReady?.(!value.error);});
 window.on('close',event=>{
  if(shuttingDown)return;event.preventDefault();if(preparingClose)return;preparingClose=true;
  void (async()=>{
   await backupControl.beforeClose();
   await storageControl.beforeClose();
   let timer:ReturnType<typeof setTimeout>|undefined;
   const flushed=await new Promise<boolean>(resolve=>{closeToken=randomUUID();closeReady=resolve;timer=setTimeout(()=>resolve(false),5000);window?.webContents.send('sylvana:before-close',closeToken);});
   clearTimeout(timer);closeToken=undefined;closeReady=undefined;
   if(!flushed&&broker){const answer=await dialog.showMessageBox(window!,{type:'warning',title:'Drafts still saving',message:'The latest edits and unsent messages could not be saved to local draft storage.',detail:'Keep Sylvana open to retry, or close with only the last acknowledged draft.',buttons:['Keep open','Close anyway'],defaultId:0,cancelId:0});if(answer.response===0){preparingClose=false;backupControl.keepOpen();storageControl.keepOpen();return;}}
   if(window)await saveWindow(app.getPath('userData'),{bounds:window.getNormalBounds(),maximized:window.isMaximized()}).catch(()=>{});
   shuttingDown=true;window?.webContents.send('sylvana:runtime',{phase:'shutdown',message:'Saving pending responses and stopping your runtime…',ready:false});
   localConnection?.close();microphoneUntil=0;workspaceBrowser?.stop();recoveryController?.abort();
   try{globalShortcut.unregisterAll();await workspaceBrowser?.flush().catch(()=>{});await startupTask;await upgradeReview?.shutdown();await stopVoice();await broker?.shutdown();await workspaceBrowser?.flush().catch(()=>{});await chromeRuntime?.close();await runtime?.stop();}catch{}finally{computer?.indicator?.dispose();app.exit(0);}
  })();
 });
 startupTask=start();
});
app.on('window-all-closed',()=>{if(!shuttingDown)app.quit();});
