import {createHash} from 'node:crypto';
import type {WebContents} from 'electron';
import {browserAddress} from './browser-address';
import {browserDomChecks,focusedTargetFunction,hitTargetFunction} from './browser-dom';

type Command=(contents:WebContents,method:string,args:Record<string,unknown>,signal:AbortSignal,sessionId?:string)=>Promise<any>;
export type BrowserFrame={id:string;url:string;name:string;key:string;parent?:string;depth?:number};
type Frame=BrowserFrame&{parent?:string;root:string;session?:string;owner?:number;loader:string};
type Context={frame:Frame;frames:Map<string,Frame>;command:(method:string,args?:Record<string,unknown>)=>Promise<any>;node:(backend:number,fn:string,args:unknown[])=>Promise<any>};
type Navigation={generation:number;versions:Map<string,number>;sessions:Map<string,string>;pending:Map<string,Promise<void>>;mainEnabled:boolean;mainPending?:Promise<void>};
const changed=()=>new Error('The embedded browser document changed. Take a fresh page snapshot and choose its current frame.');
const disappeared=(error:unknown)=>/No (?:frame|target|node|session) (?:with|for)|(?:frame|target|session).*?(?:not found|was detached|has been closed)/i.test(String((error as Error)?.message??error));

// Map a viewport point onto an iframe's actual content quadrilateral, including
// scale, rotation and perspective. Every mapped point is hit-tested afterwards.
export function framePoint(quad:number[],width:number,height:number,x:number,y:number){
 if(quad.length!==8||[...quad,width,height,x,y].some(value=>!Number.isFinite(value))||width<=0||height<=0||x<0||y<0||x>width||y>height)throw new Error('The embedded browser viewport is unavailable.');
 const [x0,y0,x1,y1,x2,y2,x3,y3]=quad,dx1=x1-x2,dx2=x3-x2,dx3=x0-x1+x2-x3,dy1=y1-y2,dy2=y3-y2,dy3=y0-y1+y2-y3,det=dx1*dy2-dx2*dy1;
 let g=0,h=0;if(Math.abs(dx3)+Math.abs(dy3)>1e-8){if(Math.abs(det)<1e-8)throw new Error('The embedded browser viewport has no usable area.');g=(dx3*dy2-dx2*dy3)/det;h=(dx1*dy3-dx3*dy1)/det;}
 const u=x/width,v=y/height,denominator=g*u+h*v+1,point={x:((x1-x0+g*x1)*u+(x3-x0+h*x3)*v+x0)/denominator,y:((y1-y0+g*y1)*u+(y3-y0+h*y3)*v+y0)/denominator};
 if(!Number.isFinite(point.x)||!Number.isFinite(point.y)||Math.abs(denominator)<1e-8||Math.abs((x1-x0)*(y3-y0)-(y1-y0)*(x3-x0))<1e-8)throw new Error('The embedded browser viewport has no usable area.');return point;
}
export function framePointReverse(quad:number[],width:number,height:number,x:number,y:number){
 if(quad.length!==8||[...quad,width,height,x,y].some(value=>!Number.isFinite(value))||width<=0||height<=0)throw new Error('The embedded browser viewport is unavailable.');
 const [x0,y0,x1,y1,x2,y2,x3,y3]=quad,dx1=x1-x2,dx2=x3-x2,dx3=x0-x1+x2-x3,dy1=y1-y2,dy2=y3-y2,dy3=y0-y1+y2-y3,det=dx1*dy2-dx2*dy1;let g=0,h=0;if(Math.abs(dx3)+Math.abs(dy3)>1e-8){if(Math.abs(det)<1e-8)throw changed();g=(dx3*dy2-dx2*dy3)/det;h=(dx1*dy3-dx3*dy1)/det;}
 const a=x1-x0+g*x1-x*g,b=x3-x0+h*x3-x*h,d=y1-y0+g*y1-y*g,e=y3-y0+h*y3-y*h,r=x-x0,s=y-y0,denominator=a*e-b*d;if(Math.abs(denominator)<1e-8)throw changed();const point={x:(r*e-b*s)/denominator*width,y:(a*s-r*d)/denominator*height};if(!Number.isFinite(point.x)||!Number.isFinite(point.y))throw changed();return point;
}
export function frameOrigin(frame:BrowserFrame){try{return new URL(browserAddress(frame.url)).origin;}catch{if(['about:blank','about:srcdoc'].includes(frame.url))return 'embedded:'+frame.key;throw new Error('This embedded address needs manual browsing.');}}

export class BrowserFrames{
 private navigation=new WeakMap<WebContents,Navigation>();
 private visualReviews=new WeakMap<WebContents,Map<string,string[]>>();
 constructor(private send:Command,private refresh:(contents:WebContents,signal:AbortSignal)=>Promise<unknown>){}
 private navigationState(c:WebContents){
  let state=this.navigation.get(c);if(state)return state;state={generation:0,versions:new Map(),sessions:new Map(),pending:new Map(),mainEnabled:false};this.navigation.set(c,state);const value=state,debugger_=c.debugger;
  const bump=(id:string)=>{if(value.versions.has(id))value.versions.set(id,value.versions.get(id)!+1);};
  const message=(_event:unknown,method:string,params:any,sessionId?:string)=>{
   if(method==='Target.detachedFromTarget'){for(const [id,session] of value.sessions)if(session===params.sessionId){value.sessions.delete(id);bump(id);}return;}
   if(sessionId&&![...value.sessions.values()].includes(sessionId))return;
   if(method==='Page.navigatedWithinDocument'||method==='Page.frameNavigated'||method==='Page.frameDetached'){const id=params.frameId??params.frame?.id;if(typeof id==='string')bump(id);}
  };
  const detached=()=>{value.generation++;value.mainEnabled=false;value.mainPending=undefined;value.sessions.clear();value.pending.clear();value.versions.clear();};
  debugger_.on('message',message);debugger_.on('detach',detached);c.once('destroyed',()=>{debugger_.removeListener('message',message);debugger_.removeListener('detach',detached);value.sessions.clear();value.pending.clear();value.versions.clear();this.navigation.delete(c);this.visualReviews.delete(c);});return value;
 }
 private async watch(c:WebContents,signal:AbortSignal,target?:string){
  const state=this.navigationState(c),generation=state.generation;
  if(!target){if(state.mainEnabled)return;if(state.mainPending)return state.mainPending;const task=this.send(c,'Page.enable',{},signal).then(()=>{if(state.generation!==generation)throw changed();state.mainEnabled=true;});state.mainPending=task;try{await task;}finally{if(state.mainPending===task)state.mainPending=undefined;}return;}
  if(state.pending.has(target))return state.pending.get(target);if(state.sessions.has(target))return;
  const task=(async()=>{let sessionId:string|undefined;try{sessionId=(await this.send(c,'Target.attachToTarget',{targetId:target,flatten:true},signal)).sessionId;state.sessions.set(target,sessionId!);await this.send(c,'Page.enable',{},signal,sessionId);if(state.generation!==generation||state.sessions.get(target)!==sessionId)throw changed();}catch(error){if(sessionId){if(state.sessions.get(target)===sessionId)state.sessions.delete(target);await this.send(c,'Target.detachFromTarget',{sessionId},AbortSignal.timeout(2000)).catch(()=>{});}throw error;}})();state.pending.set(target,task);try{await task;}finally{if(state.pending.get(target)===task)state.pending.delete(target);}
 }
 private async node(c:WebContents,frame:Frame,backend:number,fn:string,args:unknown[],signal:AbortSignal){
  const command=(method:string,args:Record<string,unknown>)=>this.send(c,method,args,signal,frame.session),{executionContextId}=await command('Page.createIsolatedWorld',{frameId:frame.id,worldName:'Sylvana browser checks',grantUniveralAccess:false});
  const objects:string[]=[];
  try{const resolve=async(backendNodeId:number)=>{const value=await command('DOM.resolveNode',{backendNodeId,executionContextId});if(!value.object.objectId)throw changed();objects.push(value.object.objectId);return value.object.objectId;},document=async()=>{const value=await command('Runtime.evaluate',{contextId:executionContextId,expression:'document'});if(value.exceptionDetails||!value.result?.objectId)throw changed();objects.push(value.result.objectId);return value.result.objectId;},objectId=backend?await resolve(backend):await document(),arguments_=args.map(value=>({value}));
   const value=await command('Runtime.callFunctionOn',{objectId,functionDeclaration:fn,arguments:arguments_,returnByValue:true});if(value.exceptionDetails)throw new Error(value.exceptionDetails.exception?.description?.split('\n')[0].replace(/^Error: /,'')??'The browser control changed. Take a fresh snapshot.');return value.result?.value;
  }finally{for(const objectId of objects)await this.send(c,'Runtime.releaseObject',{objectId},AbortSignal.timeout(2000),frame.session).catch(()=>{});}
 }
 private async scan<T>(c:WebContents,signal:AbortSignal,work:(frames:Map<string,Frame>,main:string,unavailable:number)=>Promise<T>){
  await this.watch(c,signal);const navigation=this.navigationState(c),frames=new Map<string,Frame>(),sessions:string[]=[];let main='',unavailable=0;
  const remove=(id:string)=>{for(const frame of frames.values())if(frame.parent===id)remove(frame.id);frames.delete(id);};
  const scan=async(session?:string)=>{
   const {frameTree}=await this.send(c,'Page.getFrameTree',{},signal,session);if(!main)main=frameTree.frame.id;const root=frameTree.frame.id;
   const visit=(tree:any,parent?:string)=>{if(frames.size>=256)throw new Error('The browser page exceeds the 256-frame inspection limit.');const f=tree.frame;if(!navigation.versions.has(f.id))navigation.versions.set(f.id,0);frames.set(f.id,{id:f.id,url:f.url,name:'',parent:f.parentId??parent,root,session,loader:String(f.loaderId??''),key:''});for(const child of tree.childFrames??[])visit(child,f.id);};visit(frameTree);
   await this.send(c,'DOM.enable',{},signal,session);const {nodes}=await this.send(c,'DOM.getFlattenedDocument',{depth:-1,pierce:true},signal,session);if(nodes.length>200000)throw new Error('The browser page exceeds the frame inspection limit.');
   for(const node of nodes){if(!['IFRAME','FRAME'].includes(node.nodeName)||!node.frameId||frames.has(node.frameId))continue;signal.throwIfAborted();try{await this.watch(c,signal,node.frameId);const {sessionId}=await this.send(c,'Target.attachToTarget',{targetId:node.frameId,flatten:true},signal);sessions.push(sessionId);await scan(sessionId);}catch(error){signal.throwIfAborted();if(!disappeared(error))throw error;unavailable++;remove(node.frameId);}}
  };
  try{await scan();for(const frame of frames.values()){
    if(frame.parent){const parent=frames.get(frame.parent);if(!parent){unavailable++;remove(frame.id);continue;}try{const owner=await this.send(c,'DOM.getFrameOwner',{frameId:frame.id},signal,parent.session);frame.owner=owner.backendNodeId;const {node}=await this.send(c,'DOM.describeNode',{backendNodeId:frame.owner},signal,parent.session);if(!['IFRAME','FRAME'].includes(node.nodeName)||node.frameId!==frame.id){unavailable++;remove(frame.id);continue;}const attrs=node.attributes??[];for(const label of ['title','aria-label','name']){const at=attrs.indexOf(label);if(at>=0&&attrs[at+1]){frame.name=String(attrs[at+1]).slice(0,240);break;}}}catch(error){signal.throwIfAborted();if(!disappeared(error))throw error;unavailable++;remove(frame.id);continue;}}
    const ancestors:unknown[]=[];let current:Frame|undefined=frame;while(current){if(ancestors.length>=64)throw new Error('The browser frame nesting limit was exceeded.');ancestors.push([current.id,current.url,current.loader,current.parent,current.owner,current.name,navigation.versions.get(current.id)??0]);current=current.parent?frames.get(current.parent):undefined;}frame.depth=ancestors.length-1;frame.key=createHash('sha256').update(JSON.stringify([navigation.generation,ancestors])).digest('hex');
   }for(const [id,sessionId] of [...navigation.sessions])if(!frames.has(id)){navigation.sessions.delete(id);await this.send(c,'Target.detachFromTarget',{sessionId},AbortSignal.timeout(2000)).catch(()=>{});}for(const id of navigation.versions.keys())if(!frames.has(id))navigation.versions.delete(id);return await work(frames,main,unavailable);
  }finally{for(const sessionId of sessions.reverse())await this.send(c,'Target.detachFromTarget',{sessionId},AbortSignal.timeout(2000)).catch(()=>{});}
 }
 private async rendered(c:WebContents,frame:Frame,frames:Map<string,Frame>,signal:AbortSignal){
  for(let depth=0;frame.parent;depth++){
   if(depth>=64)throw changed();const parent=frames.get(frame.parent);if(!parent||!frame.owner)throw changed();const visible=await this.node(c,parent,frame.owner,`function(){${browserDomChecks}if(!this.isConnected)return false;const box=Element.prototype.getBoundingClientRect.call(this),style=getComputedStyle(this);if(!box.width||!box.height||['hidden','collapse'].includes(style.visibility))return false;for(let node=this,depth=0;node&&depth<256;depth++){if(node.nodeType===1&&(node.hasAttribute('inert')||node.getAttribute('aria-hidden')==='true'))return false;node=node.assignedSlot||node.parentNode||shadowHost(node);}return true;}`,[],signal);if(!visible)return false;frame=parent;
  }return true;
 }
 async run<T>(c:WebContents,frame:BrowserFrame|undefined,signal:AbortSignal,work:(context:Context)=>Promise<T>):Promise<T>{
  if(!frame){const {frameTree}=await this.send(c,'Page.getFrameTree',{},signal),f:Frame={id:frameTree.frame.id,url:frameTree.frame.url,name:'',key:'',root:frameTree.frame.id,loader:''};return work({frame:f,frames:new Map([[f.id,f]]),command:(method,args={})=>this.send(c,method,args,signal),node:(backend,fn,args)=>this.node(c,f,backend,fn,args,signal)});}
  return this.scan(c,signal,async frames=>{const f=frames.get(frame.id);if(!f||f.key!==frame.key||f.url!==frame.url)throw changed();if(!await this.rendered(c,f,frames,signal))throw new Error('This embedded browser document is hidden or unavailable.');return work({frame:f,frames,command:(method,args={})=>this.send(c,method,args,signal,f.session),node:(backend,fn,args)=>this.node(c,f,backend,fn,args,signal)});});
 }
 async list(c:WebContents,signal:AbortSignal){if(c.mainFrame.framesInSubtree.length===1)return {frames:[],unavailable:0};return this.scan(c,signal,async(frames,main,unavailable)=>{const result:BrowserFrame[]=[];for(const frame of frames.values())if(frame.id!==main)try{if(await this.rendered(c,frame,frames,signal)){const {id,url,name,key,parent,depth}=frame;result.push({id,url,name,key,parent,depth});}}catch(error){signal.throwIfAborted();if(!disappeared(error))throw error;unavailable++;}return {frames:result,unavailable};});}
 async check(c:WebContents,frame:BrowserFrame|undefined,signal:AbortSignal){if(frame)await this.run(c,frame,signal,async()=>{});}
 async visualDocuments(c:WebContents,signal:AbortSignal){return this.scan(c,signal,async(frames,main)=>({main,documents:Object.fromEntries([...frames.values()].map(frame=>[frame.id,{parent:frame.parent??null,stamp:frame.key}]))}));}
 private async viewport(c:WebContents,frame:Frame,signal:AbortSignal){const {executionContextId}=await this.send(c,'Page.createIsolatedWorld',{frameId:frame.id,worldName:'Sylvana browser checks',grantUniveralAccess:false},signal,frame.session),value=await this.send(c,'Runtime.evaluate',{contextId:executionContextId,expression:`(()=>{const width=innerWidth,height=innerHeight,points=[[3,height/2],[width-3,height/2],[width/2,3],[width/2,height-3],[width/2,height/2],[3,3],[width-3,3],[3,height-3],[width-3,height-3]],wheel=[];for(const [x,y] of points){if(x<0||y<0||x>width||y>height)continue;const node=Document.prototype.elementFromPoint.call(document,x,y);if(node&&!Element.prototype.closest.call(node,'iframe,frame,input,select,textarea,button,[contenteditable]'))wheel.push({x,y});}return {width,height,wheel};})()`,returnByValue:true},signal,frame.session);if(value.exceptionDetails)throw changed();return value.result.value as {width:number;height:number;wheel:Array<{x:number;y:number}>};}
 private async contains(c:WebContents,frame:Frame,backend:number,point:{x:number;y:number},signal:AbortSignal){return this.node(c,frame,backend,hitTargetFunction,[point.x,point.y],signal);}
 private async ascend(c:WebContents,context:Context,frame:Frame,point:{x:number;y:number},signal:AbortSignal){
  for(let depth=0;frame.parent;depth++){
   if(depth>=64)throw changed();const parent=context.frames.get(frame.parent);if(!parent||!frame.owner)throw changed();const {model}=await this.send(c,'DOM.getBoxModel',{backendNodeId:frame.owner},signal,parent.session),viewport=await this.viewport(c,frame,signal);point=framePoint(model.content,viewport.width,viewport.height,point.x,point.y);
   if(parent.id!==parent.root){const ancestor=context.frames.get(parent.parent!);if(!ancestor||!parent.owner)throw changed();const outer=await this.send(c,'DOM.getBoxModel',{backendNodeId:parent.owner},signal,ancestor.session),v=await this.viewport(c,parent,signal);point=framePointReverse(outer.model.content,v.width,v.height,point.x,point.y);}
   if(!await this.contains(c,parent,frame.owner,point,signal))throw new Error('Another element covers the embedded browser document. Take a fresh snapshot.');frame=parent;
  }return point;
 }
 private async show(c:WebContents,context:Context,signal:AbortSignal){const ancestors:Frame[]=[];let current:Frame|undefined=context.frame;while(current?.parent){ancestors.unshift(current);current=context.frames.get(current.parent);}for(const frame of ancestors){const parent=context.frames.get(frame.parent!)!;await this.send(c,'DOM.scrollIntoViewIfNeeded',{backendNodeId:frame.owner},signal,parent.session);}}
 async position(c:WebContents,frame:BrowserFrame,backend:number,signal:AbortSignal){return this.run(c,frame,signal,async context=>{
  await this.show(c,context,signal);await context.command('DOM.scrollIntoViewIfNeeded',{backendNodeId:backend});await this.refresh(c,signal);const point=await context.node(backend,'function(){const box=Element.prototype.getBoundingClientRect.call(this);return {x:box.x+box.width/2,y:box.y+box.height/2};}',[]);if(!await this.contains(c,context.frame,backend,point,signal))throw new Error('Another element covers the reviewed target. Take a fresh snapshot.');return this.ascend(c,context,context.frame,point,signal);
 });}
 async scrollPoint(c:WebContents,frame:BrowserFrame,signal:AbortSignal){return this.run(c,frame,signal,async context=>{await this.show(c,context,signal);await this.refresh(c,signal);const v=await this.viewport(c,context.frame,signal),children:Array<{x:number;y:number;width:number;height:number}>=[];for(const child of context.frames.values())if(child.parent===context.frame.id&&child.owner)children.push(await context.node(child.owner,'function(){const b=Element.prototype.getBoundingClientRect.call(this);return {x:b.x,y:b.y,width:b.width,height:b.height};}',[]));
  for(const point of v.wheel){if(children.some(box=>box.width>0&&box.height>0&&point.x>=box.x&&point.x<=box.x+box.width&&point.y>=box.y&&point.y<=box.y+box.height))continue;try{return {...await this.ascend(c,context,context.frame,point,signal),height:v.height};}catch(error){signal.throwIfAborted();if(!/covers|viewport is unavailable/.test((error as Error).message))throw error;}}
  throw new Error('This embedded document has no unobstructed scroll location. Inspect its nested frames or use a fresh browser screenshot.');
 });}
 async focused(c:WebContents,frame:BrowserFrame|undefined,backend:number,signal:AbortSignal){return this.run(c,frame,signal,async context=>{if(!await context.node(backend,focusedTargetFunction,[]))return false;let current=context.frame;while(current.parent){const parent=context.frames.get(current.parent);if(!parent||!current.owner||!await this.node(c,parent,current.owner,focusedTargetFunction,[],signal))return false;current=parent;}return true;});}
 async visualTargets(c:WebContents,fn:string,points:{x:number;y:number}[],key:string,expected:string|null,signal:AbortSignal){
  return this.scan(c,signal,async(frames,main)=>{
   let reviews=this.visualReviews.get(c);if(!reviews){reviews=new Map();this.visualReviews.set(c,reviews);}
   if(expected==='delete'){
    const selected=reviews.get(key)??[];reviews.delete(key);
    for(const id of selected){const frame=frames.get(id);if(frame)await this.node(c,frame,0,fn,[[],key,'delete'],signal).catch(()=>{});}
    return {fingerprint:'',targets:[]};
   }
   const geometry=new Map<string,{quad:number[];width:number;height:number}|null>();
   const box=async(frame:Frame):Promise<{quad:number[];width:number;height:number}|null>=>{
    if(geometry.has(frame.id))return geometry.get(frame.id)!;
    const parent=frame.parent?frames.get(frame.parent):undefined;if(!parent||!frame.owner)throw changed();
    try{const model=await this.send(c,'DOM.getBoxModel',{backendNodeId:frame.owner},signal,parent.session),view=await this.viewport(c,frame,signal),value={quad:model.model.content,width:view.width,height:view.height};geometry.set(frame.id,value);return value;}
    catch(error){signal.throwIfAborted();if(disappeared(error)||/Could not compute box model/.test(String((error as Error).message))){geometry.set(frame.id,null);return null;}throw error;}
   };
   const groups=new Map<string,{frame:Frame;points:{x:number;y:number}[];indices:number[]}>();
   for(const [index,original] of points.entries()){
    signal.throwIfAborted();let frame=frames.get(main)!,point=original;
    for(let depth=0;depth<64;depth++){
     let rootPoint=point;
     if(frame.id!==frame.root){const own=await box(frame);if(!own)throw changed();rootPoint=framePoint(own.quad,own.width,own.height,point.x,point.y);}
     let next:{frame:Frame;point:{x:number;y:number}}|undefined;
     for(const child of frames.values())if(child.parent===frame.id&&child.owner){
      const bounds=await box(child);if(!bounds||bounds.width<=0||bounds.height<=0)continue;
      const xs=bounds.quad.filter((_,n)=>n%2===0),ys=bounds.quad.filter((_,n)=>n%2===1);if(Math.max(...xs)-Math.min(...xs)<1e-8||Math.max(...ys)-Math.min(...ys)<1e-8||rootPoint.x<Math.min(...xs)||rootPoint.x>Math.max(...xs)||rootPoint.y<Math.min(...ys)||rootPoint.y>Math.max(...ys))continue;
      const local=framePointReverse(bounds.quad,bounds.width,bounds.height,rootPoint.x,rootPoint.y);
      if(local.x<0||local.y<0||local.x>=bounds.width||local.y>=bounds.height)continue;
      if(await this.contains(c,frame,child.owner,point,signal)){next={frame:child,point:local};break;}
     }
     if(!next)break;if(depth===63)throw changed();frame=next.frame;point=next.point;
    }
    let group=groups.get(frame.id);if(!group){group={frame,points:[],indices:[]};groups.set(frame.id,group);}group.points.push(point);group.indices.push(index);
   }
   const previous=expected===null?null:JSON.parse(expected) as {id:string;key:string;indices:number[];fingerprint:string}[];
   if(previous&&JSON.stringify(previous.map(({id,key,indices})=>({id,key,indices})))!==JSON.stringify([...groups.values()].map(({frame,indices})=>({id:frame.id,key:frame.key,indices}))))throw changed();
   const bindings:{id:string;key:string;indices:number[];fingerprint:string}[]=[],targets:Record<string,unknown>[]=[];
   if(expected===null){while(reviews.size>=32)reviews.delete(reviews.keys().next().value!);reviews.set(key,[...groups.keys()]);}
   try{for(const [index,group] of [...groups.values()].entries()){
    const result=await this.node(c,group.frame,0,fn,[group.points,key,previous?.[index].fingerprint??null],signal);
    if(result.targets.some((target:{tag:string})=>['IFRAME','FRAME'].includes(target.tag)))throw new Error('The embedded browser target is unavailable. Take another screenshot and inspect its current document.');
    bindings.push({id:group.frame.id,key:group.frame.key,indices:group.indices,fingerprint:result.fingerprint});
    for(let n=0;n<result.targets.length;n++)targets[group.indices[n]]={...result.targets[n],frame_url:group.frame.url,frame_name:group.frame.name};
   }}catch(error){
    reviews.delete(key);for(const group of groups.values())await this.node(c,group.frame,0,fn,[[],key,'delete'],AbortSignal.timeout(2000)).catch(()=>{});throw error;
   }
   return {fingerprint:JSON.stringify(bindings),targets};
  });
 }
}
