import {app,BrowserWindow,session} from 'electron';
import path from 'node:path';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {imageData} from './attachment-images';
import {maxDocumentBytes} from './document-contracts';
import {maxPdfPageImageBytes,pdfPageNumbers,type PdfPageImage,type PdfPageRenderer} from './pdf-page-contracts';

/** Local PDF.js renderer with no preload, account session, tool bridge or network. */
export class PdfPages implements PdfPageRenderer{
 private windows=new Set<BrowserWindow>();private closed=false;
 constructor(private assets?:string){}
 async render(bytes:Uint8Array,pages:number[],signal:AbortSignal):Promise<PdfPageImage[]>{
  signal.throwIfAborted();pdfPageNumbers(pages);if(this.closed||!app?.isReady())throw Error('PDF page reading is unavailable.');if(!bytes.length||bytes.length>maxDocumentBytes)throw Error('Choose a PDF of 20 MB or smaller.');
  const assets=path.resolve(this.assets??(app.isPackaged?path.join(process.resourcesPath,'resources/ui'):path.join(__dirname,'../resources/ui'))),isolated=session.fromPartition('pdf-pages-'+randomUUID(),{cache:false});
  isolated.setPermissionRequestHandler((_web,_permission,callback)=>callback(false));isolated.setPermissionCheckHandler(()=>false);isolated.on('will-download',event=>event.preventDefault());
  const allowed=(raw:string)=>{try{const url=new URL(raw);return url.protocol==='sylvana:'&&url.hostname==='app'&&!url.username&&!url.password&&!url.port&&(/^\/assets\//.test(url.pathname)||/^\/pdf\//.test(url.pathname)||url.pathname==='/pdf-pages.html');}catch{return false;}};
  isolated.webRequest.onBeforeRequest((details,callback)=>callback({cancel:!allowed(details.url)}));
  isolated.protocol.handle('sylvana',async request=>{
   if(request.method!=='GET'||!allowed(request.url))return new Response('Not found',{status:404});let relative:string;try{relative=decodeURIComponent(new URL(request.url).pathname);}catch{return new Response('Invalid path',{status:400});}const file=path.resolve(assets,'.'+relative);if(!file.startsWith(assets+path.sep))return new Response('Forbidden',{status:403});
   const types:Record<string,string>={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.woff2':'font/woff2','.ttf':'font/ttf','.otf':'font/otf','.wasm':'application/wasm'};
    try{return new Response(await readFile(file),{headers:{'Content-Type':types[path.extname(file)]??'application/octet-stream','Content-Security-Policy':"default-src 'none'; script-src 'self'; connect-src 'self'; style-src 'unsafe-inline'; img-src data: blob:; font-src 'self' data: blob:; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'"}});}catch{return new Response('Not found',{status:404});}
  });
  const window=new BrowserWindow({show:false,width:800,height:600,webPreferences:{session:isolated,contextIsolation:true,nodeIntegration:false,sandbox:true,webviewTag:false,devTools:false,backgroundThrottling:false,offscreen:true}});this.windows.add(window);window.webContents.setWindowOpenHandler(()=>({action:'deny'}));window.webContents.on('will-navigate',event=>event.preventDefault());
  let timer:ReturnType<typeof setTimeout>|undefined,rejectCancelled:(reason:unknown)=>void=()=>{};const cancelled=new Promise<never>((_,reject)=>{rejectCancelled=reject;}),abort=()=>{if(!window.isDestroyed())window.destroy();rejectCancelled(signal.reason??Error('PDF page reading was cancelled.'));};signal.addEventListener('abort',abort,{once:true});
  try{
   const result=await Promise.race([ (async()=>{await window.loadURL('sylvana://app/pdf-pages.html');signal.throwIfAborted();return window.webContents.executeJavaScript('globalThis.__sylvanaPdfPages('+JSON.stringify({base64:Buffer.from(bytes).toString('base64'),pages})+')');})(),cancelled,new Promise<never>((_,reject)=>{timer=setTimeout(()=>{if(!window.isDestroyed())window.destroy();reject(Error('PDF page rendering exceeded 30 seconds. Read fewer or smaller pages.'));},30000);})]);signal.throwIfAborted();
   if(!Array.isArray(result)||result.length!==pages.length)throw Error('PDF page reading returned invalid images.');for(const [index,page]of result.entries()){if(page?.page!==pages[index]||!Number.isInteger(page.width)||!Number.isInteger(page.height)||page.width<1||page.height<1||page.width*page.height>4000000||typeof page.image!=='string'||!page.image.startsWith('data:image/jpeg;base64,'))throw Error('PDF page reading exceeded its image bounds.');const image=Buffer.from(page.image.slice(page.image.indexOf(',')+1),'base64');if(image.length>maxPdfPageImageBytes||imageData(image)!==page.image)throw Error('PDF page reading returned an invalid image.');}return result;
  }catch(error){signal.throwIfAborted();throw error;}finally{if(timer)clearTimeout(timer);signal.removeEventListener('abort',abort);if(!window.isDestroyed())window.destroy();this.windows.delete(window);isolated.webRequest.onBeforeRequest(null);await isolated.protocol.unhandle('sylvana');await isolated.clearStorageData();}
 }
 close(){this.closed=true;for(const window of this.windows)if(!window.isDestroyed())window.destroy();this.windows.clear();}
}
