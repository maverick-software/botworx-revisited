import {nativeImage,BrowserWindow,session} from 'electron';
import {randomUUID} from 'node:crypto';
import {avatarDimensions} from './agent-presentation';
export async function normalizeAgentAvatar(bytes:Buffer){
 const header=avatarDimensions(bytes);let image=nativeImage.createFromBuffer(bytes);
 if(image.isEmpty()&&header.format==='webp'){
  const isolated=session.fromPartition('agent-avatar-'+randomUUID());isolated.setPermissionRequestHandler((_contents,_permission,callback)=>callback(false));isolated.webRequest.onBeforeRequest((details,callback)=>callback({cancel:!details.url.startsWith('about:')&&!details.url.startsWith('data:image/webp;base64,')}));
  const window=new BrowserWindow({show:false,width:256,height:256,webPreferences:{session:isolated,sandbox:true,contextIsolation:true,nodeIntegration:false,backgroundThrottling:false}});window.webContents.setWindowOpenHandler(()=>({action:'deny'}));let timer:ReturnType<typeof setTimeout>|undefined;
  try{await window.loadURL('about:blank');const data='data:image/webp;base64,'+bytes.toString('base64'),script='('+((data:string)=>new Promise<string>((resolve,reject)=>{const image=new Image();image.onload=()=>{try{if(image.naturalWidth<1||image.naturalHeight<1||image.naturalWidth>8192||image.naturalHeight>8192||image.naturalWidth*image.naturalHeight>16000000)throw Error('Image dimensions are unsupported.');const side=Math.min(image.naturalWidth,image.naturalHeight),canvas=document.createElement('canvas');canvas.width=128;canvas.height=128;canvas.getContext('2d')!.drawImage(image,Math.floor((image.naturalWidth-side)/2),Math.floor((image.naturalHeight-side)/2),side,side,0,0,128,128);resolve(canvas.toDataURL('image/png'));}catch(error){reject(error);}};image.onerror=()=>reject(Error('The WebP image could not be decoded.'));image.src=data;})).toString()+')('+JSON.stringify(data)+')';
   const png=await Promise.race([window.webContents.executeJavaScript(script) as Promise<string>,new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(Error('The profile image took too long to decode.')),15000);})]);if(!/^data:image\/png;base64,/.test(png)||png.length>132000)throw Error('The image thumbnail is too large.');image=nativeImage.createFromBuffer(Buffer.from(png.slice(22),'base64'));
  }finally{if(timer)clearTimeout(timer);window.destroy();}
 }
 const size=image.getSize();
 if(image.isEmpty()||size.width<1||size.height<1||size.width>8192||size.height>8192||size.width*size.height>16000000)throw Error('The profile image could not be decoded.');
 const side=Math.min(size.width,size.height);
 return image.crop({x:Math.floor((size.width-side)/2),y:Math.floor((size.height-side)/2),width:side,height:side}).resize({width:128,height:128,quality:'good'}).toPNG();
}
