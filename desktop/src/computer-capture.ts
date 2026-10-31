import {BrowserWindow,desktopCapturer,nativeImage,session,type DesktopCapturerSource,type NativeImage,type Session} from 'electron';
import {randomUUID} from 'node:crypto';
import type {ComputerBox,NativeComputerWindow} from './computer-contracts';

const origin='https://sylvana-capture.invalid/';
const documentURL='data:text/html;charset=UTF-8,'+encodeURIComponent('<!doctype html><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; media-src blob:; base-uri \'none\'; form-action \'none\'"><title>Private window capture</title>');
const readFrame=String.raw`(async()=>{
 let stream,timer;
 try{
  stream=await navigator.mediaDevices.getDisplayMedia({audio:false,video:{width:{ideal:16384,max:16384},height:{ideal:16384,max:16384},resizeMode:'none',frameRate:{max:10}}});
  const tracks=stream.getVideoTracks(),settings=tracks[0]?.getSettings(),video=document.createElement('video');video.muted=true;
  // Register before playback: an unchanged dialog may emit only its first frame.
  const firstFrame=new Promise((resolve,reject)=>{timer=setTimeout(()=>reject(new Error('No window frame arrived.')),6000);video.requestVideoFrameCallback(()=>{clearTimeout(timer);resolve();});});
  video.srcObject=stream;await Promise.all([video.play(),firstFrame]);
  const width=video.videoWidth,height=video.videoHeight;if(!width||!height||width>16384||height>16384)throw new Error('Invalid captured frame.');
  const scale=Math.min(1,1280/width,960/height),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(width*scale));canvas.height=Math.max(1,Math.round(height*scale));canvas.getContext('2d').drawImage(video,0,0,canvas.width,canvas.height);
  return {image:canvas.toDataURL('image/png'),width:canvas.width,height:canvas.height,nativeWidth:width,nativeHeight:height,source:settings.deviceId,surface:settings.displaySurface,audio:stream.getAudioTracks().length,video:tracks.length};
 }finally{clearTimeout(timer);stream?.getTracks().forEach(track=>track.stop());}
})()`;

function abortable<T>(work:Promise<T>,signal:AbortSignal):Promise<T>{
 return new Promise((resolve,reject)=>{const abort=()=>reject(signal.reason);signal.addEventListener('abort',abort,{once:true});work.then(resolve,reject).finally(()=>signal.removeEventListener('abort',abort));if(signal.aborted)abort();});
}
type Capture={controller:AbortController;window?:BrowserWindow;source?:DesktopCapturerSource;permission:boolean;stream:boolean};

/** Captures only the granted HWND. No audio, camera access, network, or renderer bridge. */
export class ComputerCapture{
 private readonly partition='sylvana-private-capture-'+randomUUID();private isolated?:Session;private active?:Capture;private geometry=new WeakMap<NativeImage,ComputerBox>();
 bounds(image:NativeImage){const box=this.geometry.get(image);return box?{...box}:undefined;}
 stop(){this.active?.controller.abort(new Error('Window capture was cancelled. Take a new snapshot before continuing.'));}
 private captureSession(){
  if(this.isolated)return this.isolated;const isolated=session.fromPartition(this.partition,{cache:false});this.isolated=isolated;
  isolated.setPermissionCheckHandler(()=>false);
  isolated.setPermissionRequestHandler((contents,permission,done,details)=>{const current=this.active;const allowed=!!current?.window&&!current.window.isDestroyed()&&contents===current.window.webContents&&contents.getURL()===documentURL&&!current.controller.signal.aborted&&!current.permission&&!current.stream&&permission==='media'&&details.isMainFrame===true&&'mediaTypes' in details&&Array.isArray(details.mediaTypes)&&details.mediaTypes.length===0&&details.requestingUrl===documentURL&&'securityOrigin' in details&&details.securityOrigin===origin;if(allowed)current!.permission=true;done(allowed);});
  isolated.setDisplayMediaRequestHandler((request,done)=>{const current=this.active,contents=current?.window&&!current.window.isDestroyed()?current.window.webContents:undefined,frame=contents?.mainFrame;const allowed=!!current?.source&&!!frame&&!current.controller.signal.aborted&&current.permission&&!current.stream&&contents!.getURL()===documentURL&&request.frame?.processId===frame.processId&&request.frame?.routingId===frame.routingId&&request.frame.url===documentURL&&request.securityOrigin===origin&&request.videoRequested&&!request.audioRequested&&request.userGesture;if(!allowed){done(null);return;}current!.stream=true;done({video:current!.source!});});
  isolated.webRequest.onBeforeRequest((request,done)=>done({cancel:request.url!==documentURL}));return isolated;
 }
 async capture(target:NativeComputerWindow,signal:AbortSignal):Promise<NativeImage>{
  signal.throwIfAborted();if(this.active)throw new Error('Another window capture is still active.');if(!/^\d+$/.test(target.handle)||target.minimized||target.blocked)throw new Error('The selected window is not available for capture.');
  const current:Capture={controller:new AbortController(),permission:false,stream:false};this.active=current;const combined=AbortSignal.any([signal,current.controller.signal,AbortSignal.timeout(10000)]),destroy=()=>{if(current.window&&!current.window.isDestroyed())current.window.destroy();};combined.addEventListener('abort',destroy,{once:true});
  try{
   const sources=await abortable(desktopCapturer.getSources({types:['window'],thumbnailSize:{width:0,height:0},fetchWindowIcons:false}),combined);combined.throwIfAborted();
   current.source=sources.find(source=>source.id.startsWith('window:')&&source.id.split(':')[1]===target.handle);if(!current.source)throw new Error('The selected window is no longer available.');
   const window=new BrowserWindow({show:false,width:1280,height:960,webPreferences:{session:this.captureSession(),sandbox:true,contextIsolation:true,nodeIntegration:false,webviewTag:false,webSecurity:true,backgroundThrottling:false,offscreen:true}});current.window=window;
   window.webContents.setWindowOpenHandler(()=>({action:'deny'}));window.webContents.on('will-navigate',event=>event.preventDefault());window.webContents.on('will-frame-navigate',event=>event.preventDefault());window.webContents.once('render-process-gone',()=>current.controller.abort(new Error('Window capture stopped.')));
   // A fixed, network-free document gets a secure origin without loading a site or file.
   await abortable(window.loadURL(documentURL,{baseURLForDataURL:origin}),combined);combined.throwIfAborted();const result=await abortable(window.webContents.executeJavaScript(readFrame,true),combined);combined.throwIfAborted();
   if(!current.stream||result?.source!==current.source.id||result.surface!=='window'||result.audio!==0||result.video!==1||!Number.isInteger(result.width)||!Number.isInteger(result.height)||result.width<1||result.width>1280||result.height<1||result.height>960||typeof result.image!=='string'||result.image.length>7000000||!/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(result.image))throw new Error('The selected window returned an invalid frame.');
   const boxes=[...target.captures,target.client,target.frame,target.outer],matches=boxes.filter(box=>box.width===result.nativeWidth&&box.height===result.nativeHeight);if(!matches.length||matches.some(box=>(['left','top','width','height'] as const).some(key=>Math.abs(box[key]-matches[0][key])>2)))throw new Error('The captured source bounds could not be established.',{cause:{width:result.nativeWidth,height:result.nativeHeight,boxes}});
   const image=nativeImage.createFromDataURL(result.image),size=image.getSize();if(image.isEmpty()||size.width!==result.width||size.height!==result.height)throw new Error('The selected window returned an invalid image.');this.geometry.set(image,{...matches[0]});return image;
  }catch(error){if(signal.aborted)throw signal.reason;if(current.controller.signal.aborted)throw current.controller.signal.reason;throw new Error('The selected window could not provide a captured frame. Restore it and take a new snapshot.',{cause:error});}
  finally{combined.removeEventListener('abort',destroy);destroy();if(this.active===current)this.active=undefined;}
 }
}
