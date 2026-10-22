import type {Message} from './contracts';
import type {NativeState} from './native-contracts';

export function previousMessageCount(messages:Message[]){
 // Keep the latest prompt and all of its replies, including a prompt that is
 // still waiting for its first reply. Live decisions must stay in view too.
 let boundary=0;
 for(let index=0;index<messages.length;index++)if(messages[index].role==='user')boundary=index;
 const attention=messages.findIndex(needsTranscriptAttention);
 if(attention>=0&&attention<boundary){boundary=attention;while(boundary>0&&messages[boundary].role!=='user')boundary--;}
 return boundary;
}

export function historyTitle(title:string){return title.split(/\r?\n/).find(line=>line.trim())?.trim()||'Untitled chat';}
export function needsTranscriptAttention(message:Message){
 const {native,tools,status}=message.metadata;
 // Background progress is available in the conversation's Subagents panel.
 // Reveal old turns only for a live main response or a decision the user must see.
 return status==='running'||!!tools?.some(t=>t.status==='awaiting_approval')||!!native?.approvals.some(a=>a.status==='pending')||!!native?.children?.some(c=>c.state.approvals.some(a=>a.status==='pending')||c.state.tools?.some(t=>t.status==='awaiting_approval'))||!!native?.reports?.some(r=>!!r.error||r.state.approvals.some(a=>a.status==='pending')||r.state.tools?.some(t=>t.status==='awaiting_approval'));
}

export function responseText(message:Message){
 const native=message.metadata.native;
 if(!native)return message.content.text.replace(/\s*<!--\s*GOAL_COMPLETE\s*-->\s*$/,'');
 const reply=(state:NativeState,active:boolean)=>state.items.flatMap(entry=>entry.threadId===state.threadId&&entry.item.type==='agentMessage'&&(active||entry.item.phase!=='commentary')?[entry.item.text.replace(/\s*<!--\s*GOAL_COMPLETE\s*-->\s*$/,'')]:[]);
 // Later reports are displayed beneath the original answer. Copy that same
 // sequence, using each report's live state independently of the parent turn.
 return [...reply(native,message.metadata.status==='running'),...(native.reports??[]).flatMap(report=>reply(report.state,report.status==='running'))].filter(text=>text.trim()).join('\n\n');
}
export function messageTime(messages:Message[],index:number){
 const value=messages[index]?.metadata.timing?.startedAt??(messages[index]?.role==='user'&&messages[index+1]?.role==='assistant'?messages[index+1].metadata.timing?.startedAt:undefined);
 return value&&Number.isFinite(Date.parse(value))?value:undefined;
}
export function transcriptDateLabel(value:string,now=new Date()){
 const date=new Date(value);if(!Number.isFinite(date.getTime()))return '';
 const day=(d:Date)=>new Date(d.getFullYear(),d.getMonth(),d.getDate()).getTime(),yesterday=new Date(now);yesterday.setDate(now.getDate()-1);
 const prefix=day(date)===day(now)?'Today':day(date)===day(yesterday)?'Yesterday':date.toLocaleDateString(undefined,{month:'short',day:'numeric',...(date.getFullYear()!==now.getFullYear()?{year:'numeric'}:{})});
 return prefix+' '+date.toLocaleTimeString(undefined,{hour:'numeric',minute:'2-digit'});
}
