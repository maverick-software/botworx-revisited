from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
def edit(name,old,new):
    file=ROOT/name;text=file.read_text(encoding='utf-8');assert text.count(old)==1,(name,old[:100],text.count(old));file.write_text(text.replace(old,new),encoding='utf-8',newline='\n')
edit('desktop/ui/Composer.tsx',"import {AttachmentCards}","import {SelectedSourceCards} from './SelectedSources';\nimport {AttachmentCards}")
edit('desktop/ui/Composer.tsx',"const selectedFiles=options.files.map", "const selectedSources=options.sources??[];\n const selectedFiles=options.files.map")
edit('desktop/ui/Composer.tsx',"(project||selectedFiles.length>0)","(project||selectedFiles.length>0||selectedSources.length>0)")
edit('desktop/ui/Composer.tsx',"{selectedFiles.length>0&&<AttachmentCards", "{selectedSources.length>0&&<SelectedSourceCards sources={selectedSources} disabled={disabled} remove={source=>change({sources:selectedSources.filter(row=>row.kind!==source.kind||row.id!==source.id)})}/>}\n {selectedFiles.length>0&&<AttachmentCards")
edit('desktop/ui/Composer.tsx',"{!!selectedFiles.length&&options.permission==='chat'", "{!!(selectedFiles.length+selectedSources.length)&&options.permission==='chat'")
edit('desktop/ui/Composer.tsx',"value.trim()||options.files.length?", "value.trim()||options.files.length||selectedSources.length?")
edit('desktop/ui/Composer.tsx',"options.permission==='chat'&&!!options.files.length", "options.permission==='chat'&&!!(options.files.length+selectedSources.length)")
edit('desktop/ui/ComposerContextMenu.tsx',"'Insert recent message excerpt'", "'Attach saved text snapshot'")
edit('desktop/ui/ComposerContextMenu.tsx',"()=>void attachChat(chat))", "()=>void attachChat(chat),options.sources?.some(source=>source.kind==='chat'&&source.id===chat.conversation_id)))")
edit('desktop/ui/ComposerContextMenu.tsx',"()=>void attachTab(tab),undefined,", "()=>void attachTab(tab),options.sources?.some(source=>source.kind==='browser'&&source.id===tab.id),")
edit('desktop/ui/Attachments.tsx',"import {FileText,Folder,Paperclip,X,Image as ImageIcon}","import {FileText,Folder,Paperclip,X,Globe,MessageSquare,Image as ImageIcon}")
edit('desktop/ui/Attachments.tsx',"export function MessageAttachments({files}:{files:FileContext[]}){\n", "export function MessageAttachments({files}:{files:FileContext[]}){\n const workspace=useContext(WorkspaceLinks);\n")
edit('desktop/ui/Attachments.tsx',"<summary title={file.name}><Paperclip size={14}/>", "<summary title={file.name}>{file.source?.kind==='browser'?<Globe size={14}/>:file.source?.kind==='chat'?<MessageSquare size={14}/>:<Paperclip size={14}/>}" )
edit('desktop/ui/Attachments.tsx',"{file.notice&&<small>{file.notice}</small>}","{file.source&&<><small>Captured {new Date(file.source.capturedAt).toLocaleString()}</small><button type=\"button\" onClick={()=>file.source!.kind==='chat'?workspace.openChat(file.source!.id):workspace.browser(file.source!.url)}>Open source</button></>}{file.notice&&<small>{file.notice}</small>}")
print('Selected-source composer and saved-message UI applied.')
