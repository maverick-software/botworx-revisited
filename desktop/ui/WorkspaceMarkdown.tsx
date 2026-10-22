import React,{useContext,createContext,useEffect,useMemo,useRef,useState} from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type {Root} from 'hast';
import {ExternalLink,Image as ImageIcon} from 'lucide-react';
import {call} from './ui';
const readable=(error:unknown)=>String((error as Error)?.message??error).replace(/^Error invoking remote method '[^']+': (?:Error: )?/,'');
function headingAnchors(){return (tree:Root)=>{const seen=new Map<string,number>();const text=(node:any):string=>node.type==='text'?node.value:(node.children??[]).map(text).join('');const visit=(node:any)=>{if(node.type==='element'&&/^h[1-6]$/.test(node.tagName)){const base=text(node).toLowerCase().trim().replace(/[^\p{L}\p{N}\p{M}_\s-]/gu,'').trim().replace(/\s+/g,'-')||'section',count=seen.get(base)??0;seen.set(base,count+1);node.properties={...node.properties,'data-heading-fragment':base+(count?'-'+count:'')};}for(const child of node.children??[])visit(child);};visit(tree);};}
const LinkedImage=createContext(false);
type ImageJob={owner:ImageReads;task:()=>Promise<string>;resolve:(value:string)=>void;reject:(error:Error)=>void};
const imageQueue={busy:0,jobs:[] as ImageJob[]};
function pumpImages(){while(imageQueue.busy<4&&imageQueue.jobs.length){const job=imageQueue.jobs.shift()!;if(job.owner.closed){job.reject(new Error('Document closed.'));continue;}imageQueue.busy++;void Promise.resolve().then(job.task).then(job.resolve,job.reject).finally(()=>{imageQueue.busy--;pumpImages();});}}
class ImageReads{
 private bytes=0;private requests=new Map<string,Promise<string>>();closed=false;
 constructor(private owner:string,private referenceId:string,private path:string){}
 close(){this.closed=true;for(const job of imageQueue.jobs.filter(job=>job.owner===this))job.reject(new Error('Document closed.'));imageQueue.jobs=imageQueue.jobs.filter(job=>job.owner!==this);this.requests.clear();}
 get(href:string){let result=this.requests.get(href);if(result)return result;
  if(this.requests.size>=32)return Promise.reject(new Error('This preview supports up to 32 inline images. Open an image separately to view more.'));
  result=new Promise<string>((resolve,reject)=>{imageQueue.jobs.push({owner:this,resolve,reject,task:async()=>{if(this.closed)throw new Error('Document closed.');if(this.bytes>=16*1024*1024)throw new Error('Inline images have reached the 16 MB preview limit.');const result=await call<{image:string}>('workspace.image',{owner:this.owner,referenceId:this.referenceId,path:this.path,href});if(this.closed)throw new Error('Document closed.');const bytes=Math.ceil(result.image.length*3/4);if(this.bytes+bytes>16*1024*1024)throw new Error('Inline images have reached the 16 MB preview limit.');this.bytes+=bytes;return result.image;}});pumpImages();});this.requests.set(href,result);return result;
 }
}
function InlineImage({src='',alt='',reads,navigate}:{src?:string;alt?:string;reads:ImageReads;navigate:(href:string)=>void}){
 const linked=useContext(LinkedImage),area=useRef<HTMLSpanElement>(null),[visible,setVisible]=useState(false),[image,setImage]=useState(''),[error,setError]=useState(''),remote=/^(https?:)?\/\//i.test(src);
 useEffect(()=>{if(remote||!src)return;const observer=new IntersectionObserver(entries=>{if(entries.some(entry=>entry.isIntersecting)){setVisible(true);observer.disconnect();}},{rootMargin:'300px'});if(area.current)observer.observe(area.current);return()=>observer.disconnect();},[src,remote]);
 useEffect(()=>{if(!visible||remote)return;let live=true;void reads.get(src).then(value=>{if(live)setImage(value);}).catch(error=>{if(live)setError(readable(error));});return()=>{live=false;};},[visible,src,reads,remote]);
 return <span ref={area} className="markdown-image">{remote?linked?<span>{alt||'Remote image'}</span>:<button className="document-link" onClick={()=>navigate(src)}><ImageIcon size={15}/>{alt||'Remote image'}<ExternalLink size={12}/></button>:image&&!error?linked?<img src={image} alt={alt} onError={()=>setError('This image could not be decoded.')}/>:<button className="markdown-image-open" title="Open image in a workspace tab" onClick={()=>navigate(src)}><img src={image} alt={alt} onError={()=>setError('This image could not be decoded.')}/></button>:<span className="markdown-image-placeholder"><ImageIcon size={16}/>{alt||'Image'}{error&&<small role="status">{error}</small>}</span>}</span>;
}
export function WorkspaceMarkdown({owner,referenceId,path,content,fragment,anchorRevision,revision,navigate}:{owner:string;referenceId:string;path:string;content:string;fragment?:string;anchorRevision:number;revision:number;navigate:(href:string)=>void}){
 const area=useRef<HTMLElement>(null),[notice,setNotice]=useState(''),reads=useMemo(()=>new ImageReads(owner,referenceId,path),[owner,referenceId,path,content,revision]);
 useEffect(()=>()=>reads.close(),[reads]);
 useEffect(()=>{setNotice('');if(fragment===undefined)return;if(fragment===''){area.current?.closest('.document-content')?.scrollTo({top:0});return;}const heading=Array.from(area.current?.querySelectorAll<HTMLElement>('[data-heading-fragment]')??[]).find(element=>element.dataset.headingFragment===fragment);if(heading){heading.scrollIntoView({block:'start'});heading.tabIndex=-1;heading.focus({preventScroll:true});}else setNotice('Section “'+fragment+'” was not found in this document.');},[fragment,anchorRevision]);
 const navigateRef=useRef(navigate);navigateRef.current=navigate;
 const components=useMemo(()=>({a:({href,children}:any)=><LinkedImage.Provider value={true}><button role="link" className="document-link" onClick={()=>{if(href)navigateRef.current(href);}}>{children}</button></LinkedImage.Provider>,img:({src,alt}:any)=><InlineImage src={src} alt={alt} reads={reads} navigate={href=>navigateRef.current(href)}/>}),[reads]);
 return <article ref={area} className="markdown-preview">{notice&&<p className="document-section-notice" data-find-exclude role="status">{notice}</p>}<ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[headingAnchors]} urlTransform={value=>value} components={components}>{content}</ReactMarkdown></article>;
}
