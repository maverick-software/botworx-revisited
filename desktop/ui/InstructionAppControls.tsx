import React,{useEffect,useId,useRef,useState} from 'react';
import type {Editor} from '@tiptap/react';
import type {ToolSource} from '../src/tool-contracts';
import {instructionAppLabel,instructionAppMarkdown,instructionAppReferences} from '../src/instruction-app-references';

type Anchor={mode:'formatted'|'source';from:number;to:number;query:string;manual:boolean;document:unknown;left:number;top:number};
export function InstructionAppControls({editor,mode,value,onChange,sourceArea,sources,sourcesError,refresh,browse}:{editor:Editor|null;mode:'formatted'|'source';value:string;onChange:(value:string)=>void;sourceArea:React.RefObject<HTMLTextAreaElement|null>;sources:ToolSource[]|null;sourcesError:boolean;refresh:()=>void;browse:()=>void}){
 const listId='instruction-app-list-'+useId().replaceAll(':','');
 const [anchor,setAnchorState]=useState<Anchor|null>(null),[selected,setSelected]=useState(0),[notice,setNotice]=useState('');
 const current=useRef({editor,mode,value,onChange,sources}),anchorRef=useRef<Anchor|null>(null),dismissed=useRef(''),root=useRef<HTMLDivElement>(null),menu=useRef<HTMLDivElement>(null);
 current.current={editor,mode,value,onChange,sources};
 const setAnchor=(next:Anchor|null)=>{anchorRef.current=next;setAnchorState(next);};
 const position=(left:number,bottom:number)=>({left:Math.max(8,Math.min(left,window.innerWidth-Math.min(360,window.innerWidth-16)-8)),top:Math.max(8,Math.min(bottom+5,window.innerHeight-285))});
 const observe=(manual=false,button?:HTMLElement)=>{
  const props=current.current;let from=0,to=0,before='',document:unknown,coords={left:8,bottom:100};
  if(props.mode==='formatted'){
   if(!props.editor||props.editor.isActive('codeBlock')||props.editor.isActive('code')){setAnchor(null);return;}
   const selection=props.editor.state.selection;if(!manual&&!selection.empty){setAnchor(null);return;}
   from=selection.from;to=selection.to;document=props.editor.state.doc;
   if(!manual){const parent=selection.$from;if(!parent.parent.inlineContent){setAnchor(null);return;}before=parent.parent.textBetween(0,parent.parentOffset,'\0','\ufffc');}
   coords=props.editor.view.coordsAtPos(to);
  }else{
   const area=sourceArea.current;if(!area){setAnchor(null);return;}from=area.selectionStart;to=area.selectionEnd;document=area.value;
   if(!manual&&from!==to){setAnchor(null);return;}before=area.value.slice(0,to);const box=area.getBoundingClientRect();coords={left:box.left,bottom:Math.min(box.bottom,window.innerHeight-290)};
  }
  const match=manual?null:/(?:^|[\s(])@([^\s@\[\]()]*)$/u.exec(before);
  if(!manual&&!match){dismissed.current='';setAnchor(null);return;}
  const query=match?.[1]??'';if(!manual){from=to-query.length-1;if(props.mode==='source'&&!instructionAppReferences(String(document).slice(0,from)+instructionAppMarkdown('web_search','Query')).some(row=>row.from===from)){setAnchor(null);return;}}
  const key=props.mode+':'+from+':'+to+':'+query;if(!manual&&key===dismissed.current)return;
  if(button){const box=button.getBoundingClientRect();coords={left:box.left,bottom:box.bottom};}
  const old=anchorRef.current;setAnchor({mode:props.mode,from,to,query,manual,document,...position(coords.left,coords.bottom)});if(old?.query!==query||old?.from!==from)setSelected(0);
 };
 const options=(query:string)=>(current.current.sources??[]).filter(source=>source.enabled&&[source.name,source.plugin??'',source.id].join(' ').toLocaleLowerCase().includes(query.toLocaleLowerCase())).slice(0,40);
 const choose=(id:string)=>{
  const at=anchorRef.current,props=current.current,source=props.sources?.find(row=>row.id===id&&row.enabled);
  if(!at||at.mode!==props.mode||!source){setNotice('The assigned apps changed. Reopen the app picker.');setAnchor(null);return;}
  if(at.mode==='formatted'){
   if(!props.editor||props.editor.state.doc!==at.document){setNotice('The instructions changed. Reopen the app picker.');setAnchor(null);return;}
   const after=props.editor.state.doc.textBetween(at.to,Math.min(at.to+1,props.editor.state.doc.content.size));setAnchor(null);
   props.editor.chain().focus().insertContentAt({from:at.from,to:at.to},[{type:'instructionAppMention',attrs:{source:source.id,label:instructionAppLabel(source.name)}},...(!after||!/^\s/.test(after)?[{type:'text',text:' '}]:[])]).run();
  }else{
   const area=sourceArea.current;if(!area||area.value!==at.document||props.value!==at.document){setNotice('The instructions changed. Reopen the app picker.');setAnchor(null);return;}
   const token=instructionAppMarkdown(source.id,source.name),space=!props.value[at.to]||!/\s/.test(props.value[at.to])?' ':'',next=props.value.slice(0,at.from)+token+space+props.value.slice(at.to);setAnchor(null);props.onChange(next);
   requestAnimationFrame(()=>{area.focus();area.setSelectionRange(at.from+token.length+space.length,at.from+token.length+space.length);});
  }
  setNotice('App reference inserted. Save the agent to keep it.');dismissed.current='';
 };
 const action=useRef({observe,choose});action.current={observe,choose};
 const keydown=(event:KeyboardEvent)=>{
  if(event.isComposing)return;const at=anchorRef.current;if(!at)return;
  if(event.key!=='Escape'&&(event.target as HTMLElement)?.closest('.instruction-app-picker-actions'))return;
  const rows=options(at.query);if(['ArrowDown','ArrowUp'].includes(event.key)){event.preventDefault();event.stopPropagation();setSelected(index=>rows.length?(index+(event.key==='ArrowDown'?1:-1)+rows.length)%rows.length:0);}
  else if(event.key==='Enter'&&rows.length){event.preventDefault();event.stopPropagation();action.current.choose(rows[Math.min(selected,rows.length-1)].id);}
  else if(event.key==='Enter'&&at.manual){event.preventDefault();event.stopPropagation();}
  else if(event.key==='Escape'){event.preventDefault();event.stopPropagation();dismissed.current=at.mode+':'+at.from+':'+at.to+':'+at.query;setAnchor(null);if(at.manual){if(at.mode==='formatted')current.current.editor?.commands.focus();else sourceArea.current?.focus();}}
 };
 const keys=useRef(keydown);keys.current=keydown;
 useEffect(()=>{
  const update=()=>{if(anchorRef.current?.manual){if((mode==='formatted'?editor?.state.doc:sourceArea.current?.value)!==anchorRef.current.document)setAnchor(null);return;}action.current.observe();};
  const key=(event:KeyboardEvent)=>keys.current(event),area=sourceArea.current,editable=mode==='formatted'?editor?.view.dom:area;
  editor?.on('update',update);editor?.on('selectionUpdate',update);editable?.addEventListener('keydown',key,true);area?.addEventListener('input',update);area?.addEventListener('select',update);area?.addEventListener('keyup',update);
  setAnchor(null);dismissed.current='';
  return()=>{editor?.off('update',update);editor?.off('selectionUpdate',update);editable?.removeEventListener('keydown',key,true);area?.removeEventListener('input',update);area?.removeEventListener('select',update);area?.removeEventListener('keyup',update);};
 },[editor,mode]);
 useEffect(()=>{editor?.view.dispatch(editor.state.tr.setMeta('instructionAppSources',true));setSelected(0);},[editor,sources]);
 useEffect(()=>{if(!anchor)return;const close=(event:MouseEvent)=>{if(!root.current?.contains(event.target as Node))setAnchor(null);};document.addEventListener('mousedown',close);return()=>document.removeEventListener('mousedown',close);},[!!anchor]);
 useEffect(()=>{menu.current?.querySelector('[aria-selected=true]')?.scrollIntoView({block:'nearest'});},[selected,anchor?.query]);
 useEffect(()=>{const element=mode==='formatted'?editor?.view.dom:sourceArea.current;if(!element)return;const attributes=['aria-autocomplete','aria-controls','aria-activedescendant'],before=attributes.map(name=>element.getAttribute(name));if(anchor){element.setAttribute('aria-autocomplete','list');element.setAttribute('aria-controls',listId);if(options(anchor.query).length)element.setAttribute('aria-activedescendant',listId+'-'+Math.min(selected,options(anchor.query).length-1));}return()=>attributes.forEach((name,index)=>{if(before[index]===null)element.removeAttribute(name);else element.setAttribute(name,before[index]!);});},[editor,mode,anchor,selected,sources]);
 const rows=anchor?options(anchor.query):[],references=[...new Map(instructionAppReferences(value).map(reference=>[reference.id,reference])).values()],unavailable=references.filter(reference=>sources!==null&&!sources.some(source=>source.id===reference.id&&source.enabled&&source.ready));
 return <div ref={root} className="instruction-app-controls" data-independent-agent-settings><button type="button" className="subtle-link" aria-expanded={!!anchor} aria-controls={anchor?listId:undefined} onMouseDown={event=>event.preventDefault()} onClick={event=>{setNotice('');observe(true,event.currentTarget);}}>Insert app</button><span className="hint">Type @ to reference an assigned app.</span>
 {notice&&<p className="hint" role="status">{notice}</p>}{unavailable.length>0&&<p className="hint instruction-app-warning" role="status">{unavailable.length} app reference{unavailable.length===1?' needs':'s need'} an assigned, connected app. <button type="button" className="subtle-link" onClick={browse}>Manage apps</button></p>}
 {anchor&&<div ref={menu} className="instruction-app-picker" style={{left:anchor.left,top:anchor.top}} onKeyDown={event=>keydown(event.nativeEvent)}>
 <strong>Assigned apps</strong>{anchor.manual?<input autoFocus role="combobox" aria-expanded="true" aria-controls={listId} aria-activedescendant={rows.length?listId+'-'+Math.min(selected,rows.length-1):undefined} aria-label="Find assigned app" value={anchor.query} onChange={event=>{setAnchor({...anchor,query:event.target.value});setSelected(0);}}/>:<small>Keep typing to filter · ↑ ↓ choose · Enter insert · Escape close</small>}
 {sources===null?<p role="status">{sourcesError?'Assigned apps could not be loaded.':'Loading assigned apps…'}</p>:<div id={listId} role="listbox" aria-label="Instruction app suggestions">{rows.map((source,index)=><button key={source.id} id={listId+'-'+index} type="button" role="option" aria-selected={index===Math.min(selected,rows.length-1)} onMouseDown={event=>event.preventDefault()} onMouseEnter={()=>setSelected(index)} onFocus={()=>setSelected(index)} onClick={()=>choose(source.id)}><span>{instructionAppLabel(source.name)}</span><small>{source.ready?'Connected':'Connection required'} · {source.plugin??source.kind} · {source.id==='web_search'?'Web search':source.id.slice(-8)}</small></button>)}</div>}
 {sources!==null&&!rows.length&&<p>No assigned apps match. Add or assign an app to reference it here.</p>}<div className="instruction-app-picker-actions"><button type="button" className="subtle-link" onClick={refresh}>Refresh apps</button><button type="button" className="subtle-link" onClick={()=>{setAnchor(null);browse();}}>Browse apps</button><button type="button" className="subtle-link" onClick={()=>setAnchor(null)}>Close app picker</button></div>
 </div>}</div>;
}
