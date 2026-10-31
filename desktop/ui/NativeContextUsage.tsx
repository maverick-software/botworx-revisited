import React from 'react';
import type {NativeState} from '../src/native-contracts';

export function NativeContextUsage({state}:{state:NativeState}){
 const usage=state.tokenUsage?.value;if(!usage)return null;
 const used=usage.last.totalTokens,limit=usage.modelContextWindow;
 const percent=limit===null?null:used>0&&used/limit<0.01?'<1':String(Math.min(100,Math.round(used/limit*100)));
 const summaries=state.items.filter(e=>e.threadId===state.threadId&&e.completed&&e.item.type==='contextCompaction').length;
 const number=(n:number)=>n.toLocaleString('en-US');
 return <details className="native-item native-context-usage" aria-label="Conversation context">
  <summary><span>{percent===null?'Context usage':`Context · ${percent}% used`}</span></summary>
  <p>{number(used)} tokens in the last reported context{limit===null?'.':` of ${number(limit)} available.`}</p>
  <p>{number(usage.total.totalTokens)} tokens processed across this native thread. Reused input can be counted on multiple requests. This is separate from your subscription allowance.</p>
  {summaries>0&&<p>Earlier context was summarized {summaries===1?'once':`${summaries} times`} during this response.</p>}
  {limit===null&&<p>The model did not report its context limit.</p>}
 </details>;
}
