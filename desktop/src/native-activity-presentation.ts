import type {NativeItem} from './native-contracts';
import type {ToolActivity} from './tool-contracts';

/** Resolve a host receipt only within the displayed request and native call.
 * Reused IDs across turns, conflicting identifiers and duplicate receipts are
 * intentionally left unresolved; transport history itself stays unchanged. */
export function nativeActivityReceipt(entry:NativeItem,items:NativeItem[],tools:ToolActivity[],requestId:string){
 const item=entry.item;if(!requestId||item.type!=='mcpToolCall'||item.server!=='sylvana_host')return;
 const turns=new Set(items.filter(row=>row.threadId===entry.threadId&&row.item.id===item.id).map(row=>row.turnId));if(turns.size!==1)return;
 const key=entry.threadId+':'+item.id,matches=tools.filter(tool=>{
  if(tool.request_id!==requestId||tool.native_thread_id!==entry.threadId||tool.name!==item.tool)return false;
  const explicit=tool.native_call_id,saved=tool.arguments.provider_call_id;
  if(explicit!==undefined&&explicit!==key||saved!==undefined&&saved!==key)return false;
  return explicit===key||saved===key;
 });
 return matches.length===1?matches[0]:undefined;
}

export function nativeActivityStatus(entry:NativeItem,inactive:boolean,receipt?:ToolActivity){
 const item=entry.item,status='status' in item?item.status:'';
 if(item.type==='commandExecution'){
  if(entry.background==='stopped')return 'Stopped';if(entry.background==='interrupted')return 'Session ended';
  if(status==='inProgress'&&entry.background==='running')return 'Running in background';
  if(status==='inProgress'&&entry.background==='exited')return 'Exited';
 }
 if(status==='inProgress'){
  if(item.type==='mcpToolCall'&&!entry.completed&&receipt){
   const label=({completed:'Completed',failed:'Failed',denied:'Declined',interrupted:'Interrupted',reverted:'Undone',awaiting_approval:'Needs your approval',running:undefined} as const)[receipt.status];
   if(label)return label;
  }
  return inactive?'No completion recorded':'Working';
 }
 return ({completed:'Completed',failed:'Failed',declined:'Declined'} as Record<string,string>)[status]??status;
}
