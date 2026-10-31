import {useEffect,useRef,useState} from 'react';
import type {WorkspacePlan} from '../src/plan-contracts';
import {call} from './ui';
export const publishPlan=(owner:string,plan:WorkspacePlan)=>window.dispatchEvent(new CustomEvent('sylvana-plan',{detail:{owner,plan}}));
export function usePlan(owner:string,conversation?:string|null,id?:string){
 const [plan,setPlan]=useState<WorkspacePlan|null>(null),[error,setError]=useState(''),[loading,setLoading]=useState(false),generation=useRef(0);
 useEffect(()=>{
  const token=++generation.current;setPlan(null);setError('');if(!conversation&&!id)return;setLoading(true);
  const receive=(next:WorkspacePlan|null)=>{if(token!==generation.current)return;setPlan(old=>!next&&old||next&&old?.id===next.id&&old.revision>next.revision?old:next);};
  void call<WorkspacePlan|null>(id?'plans.open':'plans.get',{owner,...(id?{id}:{conversationId:conversation})}).then(receive).catch(e=>{if(token===generation.current)setError(e.message);}).finally(()=>{if(token===generation.current)setLoading(false);});
  const off=window.sylvana.onChat(event=>{if(event.kind==='plan'&&event.plan&&(id?event.plan.id===id:event.plan.conversation_id===conversation))receive(event.plan);});
  const local=(event:Event)=>{const value=(event as CustomEvent<{owner:string;plan:WorkspacePlan}>).detail;if(value.owner===owner&&(id?value.plan.id===id:value.plan.conversation_id===conversation))receive(value.plan);};window.addEventListener('sylvana-plan',local);
  return()=>{generation.current++;off();window.removeEventListener('sylvana-plan',local);};
 },[owner,conversation,id]);
 return {plan,error,loading};
}
