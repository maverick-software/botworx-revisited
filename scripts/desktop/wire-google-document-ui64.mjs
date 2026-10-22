import {readFile,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const edits=[
 ['desktop/ui/ChatLink.tsx','</span>;','{google&&href&&workspace.owner&&<GoogleDocumentDialog owner={workspace.owner} conversation={workspace.conversation??undefined} href={href} open={workspace.browser} configure={workspace.plugins} close={()=>setGoogle(false)}/>}</span>;'],
 ['desktop/ui/WorkspaceLinks.tsx','connections?:()=>void;','connections?:()=>void;plugins?:()=>void;'],
 ['desktop/ui/DesktopApp.tsx',"connections:()=>setSettings('connections'),conversation,","connections:()=>setSettings('connections'),plugins:()=>{setPluginSelection('@composio');openView('plugins');},conversation,"],
 ['desktop/ui/WorkspacePane.tsx',"import {DocumentView} from './DocumentPreview';","import {DocumentView} from './DocumentPreview';\nimport {GoogleDocumentDialog} from './GoogleDocumentDialog';"],
 ['desktop/ui/WorkspacePane.tsx',' const [state,setState]=useState<PaneState>(initial)'," const [google,setGoogle]=useState<{owner:string;scope:string;href:string}|null>(null);\n const [state,setState]=useState<PaneState>(initial)"],
 ['desktop/ui/WorkspacePane.tsx',"const result=await call<{url?:string;notice?:string}>('workspace.fileAction',{owner,conversationId:scope,href,action});","if(action==='google'){setGoogle({owner,scope,href});return;}const result=await call<{url?:string;notice?:string}>('workspace.fileAction',{owner,conversationId:scope,href,action});"],
 ['desktop/ui/WorkspacePane.tsx',"actions={{download:()=>void documentAction('download'),","actions={{google:/\\.(docx|xlsx|pptx)$/i.test(active.name)?()=>void documentAction('google'):undefined,download:()=>void documentAction('download'),"],
 ['desktop/ui/WorkspacePane.tsx','}{newFolder&&<Modal','}{google&&google.owner===owner&&google.scope===scope&&<GoogleDocumentDialog key={owner+scope} owner={owner} conversation={scope} href={google.href} open={browser} configure={workspaceLinks.plugins} close={()=>setGoogle(null)}/ >}{newFolder&&<Modal'],
 ['desktop/ui/VisualDocument.tsx','export type DocumentActions={download?', 'export type DocumentActions={google?:()=>void;download?'],
 ['desktop/ui/VisualDocument.tsx','<MenuItem disabled={!actions.download}', '<>{actions.google&&<MenuItem onSelect={actions.google}><ExternalLink size={15}/>Open in Google {visual.extension===\'.docx\'?\'Docs\':\'Slides\'}…</MenuItem>}</><MenuItem disabled={!actions.download}'],
 ['desktop/ui/SpreadsheetDocument.tsx','<MenuItem disabled={!actions.download}', '<>{actions.google&&<MenuItem onSelect={actions.google}><ExternalLink size={15}/>Open in Google Sheets…</MenuItem>}</><MenuItem disabled={!actions.download}'],
];
for(const [file,before,after]of edits){const source=await readFile(file,'utf8');assert.equal(source.split(before).length,2,'Unique UI anchor in '+file);await writeFile(file,source.replace(before,after));}
