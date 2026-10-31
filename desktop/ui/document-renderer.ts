import {renderAsync} from 'docx-preview';
import {getDocument,type PDFDocumentProxy,type RenderTask} from 'pdfjs-dist';
import * as pdfWorker from 'pdfjs-dist/build/pdf.worker.mjs';
import type {PptxViewer} from '@aiden0z/pptx-renderer';
import './document-viewer.css';

// This entry runs only in a sandboxed, opaque-origin frame. It has no preload,
// filesystem, account, tool bridge, external resources, or navigation permission.
(globalThis as unknown as {pdfjsWorker:unknown}).pdfjsWorker=pdfWorker;
const pages=document.getElementById('pages')!,status=document.getElementById('status')!,pageInput=document.getElementById('page') as HTMLInputElement,count=document.getElementById('count')!,previous=document.getElementById('previous') as HTMLButtonElement,next=document.getElementById('next') as HTMLButtonElement;
let opened=false,zoom=0,shownScale=1,page=1,pdf:PDFDocumentProxy|undefined,presentation:PptxViewer|undefined,renderTask:RenderTask|undefined,serial=0;
let presenting=false,previewZoom=0,lastActivity=0;
const lifetime=new AbortController();
const report=(type:string,extra:Record<string,unknown>={})=>parent.postMessage({channel:'sylvana-document',type,...extra},'*');
const asset=(name:string)=>new URL('pdf/'+name+'/',location.href).href;
function wordScale(){const first=pages.querySelector('section') as HTMLElement|null;if(!first)return;const width=first.offsetWidth||816,scale=zoom||Math.min(1,(pages.clientWidth-48)/width);shownScale=scale;pages.style.setProperty('--document-zoom',String(scale));pages.querySelectorAll<HTMLElement>('section.docx').forEach(section=>{section.style.zoom=String(scale);});report('rendered',{pages:pages.querySelectorAll('section.docx').length,zoom:Math.round(scale*100)});}
async function renderPage(){
 if(presentation){pages.dataset.fit=String(!zoom);const revision=++serial;try{await presentation.setFitMode(zoom?'none':'contain');await presentation.setZoom(zoom?zoom*100:100);if(presentation.currentSlideIndex!==page-1)await presentation.renderSlide(page-1);if(revision!==serial)return;status.textContent='';report('rendered',{page,pages:presentation.slideCount,zoom:Math.round(presentation.zoomPercent),fit:!zoom});}catch{if(revision===serial){status.textContent='This slide could not be displayed. Use extracted text or open the original file.';report('error');}}return;}
 if(!pdf){wordScale();return;}
 const revision=++serial;renderTask?.cancel();status.textContent='Rendering page…';
 try{const source=await pdf.getPage(page);if(revision!==serial)return;
  const size=source.getViewport({scale:1}),scale=zoom?zoom*(96/72):Math.min(2,(pages.clientWidth-48)/size.width),pixelRatio=Math.min(devicePixelRatio||1,2),safeScale=Math.min(scale,Math.sqrt(12_000_000/(size.width*size.height))/pixelRatio),viewport=source.getViewport({scale:safeScale}),canvas=document.createElement('canvas');
  canvas.setAttribute('role','img');canvas.setAttribute('aria-label','Document page '+page);canvas.width=Math.ceil(viewport.width*pixelRatio);canvas.height=Math.ceil(viewport.height*pixelRatio);canvas.style.width=viewport.width+'px';canvas.style.height=viewport.height+'px';
  shownScale=safeScale/(96/72);const context=canvas.getContext('2d',{alpha:false});if(!context)throw Error('Page rendering is unavailable.');
  renderTask=source.render({canvas,canvasContext:context,viewport,transform:pixelRatio===1?undefined:[pixelRatio,0,0,pixelRatio,0,0],background:'#ffffff'});await renderTask.promise;if(revision!==serial)return;
  pages.replaceChildren(canvas);status.textContent='';pageInput.value=String(page);previous.disabled=page===1;next.disabled=page>=pdf.numPages;report('rendered',{page,pages:pdf.numPages,zoom:Math.round(shownScale*100)});
 }catch(error){if((error as Error).name==='RenderingCancelledException')return;status.textContent='This page could not be displayed. Use extracted text or open the original file.';report('error');}
}
function navigate(value:number){const total=presentation?.slideCount??pdf?.numPages;if(!total)return;page=Math.max(1,Math.min(total,Number.isFinite(value)?Math.floor(value):1));void renderPage();}
function present(active:boolean){if(!presentation||active===presenting)return;presenting=active;document.body.dataset.presenting=String(active);if(active){previewZoom=zoom;zoom=0;pages.style.setProperty('--slide-ratio',String(presentation.slideWidth/presentation.slideHeight));}else zoom=previewZoom;window.scrollTo(0,0);pages.scrollTo(0,0);void renderPage();}
previous.onclick=()=>navigate(page-1);next.onclick=()=>navigate(page+1);pageInput.onchange=()=>navigate(Number(pageInput.value));
document.getElementById('fit')!.onclick=()=>{zoom=0;void renderPage();};
document.getElementById('in')!.onclick=()=>{zoom=Math.min(3,(zoom||shownScale)+.25);void renderPage();};
document.getElementById('out')!.onclick=()=>{zoom=Math.max(.25,(zoom||shownScale)-.25);void renderPage();};
let resizeTimer:ReturnType<typeof setTimeout>,lastWidth=0,lastHeight=0;new ResizeObserver(entries=>{const width=entries[0]?.contentRect.width??0,height=entries[0]?.contentRect.height??0;if(Math.abs(width-lastWidth)<1&&(!presenting||Math.abs(height-lastHeight)<1))return;lastWidth=width;lastHeight=height;clearTimeout(resizeTimer);resizeTimer=setTimeout(()=>void renderPage(),150);}).observe(document.body);
// Do not navigate hyperlinks or submit document-provided forms from the viewer.
document.addEventListener('click',event=>{if((event.target as Element)?.closest('a'))event.preventDefault();},true);
document.addEventListener('submit',event=>event.preventDefault(),true);
document.addEventListener('pointermove',()=>{if(presenting&&Date.now()-lastActivity>300){lastActivity=Date.now();report('presentation-activity');}});
document.addEventListener('keydown',event=>{if(!presentation||(event.target as Element)?.closest('input,textarea,select,[contenteditable=true]'))return;if(presenting){report('presentation-activity');if(event.key==='Escape'){event.preventDefault();report('exit-presentation');return;}if(event.key==='Tab'){event.preventDefault();report('presentation-controls',{reverse:event.shiftKey});return;}}if(['ArrowRight','PageDown','ArrowLeft','PageUp','Home','End',...(presenting?[' ']:[])].includes(event.key)){event.preventDefault();navigate(event.key==='Home'?1:event.key==='End'?presentation.slideCount:page+(['ArrowLeft','PageUp'].includes(event.key)?-1:1));}});
window.addEventListener('pagehide',()=>{lifetime.abort();presentation?.destroy();void pdf?.loadingTask.destroy();});
window.addEventListener('message',event=>{if(event.source!==parent||event.data?.channel!=='sylvana-document')return;if(event.data.type==='theme'){document.documentElement.dataset.theme=event.data.value===1?'light':'dark';return;}if(opened){if(event.data.type==='zoom'&&Number.isFinite(event.data.value)&&(event.data.value===0||event.data.value>=.25&&event.data.value<=3)){zoom=event.data.value;void renderPage();}else if(event.data.type==='page')navigate(Number(event.data.value));else if(event.data.type==='step'&&[1,-1].includes(event.data.value))navigate(page+event.data.value);else if(event.data.type==='presentation'&&[0,1].includes(event.data.value))present(event.data.value===1);return;}if(event.data.type!=='open')return;opened=true;void(async()=>{
 try{const {bytes,extension}=event.data;if(!(bytes instanceof ArrayBuffer)||!bytes.byteLength||bytes.byteLength>20*1024*1024)throw Error('Invalid document.');
  if(extension==='.pdf'){pdf=await getDocument({data:new Uint8Array(bytes),enableXfa:false,cMapUrl:asset('cmaps'),cMapPacked:true,standardFontDataUrl:asset('standard_fonts'),wasmUrl:asset('wasm'),useSystemFonts:true,verbosity:0}).promise;count.textContent='/ '+pdf.numPages;pageInput.max=String(pdf.numPages);await renderPage();}
  else if(extension==='.docx'){for(const id of ['previous','page-label','next'])document.getElementById(id)!.hidden=true;
   await renderAsync(bytes,pages,undefined,{className:'docx',inWrapper:true,breakPages:true,ignoreLastRenderedPageBreak:false,useBase64URL:true,renderAltChunks:false,renderComments:false,renderChanges:false,debug:false});wordScale();status.textContent='';report('rendered',{pages:pages.querySelectorAll('section.docx').length});
  }else if(extension==='.pptx'){
   const {PptxViewer}=await import('@aiden0z/pptx-renderer');pages.dataset.documentKind='presentation';const host=document.createElement('div');host.className='presentation-host';pages.replaceChildren(host);
   presentation=new PptxViewer(host,{fitMode:'contain',externalMedia:'block',pdfjs:false,lazyMedia:true,lazySlides:true,zipLimits:{maxEntries:4000,maxEntryUncompressedBytes:16*1024*1024,maxTotalUncompressedBytes:64*1024*1024,maxMediaBytes:32*1024*1024,maxConcurrency:2}});
   await presentation.open(bytes,{renderMode:'slide',signal:lifetime.signal});if(!presentation.slideCount||presentation.slideCount>200)throw Error('Presentation slide limit exceeded.');pages.style.setProperty('--slide-ratio',String(presentation.slideWidth/presentation.slideHeight));pages.dataset.fit='true';status.textContent='';report('rendered',{page:1,pages:presentation.slideCount,zoom:100,fit:true});
  }else throw Error('Unsupported visual document.');
 }catch{status.textContent='This document could not be displayed. Use extracted text or open the original file.';report('error');}
 })();});
report('ready');
