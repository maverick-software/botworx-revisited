// Apply the same focused repair to development sources and the frozen installed
// source baseline, keeping unfinished preview changes out of this delivery.
import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
export async function patchVisible126(directory,parts=['ui','indicator','harness','main']){
 async function edit(file,changes){let text=await readFile(path.join(directory,file),'utf8');for(const[a,b]of changes){assert.equal(text.split(a).length,2,file+': '+a.slice(0,90));text=text.replace(a,()=>b);}await writeFile(path.join(directory,file),text);}
 if(parts.includes('ui')){const viewsFile=path.join(directory,'ui/WorkspaceViews.tsx');let views=await readFile(viewsFile,'utf8');
 const start=views.indexOf('<section className="sidebar-section history-section"'),end=views.indexOf('</section>',start);assert(start>0&&end>start);
 let history=views.slice(start,end+'</section>'.length);
 const groupStart=history.indexOf('{groupChats(visible).map('),groupEnd=history.indexOf('{recent.length>visible.length');assert(groupStart>0&&groupEnd>groupStart);
 history='<SidebarSection name="Recents" owner={identity.id} className="history-section"><div role="region" aria-label="Chat history">'+history.slice(groupStart,groupEnd).replace(/^.*$/s,'{visible.map(chat=><HistoryRow key={chat.conversation_id} chat={chat} active={conversation===chat.conversation_id&&view===\'chat\'} disabled={disabled} open={open} manage={manage}/>)}')+history.slice(groupEnd).replace('</section>','</div></SidebarSection>');
 history=history.replace('<div className="section-label">Your chats</div>','');
 views=views.slice(0,start)+history+views.slice(end+'</section>'.length);
 const oldStatus="message.metadata.status&&message.metadata.status!=='completed'&&message.metadata.status!=='running'&&";
 assert.equal(views.split(oldStatus).length,2);views=views.replace(oldStatus,()=>oldStatus+"(!message.metadata.native||message.metadata.status==='failed'||!!message.metadata.error)&&");
 const oldIcon='{!inProject&&<MessageSquare className="history-chat-icon" size={14} aria-hidden="true"/>}';assert(views.includes(oldIcon));views=views.replace(oldIcon,'');
 const unused=views.indexOf('function groupChats(');assert(unused>0);assert(views.slice(unused).trim().endsWith('}'));views=views.slice(0,unused);
 await writeFile(viewsFile,views);
 await edit('ui/NativeTurn.tsx',[["  {active&&!text.length&&<p className=\"turn-work-note\">Working…</p>}", '']]);}
 if(parts.includes('indicator'))await edit('src/computer-indicator.ts',[
 ['reference:string;box:ComputerBox};','reference:string;box?:ComputerBox;desktop?:true};'],
 [' end(owner:string,request:string){'," async showDesktop(owner:string,request:string){this.leases.set(request,{owner,request,reference:'native-command',desktop:true});try{await this.refresh();}catch(error){this.end(owner,request);throw error;}}\r\n end(owner:string,request:string){"],
 ['if(intersects(display.bounds,this.host.dip(row.box)))','if(row.desktop||row.box&&intersects(display.bounds,this.host.dip(row.box)))']
 ]);
 if(parts.includes('harness')){await edit('src/codex-harness.ts',[
 ['type Worker={', 'type Worker={commandIndicators?:Map<string,()=>void>;'],
 [' constructor(private db:SupabaseClient,private providers:Providers'," commandIndicator?:{show:(owner:string,key:string)=>Promise<void>;end:(owner:string,key:string)=>void};\r\n constructor(private db:SupabaseClient,private providers:Providers"],
 ["approvalPolicy:options.permission==='full'?'never' as const:'untrusted' as const", "approvalPolicy:'untrusted' as const"],
 ["worker.disposing=(async()=>{if(worker.backgroundTimer)","worker.disposing=(async()=>{for(const stop of worker.commandIndicators?.values()??[])stop();if(worker.backgroundTimer)"],
 ["  if(method==='thread/started'&&p.thread?.parentThreadId)", "  if(method==='item/completed'&&p.item?.type==='commandExecution')w.commandIndicators?.get(JSON.stringify([p.threadId,p.item.id]))?.();\r\n  if(method==='thread/started'&&p.thread?.parentThreadId)"],
 ["if(this.currentAdmin&&!await this.currentAdmin(r.owner))return {decision:'decline'};return {decision:'accept'};", "if(this.currentAdmin&&!await this.currentAdmin(r.owner))return {decision:'decline'};if(rpc.method==='item/commandExecution/requestApproval'&&this.commandIndicator){const key=JSON.stringify([p.threadId,p.itemId]);if(!p.threadId||!p.itemId)throw Error('The native command has no owned activity identity.');const host=this.commandIndicator,w=r.worker;w.commandIndicators??=new Map();if(!w.commandIndicators.has(key)){await host.show(r.owner,key);const stop=()=>{w.commandIndicators?.delete(key);signal.removeEventListener('abort',stop);host.end(r.owner,key);};w.commandIndicators.set(key,stop);signal.addEventListener('abort',stop,{once:true});try{signal.throwIfAborted();await r.validate();signal.throwIfAborted();}catch(error){stop();throw error;}}}return {decision:'accept'};"]
 ]);await refineCommandIndicator126(directory);}
 if(parts.includes('main'))await edit('src/main.ts',[["broker.tools.computer=computer;await broker.initialize();", "broker.tools.computer=computer;broker.native.commandIndicator={show:async(owner,key)=>{if(!computer?.indicator)throw Error('The native command indicator is unavailable.');await computer.indicator.showDesktop(owner,key);},end:(owner,key)=>computer?.indicator?.end(owner,key)};await broker.initialize();"]]);
}

export async function refineCommandIndicator126(directory){
 const file=path.join(directory,'src/codex-harness.ts');let text=await readFile(file,'utf8');
 const start=text.indexOf("if(rpc.method==='item/commandExecution/requestApproval'&&this.commandIndicator){const key="),end=text.indexOf("return {decision:'accept'};",start);assert(start>0&&end>start);
 const body=text.slice(start,end),inner=body.slice(body.indexOf('{')+1,-1);
 const method=" private async indicateNativeCommand(r:Running,p:any,signal:AbortSignal){if(!this.commandIndicator)return;"+inner+"}\r\n";
 text=text.slice(0,start)+"if(rpc.method==='item/commandExecution/requestApproval')await this.indicateNativeCommand(r,p,signal);"+text.slice(end);
 const anchor=' private async serverRequest(';assert.equal(text.split(anchor).length,2);text=text.replace(anchor,()=>method+anchor);
 const waiting="if(signal.aborted)abort();});",replacement="if(signal.aborted)abort();}).then(async(value:any)=>{if(value?.decision==='accept'&&rpc.method==='item/commandExecution/requestApproval')await this.indicateNativeCommand(r,p,signal);return value;});";
 assert.equal(text.split(waiting).length,2);text=text.replace(waiting,()=>replacement);await writeFile(file,text);
}
