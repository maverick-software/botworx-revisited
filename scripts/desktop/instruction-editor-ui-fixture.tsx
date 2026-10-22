import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import {AgentInstructions} from '../../desktop/ui/AgentInstructions';
import '../../desktop/ui/style.css';
declare global{interface Window{instructionFixture:any;resetInstructions:(text:string)=>void;}}
document.documentElement.dataset.theme='light';
function Fixture(){const [value,setValue]=useState('## Role\n\nReview **approved** sources.\n\n- Cite evidence.\n- Report uncertainty.\n'),[key,setKey]=useState(0),[changes,setChanges]=useState(0),[saved,setSaved]=useState<string|null>(null),[name,setName]=useState('Generated test agent');window.instructionFixture={value,changes,saved};window.resetInstructions=text=>{setValue(text);setKey(key+1);setChanges(0);setSaved(null);};return <main style={{maxWidth:800,margin:'20px auto',padding:20}}><input aria-label="Agent name" value={name} onChange={event=>setName(event.target.value)}/><AgentInstructions key={key} value={value} onChange={text=>{setValue(text);setChanges(n=>n+1);}}/><button onClick={()=>setSaved(value)}>Save fixture</button></main>;}
createRoot(document.getElementById('root')!).render(<Fixture/>);
