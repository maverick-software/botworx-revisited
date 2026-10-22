import React,{useEffect,useRef,useState} from 'react';
import * as Popover from '@radix-ui/react-popover';
import {Check,ChevronDown,ChevronRight,ArrowLeft,Zap,RefreshCw,RotateCcw,Search,Settings} from 'lucide-react';
import type {Agent,ChatOptions,Model,ModelChoices,Provider,ProviderStatus,Thinking} from '../src/contracts';
import {selectModel} from '../src/composer';
import {call} from './ui';

export const effortLabel=(value:string)=>value==='default'?'Auto':({none:'Off',xhigh:'Extra high',max:'Maximum',ultra:'Ultra'} as Record<string,string>)[value]??value[0].toUpperCase()+value.slice(1);
const providerName=(id:Provider)=>id==='openai-oauth'?'ChatGPT':'OpenRouter';
export function ModelPicker({agent,options,change,connections,configure,disabled}:{agent:Agent|null;options:ChatOptions;change:(value:Partial<ChatOptions>)=>void;connections:ProviderStatus|null;configure:()=>void;disabled:boolean}){
 const [open,setOpen]=useState(false),[view,setView]=useState<'thinking'|'models'>('thinking'),[models,setModels]=useState<Model[]>([]),[loading,setLoading]=useState(false),[error,setError]=useState(''),[query,setQuery]=useState('');
 const searchInput=useRef<HTMLInputElement>(null),effortInput=useRef<HTMLInputElement>(null);
 useEffect(()=>{if(!open)return;const frame=requestAnimationFrame(()=>{if(view==='models')searchInput.current?.focus();else effortInput.current?.focus();});return()=>cancelAnimationFrame(frame);},[open,view]);
 const choices=useRef<ModelChoices>(connections?.selections??{}),generation=useRef(0);
 const provider=options.provider??agent?.provider??'openai-oauth';
 const model=options.model??(options.provider&&options.provider!==agent?.provider?'':agent?.model??'');
 const connected=(id:Provider)=>id==='openrouter'?!!connections?.openrouter:!!connections?.chatgpt?.authorized;
 useEffect(()=>{choices.current={...connections?.selections,...choices.current};},[connections?.selections]);
 useEffect(()=>{if(model)choices.current[provider]={model,thinking:options.thinking};},[provider,model,options.thinking]);
 useEffect(()=>{
  const current=++generation.current;setModels([]);setError('');
  if(!connected(provider)){setLoading(false);return;}
  setLoading(true);
  void call<Model[]>('providers.models',{provider}).then(rows=>{if(current===generation.current)setModels(rows);}).catch(e=>{if(current===generation.current)setError((e as Error).message);}).finally(()=>{if(current===generation.current)setLoading(false);});
  return()=>{generation.current++;};
 },[provider,connections?.openrouter,connections?.chatgpt?.authorized]);
 const chooseProvider=async(id:Provider,reset=false)=>{
  if(!connected(id)){setError(`Connect ${providerName(id)} in AI connections to use its models.`);return;}
  const current=++generation.current;setLoading(true);setError('');setQuery('');
  try{
   const rows=await call<Model[]>('providers.models',{provider:id});if(current!==generation.current)return;
   const choice=selectModel(rows,reset&&agent?{model:agent.model,thinking:'default'}:choices.current[id],{model,thinking:options.thinking},id==='openrouter'?connections?.defaultModel:undefined);
   if(!choice)throw new Error(`${providerName(id)} has no available text models. Refresh its model list or check your connection.`);
   choices.current[id]=choice;setModels(rows);change({provider:id,...choice});
  }catch(e){if(current===generation.current)setError((e as Error).message);}finally{if(current===generation.current)setLoading(false);}
 };
 const refresh=async()=>{
  if(!connected(provider)){configure();setOpen(false);return;}
  const current=++generation.current;setLoading(true);setError('');
  try{const rows=await call<Model[]>('providers.models',{provider,refresh:true});if(current===generation.current)setModels(rows);}
  catch(e){if(current===generation.current)setError((e as Error).message);}finally{if(current===generation.current)setLoading(false);}
 };
 const selected=models.find(m=>m.id===model),levels:Thinking[]=['default',...(selected?.thinking??[])];
 const displayName=(name:string)=>name.replace(/^[^:]+:\s*/, '').replace(/^openai\//,'').replace(/^gpt-/,'GPT-').replace(/-(sol|astra|luna|terra)\b/gi,(_,word:string)=>' '+word[0].toUpperCase()+word.slice(1));
 const name=displayName(selected?.name||model||'Choose model');
 const filtered=models.filter(m=>(m.name+' '+m.id).toLowerCase().includes(query.toLowerCase())).sort((a,b)=>Number(b.id===model)-Number(a.id===model)||displayName(a.name).localeCompare(displayName(b.name)));
 const progress=levels.length>1?Math.max(0,levels.indexOf(options.thinking))/(levels.length-1)*100:0;
 const pick=(m:Model)=>{change({provider,model:m.id,thinking:m.thinking?.includes(options.thinking)?options.thinking:'default'});setOpen(false);};
 const defaultModel=models.find(m=>m.id===(provider===agent?.provider?agent.model:provider==='openrouter'?connections?.defaultModel:undefined));
 const changedThinking=options.thinking!=='default'&&!selected?.thinking?.includes(options.thinking);
 return <Popover.Root open={open} onOpenChange={value=>{setOpen(value);if(value){setView('thinking');setQuery('');}}}><Popover.Trigger asChild><button type="button" className="model-trigger" aria-label="Model and thinking" title={`${providerName(provider)} · ${name} · ${effortLabel(options.thinking)} thinking`} disabled={disabled||!agent}><Zap size={14} fill="currentColor"/><span>{name}</span><b>{effortLabel(options.thinking)}</b><ChevronDown size={12}/></button></Popover.Trigger><Popover.Portal><Popover.Content className={'model-popover compact-model-popover '+(view==='thinking'?'effort-popover':'catalog-popover')} align="end" side="top" sideOffset={8} collisionPadding={12} aria-label="Model and thinking settings">
 {view==='thinking'?<>
  <div className="effort-heading"><Zap size={16} fill="currentColor"/><div className="effort-selection"><strong>{effortLabel(options.thinking)}</strong><button type="button" aria-label="Select model" title={'Select model · '+providerName(provider)} onClick={()=>setView('models')}>{name}<ChevronRight size={12}/></button></div><button type="button" className="icon-button" aria-label="Reset thinking level" title="Use automatic thinking" disabled={options.thinking==='default'||loading} onClick={()=>change({thinking:'default'})}><RotateCcw size={15}/></button></div>
  <div className="thinking-control"><label className="sr-only" htmlFor="thinking-effort">Thinking level</label><div className="effort-slider" style={{'--effort-progress':progress+'%'} as React.CSSProperties}><div className="effort-dots" aria-hidden="true">{levels.map(level=><i key={level}/>)}</div><input ref={effortInput} id="thinking-effort" aria-label="Thinking level" aria-valuetext={effortLabel(options.thinking)} type="range" min="0" max={Math.max(0,levels.length-1)} step="1" value={Math.max(0,levels.indexOf(options.thinking))} disabled={loading||levels.length<2} onChange={e=>change({thinking:levels[Number(e.target.value)]})}/></div>{!loading&&levels.length<2&&<p>This model uses automatic thinking.</p>}</div>
  {loading&&<p className="model-provider-context" role="status">Loading model capabilities…</p>}
  {changedThinking&&!loading&&<p className="model-error">{effortLabel(options.thinking)} is unavailable. <button type="button" className="inline-link" onClick={()=>change({thinking:'default'})}>Use Auto</button></p>}
 </>:<>
  <div className="model-popover-heading"><button type="button" className="catalog-back" aria-label="Back to thinking" onClick={()=>setView('thinking')}><ArrowLeft size={14}/>Select model</button><div><button type="button" className="icon-button" disabled={loading} aria-label="Refresh models" title="Refresh available models" onClick={()=>void refresh()}><RefreshCw size={14} className={loading?'spin':''}/></button><button type="button" className="icon-button" disabled={loading} aria-label="Reset model and thinking" title="Use agent defaults" onClick={()=>agent&&void chooseProvider(agent.provider,true)}><RotateCcw size={14}/></button></div></div>
  <div className="provider-tabs" role="group" aria-label="Model provider">{(['openai-oauth','openrouter'] as const).map(id=><button type="button" key={id} aria-pressed={provider===id} disabled={loading} onClick={()=>void chooseProvider(id)}>{providerName(id)}{!connected(id)&&<small>Connect</small>}</button>)}</div>
  <label className="model-search"><Search size={14}/><input ref={searchInput} aria-label="Search models" placeholder="Search models" value={query} onChange={e=>setQuery(e.target.value)}/></label>
  <div className="model-list" aria-busy={loading}>{loading?<p role="status">Loading models…</p>:<>{!query&&defaultModel&&<button type="button" className="default-model-option" aria-label="Use default model" onClick={()=>{change({provider,model:defaultModel.id,thinking:'default'});setOpen(false);}}><span>Default<small>{displayName(defaultModel.name)}</small></span></button>}{filtered.slice(0,80).map(m=><button type="button" className={m.id===model?'selected':''} key={m.id} data-model-id={m.id} title={m.name+' · '+m.id+(m.inputModalities?.includes('image')?' · Supports images':'')} onClick={()=>pick(m)}><span>{displayName(m.name)}<small className="sr-only">{m.id}</small></span>{m.id===model&&<Check size={15}/>}</button>)}</>}{!loading&&!filtered.length&&<p>{models.length?'No matching models.':connected(provider)?'No models available. Refresh or check this connection.':'Connect this provider in AI connections.'}</p>}{!loading&&filtered.length>80&&<p>Search {filtered.length} available models.</p>}</div>
  <div className="model-catalog-footer"><button type="button" className="subtle-link" aria-label="Thinking level settings" onClick={()=>setView('thinking')}>{effortLabel(options.thinking)} thinking<ChevronRight size={12}/></button><button type="button" className="model-connections" onClick={()=>{setOpen(false);configure();}} title="AI connections" aria-label="AI connections"><Settings size={14}/></button></div>
 </>}
 {error&&<p className="model-error" role="alert">{error.replace(/^Error invoking remote method '[^']+': (?:Error: )?/,'')}</p>}
 </Popover.Content></Popover.Portal></Popover.Root>;
}
