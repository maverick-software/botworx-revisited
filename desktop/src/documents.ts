import {Worker} from 'node:worker_threads';
import {randomUUID} from 'node:crypto';
import path from 'node:path';
import {documentTypes,maxDocumentBytes,type DocumentPreview} from './document-contracts';
import {pdfPageNumbers,type PdfPageRenderer} from './pdf-page-contracts';
export type DocumentReadOptions={signal?:AbortSignal;id?:string;limit?:number;generation?:number;pages?:number[]|'scanned';pageLimit?:number};
export class DocumentReader{
 private active=0;private closed=false;
 private queue:{signal:AbortSignal;start:()=>void;cancel:()=>void}[]=[];
 private jobs=new Map<string,{owner:string;cancel:()=>void;done:Promise<DocumentPreview>}>();
 private cancelled=new Map<string,number>();private epochs=new Map<string,number>();
 constructor(private settings:{timeoutMs?:number;workerFile?:string;pdf?:PdfPageRenderer}={}){}
 private slot(signal:AbortSignal):Promise<()=>void>{
  signal.throwIfAborted();return new Promise((resolve,reject)=>{
   const start=()=>{signal.removeEventListener('abort',cancel);this.active++;let released=false;resolve(()=>{if(released)return;released=true;this.active--;while(this.queue.length){const next=this.queue.shift()!;if(!next.signal.aborted){next.start();break;}}});};
   const cancel=()=>{this.queue=this.queue.filter(item=>item.start!==start);reject(signal.reason);};
   if(this.active<2)start();else{this.queue.push({signal,start,cancel});signal.addEventListener('abort',cancel,{once:true});}
  });
 }
 generation(owner:string){return this.epochs.get(owner)??0;}
 read(owner:string,bytes:Uint8Array,extension:string,options:DocumentReadOptions={}):Promise<DocumentPreview>{
  const {signal}=options,id=options.id??randomUUID(),limit=Number.isFinite(options.limit)?Math.max(1,Math.min(160000,Math.floor(options.limit!))):160000;
  for(const [key,expires] of this.cancelled)if(expires<Date.now())this.cancelled.delete(key);
  if(this.cancelled.delete(owner+':'+id)||options.generation!==undefined&&options.generation!==this.generation(owner))return Promise.reject(new Error('Document reading was cancelled.'));
  if(this.closed)return Promise.reject(new Error('Document reading has stopped.'));
  if(!documentTypes.has(extension)||!bytes.length||bytes.length>maxDocumentBytes)return Promise.reject(new Error('Choose a PDF, DOCX, XLSX, or PPTX file smaller than 20 MB.'));
  if(options.pages!==undefined){if(extension!=='.pdf')return Promise.reject(Error('Page images are available for PDFs.'));if(options.pages!=='scanned')pdfPageNumbers(options.pages);if(options.pageLimit!==undefined&&(!Number.isInteger(options.pageLimit)||options.pageLimit<0||options.pageLimit>2))return Promise.reject(Error('Choose at most two PDF page images per read.'));}
  if(this.jobs.has(id)||this.jobs.size>=10)return Promise.reject(new Error('Too many documents are being opened. Wait for the current reads or close a preview.'));
  const controller=new AbortController(),cancel=()=>controller.abort(new Error('Document reading was cancelled.'));signal?.addEventListener('abort',cancel,{once:true});if(signal?.aborted)cancel();
  const timer=setTimeout(()=>controller.abort(new Error('Document reading exceeded 30 seconds. Use a smaller document.')),this.settings.timeoutMs??30000);
  const done=this.run(bytes,extension,limit,controller.signal,options).finally(()=>{clearTimeout(timer);signal?.removeEventListener('abort',cancel);if(this.jobs.get(id)?.done===done)this.jobs.delete(id);});
  this.jobs.set(id,{owner,cancel,done});return done;
 }
 private async run(bytes:Uint8Array,extension:string,limit:number,signal:AbortSignal,options:DocumentReadOptions):Promise<DocumentPreview>{
  const release=await this.slot(signal);let worker:Worker|undefined;
  try{
   signal.throwIfAborted();const data=Uint8Array.from(bytes);
   worker=new Worker(this.settings.workerFile??path.join(__dirname,'document-worker.js'),{workerData:{data,extension,limit},transferList:[data.buffer],resourceLimits:{maxOldGenerationSizeMb:256,maxYoungGenerationSizeMb:16,stackSizeMb:4},stdout:true,stderr:true});worker.stdout?.resume();worker.stderr?.resume();
   const result=await new Promise<DocumentPreview>((resolve,reject)=>{
    const abort=()=>reject(signal.reason),clean=()=>signal.removeEventListener('abort',abort);signal.addEventListener('abort',abort,{once:true});
    worker!.once('message',message=>{clean();if(message?.ok&&message.result)resolve(message.result);else reject(new Error(typeof message?.error==='string'?message.error:'The document could not be read.'));});
    worker!.once('error',error=>{clean();reject(new Error((error as NodeJS.ErrnoException).code==='ERR_WORKER_OUT_OF_MEMORY'?'The document exceeded the reader’s memory limit. Use a smaller document.':'The document reader stopped unexpectedly. Retry or use a smaller document.'));});
    worker!.once('exit',()=>{clean();reject(new Error('The document reader stopped before finishing.'));});
   });
   await worker.terminate();worker=undefined;signal.throwIfAborted();
   if(options.pages!==undefined){const pages=options.pages==='scanned'?(result.pagesWithoutText??[]).slice(0,options.pageLimit??2):pdfPageNumbers(options.pages,result.totalUnits);if(pages.length){if(!this.settings.pdf)throw Error('PDF page rendering is unavailable.');result.pageImages=await this.settings.pdf.render(bytes,pages,signal);}result.notice=[result.notice,result.pageImages?.length?'Page images supplied for pages '+pages.join(', ')+' of '+result.totalUnits+'.':undefined,'Use read_file with pages:[page numbers] to inspect other PDF pages or their visual layout, up to two pages per read.'].filter(Boolean).join(' ');}
   signal.throwIfAborted();return result;
  }finally{if(worker)await worker.terminate();release();}
 }
 cancel(owner:string,id:string){const job=this.jobs.get(id);if(job?.owner===owner)job.cancel();else{if(this.cancelled.size>=1000)this.cancelled.delete(this.cancelled.keys().next().value!);this.cancelled.set(owner+':'+id,Date.now()+30000);}}
 cancelOwner(owner:string){this.epochs.set(owner,this.generation(owner)+1);for(const job of this.jobs.values())if(job.owner===owner)job.cancel();}
 async close(){this.closed=true;for(const job of this.jobs.values())job.cancel();await Promise.allSettled([...this.jobs.values()].map(job=>job.done));await this.settings.pdf?.close();}
}
