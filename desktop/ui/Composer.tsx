
import {type GoalInput} from '../src/goal-settings';
import {ComputerControls} from './ComputerControls';
import {ComposerAddMenu} from './ComposerAddMenu';
import React,{useEffect,useId,useState,type RefObject} from 'react';
import {contextMention,removeAgentMention,type AgentMention} from '../src/agent-mention';
import './agent-style.css';
import {Plus,ArrowUp,Square,Check,Shield,Paperclip,Folder,Target,Lightbulb,Mic,AudioLines,Wrench,X,Pause,Play,CheckCircle,Monitor,Trash2,Pencil,Maximize2} from 'lucide-react';
import type {CommandPermissions} from '../src/terminal-contracts';
import type {Agent,ChatOptions,FileReference,Goal,ProviderStatus,Project} from '../src/contracts';
import {AgentTools} from './AgentTools';
import {ModelPicker} from './ModelPicker';
import type {Preferences} from './ui';
import {Menu,MenuItem,MenuSeparator,Modal,call} from './ui';
import type {Run} from './Panels';
import type {VoiceState} from './VoiceControls';
import {compactLabel} from './composer-labels';
import {SelectedSourceCards} from './SelectedSources';
import {AttachmentCards} from './Attachments';
export function Composer({scope,administrator,terminal,project,editProject,removeProject,agent,agents,selectAgent,options,change,value,setValue,submit,steer,editGoal,expandGoal,input,preferences,disabled,request,cancel,files,pick,forget,goal,goals,selectGoal,setGoal,runGoal,manageGoal,run,voice,connections,configure,configureAgent,paste,attaching}:{
 scope?:string;administrator:boolean;terminal:()=>void;project:Project|null;editProject:()=>void;removeProject:()=>void;agent:Agent|null;agents:Agent[];selectAgent:(agent:Agent)=>Promise<void>;options:ChatOptions;change:(value:Partial<ChatOptions>)=>void;value:string;setValue:(v:string)=>void;submit:(event?:React.FormEvent,text?:string)=>Promise<unknown>;steer:()=>Promise<unknown>;editGoal:()=>void;expandGoal:()=>void;input:RefObject<HTMLTextAreaElement>;preferences:Preferences;disabled:boolean;request:string|null;cancel:()=>void;files:FileReference[];pick:(kind:'file'|'folder')=>Promise<void>;forget:(id:string)=>Promise<void>;goal:Goal|null;goals:Goal[];selectGoal:(goal:Goal)=>Promise<void>;setGoal:(goal:GoalInput)=>Promise<void>;runGoal:()=>void;manageGoal:(action:'pause'|'complete'|'delete')=>void;run:Run;voice:VoiceState;connections:ProviderStatus|null;configure:()=>void;configureAgent:()=>void;
 paste:(event:React.ClipboardEvent<HTMLTextAreaElement>)=>void;attaching:boolean;
}){

 const [caret,setCaret]=useState(value.length),[mentionActive,setMentionActive]=useState<string|undefined>(),[mentionHidden,setMentionHidden]=useState(false),[choosingAgent,setChoosingAgent]=useState(false),mentionList=useId();
 const mention=!disabled&&!mentionHidden?contextMention(value,caret):null;

 const chooseAgent=(peer:Agent,range:AgentMention|null)=>{setChoosingAgent(true);void run(async()=>{await selectAgent(peer);if(range){setValue(removeAgentMention(value,range));setCaret(range.start);}setMentionHidden(true);requestAnimationFrame(()=>{input.current?.focus();if(range)input.current?.setSelectionRange(range.start,range.start);});}).finally(()=>setChoosingAgent(false));};
 const [pluginChooser,setPluginChooser]=useState(false),[computerOpen,setComputerOpen]=useState(false);
 useEffect(()=>{setComputerOpen(false);},[scope]);
 const [readingContext,setReadingContext]=useState(false);
 const [goalMode,setGoalMode]=useState(false),[goalBusy,setGoalBusy]=useState(false),[goalError,setGoalError]=useState('');
 useEffect(()=>{setGoalMode(false);setGoalError('');},[scope]);
 const model=options.model??(options.provider&&options.provider!==agent?.provider?'':agent?.model??'');
 const selectedSources=options.sources??[];
 const selectedFiles=options.files.map(id=>files.find(f=>f.id===id)??{id,name:'Unavailable file reference',kind:'file' as const,path:''});
 const permissionLabel={chat:'Chat only',ask:'Default permissions',files:'Selected files access',full:'Full access'}[options.permission];
 const toggleFile=(id:string)=>change({files:options.files.includes(id)?options.files.filter(v=>v!==id):[...options.files,id]});
 const send=async(event?:React.FormEvent)=>{event?.preventDefault();if(readingContext)return;if(!goalMode)return submit();if(goalBusy||request||!value.trim())return;setGoalBusy(true);setGoalError('');try{await setGoal({objective:value.trim(),maxTurns:null,tokenBudget:null,start:true});setGoalMode(false);setValue('');}catch(error){setGoalError((error as Error).message);}finally{setGoalBusy(false);}};
 return <>
 {goal&&<div className="goal-strip"><Target size={14}/><span className="goal-status">{goal.status==='running'?'Pursuing goal':goal.status==='completed'?'Goal complete':goal.status==='paused'?'Goal paused':'Goal ready'}</span><button type="button" className="goal-summary" title={goal.objective} onClick={expandGoal}>{goal.objective}</button><button type="button" className="icon-button" aria-label="Delete goal" title="Delete goal" onClick={()=>manageGoal('delete')}><Trash2 size={14}/></button><button type="button" className="icon-button" aria-label="Edit goal" title="Edit goal" onClick={editGoal}><Pencil size={14}/></button>{goal.status==='running'?<button type="button" className="icon-button" aria-label="Pause goal" title="Pause goal" onClick={()=>manageGoal('pause')}><Pause size={14}/></button>:goal.status!=='completed'&&<button type="button" className="icon-button" aria-label="Resume goal" title="Resume goal" disabled={disabled||!!request} onClick={runGoal}><Play size={14}/></button>}<button type="button" className="icon-button" aria-label="Expand goal" title="Expand goal" onClick={expandGoal}><Maximize2 size={14}/></button></div>}
 {goalError&&<p className="composer-error" role="alert">{goalError}</p>}
 <form className={'composer enhanced-composer '+(options.mode==='plan'?'planning':'')} onSubmit={event=>void send(event)}>
 {options.skills?.length? <div className="composer-context"><span className="context-chip"><Lightbulb size={14}/>{options.skills.length} {options.skills.length===1?'skill':'skills'}<button type="button" aria-label="Remove skills" onClick={()=>change({skills:[]})}><X size={13}/></button></span></div>:null}
 {options.mode==='plan'&&<div className="composer-context"><span className="context-chip plan-chip"><Lightbulb size={14}/>Plan mode<button type="button" aria-label="Turn plan mode off" onClick={()=>change({mode:'chat'})}><X size={13}/></button></span></div>}
 {(project||selectedFiles.length>0||selectedSources.length>0)&&<div className="composer-context-tray">
 {project&&<div className="composer-project-chip" title={project.name+' · '+(project.memory_enabled?'Project memory':'Memory off')+(project.instructions?' · Instructions':'')+(project.file_ids.length?' · '+project.file_ids.length+' context sources':'')}><button type="button" className="project-context-chip" aria-label="Review project context" disabled={disabled} onClick={editProject}><Folder size={14}/><span>{compactLabel(project.name)}</span></button><button type="button" className="context-remove" aria-label="Remove project from chat" title="Remove chat from project" disabled={disabled||!!request} onClick={removeProject}><X size={13}/></button></div>}
 {selectedSources.length>0&&<SelectedSourceCards sources={selectedSources} disabled={disabled} remove={source=>change({sources:selectedSources.filter(row=>row.kind!==source.kind||row.id!==source.id)})}/>}
 {selectedFiles.length>0&&<AttachmentCards files={selectedFiles} disabled={disabled} remove={toggleFile}/>}
 </div>}
 <ComputerControls options={options} change={change} open={computerOpen} close={()=>setComputerOpen(false)} disabled={disabled}/>
 {attaching&&<div className="attachment-status" role="status">Adding attachments…</div>}
 {!!(selectedFiles.length+selectedSources.length)&&options.permission==='chat'&&<div className="attachment-status" role="status">Chat only blocks attachments. Change permissions or remove them before sending.</div>}

 <AgentTools agent={agent} options={options} change={change} open={pluginChooser} close={()=>setPluginChooser(false)} show={()=>setPluginChooser(true)} configure={configureAgent} disabled={disabled}/>

 <textarea ref={input} onPaste={paste} aria-autocomplete="list" aria-controls={mention?mentionList:undefined} aria-expanded={!!mention} aria-activedescendant={mention?mentionActive:undefined} onSelect={event=>setCaret(event.currentTarget.selectionStart)} aria-label="Message" placeholder={goalMode?'Describe your goal, define measurable outcomes for best results':options.mode==='plan'?'Describe what you want to plan…':agent?`Message ${agent.name}`:'Ask anything'} value={value} onChange={e=>{setValue(e.target.value);setCaret(e.target.selectionStart);setMentionHidden(false);}} disabled={disabled||choosingAgent||goalBusy} rows={1} onKeyDown={e=>{if(e.defaultPrevented||e.nativeEvent.isComposing)return;if(e.key==='Enter'&&!e.shiftKey&&(preferences.sendWith==='enter'||e.ctrlKey||e.metaKey)){e.preventDefault();void send();}}}/>
 {voice.phase!=='idle'&&!voice.open&&<div className="dictation-strip"><span className={voice.phase==='recording'?'recording-dot':''}/><span>{voice.phase==='recording'?'Listening…':voice.phase==='transcribing'?'Transcribing locally…':'Preparing Whisper…'}</span>{voice.phase==='recording'&&<button type="button" onClick={()=>void voice.stop()}><Check size={15}/>Use dictation</button>}<button type="button" aria-label="Cancel dictation" onClick={()=>voice.cancel()}><X size={16}/></button></div>}
 <div className="composer-toolbar">
 <ComposerAddMenu shareWindows={administrator?()=>setComputerOpen(true):undefined} mention={mention} dismissMention={()=>setMentionHidden(true)} menuId={mentionList} onActiveOption={setMentionActive} onBusy={setReadingContext} agent={agent} agents={agents} scope={scope} options={options} change={change} files={files} pick={pick} disabled={disabled} request={!!request} input={input} value={value} setValue={setValue} selectAgent={(peer,range)=>chooseAgent(peer,range??null)} goal={()=>{setGoalMode(true);change({mode:'chat'});requestAnimationFrame(()=>input.current?.focus());}}/>
 <Menu trigger={<button type="button" className={'permission-picker permission-'+options.permission} disabled={disabled} aria-label="Permissions" title="Workspace permissions"><Shield size={15}/><span>{permissionLabel}</span></button>}>{([['chat','Chat only','Text conversation without file sharing or tool calls.'],['ask','Default permissions','Use attached files; review file changes, computer inputs, browser actions, and plugin calls.'],['files','Selected files access','Read selected files; external tools are disabled.']] as const).map(([id,label,description])=><MenuItem key={id} onSelect={()=>change({permission:id})}><span><strong>{label}</strong><small>{description}</small></span>{options.permission===id&&<Check size={16}/>}</MenuItem>)}{administrator&&<><MenuSeparator/><MenuItem onSelect={()=>void run(async()=>{const permissions=await call<CommandPermissions>('permissions.full');if(permissions.full)change({permission:'full'});})}><Shield size={16}/><span><strong>Full access</strong><small>Run enabled tools, file changes, commands, and browser actions automatically.</small></span>{options.permission==='full'&&<Check size={16}/>}</MenuItem></>}</Menu>
 {goalMode&&<button type="button" className="composer-goal-mode" aria-label="Turn goal mode off" title="Turn goal mode off" onClick={()=>setGoalMode(false)}><Target size={14}/>Goal<X size={12}/></button>}
 <span className="composer-spacer"/>
 <ModelPicker agent={agent} options={options} change={change} connections={connections} configure={configure} disabled={disabled}/>
 <button type="button" className={'icon-button mic-button '+(voice.phase==='recording'?'active':'')} aria-label={voice.phase==='recording'?'Stop dictation':'Dictate message'} title="Dictate with local Whisper" disabled={disabled||!agent||['preparing','transcribing'].includes(voice.phase)} onClick={()=>voice.phase==='recording'?void voice.stop():void voice.start(false)}>{voice.phase==='recording'?<Square size={17}/>:<Mic size={18}/>}</button>
 {request&&(value.trim()||options.files.length||selectedSources.length)&&<><button type="submit" className="native-steer-button" aria-label="Queue message" title="Queue for after the current response" disabled={disabled||readingContext||(options.permission==='chat'&&!!(options.files.length+selectedSources.length))}><ArrowUp size={17}/>Queue</button>{value.trim()&&<button type="button" className="queue-steer" title="Guide the current turn immediately" disabled={disabled||readingContext} onClick={()=>void steer()}>Steer</button>}</>}{request?<button type="button" className="send-button" aria-label="Stop response" title="Stop response" onClick={cancel}><Square size={12} fill="currentColor" strokeWidth={0}/></button>:value.trim()||options.files.length||selectedSources.length?<button type="submit" className="send-button" aria-label="Send" title="Send message" disabled={disabled||readingContext||!agent||!model||(options.permission==='chat'&&!!(options.files.length+selectedSources.length))}><ArrowUp size={18}/></button>:<><button type="button" className="icon-button voice-mode-button" aria-label="Voice mode" title="Voice mode" disabled={disabled||!agent} onClick={()=>voice.setOpen(true)}><AudioLines size={18}/></button></>}
 </div></form>



 </>;
}
