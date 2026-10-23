import {maxAttachmentRequestBytes} from './image-limits';
import {desktopContentPolicy} from './desktop-content-policy';
import {presentationFullscreenAllowed} from './presentation-permission';
import {selectedBrowserSnapshot} from './selected-context';
import {desktopRequestLimit} from './request-limits';
import {ScheduledNotifications} from './scheduled-notifications';
import {ResponseNotifications} from './response-notifications';
import {readNotificationPreferences} from './notification-preferences';
import {ComputerService} from './computer-service';
import {desktopProfile} from './desktop-profile';
import {registeredPrivateRuntimeStorage} from './private-runtime-storage';
import {ChromeRuntime} from './chrome-runtime';
import {chromePluginName} from './chrome-contracts';
import {spawn} from 'node:child_process';
import {AgentBrowser} from './agent-browser';
import {app,BrowserWindow,Notification,protocol,ipcMain,dialog,shell,screen,Menu,globalShortcut} from 'electron';
import {readFile,writeFile,mkdir,realpath} from 'node:fs/promises';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {Runtime} from './runtime';
import {Secrets} from './secrets';
import {Providers} from './providers';
import {Broker} from './broker';
import {LocalVoice} from './voice';
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
app.setName('Agentopia');
app.setAppUserModelId('com.squirrel.AgentopiaDesktop.Agentopia');
const squirrelStartup=require('electron-squirrel-startup') as boolean;
let profileProblem:Error|undefined;
let pendingRecovery:QueuedRecovery|undefined;
let recoveryController:AbortController|undefined;
if(process.env.AGENTOPIA_TEST_PROFILE){
 const name=process.env.AGENTOPIA_TEST_PROFILE;if(!/^[a-z0-9-]+$/.test(name))throw new Error('Invalid test profile');
 app.setPath('userData',path.join(app.getPath('appData'),'Agentopia','test-profiles',name));
}else if(!squirrelStartup){
 try{
  const current=app.getPath('userData'),directory=desktopProfile({platform:process.platform,packaged:app.isPackaged,testProfile:false,exe:app.getPath('exe'),appData:app.getPath('appData'),home:app.getPath('home'),current});
  if(directory!==current){app.setPath('userData',directory);app.setPath('sessionData',directory);}
  pendingRecovery=queuedRecovery(app.getPath('home'),app.getPath('appData'),directory);
  if(pendingRecovery){app.setPath('userData',pendingRecovery.bootstrap);app.setPath('sessionData',pendingRecovery.bootstrap);}
 }catch(error){profileProblem=new Error('Agentopia could not open its saved profile or recovery request. '+(error instanceof Error?error.message:'Existing data has been preserved.'));}
}
protocol.registerSchemesAsPrivileged([{scheme:'agentopia',privileges:{standard:true,secure:true,supportFetchAPI:true,corsEnabled:true}}]);
let window:BrowserWindow|undefined;
let runtime:Runtime|undefined;
let broker:Broker|undefined;
let upgradeReview:UpgradeRecoverySession|undefined;
let voice:LocalVoice|undefined;let microphoneUntil=0;
let computer:ComputerService|undefined;
let workspaceBrowser:WorkspaceBrowser|undefined;let chromeRuntime:ChromeRuntime|undefined;
let browserOperations:Promise<unknown>=Promise.resolve();
let shuttingDown=false,starting=false,preparingClose=false;
let closeReady:((value:boolean)=>void)|undefined,closeToken:string|undefined;
let startupTask:Promise<void>|undefined;
let sessionReady=false;
const storageControl=new StorageControl();
const backupControl=new BackupControl({
 identity:()=>broker!.identity(),
 choose:async()=>{const result=await dialog.showOpenDialog(window!,{title:'Choose a private backup folder',properties:['openDirectory','createDirectory']});return result.canceled?undefined:result.filePaths[0];},
 locked:work=>broker!.backup(work),
 flush:async()=>{await browserOperations;await workspaceBrowser?.flush();},
 capture:(parent,progress,display)=>createPortableBackup({parent,name:'Agentopia-backup-'+new Date().toISOString().replaceAll(':','-')+'-'+randomUUID().slice(0,8),profile:app.getPath('userData'),publicRoot:path.join(app.getPath('home'),'Agentopia Files'),restoreHelper:path.join(resources,'runtime/Restore-Agentopia.ps1'),database:destination=>runtime!.databaseBackup(destination).then(()=>{}),references:owner=>broker!.backupReferences(owner),workspaces:(destination,owners,databaseSha)=>broker!.backupWorkspaces(destination,owners,databaseSha),image:(owner,id)=>broker!.backupImage(owner,id),settings:owner=>broker!.backupSettings(owner),checkExternalPath:file=>broker!.backupSourcePath(file),panes:owner=>broker!.backupLayouts(owner),display,window:window?{bounds:window.getNormalBounds(),maximized:window.isMaximized()}:undefined,progress}),
});
const ownsInstance=!squirrelStartup&&app.requestSingleInstanceLock();
if(!ownsInstance&&!squirrelStartup)app.quit();
app.on('second-instance',()=>{if(window?.isMinimized())window.restore();window?.show();window?.focus();});
const resources=app.isPackaged?path.join(process.resourcesPath,'resources'):path.resolve(__dirname,'../resources');
async function start(){
 if(starting)return;starting=true;sessionReady=false;
 try{
  if(pendingRecovery){
   recoveryController=new AbortController();
   await runQueuedRecovery(pendingRecovery,resources,message=>{runtime!.state={phase:'migration',message,ready:false};window?.webContents.send('agentopia:runtime',runtime!.state);},{signal:recoveryController.signal});
   recoveryController.signal.throwIfAborted();
   app.relaunch();app.quit();return;
  }
  const state=await runtime!.start();
  const secrets=new Secrets(app.getPath('userData'));await secrets.load();
  if(state.recoveryOnly){
   upgradeReview=new UpgradeRecoverySession({env:state.env,profile:app.getPath('userData'),home:app.getPath('home'),secrets,privatePaths:[path.join(app.getPath('appData'),'Agentopia'),resources,path.dirname(app.getPath('exe')),...await registeredPrivateRuntimeStorage()],reveal:async folder=>{const error=await shell.openPath(folder);if(error)throw Error(error);}});
   await upgradeReview.initialize();sessionReady=true;window?.webContents.send('agentopia:runtime',runtime!.state);return;
  }
  await voice?.recover();
  workspaceBrowser!.attachStore(secrets);await workspaceBrowser!.uploads?.ready().catch(()=>{});
  let host=secrets.get<string>('host-id');if(!host){host='urn:uuid:'+randomUUID();await secrets.set('host-id',host);}
  const providers=new Providers(secrets,host);
  const showNotification=(owner:string,conversationId:string|undefined,title:string,body:string,child?:{requestId:string;threadId:string})=>{
   if(!Notification.isSupported()||broker?.notificationOwner!==owner)return;
   const notice=new Notification({title,body});notice.on('click',()=>{if(broker?.notificationOwner!==owner)return;window?.show();window?.focus();if(conversationId)window?.webContents.send('agentopia:notification',{owner,conversationId,...(child?{child}:{})});});notice.show();
  };
  const notifications=new ScheduledNotifications(secrets,{owner:()=>broker?.notificationOwner??null,runs:owner=>broker!.scheduled.store.runs(owner),enabled:owner=>readNotificationPreferences(secrets,owner).tasks,show:(name,status,conversationId,owner)=>{if(owner)showNotification(owner,conversationId,name,status==='completed'?'Your scheduled task has a new result.':'Your scheduled task needs attention.');}});
  const responses=new ResponseNotifications(secrets,{owner:()=>broker?.notificationOwner??null,foreground:()=>!!window?.isFocused()&&!window.isMinimized(),scheduled:async(owner,id)=>(await broker!.scheduled.store.runs(owner)).some(run=>run.requestId===id),show:alert=>showNotification(alert.owner,alert.conversationId,alert.kind==='permission'?'Permission needed':alert.kind==='question'?'Answer needed':alert.kind==='goal'?'Goal complete':alert.status==='completed'?'Response ready':'Response needs attention',alert.status==='pending'?'Open Agentopia to review the waiting request.':'Open Agentopia to review the saved result.',alert.child)});
  broker=new Broker(state.env,secrets,providers,event=>{window?.webContents.send('agentopia:chat',event);if(!event.kind&&['completed','failed','interrupted'].includes(event.status??'')||event.kind==='goal'||event.kind==='native'||event.kind==='native-background'||event.kind==='tool')void responses.changed(event).catch(error=>console.warn('Response notification unavailable:',error.message));if(event.kind==='schedule'&&event.ownerId)void notifications.changed(event.ownerId).catch(error=>console.warn('Scheduled notification unavailable:',error.message));},[app.getPath('userData'),path.join(app.getPath('appData'),'Agentopia'),path.dirname(app.getPath('exe')),resources,...await registeredPrivateRuntimeStorage()],path.join(app.getPath('userData'),'attachments'),path.join(resources,'runtime/terminal.ps1'));broker.tools.browser=new AgentBrowser(workspaceBrowser!);workspaceBrowser!.configureAgents(async(owner,conversation)=>{if((await broker!.identity()).id!==owner)return false;const result=await broker!.admin.from('conversation_sessions').select('conversation_id').eq('conversation_id',conversation).eq('user_id',owner).maybeSingle();if(result.error)throw new Error('This browser conversation could not be checked.');return (await broker!.identity()).id===owner&&!!result.data;},async(owner,id)=>{const result=await broker!.admin.from('desktop_tool_calls').select('conversation_id').eq('user_id',owner).eq('name','browser_open').eq('status','completed').eq('result->>tab_id',id).limit(1).maybeSingle();if(result.error)throw new Error('Saved browser ownership could not be checked.');return result.data?.conversation_id;},async(owner,ids)=>{const result=await broker!.admin.from('conversation_sessions').select('conversation_id,title').eq('user_id',owner).in('conversation_id',ids);if(result.error)throw new Error('Browser chat titles could not be checked.');return Object.fromEntries((result.data??[]).map(row=>[row.conversation_id,(row.title||'Untitled chat').split('\n')[0].slice(0,100)]));});broker.tools.remote!.chrome=chromeRuntime;broker.tools.computer=computer;await broker.initialize();
  sessionReady=true;window?.webContents.send('agentopia:runtime',runtime!.state);
 }catch(error){if(upgradeReview&&!sessionReady){await upgradeReview.shutdown();upgradeReview=undefined;}runtime!.state={phase:'error',message:(error as Error).message,ready:false};window?.webContents.send('agentopia:runtime',runtime!.state);}
 finally{starting=false;}
}
if(ownsInstance)app.whenReady().then(async()=>{
  if(profileProblem){dialog.showErrorBox('Could not open Agentopia data',profileProblem.message);app.quit();return;}
 const assets=path.join(resources,'ui');
 protocol.handle('agentopia',async request=>{
  const url=new URL(request.url);
  if(url.hostname!=='app'||request.method!=='GET')return new Response('Not found',{status:404});
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
 });
 await mkdir(app.getPath('userData'),{recursive:true});
 Menu.setApplicationMenu(null);
 const savedWindow=await loadWindow(app.getPath('userData'),[screen.getPrimaryDisplay(),...screen.getAllDisplays().filter(d=>d.id!==screen.getPrimaryDisplay().id)].map(d=>d.workArea));
 window=new BrowserWindow({...savedWindow.bounds,minWidth:960,minHeight:640,title:'Agentopia',backgroundColor:'#ffffff',show:false,autoHideMenuBar:true,titleBarStyle:'hidden',titleBarOverlay:{color:'#eef1f4',symbolColor:'#202123',height:32},
  webPreferences:{preload:path.join(__dirname,'preload.js'),contextIsolation:true,nodeIntegration:false,sandbox:true,webviewTag:false}});
 window.webContents.setWindowOpenHandler(()=>({action:'deny'}));
 computer=new ComputerService(resources);computer.shortcut=globalShortcut.register('Control+Alt+Backspace',()=>{void broker?.tools.stopComputer().catch(()=>{});window?.webContents.send('agentopia:command','computer-stopped');});
 workspaceBrowser=new WorkspaceBrowser(window,undefined,path.join(app.getPath('userData'),'browser-uploads'));chromeRuntime=new ChromeRuntime(resources,app.getPath('userData'));
 window.webContents.on('did-start-navigation',(_event,_url,inPlace,main)=>{if(main&&!inPlace){broker?.workspaceMonitor.close();broker?.editor.clearLeases();workspaceBrowser?.closeAll();microphoneUntil=0;void voice?.stop();}});
 window.webContents.on('render-process-gone',()=>{void broker?.tools.stopComputer().catch(()=>{});broker?.workspaceMonitor.close();broker?.editor.clearLeases();});
 window.webContents.on('will-navigate',(event,url)=>{const target=new URL(url);if(target.protocol!=='agentopia:'||target.hostname!=='app')event.preventDefault();});
 window.webContents.on('will-attach-webview',event=>event.preventDefault());
 runtime=new Runtime(resources,app.getPath('userData'),state=>{if(!state.ready&&!state.recoveryOnly)window?.webContents.send('agentopia:runtime',state);},destination=>captureAutomaticUpgradeRecovery({profile:app.getPath('userData'),home:app.getPath('home'),databaseBackup:destination,restoreHelper:path.join(resources,'runtime/Restore-Agentopia.ps1'),privatePaths:[resources,path.dirname(app.getPath('exe'))],progress:message=>{runtime!.state={phase:'backup',message,ready:false};window?.webContents.send('agentopia:runtime',runtime!.state);}}));
 voice=new LocalVoice(resources,app.getPath('userData'),runtime);
 window.webContents.session.setPermissionRequestHandler((contents,permission,callback,details)=>{
  const trusted=contents===window?.webContents&&details.requestingUrl.startsWith('agentopia://app/');
  callback(presentationFullscreenAllowed(permission,contents===window?.webContents,details)||trusted&&(permission==='clipboard-sanitized-write'||permission==='media'&&Date.now()<microphoneUntil&&'mediaTypes' in details&&!!details.mediaTypes?.length&&details.mediaTypes.every((type:string)=>type==='audio')));
 });
 window.webContents.session.setPermissionCheckHandler((contents,permission,origin,details)=>presentationFullscreenAllowed(permission,contents===window?.webContents,details)||contents===window?.webContents&&(origin==='agentopia://app'||origin.startsWith('agentopia://app/'))&&(permission==='clipboard-sanitized-write'||permission==='media'&&Date.now()<microphoneUntil&&details.mediaType!=='video'));
 ipcMain.handle('agentopia:attach',async(event,args:unknown)=>{
  if(event.senderFrame!==window?.webContents.mainFrame||!event.senderFrame?.url.startsWith('agentopia://app/'))throw new Error('Untrusted desktop caller.');
  if(!broker||!args||typeof args!=='object'||JSON.stringify(args).length>maxAttachmentRequestBytes)throw new Error('Invalid attachment request.');
  if(backupControl.busy||preparingClose)throw new Error('Wait for the backup or close operation before attaching files.');
  const value=args as {owner:unknown;items:import('./contracts').AttachmentInput[]};return broker.attach(value.owner,value.items);
 });
 ipcMain.handle('agentopia:call',async(event,action:unknown,args:unknown)=>{
  if(event.senderFrame!==window?.webContents.mainFrame||!event.senderFrame?.url.startsWith('agentopia://app/'))throw new Error('Untrusted desktop caller.');
  if(typeof action!=='string'||action.length>80||args===null||(args!==undefined&&(typeof args!=='object'||Array.isArray(args)))||JSON.stringify(args??{}).length>(action==='voice.transcribe'?5500000:action==='runtime.backup'?4*1024**2+64:action.startsWith('workspace.editor.')?1000000:desktopRequestLimit(action)))throw new Error('Invalid desktop request.');
  if(action==='window.theme'){const dark=(args as Record<string,unknown>)?.dark;if(typeof dark!=='boolean')throw new Error('Invalid window theme.');window!.setTitleBarOverlay({color:dark?'#1c2429':'#eef1f4',symbolColor:dark?'#ececec':'#202123',height:32});return;}
  if(action==='window.menu'){
   const kind=(args as Record<string,unknown>)?.kind;
   const command=(name:string)=>()=>window?.webContents.send('agentopia:command',name);
   const templates:Record<string,Electron.MenuItemConstructorOptions[]>={
    file:[{label:'New chat',accelerator:'Control+Shift+O',click:command('new-chat')},{label:'Settings',accelerator:'Control+,',click:command('settings')},{type:'separator'},{label:'Close window',accelerator:'Alt+F4',click:()=>window?.close()}],
    edit:[{role:'undo'},{role:'redo'},{type:'separator'},{role:'cut'},{role:'copy'},{role:'paste'},{role:'selectAll'}],
    view:[{label:'Back',click:command('back')},{label:'Forward',click:command('forward')},{type:'separator'},{label:'Toggle chat sidebar',click:command('sidebar')},{label:'Files, canvas & browser',click:command('workspace')},{type:'separator'},{role:'resetZoom'},{role:'zoomIn'},{role:'zoomOut'},{role:'togglefullscreen'}],
    help:[{label:'About Agentopia '+app.getVersion(),click:()=>void dialog.showMessageBox(window!,{title:'Agentopia',message:'Agentopia '+app.getVersion(),detail:'Private AI workspace with PostgreSQL and Supabase.'})},{label:'Export diagnostics',click:command('diagnostics')}],
   };
   if(typeof kind!=='string'||!Object.hasOwn(templates,kind))throw new Error('Unknown application menu.');Menu.buildFromTemplate(templates[kind]).popup({window});return;
  }
  if(action==='runtime.status')return (runtime!.state.ready||runtime!.state.recoveryOnly)&&!sessionReady?{phase:'session',message:'Restoring your local session…',ready:false}:runtime!.state;
  if(action==='runtime.backup.status'){if(!broker||(await broker.identity()).admin!==true)throw new Error('Administrator access is required.');return backupControl.status();}
  if(backupControl.busy)throw new Error('Wait for the workspace backup to finish before changing application data.');
  if(action==='runtime.retry'){if(upgradeReview)throw Error('Finish workspace recovery before continuing the upgrade.');if(!runtime!.state.ready)startupTask=start();return;}
  if(action==='runtime.prerequisites'){await shell.openExternal('https://learn.microsoft.com/windows/wsl/install');return;}
  if(action==='runtime.diagnostics'){
   const result=await dialog.showSaveDialog(window!,{title:'Export diagnostics',defaultPath:'agentopia-diagnostics.json'});
   if(result.canceled||!result.filePath)return;
   await writeFile(result.filePath,JSON.stringify({version:app.getVersion(),platform:process.platform,architecture:process.arch,runtime:runtime!.state,at:new Date().toISOString()},null,2));return result.filePath;
  }
  if(upgradeReview){
   if(!sessionReady)throw Error('The local recovery sign-in is still being restored. Wait for startup to finish.');
   if(preparingClose)throw Error('Agentopia is closing. Reopen it before reviewing recovery.');const selected=upgradeReview;
   if(action==='recovery.upgrade.continue')return storageControl.run(async()=>{await selected.beginUpgrade();await selected.shutdown();if(upgradeReview!==selected)throw Error('The recovery session changed.');upgradeReview=undefined;sessionReady=false;startupTask=start();await startupTask;});
   return storageControl.run(()=>selected.call(action,args as Record<string,unknown>|undefined));
  }
  if(!broker)throw new Error('The local database is still starting.');
  if(action==='notifications.status'){await broker.identity();return {supported:Notification.isSupported()};}
  if(action==='permissions.commands'||action==='permissions.full'){
   const owner=await broker.identity();if(!owner.admin)throw new Error('Administrator access is required for Windows commands.');const full=action==='permissions.full';
   const answer=await dialog.showMessageBox(window!,{type:'warning',title:full?'Enable Full access?':'Enable Windows commands?',message:full?'Allow automatic file changes and Windows commands for Full access requests?':'Enable Windows commands for this Agentopia administrator?',detail:commandDisclosure+' '+(full?'Selected file context is shared with the chosen AI provider and selected file edits and commands run without individual approval. Browser, selected-window input and assigned plugin tools also follow Full access and their current grants.':'Default permissions show each agent command for review before execution. Commands you type and run in Terminal are your direct instruction.'),buttons:['Cancel',full?'Enable Full access':'Enable commands'],defaultId:0,cancelId:0});
   if(answer.response!==1)return broker.terminal.permissions(owner);const current=await broker.identity();if(current.id!==owner.id)throw new Error('Your account changed.');return broker.terminal.grant(current,full);
  }
  if(action.startsWith('computer.')){
   const owner=await broker.identity(),values=(value:unknown)=>{if(!Array.isArray(value)||value.length>5||value.some(id=>typeof id!=='string'||!/^[a-f0-9-]{36}$/i.test(id)))throw new Error('Choose up to five shared windows.');return value as string[];},input=(args??{}) as Record<string,unknown>,guard=async()=>{const current=await broker!.identity();if(current.id!==owner.id||!current.admin)throw new Error('Your computer-use permission changed.');};
   if(action==='computer.status')return computer!.status(owner.id);
   if(action==='computer.stop'){await broker.tools.stopComputer(owner.id);window?.webContents.send('agentopia:command','computer-stopped');return computer!.status(owner.id);}
   if(action==='computer.preview'){if(typeof input.id!=='string'||!/^[a-f0-9-]{36}$/i.test(input.id))throw new Error('Choose an observed window.');return computer!.preview(owner,input.id);}
   if(action==='computer.references')return computer!.references(owner.id,values(input.ids));
   if(action==='computer.choices')return computer!.choicesFor(owner,values(input.existing??[]),guard);
   if(action==='computer.select')return computer!.select(owner,input.ids,input.existing,guard);
   if(action==='computer.revoke'){if(typeof input.id!=='string'||!/^[a-f0-9-]{36}$/i.test(input.id))throw new Error('Choose a shared window.');broker.tools.revokeComputer(owner.id,input.id);return;}
   throw new Error('Unsupported computer-use operation.');
  }
  if(action==='chrome.context.list'||action==='chrome.context'){
   const owner=await broker.identity(),enabled=async()=>{if((await broker!.identity()).id!==owner.id)throw Error('Your Agentopia account changed.');const plugins=await broker!.call('plugins.list') as any[];if((await broker!.identity()).id!==owner.id)throw Error('Your Agentopia account changed.');return plugins.some(plugin=>plugin.name===chromePluginName&&plugin.enabled);};
   if(!await enabled()){if(action==='chrome.context.list')return {tabs:[]};throw Error('Enable and connect Chrome before selecting its page context.');}
   const guard=async()=>{if(!await enabled())throw Error('The Chrome plugin was disabled. Select context again after reconnecting.');},signal=AbortSignal.timeout(30000);
   if(action==='chrome.context.list')return chromeRuntime!.context.list(owner.id,signal,guard);
   const value=args as any;if(typeof value?.id!=='string'||typeof value?.url!=='string')throw Error('Choose an available Chrome page.');
   return selectedBrowserSnapshot(owner.id,await chromeRuntime!.context.read(owner.id,value.id,value.url,signal,guard));
  }
  if(action.startsWith('chrome.')){const owner=await broker.identity();if(action==='chrome.status')return chromeRuntime!.status(owner.id);if(action==='chrome.disconnect'||action==='chrome.cancel'){await chromeRuntime!.disconnect(owner.id);return chromeRuntime!.status(owner.id);}if(action==='chrome.connect')return chromeRuntime!.connect(owner.id,(args as any)?.mode,async()=>{if((await broker!.identity()).id!==owner.id)throw new Error('Your Agentopia account changed.');const plugins=await broker!.call('plugins.list') as any[];if(!plugins.some(p=>p.name===chromePluginName&&p.enabled))throw new Error('Enable the Chrome DevTools plugin before connecting Chrome.');});if(action==='chrome.settings'){const executable=await chromeRuntime!.chrome();if(!executable)throw new Error('Install Google Chrome first.');const child=spawn(executable,['chrome://inspect/#remote-debugging'],{windowsHide:false,detached:true,stdio:'ignore'});child.unref();return;}throw new Error('Unsupported Chrome connection operation.');}
  if(action==='browser.preview'){const owner=await broker.identity(),value=await broker.tools.browser!.pointer.preview(owner.id,(args as any)?.id);if((await broker.identity()).id!==owner.id)throw new Error('Your Agentopia account changed.');return value;}
  if(action==='browser.context'){const owner=await broker.identity(),value=args as any;if(typeof value?.id!=='string'||typeof value?.url!=='string')throw new Error('Choose an available browser page.');return selectedBrowserSnapshot(owner.id,await broker.tools.browser!.context(owner.id,value.id,value.url,AbortSignal.timeout(15000),async()=>{if((await broker!.identity()).id!==owner.id)throw new Error('Your Agentopia account changed.');}));}
  if(action.startsWith('browser.')){const operation=browserOperations.catch(()=>{}).then(async()=>{const owner=await broker!.identity();return workspaceBrowser!.call(action,args as Record<string,unknown>??{},owner.id,async()=>{if((await broker!.identity()).id!==owner.id)throw new Error('Your Agentopia account changed.');});});browserOperations=operation;return operation;}
  if(action==='auth.signOut'||action==='auth.signIn'){await broker.tools.stopComputer();await chromeRuntime?.close();workspaceBrowser?.closeAll();microphoneUntil=0;await voice?.stop();}
  if(action.startsWith('voice.')){
   const owner=await broker.identity();const value=args as Record<string,unknown>|undefined;
   if(action==='voice.preferences.get'||action==='voice.preferences.save')return broker.call(action,value);
   if(action==='voice.catalog')return voice!.voices();
   if(action==='voice.status')return voice!.status();
   if(action==='voice.prepare')return voice!.prepare();
   if(action==='voice.capture'){microphoneUntil=Date.now()+30000;return;}
   if(action==='voice.transcribe'){microphoneUntil=0;const result=await voice!.transcribe(value?.audio);if((await broker.identity()).id!==owner.id)throw new Error('Your account changed during transcription.');return result;}
   if(action==='voice.synthesize'){const preferences=await broker.call('voice.preferences.get');const result=await voice!.synthesize(value?.text,preferences);if((await broker.identity()).id!==owner.id)throw new Error('Your account changed during speech synthesis.');return result;}
   if(action==='voice.speak')return voice!.speak(value?.text);
   if(action==='voice.stop'){microphoneUntil=0;await voice!.stop();return;}
   throw new Error('Unsupported voice operation.');
  }
  if(action==='images.export'){
   const owner=await broker.identity(),id=(args as any)?.id;if(typeof id!=='string')throw new Error('Choose a saved generated image.');
   const image=await broker.images.asset(owner.id,id),choice=await dialog.showSaveDialog(window!,{title:'Save generated image',defaultPath:'generated-image.png',filters:[{name:'PNG image',extensions:['png']}]});
   if(choice.canceled||!choice.filePath)return {saved:false};
   if((await broker.identity()).id!==owner.id)throw new Error('Your Agentopia account changed.');
   broker.files.checkPath(choice.filePath);broker.files.checkPath(await realpath(path.dirname(choice.filePath)));const current=await broker.images.asset(owner.id,id);if(current.asset.sha256!==image.asset.sha256)throw new Error('The generated image changed.');
   await writeFile(choice.filePath,current.bytes,{flag:'wx'});return {saved:true};
  }
  if(action==='runtime.backup')return backupControl.start(cleanDisplaySnapshot((args as any)?.display??{}));
  if(action==='plugins.enable'&&(args as any)?.name===chromePluginName&&(args as any)?.enabled===false){const owner=await broker.identity(),result=await broker.call(action,args as Record<string,unknown>);await chromeRuntime?.disconnect(owner.id);return result;}
  if(action==='tasks.workspaces.cancel')return broker.call(action,args as Record<string,unknown>);
  if(action.startsWith('recovery.workspaces.')){if(preparingClose)throw Error('Agentopia is closing. Reopen it before inspecting recovery.');return storageControl.run(()=>broker!.call(action,args as Record<string,unknown>));}
  if(action.startsWith('storage.')||action.startsWith('tasks.workspaces.')){
   if(preparingClose)throw Error('Agentopia is closing. Reopen it before changing Storage.');
   return storageControl.run(async()=>{
    const owner=await broker!.identity(),result=await broker!.call(action,args as Record<string,unknown>);
    if(action==='storage.commit'&&result.kind==='chat')await workspaceBrowser!.forgetConversation(owner.id,String(result.itemId),async()=>{if((await broker!.identity()).id!==owner.id)throw Error('Your Agentopia account changed.');});
    if(action==='storage.commitChats')for(const deleted of result.deleted){try{if((await broker!.identity()).id!==owner.id)throw Error('Your Agentopia account changed.');await workspaceBrowser!.forgetConversation(owner.id,String(deleted.itemId),async()=>{if((await broker!.identity()).id!==owner.id)throw Error('Your Agentopia account changed.');});}catch{(result.workspaceWarnings??=[]).push(String(deleted.itemId));}}
    return result;
   });
  }
  if(action==='conversations.manage'&&(args as any)?.action==='delete'){const owner=await broker.identity(),result=await broker.call(action,args as Record<string,unknown>);await workspaceBrowser!.forgetConversation(owner.id,String((args as any).conversationId),async()=>{if((await broker!.identity()).id!==owner.id)throw new Error('Your Agentopia account changed.');});return result;}
  return broker.call(action,args as Record<string,unknown>|undefined);
 });
 if(savedWindow.maximized)window.maximize();await window.loadURL('agentopia://app/login');window.show();
 ipcMain.on('agentopia:close-ready',(event,value)=>{if(event.senderFrame===window?.webContents.mainFrame&&value?.token===closeToken)closeReady?.(!value.error);});
 window.on('close',event=>{
  if(shuttingDown)return;event.preventDefault();if(preparingClose)return;preparingClose=true;
  void (async()=>{
   await backupControl.beforeClose();
   await storageControl.beforeClose();
   let timer:ReturnType<typeof setTimeout>|undefined;
   const flushed=await new Promise<boolean>(resolve=>{closeToken=randomUUID();closeReady=resolve;timer=setTimeout(()=>resolve(false),5000);window?.webContents.send('agentopia:before-close',closeToken);});
   clearTimeout(timer);closeToken=undefined;closeReady=undefined;
   if(!flushed&&broker){const answer=await dialog.showMessageBox(window!,{type:'warning',title:'Drafts still saving',message:'The latest edits and unsent messages could not be saved to local draft storage.',detail:'Keep Agentopia open to retry, or close with only the last acknowledged draft.',buttons:['Keep open','Close anyway'],defaultId:0,cancelId:0});if(answer.response===0){preparingClose=false;backupControl.keepOpen();storageControl.keepOpen();return;}}
   if(window)await saveWindow(app.getPath('userData'),{bounds:window.getNormalBounds(),maximized:window.isMaximized()}).catch(()=>{});
   shuttingDown=true;window?.webContents.send('agentopia:runtime',{phase:'shutdown',message:'Saving pending responses and stopping your runtime…',ready:false});
   microphoneUntil=0;workspaceBrowser?.stop();recoveryController?.abort();
   try{globalShortcut.unregisterAll();await workspaceBrowser?.flush().catch(()=>{});await startupTask;await upgradeReview?.shutdown();await voice?.stop();await broker?.shutdown();await workspaceBrowser?.flush().catch(()=>{});await chromeRuntime?.close();await runtime?.stop();}catch{}finally{app.exit(0);}
  })();
 });
 startupTask=start();
});
app.on('window-all-closed',()=>{if(!shuttingDown)app.quit();});
