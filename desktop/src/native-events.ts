import type {NativeState} from './native-contracts';

// The app-server streams patch updates separately from item lifecycle events.
// Identify items by their complete scope: children and later turns may reuse IDs.
export function applyNativeEvent(state:NativeState,method:string,p:any){
 if(!p||typeof p.threadId!=='string'||typeof p.turnId!=='string')return;
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
