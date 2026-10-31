import React,{useEffect,useState} from 'react';
import {BookOpen,Plug,Search} from 'lucide-react';
import type {PluginRecord} from '../src/plugin-contracts';
import {call} from './ui';
import {composioMcpPluginName} from '../src/composio-mcp-contracts';
import {pluginTitle} from './plugin-presentation';
import type {SkillCatalogEntry} from '../src/skill-contracts';
export function PluginsNavigation({selection,select,revision=0}:{selection?:string|null;select?:(name:string|null)=>void;revision?:number}){
 const [rows,setRows]=useState<PluginRecord[]>([]),[query,setQuery]=useState(''),[error,setError]=useState('');
 useEffect(()=>{let live=true;void call<PluginRecord[]>('plugins.list').then(rows=>{if(live){setRows(rows.filter(row=>row.kind!=='skills'&&row.name!==composioMcpPluginName&&(row.name!=='composio'||row.configured)));setError('');}}).catch(()=>{if(live)setError('Installed plugins could not be loaded.');});return()=>{live=false;};},[revision]);
 return <><div className="customize-nav-heading"><strong>Plugins</strong><Plug size={17}/></div><div className="sidebar-scroll customize-installed"><h2>Installed plugins</h2><label className="customize-installed-search"><Search size={14}/><input aria-label="Filter installed plugins" placeholder="Filter plugins" value={query} onChange={e=>setQuery(e.target.value)}/></label>{rows.filter(row=>(pluginTitle(row)+' '+row.name+' '+row.description).toLowerCase().includes(query.toLowerCase())).map(row=><button className={'nav '+(selection===row.name?'active':'')} key={row.name} title={row.description} onClick={()=>select?.(row.name)}><Plug size={16}/><span>{pluginTitle(row)}</span>{!row.enabled&&<small>Off</small>}</button>)}{!rows.length&&!error&&<p className="sidebar-hint">Installed plugins appear here.</p>}{error&&<p role="alert" className="sidebar-hint">{error}</p>}</div></>;
}
export function SkillsNavigation({rows,selection,select,disabled=false}:{rows:SkillCatalogEntry[];selection?:string|null;select?:(id:string)=>void;disabled?:boolean}){
 const [query,setQuery]=useState('');
 const visible=rows.filter(row=>(row.name+' '+row.description+' '+row.source).toLowerCase().includes(query.toLowerCase()));
 return <><div className="customize-nav-heading"><strong>Skills</strong><BookOpen size={17}/></div><div className="sidebar-scroll customize-installed"><h2>Available skills</h2><label className="customize-installed-search"><Search size={14}/><input aria-label="Filter available skills" placeholder="Filter skills" value={query} onChange={e=>setQuery(e.target.value)}/></label>{visible.map(row=><button className={'nav '+(selection===row.id?'active':'')} key={row.id} title={row.description} disabled={disabled&&selection!==row.id} onClick={()=>select?.(row.id)}><BookOpen size={16}/><span>{row.name}</span>{!row.enabled&&<small>Off</small>}</button>)}{!visible.length&&<p className="sidebar-hint">{rows.length?'No matching skills.':'Available skills appear here.'}</p>}</div></>;
}
