import React,{useLayoutEffect,useRef,useState} from 'react';
import {ArrowUp,ArrowDown,CaseSensitive,X} from 'lucide-react';
import {documentMatches} from '../src/document-find';
export type FindRequest={query:string;matchCase:boolean;step:number;forward:boolean};
export type FindResult={matches:number;ordinal:number;pending?:boolean;error?:string};
export const emptyFind:FindResult={matches:0,ordinal:0};
type Span={node:Text;start:number;end:number};
const allName='sylvana-find-matches',currentName='sylvana-find-current';
function indexText(root:HTMLElement){
 const spans:Span[]=[],parts:string[]=[],visibility=new Map<Element,boolean>();let length=0,block:Element|null=null;
 const visible=(element:Element):boolean=>{const known=visibility.get(element);if(known!==undefined)return known;const style=getComputedStyle(element),value=style.display!=='none'&&style.visibility!=='hidden'&&(!element.parentElement||element===root||visible(element.parentElement));visibility.set(element,value);return value;};
 const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT,{acceptNode(node){const parent=node.parentElement;if(!parent||!node.textContent||parent.closest('script,style,input,textarea,select,[hidden],[aria-hidden="true"],[data-find-exclude],button:not([role="link"])')||!visible(parent))return NodeFilter.FILTER_REJECT;const details=parent.closest('details:not([open])');return details&&!parent.closest('summary')?NodeFilter.FILTER_REJECT:NodeFilter.FILTER_ACCEPT;}});
 let node:Node|null;while((node=walker.nextNode())){const parent=node.parentElement!,next=parent.closest('p,h1,h2,h3,h4,h5,h6,li,pre,td,th,blockquote,section,div')??root;if(block&&block!==next){parts.push('\n');length++;}const value=node.textContent!;spans.push({node:node as Text,start:length,end:length+value.length});parts.push(value);length+=value.length;block=next;}
 return {text:parts.join(''),spans};
}
function matchRange(spans:Span[],start:number,end:number){
 // Binary search keeps navigation responsive in documents with many text nodes.
 const at=(offset:number,last=false)=>{let low=0,high=spans.length-1;while(low<=high){const mid=(low+high)>>1,span=spans[mid];if(offset<span.start||last&&offset===span.start)high=mid-1;else if(offset>span.end||!last&&offset===span.end)low=mid+1;else return span;}return undefined;};
 const first=at(start),last=at(end,true);if(!first||!last)return null;
 const range=document.createRange();range.setStart(first.node,start-first.start);range.setEnd(last.node,end-last.start);return range;
}
export function usePreviewFind(root:React.RefObject<HTMLElement|null>,enabled:boolean,request:FindRequest,identity:string,content:unknown){
 const [result,setResult]=useState<FindResult>(emptyFind),selection=useRef({identity:'',query:'',matchCase:false,content:null as unknown,index:0,step:-1});
 useLayoutEffect(()=>{
  CSS.highlights?.delete(allName);CSS.highlights?.delete(currentName);
  if(!enabled||!request.query||!root.current){setResult(emptyFind);return;}
  const prior=selection.current,{text,spans}=indexText(root.current),matches=documentMatches(text,request.query,request.matchCase),reset=prior.identity!==identity||prior.query!==request.query||prior.matchCase!==request.matchCase||prior.content!==content;
  const index=matches.length?(reset?0:((prior.index+(prior.step===request.step?0:request.forward?1:-1))%matches.length+matches.length)%matches.length):0;
  selection.current={identity,query:request.query,matchCase:request.matchCase,content,index,step:request.step};
  const selected=matches[index],active=selected?matchRange(spans,selected.start,selected.end):null;
  if(CSS.highlights&&typeof Highlight!=='undefined'){
   const ranges=matches.slice(Math.max(0,index-250),index+251).flatMap(match=>{const range=matchRange(spans,match.start,match.end);return range?[range]:[];});
   CSS.highlights.set(allName,new Highlight(...ranges));if(active)CSS.highlights.set(currentName,new Highlight(active));
  }
  if(active&&(reset||prior.step!==request.step)){
   active.startContainer.parentElement?.scrollIntoView({block:'center',inline:'nearest'});
   let parent=active.startContainer.parentElement;while(parent&&root.current.contains(parent)){const rect=active.getBoundingClientRect(),bounds=parent.getBoundingClientRect();if(parent.scrollHeight>parent.clientHeight)parent.scrollTop+=rect.top-bounds.top-parent.clientHeight/2;if(parent.scrollWidth>parent.clientWidth)parent.scrollLeft+=Math.min(0,rect.left-bounds.left)+Math.max(0,rect.right-bounds.right);if(parent===root.current)break;parent=parent.parentElement;}
  }
  setResult({matches:matches.length,ordinal:matches.length?index+1:0});
  return()=>{CSS.highlights?.delete(allName);CSS.highlights?.delete(currentName);};
 },[enabled,request,identity,content]);
 return result;
}
export function WorkspaceFindBar({request,result,scope,focusVersion,change,move,close}:{request:FindRequest;result:FindResult;scope:string;focusVersion:number;change:(query:string,matchCase:boolean)=>void;move:(forward:boolean)=>void;close:()=>void}){
 const input=useRef<HTMLInputElement>(null);
 useLayoutEffect(()=>{input.current?.focus();input.current?.select();},[focusVersion]);
 return <div className="workspace-find" role="search" aria-label="Find in workspace preview"><div className="workspace-find-controls"><input ref={input} aria-label="Find in preview" placeholder="Find in preview…" maxLength={512} value={request.query} onChange={event=>change(event.target.value,request.matchCase)} onKeyDown={event=>{if(event.key==='Enter'){event.preventDefault();move(!event.shiftKey);}else if(event.key==='Escape'){event.preventDefault();event.stopPropagation();close();}}}/><span className="workspace-find-count" role="status" aria-live="polite">{result.error?'Search unavailable':result.pending?'Searching…':request.query?(result.matches?`${result.ordinal} of ${result.matches}`:'No matches'):''}</span><button className={'icon-button '+(request.matchCase?'active':'')} aria-label="Match case" aria-pressed={request.matchCase} onClick={()=>change(request.query,!request.matchCase)}><CaseSensitive size={16}/></button><button className="icon-button" aria-label="Previous preview match" disabled={!result.matches||result.pending} onClick={()=>move(false)}><ArrowUp size={15}/></button><button className="icon-button" aria-label="Next preview match" disabled={!result.matches||result.pending} onClick={()=>move(true)}><ArrowDown size={15}/></button><button className="icon-button" aria-label="Close preview search" onClick={close}><X size={15}/></button></div><small>{result.error||scope}</small></div>;
}
