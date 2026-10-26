import React,{useEffect,useState} from 'react';
import {BookOpen,Plug,Search} from 'lucide-react';
import type {PluginRecord} from '../src/plugin-contracts';
import {call} from './ui';
import {pluginTitle} from './plugin-presentation';
import type {View} from './WorkspaceViews';
export const isCustomize=(view:View)=>['plugins','skills'].includes(view);
export function CustomizeNavigation({view,open,selection,select,revision=0}:{view:View;open:(view:View)=>void;selection?:string|null;select?:(name:string|null)=>void;revision?:number}){
 const [rows,setRows]=useState<PluginRecord[]>([]),[query,setQuery]=useState(''),[error,setError]=useState('');
 useEffect(()=>{let live=true;void call<PluginRecord[]>('plugins.list').then(rows=>{if(live){setRows(rows.filter(row=>row.kind!=='skills'));setError('');}}).catch(()=>{if(live)setError('Installed plugins could not be loaded.');});return()=>{live=false;};},[revision]);
 return <><div className="customize-nav-heading"><strong>Customize</strong><Search size={16}/></div><nav className="customize-nav" aria-label="Customize">{([{id:'plugins',name:'Plugins',icon:Plug},{id:'skills',name:'Skills',icon:BookOpen}] as const).map(page=><button key={page.id} className={'nav '+(view===page.id?'active':'')} aria-current={view===page.id?'page':undefined} onClick={()=>{select?.(null);open(page.id);}}><page.icon size={17}/>{page.name}</button>)}</nav><div className="sidebar-scroll customize-installed"><h2>Installed</h2><label className="customize-installed-search"><Search size={14}/><input aria-label="Filter installed plugins" placeholder="Filter plugins" value={query} onChange={e=>setQuery(e.target.value)}/></label>{rows.filter(row=>(pluginTitle(row)+' '+row.name+' '+row.description).toLowerCase().includes(query.toLowerCase())).map(row=><button className={'nav '+(view==='plugins'&&selection===row.name?'active':'')} key={row.name} title={row.description} onClick={()=>{open('plugins');select?.(row.name);}}><Plug size={16}/><span>{pluginTitle(row)}</span>{!row.enabled&&<small>Off</small>}</button>)}{!rows.length&&!error&&<p className="sidebar-hint">Installed plugins appear here.</p>}{error&&<p role="alert" className="sidebar-hint">{error}</p>}</div></>;
}
