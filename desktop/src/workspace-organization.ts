import type {FileReference,PaneState,WorkspaceTreeView} from './contracts';
export const maximumExpandedFolders=63;
export const emptyTreeView=():WorkspaceTreeView=>({expanded:[],filter:'',followActive:true});
export function relativeFolder(value:string){
 const normalized=value.replace(/\\/g,'/');
 if(!normalized||normalized.length>500||normalized.split('/').length>13||normalized.split('/').some(part=>!part||part==='.'||part==='..'||/[\x00-\x1f:]/.test(part)))throw new Error('Invalid saved folder path.');
 return normalized;
}
export function validateTreeViews(value:unknown,references:FileReference[]):Record<string,WorkspaceTreeView>|undefined{
 if(value===undefined)return;
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).length>32)throw new Error('Invalid saved folder navigation.');
 const result:Record<string,WorkspaceTreeView>={};
 for(const [id,raw] of Object.entries(value)){
  if(!raw||typeof raw!=='object'||!Array.isArray(raw.expanded)||raw.expanded.length>maximumExpandedFolders||typeof raw.filter!=='string'||raw.filter.length>120||typeof raw.followActive!=='boolean')throw new Error('Invalid saved folder navigation.');
  const expanded=[...new Set<string>(Array.from(raw.expanded,(entry:unknown)=>{if(typeof entry!=='string')throw new Error('Invalid saved folder path.');return relativeFolder(entry);} ))];
  if(references.some(ref=>ref.id===id&&ref.kind==='folder'))result[id]={expanded,filter:raw.filter,followActive:raw.followActive};
 }
 return result;
}
export function revealTreeFolder(view:WorkspaceTreeView,path:string){
 const parts=relativeFolder(path).split('/'),ancestors=parts.map((_,index)=>parts.slice(0,index+1).join('/'));
 const expanded=[...view.expanded];for(const ancestor of ancestors)if(!expanded.some(entry=>entry.toLowerCase()===ancestor.toLowerCase()))expanded.push(ancestor);
 if(expanded.length>maximumExpandedFolders)throw new Error('Up to 63 folders can stay expanded. Collapse some folders before opening more.');
 return expanded.length===view.expanded.length?view:{...view,expanded};
}
export function toggleTreeFolder(view:WorkspaceTreeView,path:string,open:boolean){
 if(open)return revealTreeFolder(view,path);
 return {...view,expanded:view.expanded.filter(entry=>entry.toLowerCase()!==path.toLowerCase())};
}
export function changeTreeView(state:PaneState,id:string,update:(view:WorkspaceTreeView)=>WorkspaceTreeView){
 const before=state.treeViews?.[id]??emptyTreeView(),view=update(before);if(view===before)return state;
 const entries=Object.entries(state.treeViews??{}).filter(([key])=>key!==id).slice(-31);
 return {...state,treeViews:{...Object.fromEntries(entries),[id]:view}};
}
export function organizeTabs(state:PaneState,id:string,action:'close'|'others'|'right'|'all'|'left'|'next'){
 const index=state.tabs.findIndex(tab=>tab.id===id);if(index<0)return state;
 const tabs=action==='all'?[]:action==='close'?state.tabs.filter(tab=>tab.id!==id):action==='others'?state.tabs.filter(tab=>tab.id===id):action==='right'?state.tabs.slice(0,index+1):[...state.tabs];
 if(action==='left'||action==='next'){const target=index+(action==='left'?-1:1);if(target<0||target>=tabs.length)return state;[tabs[index],tabs[target]]=[tabs[target],tabs[index]];}
 const active=tabs.some(tab=>tab.id===state.active)?state.active:tabs[Math.min(index,tabs.length-1)]?.id??null;
 return {...state,tabs,active};
}
export function reorderTabs(state:PaneState,id:string,target:string){
 const from=state.tabs.findIndex(tab=>tab.id===id),to=state.tabs.findIndex(tab=>tab.id===target);if(from<0||to<0||from===to)return state;
 const tabs=[...state.tabs],tab=tabs.splice(from,1)[0];tabs.splice(to,0,tab);return {...state,tabs};
}
