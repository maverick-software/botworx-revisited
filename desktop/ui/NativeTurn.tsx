import {remarkWindowsFileLinks} from './remark-windows-file-links';
import {AgentReportStatus} from './AgentReportStatus';
import {QuestionCard,QuestionDock} from './QuestionCard';
import {ChatLink} from './ChatLink';
import {GeneratedImages} from './GeneratedImages';
import {ChatOrigin} from './ChatOrigin';
import {ChangedFilesCard,TurnSummary,CurrentTurnActivity} from './TurnActivity';
import React,{useContext,useState} from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {Bot,ChevronRight,TerminalSquare,FileDiff,Workflow,BookOpen} from 'lucide-react';
import type {Message} from '../src/contracts';
import type {NativeApproval,NativeItem,NativeChild} from '../src/native-contracts';
import {WorkspaceLinks} from './WorkspaceLinks';
import {call} from './ui';
import {ToolTimeline,McpContent} from './ToolActivity';
import {ChildChats} from './ChildChats';
import {childTranscriptItems,childInterruptionNotice,childGuidance} from './native-child-items';
import {NativeGoal} from './NativeGoal';
import {NativeContextUsage} from './NativeContextUsage';
import {NativeBackgroundCommands} from './NativeBackgroundCommands';
import type {ToolActivity} from '../src/tool-contracts';
import {nativeActivityReceipt,nativeActivityStatus} from './native-activity-status';

const itemKey=(entry:NativeItem)=>JSON.stringify([entry.threadId,entry.turnId,entry.item.id]);
export function NativeQuestion({entry,requestId,execute}:{entry:NativeItem;requestId:string;execute?:(action:string,args:Record<string,unknown>)=>Promise<unknown>}){
 if(entry.item.type!=='agentMessage'||!entry.item.questions?.length)return null;
 return <QuestionCard questions={entry.item.questions} response={entry.questionAnswer} submit={answers=>(execute??call)('native.question.answer',{requestId,threadId:entry.threadId,turnId:entry.turnId,itemId:entry.item.id,answers})}/>;
}

export function NativeApprovalCard({approval,requestId,change,submit}:{approval:NativeApproval;requestId:string;change?:NativeItem;submit?:(value:unknown)=>Promise<unknown>}){
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 const fileChanges=change?.item.type==='fileChange'?change.item.changes:[];
 async function answer(value:unknown){setBusy(true);setError('');try{if(submit)await submit(value);else await call('native.answer',{requestId,id:approval.id,value});}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 if(approval.kind==='input')return <QuestionCard key={approval.id} questions={(approval.questions??[]).map(q=>({title:q.question,options:q.options,secret:q.isSecret}))} submit={async values=>{const value={answers:Object.fromEntries((approval.questions??[]).flatMap((q,i)=>values[i]===null?[]:[[q.id,values[i]]]))};if(submit)return submit(value);return call('native.answer',{requestId,id:approval.id,value});}} skip={async()=>{if(submit)return submit({skip:true});return call('native.answer',{requestId,id:approval.id,value:{skip:true}});}}/>;
 return <section className="native-approval" aria-label="Native approval"><strong>{approval.kind==='file'?'Review native file change':'Allow this command?'}</strong>{approval.reason&&<p>{approval.reason}</p>}{approval.command&&<pre>{approval.command}</pre>}{approval.cwd&&<small>{approval.cwd}</small>}{approval.kind==='file'&&(fileChanges.length?fileChanges.map((file,n)=><div key={n}><strong>{file.path}</strong><small>{file.kind.type==='add'?'Create file':file.kind.type==='delete'?'Delete file':file.kind.move_path?'Move to '+file.kind.move_path:'Update file'}</small><pre>{file.diff}</pre></div>):<p>Waiting for Codex to provide the proposed diff.</p>)}
  <div className="native-approval-actions"><button disabled={busy||approval.kind==='file'&&!fileChanges.length} onClick={()=>void answer({decision:'accept'})}>Allow once</button><button className="secondary" disabled={busy} onClick={()=>void answer({decision:'decline'})}>Decline</button></div>{error&&<p role="alert">{error}</p>}</section>;
}

const Approval=NativeApprovalCard;
export function Activity({entry,inactive=false,receipt}:{entry:NativeItem;inactive?:boolean;receipt?:ToolActivity}){const i=entry.item,label=(_status:string)=>nativeActivityStatus(entry,inactive,receipt);
 if(i.type==='commandExecution')return <details className="native-item"><summary><TerminalSquare size={14}/><span className="native-command-label">{i.command}</span><small>{label(i.status)}{i.exitCode!==null?' · exit '+i.exitCode:''}</small></summary>{i.aggregatedOutput&&<pre>{i.aggregatedOutput}</pre>}<small>{i.cwd}</small>{entry.backgroundNote&&<p className="turn-work-note">{entry.backgroundNote}</p>}</details>;
 if(i.type==='fileChange')return <details className="native-item"><summary><FileDiff size={14}/>File changes · {label(i.status)}</summary>{i.changes.map((change,index)=><div key={index}><strong>{change.path}</strong><pre>{change.diff}</pre></div>)}</details>;
 if(i.type==='collabAgentToolCall')return <details className="native-item native-subagent"><summary><Workflow size={14}/>{i.tool==='spawnAgent'?'Started subagent':i.tool==='wait'?'Waited for subagents':i.tool}<small>{label(i.status)}</small></summary>{i.prompt&&<p>{i.prompt}</p>}{Object.entries(i.agentsStates).map(([id,state])=><div key={id}><small>{id} · {state?.status}</small>{state?.message&&<p>{state.message}</p>}</div>)}</details>;
 if(i.type==='dynamicToolCall')return <details className="native-item"><summary><BookOpen size={14}/>{i.tool}<small>{label(i.status)}</small></summary><pre>{JSON.stringify(i.arguments,null,2)}</pre></details>;
 if(i.type==='mcpToolCall')return <details className="native-item"><summary><BookOpen size={14}/>{i.server} · {i.tool}<small>{label(i.status)}</small></summary>{Array.isArray((i.result as any)?.content)?<McpContent result={i.result}/>:i.result!=null||i.error!=null?<pre>{JSON.stringify(i.result??i.error,null,2)}</pre>:null}{!entry.completed&&!i.result&&receipt?.error&&<p role="status" className="turn-work-note">{receipt.error}</p>}</details>;
 if(i.type==='plan')return <details className="native-item"><summary>Plan</summary><pre>{i.text}</pre></details>;
 if(i.type==='contextCompaction')return <p className="turn-work-note">Codex compacted the conversation context.</p>;
 return null;
}

/** Host cards are the primary tool activity. Keep the native transport records
 * together for inspection, including older calls without a durable receipt ID. */
function NativeActivityList({entries,items=entries,tools,requestId,active,turnId,pendingOutside=false,execute}:{entries:NativeItem[];items?:NativeItem[];tools:ToolActivity[];requestId:string;active:boolean;turnId?:string;pendingOutside?:boolean;execute?:(action:string,args:Record<string,unknown>)=>Promise<unknown>}){
 const host=tools.length?entries.filter(e=>e.item.type==='mcpToolCall'&&e.item.server==='sylvana_host'):[],hostSet=new Set(host);
 const render=(entry:NativeItem)=><Activity key={itemKey(entry)} entry={entry} inactive={!active||!!turnId&&entry.turnId!==turnId} receipt={nativeActivityReceipt(entry,items,tools,requestId)}/>;
 return <>{entries.filter(e=>!hostSet.has(e)).map(render)}<ToolTimeline activities={pendingOutside?tools.filter(t=>t.status!=='awaiting_approval'):tools} active={active} execute={execute}/>{!!host.length&&<details className="native-host-details native-item"><summary><BookOpen size={14}/><span>Codex tool details</span><small>{host.length} {host.length===1?'call':'calls'}</small></summary>{host.map(render)}</details>}</>;
}

export function NativeChildCard({child,requestId,chat=false,expandedActivity=false,compose,execute,controls=true}:{child:NativeChild;requestId:string;chat?:boolean;expandedActivity?:boolean;controls?:boolean;execute?:(action:string,args:Record<string,unknown>)=>Promise<unknown>;compose?:{text:string;setText:(text:string)=>void;sent:(text:string)=>Promise<void>}}){
 const [localText,setLocalText]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),workspace=useContext(WorkspaceLinks),text=compose?.text??localText,setText=compose?.setText??setLocalText;
 const markdown=(text:string)=><ReactMarkdown remarkPlugins={[remarkGfm,remarkWindowsFileLinks]} urlTransform={v=>v} components={{a:ChatLink}}>{text}</ReactMarkdown>;
 async function control(action:string){setBusy(true);setError('');try{await (execute??call)('native.child.control',{requestId,threadId:child.threadId,turnId:child.turnId,action,text,id:crypto.randomUUID()});if(action==='send'){if(compose)await compose.sent(text);else setText('');}}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 const running=child.status==='running',interruption=childInterruptionNotice(child),transcript=childTranscriptItems(child),guidance=childGuidance(child,transcript);
 return <section className={'native-child-card '+(chat?'child-chat-card':'')} data-child-thread={child.threadId} aria-label={'Subagent '+child.name}>
  <header><Workflow size={16}/><strong>{child.name}</strong><span className={'child-status '+child.status}>{child.status}</span>{controls&&running&&<button className="secondary" disabled={busy||!child.turnId} onClick={()=>void control('cancel')}>Stop subagent</button>}</header>
  <details className="native-child-assignment"><summary>{child.prompt?'Assigned work':'Details'}</summary>{child.prompt&&<p>{child.prompt}</p>}<small>Child {child.threadId} · Parent {child.parentThreadId}</small></details>
  {interruption&&<p role="status" className="turn-work-note native-child-interruption">{interruption}</p>}
  {child.error&&child.status!=='interrupted'&&<p className="danger">{child.error}</p>}
  <NativeGoal state={child.state} requestId={requestId} active={running} controls={false}/>
  <NativeContextUsage state={child.state}/>
  {controls&&<NativeBackgroundCommands state={child.state} requestId={requestId} active={running} execute={execute}/>}
  <details className="native-child-transcript" open={chat||expandedActivity||child.state.tools?.some(t=>t.status==='awaiting_approval')?true:undefined}><summary>{running?'Live activity':'Transcript'} &amp; tools</summary>{transcript.map(e=>e.item.type==='agentMessage'?<div className="child-transcript-message" key={itemKey(e)}>{e.item.questions?.length?<NativeQuestion entry={e} requestId={requestId} execute={execute}/>:markdown(e.item.text)}</div>:e.item.type==='userMessage'?<div className="native-steering" key={itemKey(e)}>{guidance.byItem.get(e)?.source?<ChatOrigin source={guidance.byItem.get(e)!.source!}/>:<strong>{guidance.byItem.has(e)?'Your guidance':'Instructions'}</strong>}{markdown(e.item.content.filter(c=>c.type==='text').map(c=>c.type==='text'?c.text:'').join('\n'))}</div>:null)}<NativeActivityList entries={transcript.filter(e=>!['agentMessage','userMessage'].includes(e.item.type))} items={child.state.items} tools={child.state.tools??[]} requestId={requestId} active={running} turnId={child.turnId} execute={execute}/>{!transcript.length&&<p>Waiting for native activity.</p>}</details>
  {child.result&&<div className="native-child-result"><strong>{child.status==='completed'?'Result':child.status==='running'?'Previous result':'Saved partial result'}</strong>{markdown(child.result)}</div>}
  {controls&&child.state.approvals.filter(a=>a.status==='pending').map(a=><Approval key={a.id} approval={a} requestId={requestId} change={child.state.items.find(i=>i.threadId===a.threadId&&i.turnId===a.turnId&&i.item.id===a.itemId)} submit={execute?value=>execute('native.answer',{requestId,id:a.id,value}):undefined}/>)}
  {chat&&<ChangedFilesCard native={child.state} requestId={requestId} activities={child.state.tools??[]} active={running}/>}
  <GeneratedImages activities={child.state.tools??[]} threadId={child.threadId}/>
  {child.status!=='interrupted'&&<p className="turn-work-note">{child.delivery==='delivered'?'Result reported to the main agent.':child.delivery==='running'?'Main agent is processing this report…':child.delivery==='failed'?'Report delivery needs attention.':running?'Working independently in the background.':'Report queued for the main agent.'}</p>}
  {controls&&child.delivery==='failed'&&child.status!=='interrupted'&&<button className="secondary" disabled={busy} onClick={()=>void control('retry-report')}>Retry report to main agent</button>}
  {guidance.unmatched.map(s=><p className="native-steering" key={s.id}><>{s.source?<ChatOrigin source={s.source}/>:<strong>Your guidance</strong>} {s.text}</></p>)}
  {controls&&<QuestionDock/>}
  {controls&&<form className="native-child-compose" onSubmit={e=>{e.preventDefault();void control('send');}}><label className="sr-only" htmlFor={'child-'+child.threadId}>{running?'Steer subagent':'Follow up with subagent'}</label><textarea disabled={busy} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.nativeEvent.isComposing){e.preventDefault();if(text.trim()&&!busy&&(!running||child.turnId))e.currentTarget.form?.requestSubmit();}}} id={'child-'+child.threadId} aria-label={running?'Steer subagent':'Follow up with subagent'} placeholder={running?'Guide this subagent while it works…':'Send a follow-up or resume this subagent…'} value={text} maxLength={100000} onChange={e=>setText(e.target.value)} rows={2}/><button disabled={busy||!text.trim()||running&&!child.turnId}>{running?'Steer subagent':'Send follow-up'}</button></form>}
  {error&&<p role="alert" className="danger">{error}</p>}
 </section>;
}

export function NativeTurn({message}:{message:Message}){
 const state=message.metadata.native!,workspace=useContext(WorkspaceLinks),childChats=useContext(ChildChats),[reportError,setReportError]=useState(''),active=message.metadata.status==='running';
 const pending=state.approvals.filter(a=>a.status==='pending'&&(active||a.threadId!==state.threadId)&&!(state.children??[]).some(c=>c.threadId===a.threadId));
 const text=state.items.filter(e=>e.threadId===state.threadId&&e.item.type==='agentMessage'),actions=state.items.filter(e=>!['agentMessage','userMessage','reasoning','functionCallOutput','hookPrompt'].includes(e.item.type)),children=[...new Set(state.items.filter(e=>e.threadId!==state.threadId).map(e=>e.threadId))];
 return <div className="native-turn" data-native-thread={state.threadId}>
  {!state.composerGoalId&&<NativeGoal state={state} requestId={message.metadata.timing?.requestId??''} active={active}/>}
  <NativeContextUsage state={state}/>
  
  <TurnSummary status={message.metadata.status} timing={message.metadata.timing}>
  <div className="turn-work-history" aria-label="Native Codex activity">{(state.importedHistory||state.branch)&&<p className="turn-work-note">Earlier messages were imported as context into this native Codex branch.</p>}{!active&&state.steering.map(s=><div className="native-steering" key={s.id}><>{s.source?<ChatOrigin source={s.source}/>:<strong>You steered this turn</strong>}<p>{s.text}</p></></div>)}<div className="native-runtime-label"><Bot size={13}/>Codex {state.version}{children.length?' · '+children.length+' '+(children.length===1?'subagent':'subagents'):''}</div>{message.metadata.options&&<div className="native-runtime-label">{message.metadata.options.model} · {message.metadata.options.thinking??'default'} thinking{message.metadata.options.mode==='plan'?' · Plan mode':''}</div>}{!active&&text.filter(e=>e.item.type==='agentMessage'&&e.item.phase==='commentary').map(e=>e.item.type==='agentMessage'&&<div key={itemKey(e)} className="native-message-phase commentary"><ReactMarkdown remarkPlugins={[remarkGfm,remarkWindowsFileLinks]} urlTransform={v=>v} components={{a:ChatLink}}>{e.item.text}</ReactMarkdown></div>)}<NativeActivityList entries={actions} items={state.items} tools={message.metadata.tools??[]} requestId={message.metadata.timing?.requestId??''} active={active} turnId={state.turnId} pendingOutside/>{!state.children?.length&&children.map(id=><details className="native-item native-child" key={id}><summary><Workflow size={14}/>Subagent <small>{id}</small></summary>{state.items.filter(e=>e.threadId===id).map(e=>e.item.type==='agentMessage'?<p key={itemKey(e)}>{e.item.text}</p>:<Activity key={itemKey(e)} entry={e} inactive={!active} receipt={nativeActivityReceipt(e,state.items,message.metadata.tools??[],message.metadata.timing?.requestId??'')}/>)}</details>)}{!actions.length&&!message.metadata.tools?.length&&<p className="turn-work-note">No tool activity recorded yet.</p>}</div></TurnSummary>
  {pending.map(approval=><Approval key={approval.id} approval={approval} requestId={message.metadata.timing?.requestId??''} change={state.items.find(e=>e.threadId===approval.threadId&&e.turnId===approval.turnId&&e.item.id===approval.itemId)}/>)}
  {(message.metadata.tools??[]).some(t=>t.status==='awaiting_approval')&&<ToolTimeline activities={(message.metadata.tools??[]).filter(t=>t.status==='awaiting_approval')} active={true}/>}
  {active&&state.steering.map(s=><div className="native-steering" key={s.id}><>{s.source?<ChatOrigin source={s.source}/>:<strong>You steered this turn</strong>}<p>{s.text}</p></></div>)}
  {text.filter(e=>active||e.item.type!=='agentMessage'||e.item.phase!=='commentary').map(e=>e.item.type==='agentMessage'&&<div className={'native-message-phase '+(e.item.phase??'')} key={itemKey(e)}><>{e.item.questions?.length?<NativeQuestion entry={e} requestId={message.metadata.timing?.requestId??''}/>:<ReactMarkdown remarkPlugins={[remarkGfm,remarkWindowsFileLinks]} urlTransform={v=>v} components={{a:ChatLink}}>{e.item.text}</ReactMarkdown>}</></div>)}

  <CurrentTurnActivity active={active} native={state} tools={message.metadata.tools} requestId={message.metadata.timing?.requestId}/>
  <NativeBackgroundCommands state={state} requestId={message.metadata.timing?.requestId??''} active={active}/>
  {!!state.children?.length&&<div className="native-children" aria-label="Background subagents">{state.children.map(c=>{return <div className="inline-child" data-inline-child={c.threadId} key={c.threadId}><details className="inline-child-disclosure" open={c.state.approvals.some(a=>a.status==='pending')||c.state.tools?.some(t=>t.status==='awaiting_approval')?true:undefined}><summary><ChevronRight size={14} className="inline-disclosure-chevron"/><Workflow size={15}/><strong>{c.name}</strong><span className={'child-status '+c.status}>{c.status}</span>{(c.state.approvals.some(a=>a.status==='pending')||c.state.tools?.some(t=>t.status==='awaiting_approval'))&&<small>Needs input</small>}</summary><NativeChildCard child={c} expandedActivity requestId={message.metadata.timing?.requestId??''}/></details><button className="subtle-link open-child-chat" title="Open subagent chat" aria-label={'Open chat with '+c.name} onClick={()=>childChats.open({requestId:message.metadata.timing?.requestId??'',conversationId:'',provider:'',model:'',child:c})}>Open chat<ChevronRight size={13}/></button></div>;})}</div>}
  {message.metadata.timing?.requestId&&(message.metadata.tools??[]).some(tool=>/(?:^|\.)invoke_agent$/.test(tool.name))&&<AgentReportStatus requestId={message.metadata.timing.requestId} active={active} revision={(message.metadata.tools??[]).filter(tool=>/(?:^|\.)invoke_agent$/.test(tool.name)).map(tool=>tool.id+':'+tool.status).join(',')} reports={state.reports??[]}/>}
  {state.reports?.map(report=><section className="native-report-response" aria-label="Automatic agent response" key={report.id}>
   <details id={'native-report-'+report.id} className="native-parent-report" aria-label="Main agent report" open={report.status==='running'||!!report.error||report.state.approvals.some(a=>a.status==='pending')||report.state.tools?.some(t=>t.status==='awaiting_approval')?true:undefined}>
    <summary><Bot size={15}/><strong>{report.assignments?.length?'Workspace agent report':'Subagent report'}</strong><small>{report.status}</small></summary>
    <div className="parent-report-body">
     {report.status==='running'&&<button className="secondary" disabled={!report.state.turnId} onClick={()=>void call('native.report.cancel',{requestId:message.metadata.timing?.requestId,id:report.id}).catch(e=>setReportError(e.message))}>Stop report</button>}
     {report.assignments?.map(source=><p className="turn-work-note" key={source.invocationId}><ChatLink href={source.citation}>{source.name+(source.messageId?' result':' assignment')}</ChatLink> · {source.status}</p>)}
     {report.state.approvals.filter(a=>a.status==='pending').map(a=><Approval key={a.id} approval={a} requestId={message.metadata.timing?.requestId??''} change={report.state.items.find(i=>i.threadId===a.threadId&&i.turnId===a.turnId&&i.item.id===a.itemId)}/>)}
     <NativeBackgroundCommands state={report.state} requestId={message.metadata.timing?.requestId??''} active={report.status==='running'}/>
     <details open={report.state.tools?.some(t=>t.status==='awaiting_approval')?true:undefined}><summary>Report activity</summary>
      {report.status!=='running'&&report.state.items.filter(e=>e.item.type==='agentMessage'&&e.item.phase==='commentary').map(e=>e.item.type==='agentMessage'&&<div className="native-message-phase commentary" key={itemKey(e)}><>{e.item.questions?.length?<NativeQuestion entry={e} requestId={message.metadata.timing?.requestId??''}/>:<ReactMarkdown remarkPlugins={[remarkGfm,remarkWindowsFileLinks]} urlTransform={v=>v} components={{a:ChatLink}}>{e.item.text}</ReactMarkdown>}</></div>)}
      <NativeActivityList entries={report.state.items} tools={report.state.tools??[]} requestId={message.metadata.timing?.requestId??''} active={report.status==='running'} turnId={report.state.turnId}/>
     </details>
     {report.error&&<p className="danger">{report.error}</p>}
    </div>
   </details>
   {report.state.items.filter(e=>e.threadId===report.state.threadId&&e.item.type==='agentMessage'&&(report.status==='running'||e.item.phase!=='commentary')).map(e=>e.item.type==='agentMessage'&&<div className={'native-message-phase '+(e.item.phase??'')} key={itemKey(e)}><>{e.item.questions?.length?<NativeQuestion entry={e} requestId={message.metadata.timing?.requestId??''}/>:<ReactMarkdown remarkPlugins={[remarkGfm,remarkWindowsFileLinks]} urlTransform={v=>v} components={{a:ChatLink}}>{e.item.text}</ReactMarkdown>}</></div>)}
  </section>)}{reportError&&<p role="alert" className="danger">{reportError}</p>}
 </div>;
}
