import React,{useEffect,useState} from 'react';
import type {Profile} from '../src/contracts';
import {call} from './ui';
import type {Run} from './Panels';
function useOperation(run:Run){const [busy,setBusy]=useState(false),[notice,setNotice]=useState('');return {busy,notice,perform:(work:()=>Promise<unknown>,message='Settings saved.')=>{setBusy(true);setNotice('');void run(async()=>{await work();setNotice(message);}).finally(()=>setBusy(false));}};}
function Result({value}:{value:string}){return value?<p role="status" className="settings-success">{value}</p>:null;}
export function ProfilePanel({run}:{run:Run}){
 const [profile,setProfile]=useState<Profile|null>(null);const op=useOperation(run);
 useEffect(()=>{void run(async()=>setProfile(await call<Profile>('settings.profile.get')));},[]);
 return <>{op.notice&&<Result value={op.notice}/>}<p className="pane-intro">Your profile in this Sylvana installation.</p>{profile?<form onSubmit={e=>{e.preventDefault();op.perform(()=>call('settings.profile.save',{value:profile}));}}><div className="two-columns">{[['first_name','First name'],['last_name','Last name'],['username','Username'],['mobile_number','Mobile number'],['company_name','Company'],['title','Job title']].map(([key,label])=><label key={key}>{label}<input maxLength={key==='mobile_number'?40:100} value={profile[key as keyof Profile]??''} onChange={e=>setProfile({...profile,[key]:e.target.value})}/></label>)}</div><button disabled={op.busy}>Save profile</button></form>:<p role="status">Loading profile…</p>}</>;
}
