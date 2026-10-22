import React,{useState} from 'react';
import {Target} from 'lucide-react';
import type {Agent,Goal} from '../src/contracts';
import {goalLimits,goalTurnLabel,maximumGoalTurns,type GoalInput} from '../src/goal-settings';
import {Modal} from './ui';

export function GoalDialog({initial,goals,agents,select,save,close,legacy=false}:{initial:Goal|null;goals:Goal[];agents:Agent[];select:(goal:Goal)=>Promise<void>;save:(value:GoalInput)=>Promise<void>;close:()=>void;legacy?:boolean}){
 const [objective,setObjective]=useState(initial?.objective??''),[unlimited,setUnlimited]=useState(initial?.max_turns===null),[turns,setTurns]=useState(initial?.max_turns??3);
 const [limitedTokens,setLimitedTokens]=useState(initial?.token_budget!=null),[tokens,setTokens]=useState(initial?.token_budget??40000),[busy,setBusy]=useState(false),[error,setError]=useState('');
 async function submit(start:boolean){setError('');setBusy(true);try{const limits=goalLimits({maxTurns:unlimited?null:turns,tokenBudget:limitedTokens?tokens:null});await save({id:initial?.id,objective,...limits,start});close();}catch(e){setError((e as Error).message.replace(/^Error invoking remote method '[^']+': (?:Error: )?/,''));}finally{setBusy(false);}}
 return <Modal title={initial?'Goal settings':'Set a goal'} close={()=>!busy&&close()}>
  {!initial&&goals.length>0&&<div className="saved-goals"><h3>Saved goals</h3>{goals.map(item=><button type="button" disabled={busy} className="saved-goal-row" key={item.id} onClick={()=>{setBusy(true);void select(item).then(close).catch(e=>setError(e.message)).finally(()=>setBusy(false));}}><Target size={17}/><span><strong>{item.objective}</strong><small>{agents.find(a=>a.id===item.agent_id)?.name??'Agent'} · {item.status} · {goalTurnLabel(item)}</small></span></button>)}</div>}
  <form onSubmit={e=>{e.preventDefault();void submit(true);}}>
   <label>Goal<textarea aria-label="Goal objective" required maxLength={4000} rows={4} value={objective} readOnly={!!initial} onChange={e=>setObjective(e.target.value)}/></label>
   <label className="checkbox"><input type="checkbox" checked={unlimited} disabled={busy} onChange={e=>setUnlimited(e.target.checked)}/>Keep working until complete</label>
   {!unlimited&&<label>Turn limit<input aria-label="Goal turn limit" type="number" min={1} max={maximumGoalTurns} value={turns} disabled={busy} onChange={e=>setTurns(Number(e.target.value))}/></label>}
   <label className="checkbox"><input type="checkbox" checked={limitedTokens} disabled={busy} onChange={e=>setLimitedTokens(e.target.checked)}/>Use a token budget</label>
   {limitedTokens&&<label>Codex token budget<input aria-label="Goal token budget" type="number" min={1} max={Number.MAX_SAFE_INTEGER} value={tokens} disabled={busy} onChange={e=>setTokens(Number(e.target.value))}/></label>}
   <p className="hint">{unlimited?'Continues until completion, a pause, a usage limit, or work that needs your attention.':'Pauses when the turn limit is reached.'} You can stop it at any time. Uses the selected connection and permissions.</p>
   {limitedTokens&&<p className="hint">The budget is the goal’s total Codex token allowance, including earlier work. An in-flight response can finish after the allowance is reached. Provider charges and plan limits still apply.</p>}
   {legacy&&(unlimited||limitedTokens)&&<p className="hint">These controls require the Codex harness when you start the goal.</p>}
   {error&&<p role="alert" className="danger">{error}</p>}
   <div className="form-actions"><button type="button" className="secondary" disabled={busy||!objective.trim()} onClick={()=>void submit(false)}>{initial?'Save settings':'Save goal'}</button><button disabled={busy||!objective.trim()}>{initial?'Save and resume':'Start goal'}</button></div>
  </form>
 </Modal>;
}
