import {BrowserUploads} from './browser-uploads';
import {BrowserWindow,WebContentsView,session} from 'electron';
import {BrowserDataStore,browserPartition,type BrowserStore} from './browser-data';
import {BrowserDownloads} from './browser-downloads';
import {browserAddress} from './browser-address';
export {browserAddress} from './browser-address';
import {BrowserTabs,type BrowserScope} from './browser-tabs';
const configuredSessions=new WeakSet<Electron.Session>();
const downloadSources=new WeakMap<Electron.WebContents,()=>{manager:BrowserDownloads;owner:string;tabId:string;conversation?:string;scope?:'agent-draft-preview';origin:string}|undefined>();
type FindState={matches:number;ordinal:number;pending:boolean;error?:string};
type CaptureHost={window:BrowserWindow;bounds:Electron.Rectangle;index:number;visible:boolean;controller:AbortController};
type Entry={owner:string;generation:number;agentConversation?:string;agentScope?:BrowserScope;view:WebContentsView;canvas:boolean;error:string;target?:string;capture?:CaptureHost;findVersion:number;findOpen:boolean;findRequest?:number;findQuery?:string;matchCase?:boolean;find:FindState;findTimer?:ReturnType<typeof setTimeout>};
export class WorkspaceBrowser{
 readonly uploads?:BrowserUploads;
 private stopping=false;private entries=new Map<string,Entry>();private shown:string|null=null;
 readonly tabs=new BrowserTabs();private agentValidator?: (owner:string,conversation:string,scope:BrowserScope)=>Promise<boolean>;private legacyLookup?: (owner:string,id:string)=>Promise<string|undefined>;private conversationTitles?: (owner:string,ids:string[])=>Promise<Record<string,string>>;private tabOperations=new Map<string,Promise<unknown>>();private tabWrites=new Map<string,{timer:ReturnType<typeof setTimeout>;entry:Entry}>();
 private data=new BrowserDataStore();private downloads:BrowserDownloads;private activeOwner:string|null=null;private clearing=new Set<string>();private sessions=new Map<string,Set<Electron.Session>>();private openingConversations=new Map<string,{conversation:string;scope:BrowserScope}>();
 constructor(private window:BrowserWindow,configureDownload?:ConstructorParameters<typeof BrowserDownloads>[2],uploadDirectory?:string){this.downloads=new BrowserDownloads(this.data,window,configureDownload);if(uploadDirectory)this.uploads=new BrowserUploads(uploadDirectory);}
 attachStore(store:BrowserStore){this.data.attach(store);this.tabs.attach(store);}
 configureAgents(validate:(owner:string,conversation:string,scope:BrowserScope)=>Promise<boolean>,legacy?:(owner:string,id:string)=>Promise<string|undefined>,titles?:(owner:string,ids:string[])=>Promise<Record<string,string>>){this.agentValidator=validate;this.legacyLookup=legacy;this.conversationTitles=titles;}
 private async validateAgent(owner:string,conversation:string,scope:BrowserScope='chat'){if(this.agentValidator&&!await this.agentValidator(owner,conversation,scope))throw new Error('This browser conversation is no longer available to your account.');}
 private queueTab(entry:Entry,id:string){if(!entry.agentConversation)return;const previous=this.tabWrites.get(id);if(previous)clearTimeout(previous.timer);const timer=setTimeout(()=>{this.tabWrites.delete(id);void this.saveTab(entry,id).catch(()=>{});},200);this.tabWrites.set(id,{timer,entry});}
 private async saveTab(entry:Entry,id:string){if(!entry.agentConversation||entry.view.webContents.isDestroyed())return;const c=entry.view.webContents;try{await this.tabs.update(entry.owner,id,browserAddress(c.getURL()),c.getTitle());}catch(error){if(c.getURL().startsWith('http'))throw error;}}
 stop(){this.stopping=true;this.closeAll();}
 closeAll(){this.activeOwner=null;this.downloads.cancelOwner();for(const [id,entry] of this.entries){const pending=this.tabWrites.get(id);if(pending){clearTimeout(pending.timer);this.tabWrites.delete(id);}void this.saveTab(entry,id).catch(()=>{});this.finishCapture(entry);clearTimeout(entry.findTimer);downloadSources.delete(entry.view.webContents);this.window.contentView.removeChildView(entry.view);entry.view.webContents.close();void this.uploads?.closeTab(entry.owner,id).catch(()=>{});}this.entries.clear();this.shown=null;}
 async flush(){for(const [id,{timer,entry}] of this.tabWrites){clearTimeout(timer);this.tabWrites.delete(id);await this.saveTab(entry,id);}await this.tabs.flush();for(const sessions of this.sessions.values())for(const isolated of sessions){isolated.flushStorageData();await isolated.cookies.flushStore();}await this.downloads.flush();await this.uploads?.flush();}
 downloadList(owner:string,conversation:string,scope:BrowserScope='chat'){return this.downloads.list(owner,conversation,scope);}
 async agentOpen(owner:string,conversation:string,url:string,scope:BrowserScope='chat'){const id=require('node:crypto').randomUUID() as string;await this.validateAgent(owner,conversation,scope);await this.tabs.put(owner,{id,conversation,...(scope==='agent-draft-preview'?{scope}:{}),url:browserAddress(url),title:'',updatedAt:new Date().toISOString()});this.openingConversations.set(id,{conversation,scope});try{await this.call('browser.open',{id,url},owner);this.entries.get(id)!.view.setBounds({x:54,y:80,width:1000,height:700});return {id};}catch(error){await this.tabs.forget(owner,id).catch(()=>{});throw error;}finally{this.openingConversations.delete(id);}}
 async savedAgentTab(owner:string,conversation:string,id:string,scope:BrowserScope='chat'){const row=this.tabs.get(owner,id);if(!row||row.conversation!==conversation||(row.scope??'chat')!==scope)throw new Error('This saved browser tab is not available to this conversation.');await this.validateAgent(owner,conversation,scope);return row;}
 async restoreAgent(owner:string,conversation:string,id:string,guard:()=>Promise<void>,expectedUrl?:string,scope:BrowserScope='chat'){const row=await this.savedAgentTab(owner,conversation,id,scope);await guard();if(expectedUrl!==undefined&&row.url!==expectedUrl)throw new Error('The saved browser address changed during review. Review restoration again.');await this.call('browser.open',{id,url:row.url,restoreConversation:conversation,restoreUrl:row.url},owner,guard);const entry=this.entries.get(id);if(entry)entry.view.setBounds({x:54,y:80,width:1000,height:700});return this.agentContents(owner,conversation,id,scope);}
 async forgetConversation(owner:string,conversation:string,guard:()=>Promise<void>,scope:BrowserScope='chat'){const ids=new Set([...this.tabs.list(owner,conversation,scope).map(row=>row.id),...[...this.entries].filter(([,entry])=>entry.owner===owner&&entry.agentConversation===conversation&&(entry.agentScope??'chat')===scope).map(([id])=>id)]);for(const id of ids)await this.call('browser.close',{id},owner,guard);}
 agentContents(owner:string,conversation:string,id:string,scope:BrowserScope='chat'){const entry=this.entries.get(id);if(!entry||entry.owner!==owner||entry.agentConversation!==conversation||(entry.agentScope??'chat')!==scope||entry.canvas||entry.view.webContents.isDestroyed())throw new Error('This browser tab is not available to this conversation. Open a fresh agent browser tab.');return entry.view.webContents;}
 contextContents(owner:string,id:string){const entry=this.entries.get(id);if(!entry||entry.owner!==owner||entry.canvas||entry.agentConversation||entry.view.webContents.isDestroyed())throw new Error('This browser tab is no longer available to your account.');return entry.view.webContents;}
 agentEntryForContents(contents:Electron.WebContents){const entry=[...this.entries.values()].find(e=>e.view.webContents===contents);if(!entry||contents.isDestroyed()||entry.canvas)throw new Error('This agent browser tab was closed.');return entry;}
 private finishCapture(entry:Entry){const capture=entry.capture;if(!capture)return;delete entry.capture;capture.controller.abort(new Error('The browser layout changed during this operation. Inspect before retrying.'));entry.view.setVisible(false);capture.window.contentView.removeChildView(entry.view);if(!this.window.isDestroyed()&&!entry.view.webContents.isDestroyed()){this.window.contentView.addChildView(entry.view,Math.max(0,Math.min(capture.index,this.window.contentView.children.length)));entry.view.setBounds(capture.bounds);entry.view.setVisible(capture.visible);}capture.window.destroy();}
 async withAgentSurface<T>(contents:Electron.WebContents,work:(signal:AbortSignal)=>Promise<T>,present=false){
  const entry=this.agentEntryForContents(contents);if(entry.capture)throw new Error('This browser tab is already being captured.');if(entry.view.getVisible()&&this.window.isVisible()&&!this.window.isMinimized())return work(new AbortController().signal);
  // A never-shown Windows WebContentsView has no copyable surface. Render the
  // same live contents in a hidden host; retain its document, session and size.
  const bounds=entry.view.getBounds(),host=new BrowserWindow({show:false,skipTaskbar:true,frame:false,width:Math.max(100,bounds.width),height:Math.max(100,bounds.height),webPreferences:{sandbox:true,contextIsolation:true,nodeIntegration:false}}),capture={window:host,bounds,index:this.window.contentView.children.indexOf(entry.view),visible:entry.view.getVisible(),controller:new AbortController()};entry.capture=capture;if(present)host.on('close',event=>{event.preventDefault();capture.controller.abort(new Error('The browser upload window was closed. Inspect the site before retrying.'));});
  try{host.contentView.addChildView(entry.view);entry.view.setBounds({x:0,y:0,width:bounds.width,height:bounds.height});entry.view.setVisible(true);if(present)host.showInactive();const image=await work(capture.controller.signal);if(entry.capture!==capture)throw new Error('The browser layout changed during capture. Inspect the tab before retrying.');return image;}finally{this.finishCapture(entry);}
 }
 agentTabs(owner:string,conversation:string,scope:BrowserScope='chat'){const rows=this.tabs.list(owner,conversation,scope).map(row=>({tab_id:row.id,url:row.url,title:row.title,status:'saved'}));for(const [id,e] of this.entries)if(e.owner===owner&&e.agentConversation===conversation&&(e.agentScope??'chat')===scope&&!e.canvas&&!e.view.webContents.isDestroyed()){const live={tab_id:id,url:e.view.webContents.getURL(),title:e.view.webContents.getTitle(),status:'live'},index=rows.findIndex(r=>r.tab_id===id);if(index>=0)rows[index]=live;else rows.push(live);}return rows;}
 private failed(entry:Entry,message:string){clearTimeout(entry.findTimer);entry.error=message;entry.findRequest=undefined;entry.find={matches:0,ordinal:0,pending:false,error:message};}
 private find(entry:Entry,forward=true,newSession=true){
  clearTimeout(entry.findTimer);entry.find={matches:0,ordinal:0,pending:!!entry.findQuery};
  if(!entry.findQuery){entry.findRequest=undefined;entry.view.webContents.stopFindInPage('clearSelection');return;}
  if(entry.error){entry.findRequest=undefined;entry.find={matches:0,ordinal:0,pending:false,error:entry.error};return;}
  entry.findRequest=entry.view.webContents.findInPage(entry.findQuery,{forward,findNext:newSession,matchCase:entry.matchCase});
  const request=entry.findRequest;entry.findTimer=setTimeout(()=>{if(entry.findRequest===request&&entry.find.pending)entry.find={matches:0,ordinal:0,pending:false,error:'Search timed out. Try again after the page finishes loading.'};},5000);
 }
 hide(){for(const entry of this.entries.values()){if(entry.capture){entry.capture.visible=false;continue;}entry.view.setVisible(false);}this.shown=null;}
 async call(action:string,args:Record<string,unknown>,owner:string,guard:()=>Promise<void>=async()=>{}){
  if(['browser.open','browser.close','browser.release'].includes(action)&&typeof args.id==='string'){const key=owner+':'+args.id,operation=(this.tabOperations.get(key)??Promise.resolve()).catch(()=>{}).then(()=>this.dispatch(action,args,owner,guard));this.tabOperations.set(key,operation);try{return await operation;}finally{if(this.tabOperations.get(key)===operation)this.tabOperations.delete(key);}}
  return this.dispatch(action,args,owner,guard);
 }
 private async dispatch(action:string,args:Record<string,unknown>,owner:string,guard:()=>Promise<void>){
  await guard();if(this.stopping)throw new Error('Agentopia’s browser is stopping. Reopen the application to continue.');if(this.clearing.has(owner))throw new Error('Wait for browser data to finish clearing.');if(this.activeOwner&&this.activeOwner!==owner)this.closeAll();this.activeOwner=owner;
  if(action==='browser.preferences')return {rememberSignIns:this.data.get(owner).rememberSignIns};
  if(action==='browser.tabs.list'||action==='browser.context.list'){const rows=this.tabs.list(owner),titles=rows.length&&this.conversationTitles?await this.conversationTitles(owner,[...new Set(rows.map(row=>row.conversation))]):{};await guard();const tabs=rows.map(row=>({...row,conversationTitle:row.scope==='agent-draft-preview'?'Agent preview':titles[row.conversation],status:this.entries.get(row.id)?.agentConversation===row.conversation?'live':'saved'}));if(action==='browser.context.list')for(const [id,entry]of this.entries){if(entry.owner!==owner||entry.canvas||entry.agentConversation||entry.view.webContents.isDestroyed())continue;try{tabs.push({id,conversation:'',url:browserAddress(entry.view.webContents.getURL()),title:entry.view.webContents.getTitle().slice(0,240),updatedAt:new Date().toISOString(),conversationTitle:'',status:'live'});}catch{/* A loading or unsupported page cannot be selected as context. */}}return {tabs,error:this.tabs.error(owner)||this.uploads?.error(owner)||''};}
  if(action==='browser.resolve'){const id=args.id;if(typeof id!=='string'||!/^[a-f0-9-]{36}$/i.test(id))throw new Error('Invalid browser tab.');return {id:this.tabs.closed(owner,id)?require('node:crypto').randomUUID():id};}
  if(action==='browser.tabs.retry'){await this.flush();return;}
  if(action==='browser.downloads')return this.downloads.list(owner);
  if(action==='browser.downloads.clear'){await this.downloads.clear(owner);return;}
  if(action==='browser.download.cancel'||action==='browser.download.reveal'){if(typeof args.downloadId!=='string')throw new Error('Choose a download.');if(action==='browser.download.cancel')return this.downloads.cancel(owner,args.downloadId);return this.downloads.reveal(owner,args.downloadId,guard);}
  if(action==='browser.download.pause'||action==='browser.download.resume'){if(typeof args.downloadId!=='string')throw new Error('Choose a download.');return this.downloads.pause(owner,args.downloadId,action==='browser.download.resume');}
  if(action==='browser.preferences.save'||action==='browser.data.clear'){
   if(action==='browser.preferences.save'&&typeof args.rememberSignIns!=='boolean')throw new Error('Choose whether to keep website sign-ins.');
   this.clearing.add(owner);this.closeAll();try{
    if(action==='browser.data.clear'||args.rememberSignIns===false){for(const isolated of this.sessions.get(owner)??[]){await isolated.clearStorageData();await isolated.clearCache();await isolated.clearAuthCache();await isolated.closeAllConnections();}const saved=session.fromPartition(browserPartition(owner,true));await saved.clearStorageData();await saved.clearCache();await saved.clearAuthCache();await saved.closeAllConnections();}
    await guard();const previous=this.data.get(owner).rememberSignIns;if(action==='browser.preferences.save')this.data.get(owner).rememberSignIns=args.rememberSignIns as boolean;try{await this.data.save(owner);}catch(error){this.data.get(owner).rememberSignIns=previous;throw error;}return;
   }finally{this.clearing.delete(owner);if(!this.window.isDestroyed())this.window.webContents.send('agentopia:command','browser-reset');}
  }
  if(action==='browser.hide'){this.hide();return;}
  const id=args.id;if(typeof id!=='string'||!/^[a-f0-9-]{36}$/i.test(id))throw new Error('Invalid browser tab.');
  let entry=this.entries.get(id);if(entry&&entry.owner!==owner)throw new Error('This browser belongs to another account.');
  if(action==='browser.open'){
   if(typeof args.html!=='string'&&this.tabs.closed(owner,id))throw new Error('This browser tab was closed. Open a fresh tab.');
   if(args.restoreConversation!==undefined&&(this.tabs.get(owner,id)?.conversation!==args.restoreConversation||this.tabs.get(owner,id)?.url!==args.restoreUrl))throw new Error('This saved tab was closed or changed before restoration.');
   const opening=this.openingConversations.get(id),saved=this.tabs.get(owner,id);let agentConversation=opening?.conversation??saved?.conversation;const agentScope:BrowserScope=opening?.scope??saved?.scope??'chat';
   if(!agentConversation&&!this.tabs.closed(owner,id)&&this.legacyLookup&&typeof args.html!=='string'){agentConversation=await this.legacyLookup(owner,id);if(agentConversation){await this.validateAgent(owner,agentConversation);await this.tabs.put(owner,{id,conversation:agentConversation,url:browserAddress(args.url),title:'',updatedAt:new Date().toISOString()});}}
   if(agentConversation)await this.validateAgent(owner,agentConversation,agentScope);await guard();if(this.stopping)throw new Error('Agentopia’s browser is stopping.');
   let existed=!!entry;const wasCanvas=entry?.canvas;
   const canvas=typeof args.html==='string',url=canvas?'':browserAddress(!entry&&args.navigate!==true&&this.tabs.get(owner,id)?this.tabs.get(owner,id)!.url:args.url);
   if(canvas&&(args.html as string).length>160000)throw new Error('This canvas is too large.');
   if(entry&&entry.canvas!==canvas){if(entry.agentConversation)await this.tabs.forget(owner,id);downloadSources.delete(entry.view.webContents);clearTimeout(entry.findTimer);this.window.contentView.removeChildView(entry.view);entry.view.webContents.close();this.entries.delete(id);await this.uploads?.closeTab(owner,id);entry=undefined;existed=false;}
   if(!entry){
    if(this.entries.size>=16)throw new Error('Close a browser tab before opening another.');
    const isolated=session.fromPartition(browserPartition(owner,this.data.get(owner).rememberSignIns,canvas));let owned=this.sessions.get(owner);if(!owned){owned=new Set();this.sessions.set(owner,owned);}owned.add(isolated);
    if(!configuredSessions.has(isolated)){configuredSessions.add(isolated);isolated.setPermissionRequestHandler((_contents,_permission,callback)=>callback(false));isolated.setPermissionCheckHandler(()=>false);
    isolated.on('will-download',(event,item,contents)=>{const source=contents&&!contents.isDestroyed()?downloadSources.get(contents)?.():undefined;if(!source){event.preventDefault();return;}source.manager.receive(event,item,source);});
    isolated.webRequest.onBeforeRequest((details,callback)=>{let allowed=false;try{const u=new URL(details.url);allowed=['https:','data:','about:','blob:'].includes(u.protocol)||u.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(u.hostname);}catch{}callback({cancel:!allowed});});}
    const view=new WebContentsView({webPreferences:{session:isolated,sandbox:true,contextIsolation:true,nodeIntegration:false,webviewTag:false,webSecurity:true,allowRunningInsecureContent:false,navigateOnDragDrop:false}});
    entry={owner,generation:0,view,canvas,agentConversation:canvas?undefined:agentConversation,agentScope:canvas?undefined:agentScope,error:'',findVersion:0,findOpen:false,find:{matches:0,ordinal:0,pending:false}};this.entries.set(id,entry);this.window.contentView.addChildView(view);view.setVisible(false);
    const current=entry;
    if(!canvas)view.webContents.on('did-finish-load',()=>{void view.webContents.setVisualZoomLevelLimits(1,3).catch(()=>{});});
    if(current.agentConversation){view.webContents.on('did-finish-load',()=>this.queueTab(current,id));view.webContents.on('did-navigate-in-page',()=>this.queueTab(current,id));view.webContents.on('page-title-updated',()=>this.queueTab(current,id));}
    downloadSources.set(view.webContents,()=>{if(this.activeOwner!==owner||this.clearing.has(owner)||view.webContents.isDestroyed()||this.entries.get(id)!==current)return;let origin='HTML canvas';if(!current.canvas){try{origin=new URL(browserAddress(view.webContents.getURL()||current.target)).origin;}catch{return;}}return {manager:this.downloads,owner,tabId:id,conversation:current.agentConversation,...(current.agentScope==='agent-draft-preview'?{scope:'agent-draft-preview' as const}:{}),origin};});
    view.webContents.setWindowOpenHandler(()=>({action:'deny'}));
    const guard=(event:Electron.Event,target:string)=>{try{browserAddress(target);if(current.canvas)event.preventDefault();}catch{event.preventDefault();}};
    view.webContents.on('will-navigate',guard);view.webContents.on('will-redirect',guard);
    view.webContents.on('did-fail-load',(_event,code,_message,_url,main)=>{if(main&&code!==-3)this.failed(current,'This page could not be loaded. Check the address and your connection.');});
    view.webContents.on('render-process-gone',()=>this.failed(current,'This browser page stopped. Close and reopen the tab.'));
    view.webContents.on('found-in-page',(_event,result)=>{if(result.requestId!==current.findRequest||!current.findOpen)return;current.find={matches:result.matches,ordinal:result.activeMatchOrdinal,pending:!result.finalUpdate};if(result.finalUpdate)clearTimeout(current.findTimer);});
    view.webContents.on('did-start-navigation',(_event,_url,inPlace,main)=>{if(main&&!inPlace){current.generation++;current.error='';clearTimeout(current.findTimer);current.findRequest=undefined;current.find={matches:0,ordinal:0,pending:!!current.findQuery};if(current.findQuery)current.findTimer=setTimeout(()=>{if(current.find.pending)current.find={matches:0,ordinal:0,pending:false,error:'This page is still loading. Try search again when it is ready.'};},5000);}});
    view.webContents.on('did-navigate-in-page',(_event,_url,main)=>{if(main)current.generation++;if(main&&current.findOpen)this.find(current);});
    view.webContents.on('did-finish-load',()=>{if(current.findOpen)this.find(current);});
    view.webContents.on('before-input-event',(event,input)=>{if(this.shown!==id||input.type!=='keyDown'||input.alt)return;const key=input.key.toLowerCase(),command=(input.control||input.meta)&&key==='f'?'open':key==='f3'?(input.shift?'previous':'next'):key==='escape'&&current.findOpen?'close':null;if(command){event.preventDefault();this.window.webContents.focus();this.window.webContents.send('agentopia:command','workspace-find-'+command);}});
   }
   entry.canvas=canvas;
   const csp="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; font-src data:; connect-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'";
   const target=canvas?'data:text/html;charset=utf-8,'+encodeURIComponent('<meta http-equiv="Content-Security-Policy" content="'+csp+'"><meta name="viewport" content="width=device-width,initial-scale=1">'+args.html):url;
   if(existed&&(canvas&&wasCanvas&&entry.target===target||!canvas&&!wasCanvas&&args.navigate!==true))return;
   entry.error='';entry.target=target;
   void entry.view.webContents.loadURL(target).catch(error=>{if(entry?.target===target&&error?.code!=='ERR_ABORTED')this.failed(entry,'This page could not be loaded. Check the address and your connection.');});return;
  }
  if(!entry){if(action==='browser.close'){await this.tabs.forget(owner,id);await guard();if(this.activeOwner===owner)this.window.webContents.send('agentopia:command','browser-tab-closed:'+id);await this.uploads?.closeTab(owner,id);}if(action==='browser.close'||action==='browser.release'||action==='browser.bounds'||action==='browser.findClose')return;throw new Error('Open the browser tab first.');}
  const contents=entry.view.webContents;
  if(action==='browser.release'&&args.keepAgent===true&&entry.agentConversation){if(entry.capture)entry.capture.visible=false;else entry.view.setVisible(false);if(this.shown===id)this.shown=null;return;}
  if(action==='browser.close'||action==='browser.release'){if(action==='browser.close'){await this.tabs.forget(owner,id);await guard();if(this.activeOwner===owner)this.window.webContents.send('agentopia:command','browser-tab-closed:'+id);}else await this.saveTab(entry,id);const pending=this.tabWrites.get(id);if(pending){clearTimeout(pending.timer);this.tabWrites.delete(id);}this.finishCapture(entry);clearTimeout(entry.findTimer);downloadSources.delete(contents);this.window.contentView.removeChildView(entry.view);contents.close();this.entries.delete(id);if(this.shown===id)this.shown=null;await this.uploads?.closeTab(owner,id);return;}
  if(action==='browser.focus'){if(this.shown===id)contents.focus();return;}
  if(action==='browser.find'||action==='browser.findClose'){
   if(!Number.isSafeInteger(args.version)||(args.version as number)<1)throw new Error('Invalid preview search version.');
   if((args.version as number)<=entry.findVersion)return entry.find;
   entry.findVersion=args.version as number;
   if(action==='browser.findClose'){entry.findOpen=false;entry.findQuery='';this.find(entry);return entry.find;}
   if(typeof args.query!=='string'||args.query.length>512||typeof args.matchCase!=='boolean')throw new Error('Enter up to 512 characters to find.');
   entry.findOpen=true;entry.findQuery=args.query;entry.matchCase=args.matchCase;this.find(entry,args.forward!==false,args.newSession!==false);return entry.find;
  }
  if(action==='browser.bounds'){
   const rect=args.bounds as {x:number;y:number;width:number;height:number};if(!rect||Object.values(rect).some(n=>!Number.isFinite(n)))throw new Error('Invalid browser bounds.');
   const [width,height]=this.window.getContentSize(),x=Math.max(54,Math.round(rect.x)),y=Math.max(80,Math.round(rect.y)),w=Math.min(width-x,Math.max(0,Math.round(rect.width))),h=Math.min(height-y,Math.max(0,Math.round(rect.height)));
   this.hide();this.finishCapture(entry);if(w>=20&&h>=20){entry.view.setBounds({x,y,width:w,height:h});entry.view.setVisible(true);this.shown=id;}return;
  }
  if(action==='browser.back'){if(contents.navigationHistory.canGoBack())contents.navigationHistory.goBack();}
  else if(action==='browser.forward'){if(contents.navigationHistory.canGoForward())contents.navigationHistory.goForward();}
  else if(action==='browser.reload'){entry.error='';contents.reload();}
  else if(action!=='browser.state')throw new Error('Unsupported browser operation.');
  return {url:entry.canvas?'':contents.getURL(),title:entry.canvas?'Canvas':contents.getTitle(),agentConversation:entry.agentConversation,loading:contents.isLoading(),back:contents.navigationHistory.canGoBack(),forward:contents.navigationHistory.canGoForward(),error:entry.error,find:entry.find,findVersion:entry.findVersion,downloadsActive:this.downloads.activeCount(owner),persistenceError:this.tabs.error(owner)||this.uploads?.error(owner)||''};
 }
}
