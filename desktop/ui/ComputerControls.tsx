import {SettingsSection} from './SettingsSection';
import React,{useContext,useEffect,useState} from 'react';
import {Monitor,X} from 'lucide-react';
import type {ChatOptions} from '../src/contracts';
import type {ComputerReference} from '../src/computer-contracts';
import {call} from './ui';
import {compactLabel} from './composer-labels';
import {ComputerSettings} from './ComputerSettings';
import {WorkspaceLinks} from './WorkspaceLinks';

export function ComputerControls({options,change,open,close,disabled,inline}:{options:ChatOptions;change:(patch:Partial<ChatOptions>)=>void;open:boolean;close:()=>void;disabled:boolean;inline?:boolean}){
 const {owner}=useContext(WorkspaceLinks),ids=options.windows??[],[references,setReferences]=useState<ComputerReference[]>([]),[busy,setBusy]=useState(false),[error,setError]=useState('');
 useEffect(()=>{let live=true;setReferences([]);if(ids.length)void call<ComputerReference[]>('computer.references',{ids}).then(value=>{if(live)setReferences(value);}).catch(failure=>{if(live)setError(failure.message);});return()=>{live=false;};},[ids.join(',')]);
 useEffect(()=>window.sylvana.onCommand(command=>{if(command==='computer-stopped'&&ids.length){setReferences([]);change({windows:[]});}}),[change,ids.join(',')]);
 useEffect(()=>{if(!ids.length||['ask','full'].includes(options.permission))return;let live=true;void Promise.all(ids.map(id=>call('computer.revoke',{id}))).then(()=>{if(live){setReferences([]);change({windows:[]});}}).catch(failure=>{if(live)setError(failure.message);});return()=>{live=false;};},[options.permission,ids.join(',')]);
 async function remove(id:string){setBusy(true);setError('');try{await call('computer.revoke',{id});change({windows:ids.filter(value=>value!==id)});}catch(failure){setError((failure as Error).message);}finally{setBusy(false);}}
 return <>
 {!!ids.length&&<div className="computer-shared-windows" aria-label="Shared application windows">{ids.map(id=>{const ref=references.find(ref=>ref.id===id);return <div className={'computer-window-chip '+(ref&&!ref.available?'unavailable':'')} key={id} data-computer-window={id} title={ref?.title??'Shared window'}><Monitor size={14}/><span>{compactLabel(ref?.title??'Shared window')}</span><button type="button" className="context-remove" aria-label={'Remove shared window '+(ref?.title??id)} disabled={disabled||busy} onClick={()=>void remove(id)}><X size={13}/></button></div>;})}</div>}
 {error&&<p role="alert" className="computer-error">{error}</p>}
 {open&&<SettingsSection inline={inline} title="Computer use" close={close} className="computer-window-dialog"><ComputerSettings key={owner}/></SettingsSection>}
 </>;
}
