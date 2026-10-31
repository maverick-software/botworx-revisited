import React,{useState} from 'react';
import {Target,ChevronRight} from 'lucide-react';
import type {NativeState} from '../src/native-contracts';
import {call} from './ui';
import {goalStatusNote} from './goal-status-note';

export function NativeGoal({state,requestId,active,controls=true}:{state:NativeState;requestId:string;active:boolean;controls?:boolean}){
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),goal=state.goal;if(!goal)return null;
 const label={active:active?'Pursuing goal':'Active when last saved',paused:'Paused',blocked:'Needs attention',usageLimited:'Usage limit reached',budgetLimited:'Token budget reached',complete:'Completed'}[goal.status];
 async function control(action:'pause'|'complete'){setBusy(true);setError('');try{await call('native.goal.control',{requestId,action});}catch(e){setError((e as Error).message.replace(/^Error invoking remote method '[^']+': (?:Error: )?/,''));}finally{setBusy(false);}}
 return <details className="native-goal" aria-label="Codex goal"><summary><ChevronRight size={12} className="native-goal-chevron"/><Target size={14}/><strong>{label}</strong><span title={goal.objective}>{goal.objective}</span></summary><div className="native-goal-body"><p>{goal.objective}</p><small>{goal.tokensUsed.toLocaleString()} Codex goal tokens{goal.tokenBudget!==null?' of '+goal.tokenBudget.toLocaleString():''}{state.goalTurns?' · '+state.goalTurns+' '+(state.goalTurns===1?'turn':'turns'):''}</small>{state.goalNote&&<p className="turn-work-note">{goalStatusNote(state.goalNote)}</p>}{controls&&active&&goal.status==='active'&&<div><button className="secondary" disabled={busy} onClick={()=>void control('pause')}>Pause goal</button><button className="secondary" disabled={busy} onClick={()=>void control('complete')}>Mark complete</button></div>}{!active&&goal.status!=='complete'&&<p className="turn-work-note">Resume from the goal controls, or send a message describing the work to continue.</p>}{error&&<p role="alert" className="danger">{error}</p>}</div></details>;
}
