import {randomUUID} from 'node:crypto';

type ToolResult={isError?:boolean;structuredContent?:unknown;content?:unknown};
type Invoke=(name:string,args:Record<string,unknown>)=>Promise<ToolResult>;
export type ChromeContextTab={id:string;title:string;url:string;status:'live';browser:'chrome'};
type Page={id:number;title:string;url:string;selected:boolean};
type Source={id:string;page:number;url:string};
export interface ChromeContextRuntime{
 ready(owner:string):boolean;
 signature(owner:string):string;
 contextOperation<T>(owner:string,signal:AbortSignal,guard:()=>Promise<void>,run:(invoke:Invoke)=>Promise<T>):Promise<T>;
}
function address(value:unknown):string|undefined{
 if(typeof value!=='string'||value.length>4096)return;
 try{const url=new URL(value);if(['http:','https:'].includes(url.protocol)&&!url.username&&!url.password)return url.href;}catch{}
}
function pages(result:ToolResult):Page[]{
 if(result.isError)throw Error('Chrome could not list its tabs. Reconnect Chrome and try again.');
 const rows=(result.structuredContent as {pages?:unknown})?.pages;
 if(!Array.isArray(rows)||rows.length>1000)throw Error('Chrome returned an unsupported tab list.');
 const ids=new Set<number>();
 return rows.flatMap(row=>{
  if(!row||!Number.isSafeInteger(row.id)||row.id<0||ids.has(row.id))throw Error('Chrome returned an invalid tab list.');
  ids.add(row.id);const url=address(row.url);return url?[{id:row.id,url,title:typeof row.title==='string'?row.title.replace(/\s+/g,' ').slice(0,240):'',selected:row.selected===true}]:[];
 });
}

// Fixed read-only page code. The selected URL is data, never executable source.
export function chromePageText(expected:string){
 if(location.href!==expected)throw Error('The Chrome page navigated. Select it again.');
 const parts:string[]=[];let length=0,visited=0,truncated=false;
 if(document.body){
  const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);
  let node:Node|null;
  while((node=walker.nextNode())){
   if(++visited>10000){truncated=true;break;}
   const parent=node.parentElement;if(!parent||parent.closest('script,style,noscript,template,input,textarea,select,[contenteditable]:not([contenteditable="false"]),[role="textbox"],[role="combobox"],[hidden],[aria-hidden="true"]'))continue;
   let visible=true;
   for(let element:Element|null=parent;element;element=element.parentElement){const style=getComputedStyle(element);if(style.display==='none'||style.visibility==='hidden'||style.visibility==='collapse'||Number(style.opacity)===0){visible=false;break;}}
   if(!visible||!parent.getClientRects().length)continue;
   const text=node.textContent?.replace(/\s+/g,' ').trim();if(!text)continue;
   const available=12000-length;if(available<=0){truncated=true;break;}
   parts.push(text.slice(0,available));length+=Math.min(available,text.length)+1;
   if(text.length>available){truncated=true;break;}
  }
 }
 if(location.href!==expected)throw Error('The Chrome page navigated. Select it again.');
 return {url:location.href,title:document.title,text:parts.join('\n').slice(0,12000),truncated};
}

function snapshot(result:ToolResult){
 if(result.isError)throw Error('Chrome could not read this page. Select the tab again.');
 const content=result.content;if(!Array.isArray(content))throw Error('Chrome returned an unsupported page snapshot.');
 const text=content.filter(row=>row?.type==='text'&&typeof row.text==='string').map(row=>row.text).join('\n');
 if(text.length>100000)throw Error('Chrome returned an oversized page snapshot.');
 const match=/Script ran on page and returned:\r?\n```json\r?\n([\s\S]*?)\r?\n```/.exec(text);
 if(!match)throw Error('Chrome returned an unsupported page snapshot.');
 let value;try{value=JSON.parse(match[1]);}catch{throw Error('Chrome returned an invalid page snapshot.');}
 if(!value||typeof value.url!=='string'||typeof value.title!=='string'||typeof value.text!=='string'||value.text.length>12000||typeof value.truncated!=='boolean')throw Error('Chrome returned an invalid page snapshot.');
 return value as {url:string;title:string;text:string;truncated:boolean};
}

/** Explicit user-selected snapshots; these handles grant no agent browser tools. */
export class ChromeContext{
 private catalogs=new Map<string,{signature:string;sources:Map<number,Source>}>();
 constructor(private runtime:ChromeContextRuntime){}
 async list(owner:string,signal:AbortSignal,guard:()=>Promise<void>):Promise<{tabs:ChromeContextTab[]}>{
  signal.throwIfAborted();await guard();
  if(!this.runtime.ready(owner)){this.catalogs.delete(owner);return {tabs:[]};}
  const signature=this.runtime.signature(owner);
  return this.runtime.contextOperation(owner,signal,guard,async invoke=>{
   const rows=pages(await invoke('list_pages',{}));
   const old=this.catalogs.get(owner),sources=new Map<number,Source>();
   const tabs=rows.map(row=>{const prior=old?.signature===signature?old.sources.get(row.id):undefined;const source=prior?.url===row.url?prior:{id:randomUUID(),page:row.id,url:row.url};sources.set(row.id,source);return {id:source.id,title:row.title||new URL(row.url).hostname,url:row.url,status:'live' as const,browser:'chrome' as const};});
   if(this.runtime.signature(owner)!==signature)throw Error('The Chrome connection changed. Select the tab again.');
   this.catalogs.set(owner,{signature,sources});return {tabs};
  });
 }
 async read(owner:string,id:string,url:string,signal:AbortSignal,guard:()=>Promise<void>){
  const catalog=this.catalogs.get(owner),source=[...catalog?.sources.values()??[]].find(row=>row.id===id);
  if(!source||source.url!==url||!address(url))throw Error('Select an available Chrome tab again.');
  if(!this.runtime.ready(owner)||this.runtime.signature(owner)!==catalog!.signature)throw Error('The Chrome connection changed. Select the tab again.');
  return this.runtime.contextOperation(owner,signal,guard,async invoke=>{
   const before=pages(await invoke('list_pages',{})),page=before.find(row=>row.id===source.page);
   if(page?.url!==url)throw Error('The Chrome page closed or navigated. Select it again.');
    const value=snapshot(await invoke('evaluate_script',{pageId:source.page,function:'()=>('+chromePageText.toString()+')('+JSON.stringify(url)+')'}));
    const after=pages(await invoke('list_pages',{}));
    if(value.url!==url||after.find(row=>row.id===source.page)?.url!==url||this.runtime.signature(owner)!==catalog!.signature)throw Error('The Chrome page or connection changed while reading. Select it again.');
    return {id,title:value.title.replace(/\s+/g,' ').slice(0,240)||page.title,url,text:value.text,notice:'Chrome main-page text snapshot; frames, form values and editable fields are excluded. '+(value.truncated?'Partial content: up to 12,000 characters and 10,000 text nodes.':'Up to 12,000 characters.')};
  });
 }
}
