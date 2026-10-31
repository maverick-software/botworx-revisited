import {BrowserWindow,screen} from 'electron';
import type {ComputerBox} from './computer-contracts';

export const computerIndicatorHue='#a56bff';
export const computerIndicatorHtml=`<!doctype html><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'"><style>
html,body{margin:0;width:100%;height:100%;overflow:hidden;background:transparent;pointer-events:none}*{box-sizing:border-box}
#monitor{position:fixed;inset:0;border:4px solid ${computerIndicatorHue};border-radius:7px;background:rgba(165,107,255,.025);box-shadow:inset 0 0 34px rgba(165,107,255,.22),inset 0 0 2px rgba(255,255,255,.8)}
#pointer{position:fixed;left:0;top:0;width:28px;height:34px;will-change:transform;visibility:hidden;filter:drop-shadow(0 0 2px rgba(0,0,0,.6))}#pointer:before{content:'';position:absolute;left:-25px;top:-24px;width:68px;height:68px;border-radius:50%;background:radial-gradient(circle,rgba(165,107,255,.5),rgba(165,107,255,.19) 40%,transparent 72%)}svg{position:relative;width:24px;height:30px}
</style><div id="monitor"></div><div id="pointer"><svg viewBox="0 0 24 30" xmlns="http://www.w3.org/2000/svg"><path d="M2 2L3 23L8.7 18.1L13.7 28L17.6 26L12.7 16.5L20 15.5Z" fill="${computerIndicatorHue}" stroke="white" stroke-width="1.5" stroke-linejoin="round"/></svg></div>`;
type Rect={x:number;y:number;width:number;height:number};
type Display={id:number;bounds:Rect};
export type IndicatorWindow={ready:Promise<void>;show:()=>void;bounds:(value:Rect)=>void;pointer:(x:number,y:number,visible:boolean)=>Promise<unknown>;destroy:()=>void;alive:()=>boolean};
export type IndicatorHost={displays:()=>Display[];dip:(value:ComputerBox)=>Rect;cursor:()=>{x:number;y:number};create:(bounds:Rect)=>IndicatorWindow;watch:(changed:()=>void)=>()=>void};
type Lease={owner:string;request:string;reference:string;box?:ComputerBox;desktop?:true};
type Surface={window:IndicatorWindow;bounds:Rect;ready:Promise<void>;moving:boolean};
const intersects=(a:Rect,b:Rect)=>Math.min(a.x+a.width,b.x+b.width)>Math.max(a.x,b.x)&&Math.min(a.y+a.height,b.y+b.height)>Math.max(a.y,b.y);
function electronIndicatorHost():IndicatorHost{
 return {displays:()=>screen.getAllDisplays().map(d=>({id:d.id,bounds:d.bounds})),dip:value=>screen.screenToDipRect(null,{x:value.left,y:value.top,width:value.width,height:value.height}),cursor:()=>screen.getCursorScreenPoint(),watch:changed=>{screen.on('display-added',changed);screen.on('display-removed',changed);screen.on('display-metrics-changed',changed);return()=>{screen.removeListener('display-added',changed);screen.removeListener('display-removed',changed);screen.removeListener('display-metrics-changed',changed);};},create:bounds=>{
  const window=new BrowserWindow({...bounds,title:'Sylvana Computer Use',show:false,frame:false,transparent:true,backgroundColor:'#00000000',focusable:false,skipTaskbar:true,alwaysOnTop:true,resizable:false,movable:false,minimizable:false,maximizable:false,closable:false,hasShadow:false,enableLargerThanScreen:true,webPreferences:{contextIsolation:true,nodeIntegration:false,sandbox:true,devTools:false,backgroundThrottling:false,partition:'sylvana-computer-indicator'}});
  window.setIgnoreMouseEvents(true);window.setFocusable(false);window.setEnabled(false);window.setContentProtection(true);window.setAlwaysOnTop(true,'screen-saver');window.webContents.setWindowOpenHandler(()=>({action:'deny'}));window.webContents.on('will-navigate',event=>event.preventDefault());
  const ready=window.loadURL('data:text/html;charset=utf-8,'+encodeURIComponent(computerIndicatorHtml));return {ready,show:()=>{window.showInactive();window.setBounds(bounds,false);},bounds:value=>{bounds=value;window.setBounds(value,false);},alive:()=>!window.isDestroyed(),destroy:()=>{if(!window.isDestroyed())window.destroy();},pointer:(x,y,visible)=>window.webContents.executeJavaScript('(()=>{const p=document.getElementById("pointer");if(p){p.style.transform="translate3d('+Number(x)+'px,'+Number(y)+'px,0)";p.style.visibility="'+(visible?'visible':'hidden')+'";}})()')};
 }};
}

/** A visual layer only: it never changes the system cursor, input target or focus. */
export class ComputerIndicator{
 private leases=new Map<string,Lease>();private surfaces=new Map<number,Surface>();private timer?:ReturnType<typeof setInterval>;private unwatch:()=>void;private emergency?:{controller:AbortController;ready:Promise<void>};
 constructor(private host:IndicatorHost=electronIndicatorHost(),private watchEmergency?:(signal:AbortSignal)=>Promise<void>){this.unwatch=host.watch(()=>{void this.refresh().catch(()=>this.stop());});}
 async show(owner:string,request:string,reference:string,box:ComputerBox){if(![box.left,box.top,box.width,box.height].every(Number.isFinite)||box.width<=0||box.height<=0)throw Error('The computer-use indicator has no valid target display.');this.leases.set(request,{owner,request,reference,box});try{await this.refresh();}catch(error){this.end(owner,request);throw error;}}
 async showDesktop(owner:string,request:string){this.leases.set(request,{owner,request,reference:'native-command',desktop:true});try{await this.refresh();}catch(error){this.end(owner,request);throw error;}}
 end(owner:string,request:string){if(this.leases.get(request)?.owner===owner)this.leases.delete(request);void this.refresh().catch(()=>this.stop());}
 revoke(owner:string,reference:string){for(const[id,row]of this.leases)if(row.owner===owner&&row.reference===reference)this.leases.delete(id);void this.refresh().catch(()=>this.stop());}
 stop(owner?:string){for(const[id,row]of this.leases)if(!owner||row.owner===owner)this.leases.delete(id);if(!this.leases.size){this.endEmergency();for(const surface of this.surfaces.values())surface.window.destroy();this.surfaces.clear();if(this.timer)clearInterval(this.timer);this.timer=undefined;}else void this.refresh().catch(()=>this.stop());}
 dispose(){this.stop();this.unwatch();}
 private async refresh(){
  if(!this.leases.size)this.endEmergency();
  else if(this.watchEmergency){if(!this.emergency){const controller=new AbortController();this.emergency={controller,ready:Promise.resolve().then(()=>this.watchEmergency!(controller.signal))};}const pending=this.emergency;await pending.ready;if(this.emergency!==pending||pending.controller.signal.aborted)return;}
  const desired=new Map<number,Rect>();for(const display of this.host.displays())for(const row of this.leases.values())if(row.desktop||row.box&&intersects(display.bounds,this.host.dip(row.box)))desired.set(display.id,display.bounds);
  if(this.leases.size&&!desired.size)throw Error('The computer-use target display is unavailable.');
  for(const[id,surface]of this.surfaces)if(!desired.has(id)){surface.window.destroy();this.surfaces.delete(id);}
  const waiting:Promise<void>[]=[];
  for(const[id,bounds]of desired){let surface=this.surfaces.get(id);if(!surface){const window=this.host.create(bounds),record:Surface={window,bounds,ready:Promise.resolve(),moving:false};this.surfaces.set(id,record);let timeout:ReturnType<typeof setTimeout>;record.ready=Promise.race([window.ready,new Promise<void>((_,reject)=>{timeout=setTimeout(()=>reject(Error('The computer-use indicator did not open.')),5000);})]).then(()=>{if(this.surfaces.get(id)===record&&window.alive())window.show();}).finally(()=>clearTimeout(timeout));surface=record;}else if(JSON.stringify(surface.bounds)!==JSON.stringify(bounds)){surface.window.bounds(bounds);surface.bounds=bounds;}waiting.push(surface.ready);}
  if(this.surfaces.size&&!this.timer){this.timer=setInterval(()=>{try{this.movePointer();}catch{this.stop();}},16);this.timer.unref?.();}if(!this.surfaces.size&&this.timer){clearInterval(this.timer);this.timer=undefined;}await Promise.all(waiting);this.movePointer();
 }
 private endEmergency(){const current=this.emergency;this.emergency=undefined;current?.controller.abort();}
 private movePointer(){const point=this.host.cursor();for(const surface of this.surfaces.values()){if(surface.moving||!surface.window.alive())continue;const {x,y,width,height}=surface.bounds,local={x:point.x-x,y:point.y-y};surface.moving=true;void surface.window.pointer(local.x,local.y,local.x>=0&&local.y>=0&&local.x<width&&local.y<height).catch(()=>this.stop()).finally(()=>{surface.moving=false;});}}
}
