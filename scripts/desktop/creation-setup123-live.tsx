import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import {AgentEditor} from '../../desktop/ui/AgentSettings';
import '../../desktop/ui/style.css';
const owner=new URLSearchParams(location.search).get('owner')!;
function Fixture(){const [created,setCreated]=useState(''),[error,setError]=useState('');return <>{error&&<p role="alert">{error}</p>}{created?<section aria-label="Created qualification agent">{created}</section>:<AgentEditor administrator owner={owner} agent={null} defaultModel="gpt-6.1-sol" connections={null} close={()=>{}} saved={async(_stay,id)=>{if(!id)throw Error('Missing actual saved identity');setCreated(id);}} run={async work=>{setError('');try{await work();}catch(error){setError((error as Error).message);}}}/>}</>;}
createRoot(document.getElementById('root')!).render(<Fixture/>);
