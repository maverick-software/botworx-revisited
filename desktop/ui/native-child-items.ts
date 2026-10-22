import type {NativeChild,NativeItem} from '../src/native-contracts';

/** Keep the saved host receipt as the visible record of a completed call.
 * Older or unmatched transport events remain available in the transcript. */
export function childTranscriptItems(child:NativeChild){
 const receipts=new Map((child.state.tools??[]).filter(tool=>tool.status==='completed'&&tool.native_thread_id===child.threadId&&tool.native_call_id).map(tool=>[tool.native_call_id!,tool.name]));
 const resultItems=child.state.items.filter(entry=>entry.threadId===child.threadId&&entry.turnId===child.turnId&&entry.item.type==='agentMessage'&&entry.item.phase!=='commentary'),resultText=resultItems.map(entry=>entry.item.type==='agentMessage'?entry.item.text:'').join('\n\n'),shownResult=new Set(child.result&&resultText===child.result?resultItems:[]);
 return child.state.items.filter(entry=>{if(shownResult.has(entry))return false;const item=entry.item;if(item.type!=='mcpToolCall'||item.server!=='agentopia_host'||item.status!=='completed'||item.error)return true;const key=entry.threadId+':'+item.id;if(receipts.get(key)!==item.tool)return true;receipts.delete(key);return false;});
}

/** Native user messages already contain most submitted guidance. Pair each
 * receipt once, retaining attribution and unmatched legacy/pending guidance. */
export function childGuidance(child:NativeChild,transcript=childTranscriptItems(child)){
 const unmatched=[...child.state.steering],byItem=new Map<NativeItem,NativeChild['state']['steering'][number]>();
 for(const entry of [...transcript].reverse()){
  if(entry.threadId!==child.threadId||entry.item.type!=='userMessage')continue;
  const text=entry.item.content.filter(part=>part.type==='text').map(part=>part.type==='text'?part.text:'').join('\n');
  let index=unmatched.findIndex(row=>row.id===entry.item.id&&row.text===text);
  if(index<0)for(let n=unmatched.length-1;n>=0;n--)if(unmatched[n].text===text){index=n;break;}
  if(index>=0)byItem.set(entry,unmatched.splice(index,1)[0]);
 }
 return {byItem,unmatched};
}

export function childInterruptionNotice(child:NativeChild){
 if(child.status!=='interrupted')return '';
 return child.error&&child.error!=='Agentopia stopped. Inspect the saved work before explicitly resuming.'?child.error:'This session closed. Inspect the saved work before resuming; actions may have completed.';
}
