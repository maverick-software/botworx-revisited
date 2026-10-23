import React,{useEffect,useRef,useState} from 'react';
import {EditorContent,useEditor} from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import {Markdown} from '@tiptap/markdown';
import {TableKit} from '@tiptap/extension-table';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import {Fragment,Slice} from '@tiptap/pm/model';
import {instructionsNeedSource,sameInstructionMarkdown} from './instruction-markdown';
import type {ToolSource} from '../src/tool-contracts';
import {InstructionAppMention} from './instruction-app-extension';
import {InstructionAppControls} from './InstructionAppControls';
import './agent-instructions.css';

export function AgentInstructions({value,onChange,sources=null,sourcesError=false,refreshSources=()=>{},browseApps}:{value:string;onChange:(text:string)=>void;sources?:ToolSource[]|null;sourcesError?:boolean;refreshSources?:()=>void;browseApps?:()=>void}){
 const sourceArea=useRef<HTMLTextAreaElement>(null),appSources=useRef<ToolSource[]|null>(sources);appSources.current=sources;
 const [mode,setMode]=useState<'formatted'|'source'>(()=>instructionsNeedSource(value)?'source':'formatted'),[sourceReason,setSourceReason]=useState(''),[link,setLink]=useState<string|null>(null),[linkError,setLinkError]=useState('');
 const loaded=useRef(value),current=useRef(value),notify=useRef(onChange);current.current=value;notify.current=onChange;
 const editor=useEditor({extensions:[InstructionAppMention.configure({sources:()=>appSources.current}),StarterKit.configure({link:{openOnClick:false,autolink:false,linkOnPaste:false,protocols:['https','http','mailto']}}),Markdown,TableKit.configure({table:{resizable:false}}),TaskList,TaskItem.configure({nested:true,HTMLAttributes:{"data-type":"taskItem"}})],content:instructionsNeedSource(value)?'':value,contentType:'markdown',editorProps:{attributes:{role:'textbox','aria-label':'Instructions','aria-multiline':'true',class:'agent-instructions-prose'},handlePaste(view,event){
  // Clipboard HTML can contain executable markup or remote images. Paste its text.
  event.preventDefault();const text=event.clipboardData?.getData('text/plain')??'';if(!text)return true;
  const paragraphs=text.replaceAll('\r\n','\n').split('\n').map(line=>({type:'paragraph',content:line?[{type:'text',text:line}]:[]}));
  view.dispatch(view.state.tr.replaceSelection(new Slice(Fragment.fromArray(paragraphs.map(node=>view.state.schema.nodeFromJSON(node))),0,0)));return true;
 },handleDrop(_view,event){event.preventDefault();return true;}},onCreate({editor}){
  if(!instructionsNeedSource(current.current)&&!sameInstructionMarkdown(current.current,editor.getMarkdown())){setSourceReason('This document uses formatting that needs Markdown source editing. Your original instructions are preserved.');setMode('source');}
 },onUpdate({editor}){const next=editor.getMarkdown();loaded.current=next;notify.current(next);}});
 useEffect(()=>{if(!editor||value===loaded.current)return;loaded.current=value;if(instructionsNeedSource(value)){setMode('source');return;}editor.commands.setContent(value,{contentType:'markdown',emitUpdate:false});if(!sameInstructionMarkdown(value,editor.getMarkdown())){setSourceReason('This document uses formatting that needs Markdown source editing. Your original instructions are preserved.');setMode('source');}},[editor,value]);
 const formatted=()=>{if(!editor)return;if(instructionsNeedSource(value)){setSourceReason('This document contains embedded markup, images, or references. Edit its Markdown source to preserve them.');return;}editor.commands.setContent(value,{contentType:'markdown',emitUpdate:false});if(!sameInstructionMarkdown(value,editor.getMarkdown())){setSourceReason('This document uses formatting that needs Markdown source editing. Your original instructions are preserved.');return;}loaded.current=value;setSourceReason('');setMode('formatted');};
 const applyLink=()=>{if(!editor||link===null)return;const url=link.trim();if(url&&!/^(https?:\/\/|mailto:)/i.test(url)){setLinkError('Use an https, http, or mailto link.');return;}if(url)editor.chain().focus().extendMarkRange('link').setLink({href:url}).run();else editor.chain().focus().extendMarkRange('link').unsetLink().run();setLink(null);setLinkError('');};
 const tool=(name:string,active:boolean,action:()=>void)=><button type="button" aria-label={name} aria-pressed={active} onMouseDown={event=>event.preventDefault()} onClick={action}>{name}</button>;
 return <section className="agent-instructions" aria-label="Agent instructions editor" data-independent-agent-settings onChange={event=>event.stopPropagation()}><div className="agent-instructions-heading"><span>Instructions</span><div role="group" aria-label="Instruction editing mode"><button type="button" aria-pressed={mode==='formatted'} onClick={formatted}>Formatted</button><button type="button" aria-pressed={mode==='source'} onClick={()=>{setMode('source');setLink(null);}}>Markdown</button></div></div>
 {browseApps&&<InstructionAppControls editor={editor} mode={mode} value={value} onChange={onChange} sourceArea={sourceArea} sources={sources} sourcesError={sourcesError} refresh={refreshSources} browse={browseApps}/>}
 {sourceReason&&<p role="status" className="hint">{sourceReason}</p>}
 {mode==='formatted'&&editor&&<><div className="agent-instructions-toolbar" role="toolbar" aria-label="Instruction formatting">{tool('Heading',editor.isActive('heading'),()=>{editor.chain().focus().toggleHeading({level:2}).run();})}{tool('Bold',editor.isActive('bold'),()=>{editor.chain().focus().toggleBold().run();})}{tool('Italic',editor.isActive('italic'),()=>{editor.chain().focus().toggleItalic().run();})}{tool('Bullets',editor.isActive('bulletList'),()=>{editor.chain().focus().toggleBulletList().run();})}{tool('Numbered list',editor.isActive('orderedList'),()=>{editor.chain().focus().toggleOrderedList().run();})}{tool('Quote',editor.isActive('blockquote'),()=>{editor.chain().focus().toggleBlockquote().run();})}{tool('Code',editor.isActive('codeBlock'),()=>{editor.chain().focus().toggleCodeBlock().run();})}{tool('Link',editor.isActive('link'),()=>{setLink(editor.getAttributes('link').href??'');setLinkError('');})}{tool('Undo',false,()=>{editor.chain().focus().undo().run();})}</div>{link!==null&&<div className="agent-instructions-link"><label>Link address<input aria-label="Instruction link address" value={link} onChange={event=>setLink(event.target.value)} onKeyDown={event=>{if(event.key==='Enter'){event.preventDefault();applyLink();}if(event.key==='Escape'){event.preventDefault();event.stopPropagation();setLink(null);}}}/></label><button type="button" onClick={applyLink}>Apply link</button><button type="button" className="secondary" onClick={()=>setLink(null)}>Cancel link</button>{linkError&&<p role="alert">{linkError}</p>}</div>}<EditorContent editor={editor}/></>}
 {mode==='source'&&<textarea ref={sourceArea} aria-label="Instructions" spellCheck={false} rows={16} maxLength={100000} value={value} onChange={event=>{loaded.current=event.target.value;onChange(event.target.value);}}/>}
 {value.length>100000&&<p role="alert">Instructions must contain at most 100,000 characters before saving.</p>}
 </section>;
}
