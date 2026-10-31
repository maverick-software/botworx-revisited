import React,{createContext,useEffect,useRef,useState} from 'react';
import {call} from './ui';

export const ChatActivity=createContext<{running:Set<string>;completed:Set<string>}>({running:new Set(),completed:new Set()});
export function ChatActivityProvider({owner,current,running,children}:{owner:string;current:string|null;running?:Set<string>;children:React.ReactNode}){
 const key='sylvana.completed-chats:'+owner;
 const [completed,setCompleted]=useState<Set<string>>(()=>{try{return new Set(JSON.parse(localStorage.getItem(key)??'[]'));}catch{return new Set();}});
 const visible=useRef(current);visible.current=current;
 const [reportChats,setReportChats]=useState(new Map<string,string>());
 useEffect(()=>{try{setCompleted(new Set(JSON.parse(localStorage.getItem(key)??'[]')));}catch{setCompleted(new Set());}},[key]);
 useEffect(()=>{
  let live=true;const reports=new Map<string,string>(),observedRequests=new Set<string>();setReportChats(new Map());
  const stop=window.sylvana.onChat(event=>{
   if(event.ownerId!==owner)return;
   if(event.status==='completed'&&event.conversationId&&event.conversationId!==visible.current)setCompleted(previous=>new Set([...previous,event.conversationId!]));
   if(!event.native||!event.conversationId||!['native','native-background'].includes(event.kind??''))return;
   observedRequests.add(event.requestId);const prefix=event.requestId+':',next=new Map<string,string>();let completedReport=false;
   for(const report of event.native.reports??[]){const key=prefix+report.id;if(report.status==='running')next.set(key,event.conversationId);else if(report.status==='completed'&&reports.has(key))completedReport=true;}
   for(const key of reports.keys())if(key.startsWith(prefix))reports.delete(key);for(const [key,conversation]of next)reports.set(key,conversation);setReportChats(new Map(reports));
   if(completedReport&&event.conversationId!==visible.current)setCompleted(previous=>new Set([...previous,event.conversationId!]));
  });
  void call<{requestId:string;conversationId:string;reportId:string}[]>('native.reports.active').then(rows=>{if(!live)return;for(const row of rows)if(!observedRequests.has(row.requestId))reports.set(row.requestId+':'+row.reportId,row.conversationId);setReportChats(new Map(reports));}).catch(()=>{});
  return()=>{live=false;stop();};
 },[owner]);
 useEffect(()=>{if(current)setCompleted(previous=>{if(!previous.has(current))return previous;const next=new Set(previous);next.delete(current);return next;});},[current]);
 useEffect(()=>{try{localStorage.setItem(key,JSON.stringify([...completed].slice(-500)));}catch{/* Status remains available for this session if storage is full. */}},[key,completed]);
 return <ChatActivity.Provider value={{running:new Set([...(running??[]),...reportChats.values()]),completed}}>{children}</ChatActivity.Provider>;
}
