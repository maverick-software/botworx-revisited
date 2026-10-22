import React,{useEffect,useState} from 'react';
import type {Goal} from '../src/contracts';

export function GoalPane({goal,editing,save,edit}:{goal:Goal|null;editing:boolean;save:(value:string)=>Promise<void>;edit:()=>void}){
 const [text,setText]=useState(goal?.objective??''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 useEffect(()=>{setText(goal?.objective??'');setError('');},[goal?.id,goal?.objective,editing]);
 if(!goal)return <p className="pane-loading">This goal has been removed.</p>;
 return <section className="goal-pane" aria-label={editing?'Edit goal':'Goal details'}><header><span>{goal.status==='running'?'Pursuing goal':goal.status==='completed'?'Goal complete':goal.status==='paused'?'Goal paused':'Goal ready'}</span>{editing?<button disabled={busy||!text.trim()||text.trim()===goal.objective} onClick={()=>{setBusy(true);setError('');void save(text.trim()).catch(e=>setError(e.message)).finally(()=>setBusy(false));}}>{busy?'Saving…':'Save'}</button>:<button className="subtle-link" onClick={edit}>Edit</button>}</header>{editing?<textarea aria-label="Goal objective" maxLength={4000} autoFocus value={text} onChange={event=>setText(event.target.value)}/>:<div className="goal-objective">{goal.objective}</div>}{error&&<p className="danger" role="alert">{error}</p>}{goal.note&&<p className="hint">{goal.note}</p>}</section>;
}
