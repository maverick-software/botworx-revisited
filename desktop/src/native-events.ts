import type {NativeState} from './native-contracts';
import type {ThreadTokenUsage} from './codex-protocol/v2/ThreadTokenUsage';

function tokenUsage(value:any):ThreadTokenUsage|undefined{
 const counter=(n:unknown)=>typeof n==='number'&&Number.isSafeInteger(n)&&n>=0;
 const breakdown=(v:any)=>v&&['totalTokens','inputTokens','cachedInputTokens','outputTokens','reasoningOutputTokens'].every(k=>counter(v[k]))&&(v.cacheWriteInputTokens===undefined||counter(v.cacheWriteInputTokens))?{
  totalTokens:v.totalTokens,inputTokens:v.inputTokens,cachedInputTokens:v.cachedInputTokens,cacheWriteInputTokens:v.cacheWriteInputTokens??0,outputTokens:v.outputTokens,reasoningOutputTokens:v.reasoningOutputTokens,
 }:undefined;
 const total=breakdown(value?.total),last=breakdown(value?.last),limit=value?.modelContextWindow;
 if(!total||!last||limit!==null&&(!counter(limit)||limit===0))return;
 return {total,last,modelContextWindow:limit};
}

// The app-server streams patch updates separately from item lifecycle events.
// Identify items by their complete scope: children and later turns may reuse IDs.
export function applyNativeEvent(state:NativeState,method:string,p:any){
 if(!p||typeof p.threadId!=='string'||typeof p.turnId!=='string')return;
 if(method==='thread/tokenUsage/updated'){
  // Root transcripts also contain child items. Their independent context must
  // never replace the parent's, nor may a late previous-turn update replace it.
  if(p.threadId!==state.threadId||state.turnId&&p.turnId!==state.turnId)return;
  const value=tokenUsage(p.tokenUsage);if(value)state.tokenUsage={turnId:p.turnId,value};return;
 }
 const entry=(id:string)=>state.items.find(row=>row.threadId===p.threadId&&row.turnId===p.turnId&&row.item.id===id);
 if((method==='item/started'||method==='item/completed')&&p.item){
  const item=structuredClone(p.item),found=entry(item.id);
  if(found?.completed&&method==='item/started')return;
  if(item.type==='reasoning'){item.content=[];item.summary=[];}
  if(method==='item/started'&&item.type==='fileChange'&&found?.item.type==='fileChange'&&!item.changes.length)item.changes=found.item.changes;
  if(found){found.item=item;found.completed=method==='item/completed';if(found.completed&&item.type==='commandExecution'&&found.background==='running'){found.background='exited';found.backgroundNote=undefined;}}
  else state.items.push({threadId:p.threadId,turnId:p.turnId,item,completed:method==='item/completed'});
 }
 if(method==='item/fileChange/patchUpdated'&&typeof p.itemId==='string'&&Array.isArray(p.changes)){
  const found=entry(p.itemId);if(found?.completed)return;
  const changes=structuredClone(p.changes);
  if(found?.item.type==='fileChange')found.item.changes=changes;
  else if(!found)state.items.push({threadId:p.threadId,turnId:p.turnId,item:{type:'fileChange',id:p.itemId,changes,status:'inProgress'},completed:false});
 }
 if(method==='turn/diff/updated'&&typeof p.diff==='string'){
  const diffs=state.diffs??(state.diffs=[]),found=diffs.find(row=>row.threadId===p.threadId&&row.turnId===p.turnId),value={threadId:p.threadId,turnId:p.turnId,diff:p.diff.slice(0,1000000),truncated:p.diff.length>1000000};
  if(found)Object.assign(found,value);else diffs.push(value);
 }
 if(method==='item/agentMessage/delta'){const found=entry(p.itemId);if(found?.item.type==='agentMessage'&&!found.completed)found.item.text+=p.delta;}
 if(method==='item/commandExecution/outputDelta'){const found=entry(p.itemId);if(found?.item.type==='commandExecution'&&!found.completed)found.item.aggregatedOutput=(found.item.aggregatedOutput??'')+p.delta;}
}
