import type {FileReference,PaneState,WorkspaceTab} from './contracts';
import type {WorkspaceFileChange} from './file-operation-contracts';
import {emptyTreeView,maximumExpandedFolders} from './workspace-organization';
/** A new unsent chat keeps pane sizing, while starting with no open context. */
export function freshChatWorkspace(previous:PaneState):PaneState{return {open:false,width:previous.width??620,treeWidth:previous.treeWidth??210,tree:previous.tree??true,tabs:[],active:null,referenceId:null,...(previous.fileRevision!==undefined?{fileRevision:previous.fileRevision}:{})};}
const normalized=(value:string)=>value.replace(/\\/g,'/').replace(/\/+$/,'');
const inside=(root:string,value:string)=>{root=normalized(root).toLowerCase();value=normalized(value).toLowerCase();return root===value||value.startsWith(root+'/');};
const absolute=(reference:FileReference,relative:string)=>normalized(reference.kind==='file'?reference.path:reference.path+'/'+relative);
/** Shared by saved layouts and the renderer. It changes navigation metadata, never message snapshots. */
export function applyWorkspaceChange(state:PaneState,references:FileReference[],change:WorkspaceFileChange):PaneState{
 if(change.revision<=(state.fileRevision??0))return state;
 const from=normalized(change.from),tabs:WorkspaceTab[]=[];
 for(const tab of state.tabs){
  const reference=references.find(ref=>ref.id===tab.referenceId);if((tab.kind!=='file'&&tab.kind!=='folder')||!reference){tabs.push(tab);continue;}
  const original=absolute(reference,tab.path??'');if(!inside(from,original)||change.action==='create'){tabs.push(tab);continue;}
  if(change.action==='remove')continue;
  const target=normalized(change.to!)+original.slice(from.length),grant=inside(reference.path,target)?reference:references.find(ref=>ref.id===change.referenceId&&ref.kind==='folder'&&inside(ref.path,target))??references.filter(ref=>ref.kind==='folder'&&inside(ref.path,target)).sort((a,b)=>b.path.length-a.path.length)[0];
  if(!grant)continue;const relative=grant.kind==='file'?'':target.slice(normalized(grant.path).length+1);tabs.push({...tab,referenceId:grant.id,path:relative,name:target.split('/').at(-1)??tab.name});
 }
 const before=state.tabs.find(tab=>tab.id===state.active),after=tabs.find(tab=>tab.id===state.active),referenceId=before&&after&&state.referenceId===before.referenceId?after.referenceId??state.referenceId:state.referenceId;
 let treeViews=state.treeViews;
 if(treeViews&&change.action!=='create'){
  treeViews=Object.fromEntries(Object.entries(treeViews).filter(([id])=>references.some(ref=>ref.id===id&&ref.kind==='folder')).map(([id,view])=>[id,{...view,expanded:[...view.expanded]}]));
  const additions=new Map<string,string[]>();
  for(const [id,view] of Object.entries(treeViews)){
   const reference=references.find(ref=>ref.id===id)!;
   view.expanded=view.expanded.filter(relative=>{
    const original=absolute(reference,relative);if(!inside(from,original))return true;
    if(change.action==='move'){
     const target=normalized(change.to!)+original.slice(from.length),grant=inside(reference.path,target)?reference:references.filter(ref=>ref.kind==='folder'&&inside(ref.path,target)).sort((a,b)=>b.path.length-a.path.length)[0];
     if(grant){const next=target.slice(normalized(grant.path).length+1);if(next){const parts=next.split('/'),paths=additions.get(grant.id)??[];for(let i=0;i<parts.length;i++)paths.push(parts.slice(0,i+1).join('/'));additions.set(grant.id,paths);}}
    }
    return false;
   });
  }
  for(const [id,paths] of additions){const previous=treeViews[id]??emptyTreeView(),seen=new Set<string>(),expanded=[...paths,...previous.expanded].filter(value=>{const key=value.toLowerCase();if(seen.has(key))return false;seen.add(key);return true;}).slice(0,maximumExpandedFolders);treeViews[id]={...previous,expanded};}
  treeViews=Object.fromEntries(Object.entries(treeViews).slice(-32));
 }
 return {...state,...(treeViews?{treeViews}:{}),tabs,active:after?.id??tabs.at(-1)?.id??null,referenceId,fileRevision:change.revision};
}
