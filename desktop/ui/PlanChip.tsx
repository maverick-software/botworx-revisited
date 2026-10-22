import React from 'react';
import {ListChecks,ChevronRight} from 'lucide-react';
import {usePlan} from './plan-state';
export function PlanChip({owner,conversation,open}:{owner:string;conversation:string|null;open:(id:string)=>void}){
 const {plan,error}=usePlan(owner,conversation);if(error)return <p className="plan-notice" role="status">Plan unavailable: {error}</p>;if(!plan)return null;
 const completed=plan.steps.filter(s=>s.status==='completed').length;
 return <button type="button" className="plan-chip-summary" aria-label="Open conversation plan" onClick={()=>open(plan.id)}><ListChecks size={18}/><span><strong>{plan.title}</strong><small>{completed}/{plan.steps.length} steps reported complete · {plan.approved_content_revision===plan.content_revision?'Reviewed plan':'Review before implementation'}</small></span><ChevronRight size={15}/></button>;
}
