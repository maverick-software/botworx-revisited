import {dialog} from 'electron';
import {randomUUID} from 'node:crypto';
import path from 'node:path';
import {lstat,realpath,readdir,readFile,open} from 'node:fs/promises';
import type {Secrets} from './secrets';
import type {FileReference,FileSelection,FileContext,ChatOptions} from './contracts';
import type {AttachmentInput} from './contracts';
import {AttachmentImages,imageMime,maxImageBytes} from './attachment-images';
import {maxImageBatchBytes} from './image-limits';
import {readImageFile} from './image-file';
import {DocumentReader} from './documents';
import {PdfPages} from './pdf-pages';
import type {PdfPageRenderer,PdfPageImage} from './pdf-page-contracts';
import {documentTypes,maxDocumentBytes} from './document-contracts';
import {privateRuntimePath} from './runtime-binding';
import {privateProfilePath} from './desktop-profile';
import {storageUuid} from './storage-files';
export const textTypes=new Set(['.txt','.md','.markdown','.csv','.json','.jsonl','.xml','.html','.css','.js','.jsx','.ts','.tsx','.py','.sql','.yml','.yaml','.toml','.rs','.go','.java','.c','.cpp','.h','.sh','.ps1','.log']);
const ignored=new Set(['.agentopia-recovery','.git','.ssh','.aws','.azure','.supabase','node_modules','.env','.venv','venv','credentials.bin','id_rsa','id_ed25519']);
const sameRecoveryPath=(a:string,b:string)=>process.platform==='win32'?a.toLowerCase()===b.toLowerCase():a===b;
export function safeName(name:string){return !name.startsWith('.')&&!/[. ]$/.test(name)&&!/^(con|prn|aux|nul|com[0-9]|lpt[0-9])(?:\.|$)/i.test(name)&&!ignored.has(name.toLowerCase())&&!['appdata','windows','programdata','backups','__pycache__','auth.json','credentials.json','token.json','tokens.json','secrets.json'].includes(name.toLowerCase())&&!/\.(pem|key|pfx|p12)$/i.test(name);}
export class WorkspaceFiles {
 readonly documents:DocumentReader;
 private operations=new Map<string,Promise<unknown>>();
 constructor(private secrets:Secrets,private dialogs=dialog,private protectedPaths:string[]=[],private images?:AttachmentImages,pdf:PdfPageRenderer=new PdfPages()){this.documents=new DocumentReader({pdf});}
 private exclusive<T>(user:string,task:()=>Promise<T>){const work=(this.operations.get(user)??Promise.resolve()).catch(()=>{}).then(task);this.operations.set(user,work);void work.finally(()=>{if(this.operations.get(user)===work)this.operations.delete(user);}).catch(()=>{});return work;}
 checkPath(file:string){
  const resolved=path.resolve(file).replace(/^\\\\\?\\UNC\\/i,'\\\\').replace(/^\\\\\?\\(?=[a-z]:\\)/i,''),parts=resolved.split(/[\\/]/).map(part=>part.toLowerCase());
  if(privateRuntimePath(resolved)||parts.some(part=>ignored.has(part)))throw new Error('Credential, backend, and dependency paths cannot be attached.');
  if(privateProfilePath(resolved)||this.protectedPaths.some(folder=>{const relative=path.relative(path.resolve(folder),resolved);return relative===''||relative!=='..'&&!relative.startsWith('..'+path.sep)&&!path.isAbsolute(relative);}))throw new Error('Agentopia application and credential storage cannot be attached.');
 }
 checkBackupPath(file:string){const resolved=path.resolve(file).replace(/^\\\\\?\\UNC\\/i,'\\\\').replace(/^\\\\\?\\(?=[a-z]:\\)/i,'');if(privateRuntimePath(resolved)||privateProfilePath(resolved)||this.protectedPaths.some(folder=>{const relative=path.relative(path.resolve(folder),resolved);return relative===''||relative!=='..'&&!relative.startsWith('..'+path.sep)&&!path.isAbsolute(relative);}))throw Error('Application and database storage cannot be captured as an external attachment.');}
 list(user:string):FileReference[]{return this.secrets.get<FileReference[]>('files:'+user)??[];}
 async pick(user:string,kind:'file'|'folder',guard:()=>Promise<void>=async()=>{}):Promise<FileSelection>{
  const result=await this.dialogs.showOpenDialog({title:kind==='folder'?'Add a folder to Agentopia':'Add files to Agentopia',properties:kind==='folder'?['openDirectory']:['openFile','multiSelections']});
  if(result.canceled)return {references:this.list(user),selected:[]};
  return this.attach(user,result.filePaths.map(file=>({path:file})),guard);
 }
 async add(user:string,paths:string[]){return (await this.attach(user,paths.map(file=>({path:file})))).references;}
 async attach(user:string,items:AttachmentInput[],guard:()=>Promise<void>=async()=>{}):Promise<FileSelection>{return this.exclusive(user,async()=>{
  if(!Array.isArray(items)||!items.length||items.length>20)throw new Error('Attach up to 20 files or folders at a time.');
  const rows=[...this.list(user)],selected:string[]=[],prepared:{id:string;bytes:Buffer}[]=[];
  for(const item of items){
   if(!item||typeof item!=='object')throw new Error('Invalid attachment.');
   if('path' in item){
    if(typeof item.path!=='string'||!path.isAbsolute(item.path)||item.path.length>4000)throw new Error('Choose a local file or folder.');
    this.checkPath(item.path);const canonical=await realpath(item.path);this.checkPath(canonical);const stat=await lstat(canonical);
    if(!stat.isFile()&&!stat.isDirectory())throw new Error('Choose a regular file or folder.');if(!safeName(path.basename(canonical)))throw new Error('Credential files cannot be attached.');
    const existing=rows.find(r=>r.source!=='clipboard'&&r.path.toLowerCase()===canonical.toLowerCase());
    if(existing){selected.push(existing.id);continue;}
    if(stat.isFile()&&!textTypes.has(path.extname(canonical).toLowerCase())&&!documentTypes.has(path.extname(canonical).toLowerCase())&&!['.png','.jpg','.jpeg','.webp'].includes(path.extname(canonical).toLowerCase()))throw new Error('Attach text/code files, PDF, DOCX, XLSX, PPTX, PNG, JPEG, or WebP images.');
    const extension=path.extname(canonical).toLowerCase(),limit=documentTypes.has(extension)?maxDocumentBytes:textTypes.has(extension)?2*1024*1024:maxImageBytes;
    if(stat.isFile()&&stat.size>limit)throw new Error('PDF, Office files and images must be 20 MB or smaller; text files must be 2 MB or smaller.');
    const reference:FileReference={id:randomUUID(),path:canonical,name:path.basename(canonical),kind:stat.isDirectory()?'folder':'file'};rows.push(reference);selected.push(reference.id);
   }else{
    if(!this.images)throw new Error('Local image storage is unavailable.');if(prepared.length>=4)throw new Error('Paste up to four images at a time.');
    const bytes=this.images.prepare(item.image),id=randomUUID();prepared.push({id,bytes});
    if(prepared.reduce((total,image)=>total+image.bytes.length,0)>maxImageBatchBytes)throw new Error('Pasted images exceed 40 MB in one batch.');
    const raw=typeof item.name==='string'?path.basename(item.name):'';
    const mime=imageMime(bytes),extension=mime==='image/jpeg'?'.jpg':mime==='image/webp'?'.webp':'.png';
    const name=raw&&raw!=='image.png'&&safeName(raw)&&raw.length<120?raw.replace(/\.[^.]+$/, '')+extension:'Pasted image '+new Date().toISOString().replace(/[:.]/g,'-')+extension;
    rows.push({id,name,path:'Clipboard image stored locally',kind:'file',source:'clipboard',bytes:bytes.length});selected.push(id);
   }
  }
  if(rows.length>100)throw new Error('Remove an existing file reference before adding more than 100.');
  if(rows.reduce((total,row)=>total+(row.source==='clipboard'?row.bytes??0:0),0)>40*1024*1024)throw new Error('Stored clipboard images exceed 40 MB. Forget an older image before pasting another.');
  const written:string[]=[];
  try{await guard();for(const image of prepared){await this.images!.write(user,image.id,image.bytes);written.push(image.id);}await guard();await this.secrets.set('files:'+user,rows);}
  catch(error){for(const id of written)await this.images!.remove(user,id).catch(()=>{});throw error;}
  return {references:rows,selected:[...new Set(selected)]};
 });}
 async remove(user:string,id:string){return this.exclusive(user,async()=>{
  const reference=this.list(user).find(r=>r.id===id),rows=this.list(user).filter(r=>r.id!==id);await this.secrets.set('files:'+user,rows);if(reference?.source==='clipboard')await this.images?.remove(user,id);return rows;
 });}
 async recover(user:string){return this.exclusive(user,async()=>this.images?.recover(user,this.list(user).filter(r=>r.source==='clipboard').map(r=>r.id)));}
 async restoreClipboardReferences(user:string,receiptId:string,planned:{reference:FileReference;bytes:Buffer}[],guard:()=>Promise<void>){return this.exclusive(user,async()=>{
  if(!this.images||!/^[a-f0-9]{64}$/.test(receiptId))throw Error('Clipboard image recovery is unavailable.');const applied=this.secrets.get<string[]>('clipboard-file-recovery:'+user)??[];if(applied.includes(receiptId))return this.list(user);
  const rows=[...this.list(user)],ids=new Set<string>();for(const {reference,bytes}of planned){if(reference.source!=='clipboard'||reference.kind!=='file'||reference.bytes!==bytes.length||ids.has(reference.id))throw Error('Invalid clipboard recovery reference.');ids.add(reference.id);const existing=rows.find(row=>row.id===reference.id);if(existing&&(existing.source!=='clipboard'||existing.kind!=='file'||existing.name!==reference.name||existing.bytes!==reference.bytes))throw Error('A saved attachment conflicts with clipboard recovery.');if(existing)rows[rows.indexOf(existing)]={...reference};else rows.push({...reference});}
  if(rows.length>100||applied.length>=256||rows.reduce((sum,row)=>sum+(row.source==='clipboard'?row.bytes??0:0),0)>40*1024**2)throw Error('Clipboard recovery exceeds the saved attachment limit.');
  for(const {reference,bytes}of planned){await guard();await this.images.restore(user,reference.id,bytes);await guard();}await guard();await this.secrets.setMany([['files:'+user,rows],['clipboard-file-recovery:'+user,[...applied,receiptId]]]);await guard();return this.list(user);
 });}
 async restorePublicReferences(user:string,receiptId:string,planned:import('./public-file-recovery').RecoveredReference[],guard:()=>Promise<void>){return this.exclusive(user,async()=>{
  if(!/^[a-f0-9]{64}$/.test(receiptId))throw Error('Invalid recovered attachment identity.');
  const applied=this.secrets.get<string[]>('public-file-recovery:'+user)??[];if(applied.includes(receiptId))return this.list(user);
  const rows=[...this.list(user)];for(const {reference,formerPath}of planned){
   this.checkPath(reference.path);const info=await lstat(reference.path);if(info.isSymbolicLink()||!sameRecoveryPath(await realpath(reference.path),reference.path)||!(reference.kind==='file'?info.isFile()&&info.nlink===1:info.isDirectory()))throw Error('The recovered attachment changed.');
   const existing=rows.find(row=>row.id===reference.id),samePath=rows.find(row=>row.id!==reference.id&&sameRecoveryPath(row.path,reference.path));
   if(samePath||existing&&(existing.source==='clipboard'||existing.kind!==reference.kind||!sameRecoveryPath(existing.path,formerPath)&&!sameRecoveryPath(existing.path,reference.path)))throw Error('A saved attachment conflicts with this recovery. Preserve both profiles before continuing.');
   if(existing)rows[rows.indexOf(existing)]={...reference};else rows.push({...reference});
  }
  if(rows.length>100||applied.length>=256)throw Error('This attachment recovery exceeds the saved-reference limit.');
  await guard();await this.secrets.setMany([['files:'+user,rows],['public-file-recovery:'+user,[...applied,receiptId]]]);await guard();return this.list(user);
 });}
 /** Workspace recovery publishes grants and its owner-scoped journals in one
  * credential transaction. No provider/settings namespace may be changed. */
 async restoreWorkspaceReferences(user:string,receiptId:string,planned:import('./public-file-recovery').RecoveredReference[],entries:readonly (readonly [string,unknown])[],guard:()=>Promise<void>){return this.exclusive(user,async()=>{
  if(!storageUuid(user)||!/^[a-f0-9]{64}$/.test(receiptId))throw Error('Invalid workspace recovery receipt.');const applied=this.secrets.get<string[]>('workspace-file-recovery:'+user)??[];if(applied.includes(receiptId))return this.list(user);
  const entryKeys=new Set<string>();for(const [key]of entries){const prefix=['scheduled-workspace:','scheduled-workspace-recovery:','scheduled-workspace-import:'].find(prefix=>key.startsWith(prefix+user+':')),suffix=prefix?key.slice((prefix+user+':').length):'';if(!prefix||entryKeys.has(key)||(prefix==='scheduled-workspace-import:'?!/^[a-f0-9]{64}$/.test(suffix):!storageUuid(suffix)))throw Error('Workspace recovery cannot change another account or connection setting.');entryKeys.add(key);}
  const rows=[...this.list(user)],ids=new Set<string>();for(const {reference,formerPath}of planned){if(!storageUuid(reference.id)||reference.source!==undefined||!['file','folder'].includes(reference.kind)||!path.isAbsolute(formerPath)||ids.has(reference.id))throw Error('Invalid or duplicate workspace recovery reference.');ids.add(reference.id);this.checkPath(reference.path);const info=await lstat(reference.path);if(info.isSymbolicLink()||!sameRecoveryPath(await realpath(reference.path),reference.path)||!(reference.kind==='file'?info.isFile()&&info.nlink===1:info.isDirectory()))throw Error('A recovered workspace reference changed.');const existing=rows.find(row=>row.id===reference.id),samePath=rows.find(row=>row.id!==reference.id&&sameRecoveryPath(row.path,reference.path));if(samePath||existing&&(existing.source==='clipboard'||existing.kind!==reference.kind||!sameRecoveryPath(existing.path,formerPath)&&!sameRecoveryPath(existing.path,reference.path)))throw Error('A saved attachment conflicts with this workspace recovery. Preserve both copies.');if(existing)rows[rows.indexOf(existing)]={...reference};else rows.push({...reference});}
  if(rows.length>100||applied.length>=256)throw Error('Workspace recovery exceeds the saved reference limit.');await guard();await this.secrets.setMany([...entries,['files:'+user,rows],['workspace-file-recovery:'+user,[...applied,receiptId]]]);await guard();return this.list(user);
 });}
 async preview(user:string,id:string){
  const reference=this.list(user).find(row=>row.id===id);if(!reference)throw new Error('This file reference is unavailable.');
  if(reference.source==='clipboard'){if(!this.images)throw new Error('Local image storage is unavailable.');return {image:await this.images.read(user,id)};}
  if(reference.kind!=='file'||!['.png','.jpg','.jpeg','.webp'].includes(path.extname(reference.path).toLowerCase()))throw new Error('Choose an image to preview.');
  this.checkPath(reference.path);const resolved=await realpath(reference.path);this.checkPath(resolved);if(resolved!==reference.path)throw new Error('This image path changed. Select it again.');
  return {image:await readImageFile(resolved)};
 }
 async readDocument(user:string,file:string,options:import('./documents').DocumentReadOptions&{original?:boolean}={}){
  const generation=options.generation??this.documents.generation(user);options.signal?.throwIfAborted();
  this.checkPath(file);const resolved=await realpath(file);this.checkPath(resolved);if(resolved!==file)throw new Error('The document path changed. Select it again.');
  const before=await lstat(file);if(!before.isFile()||before.isSymbolicLink()||before.nlink>1||before.size>maxDocumentBytes)throw new Error('Documents must be regular files smaller than 20 MB.');
  const handle=await open(file,'r');let bytes:Buffer;
  try{const stat=await handle.stat();if(stat.ino!==before.ino||stat.size!==before.size||await realpath(file)!==file)throw new Error('The document changed while it was being opened. Retry the read.');
   bytes=Buffer.alloc(stat.size);let offset=0;while(offset<bytes.length){options.signal?.throwIfAborted();const read=await handle.read(bytes,offset,bytes.length-offset,offset);if(!read.bytesRead)throw new Error('The document changed while it was being read. Retry the read.');offset+=read.bytesRead;}
   const after=await handle.stat();if(after.size!==stat.size||after.mtimeMs!==stat.mtimeMs)throw new Error('The document changed while it was being read. Retry the read.');
  }finally{await handle.close();}
  const extension=path.extname(file).toLowerCase(),document=await this.documents.read(user,bytes!,extension,{...options,generation});
  options.signal?.throwIfAborted();if(this.documents.generation(user)!==generation)throw Error('Document reading was cancelled.');
  if(!options.original){const {workbook,...extracted}=document;return extracted;}
  if(options.original&&(extension==='.pdf'||extension==='.docx'||extension==='.pptx'))return {...document,visual:{extension,base64:bytes!.toString('base64')}};
  return document;
 }
 async context(user:string,ids:unknown,permission:ChatOptions['permission'],signal?:AbortSignal,onClipboardImage?:(reference:FileReference,image:string)=>void):Promise<FileContext[]>{
  signal?.throwIfAborted();
  if(!Array.isArray(ids)||ids.length>20||ids.some(i=>typeof i!=='string'))throw new Error('Choose up to 20 file or folder references.');
  const references=[...new Set(ids)].map(id=>{const r=this.list(user).find(r=>r.id===id);if(!r)throw new Error('A file reference is missing or belongs to another account. Remove it and select the file again.');return r;});
  if(permission==='chat'){if(references.length)throw new Error('Chat only blocks file sharing. Change permissions or remove the attachments.');return [];}
  // The submitted attachment selection grants this turn's context. Subsequent
  // actions, such as edits and website uploads, retain their own tool reviews.
  if(references.some(reference=>!this.list(user).some(current=>current.id===reference.id&&current.path===reference.path&&current.kind===reference.kind)))throw new Error('A file reference changed while sharing was reviewed. Select it again before sending.');
  const selectedImages=references.filter(reference=>reference.source==='clipboard'||reference.kind==='file'&&['.png','.jpg','.jpeg','.webp'].includes(path.extname(reference.path).toLowerCase())).length;if(selectedImages>4)throw Error('Attach up to four images per message.');
  let remaining=160000,images=0,imageBytes=0,documents=0,pdfImages=0;const result:FileContext[]=[];
  const includePages=(pages:PdfPageImage[]|undefined)=>{for(const page of pages??[]){imageBytes+=Buffer.byteLength(page.image.slice(page.image.indexOf(',')+1),'base64');pdfImages++;if(++images>4)throw Error('Attached images and PDF pages exceed the image context limit.');}return pages;};
  const includeImage=(name:string,image:string)=>{imageBytes+=Buffer.byteLength(image.slice(image.indexOf(',')+1),'base64');result.push({name,image});images++;};
  for(const reference of references){
   signal?.throwIfAborted();
   if(reference.source==='clipboard'){if(images>=4)throw new Error('Attach up to four images per message.');const preview=await this.preview(user,reference.id);includeImage(reference.name,preview.image);onClipboardImage?.(reference,preview.image);continue;}
   this.checkPath(reference.path);const root=await realpath(reference.path);this.checkPath(root);if(root!==reference.path)throw new Error('An attached path changed. Select the file or folder again.');
   if(reference.kind==='file'){
    const ext=path.extname(root).toLowerCase();
    if(documentTypes.has(ext)){
     if(remaining<=0)throw new Error('The selected files exceed the context limit.');if(++documents>10)throw new Error('Include up to ten PDF or Office documents in one message.');
     const extracted=await this.readDocument(user,root,{signal,limit:remaining,...(ext==='.pdf'?{pages:'scanned' as const,pageLimit:Math.min(2,4-selectedImages-pdfImages)}:{})});if(!extracted.hasText&&ext!=='.pdf')throw new Error('No readable text was found in '+reference.name+'.');
     const {sections,text,pageImages,...document}=extracted;includePages(pageImages);remaining-=text.length;result.push({name:reference.name,text,...(pageImages?.length?{pageImages}:{}),fileCount:1,document,notice:extracted.notice});continue;
    }
    if(['.png','.jpg','.jpeg','.webp'].includes(ext)){
     if(images>=4)throw new Error('Attach up to four images per message.');includeImage(reference.name,await readImageFile(root));continue;
    }
    const content=await this.readText(root,remaining);remaining-=content.length;result.push({name:reference.name,text:content,fileCount:1});
   }else{
    const chunks:string[]=[],notices:string[]=[],pageImages:(PdfPageImage&{source?:string})[]=[];let count=0,skipped=0;
    const visit=async(directory:string,depth:number)=>{
     if(depth>6||count>=100||remaining<=0){skipped++;return;}
     const entries=(await readdir(directory,{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name));
     for(const entry of entries){signal?.throwIfAborted();if(!safeName(entry.name)||entry.isSymbolicLink()){skipped++;continue;}const target=path.join(directory,entry.name);const resolved=await realpath(target);try{this.checkPath(resolved);}catch{skipped++;continue;}if(resolved!==root&&!resolved.startsWith(root+path.sep)){skipped++;continue;}
      const ext=path.extname(entry.name).toLowerCase(),isDocument=documentTypes.has(ext);
      if(entry.isDirectory()){await visit(target,depth+1);continue;}if(!entry.isFile()||!textTypes.has(ext)&&!isDocument||count>=100||remaining<=0||isDocument&&documents>=10){skipped++;continue;}
      try{const header='\n--- '+path.relative(root,target)+' ---\n',limit=Math.min(remaining-header.length,40000);if(limit<=0){skipped++;continue;}let text:string;
       if(isDocument){documents++;const extracted=await this.readDocument(user,target,{signal,limit,...(ext==='.pdf'?{pages:'scanned' as const,pageLimit:Math.min(2,4-selectedImages-pdfImages)}:{})});if(!extracted.hasText&&ext!=='.pdf')throw new Error('No readable text');includePages(extracted.pageImages);pageImages.push(...(extracted.pageImages??[]).map(page=>({...page,source:path.relative(root,target)})));text=extracted.text;if(extracted.notice)notices.push(path.relative(root,target)+': '+extracted.notice);}
       else text=await this.readText(target,limit);
       const block=header+text;chunks.push(block);remaining-=block.length;count++;
      }catch{if(signal?.aborted)signal.throwIfAborted();skipped++;if(isDocument)notices.push(path.relative(root,target)+' could not be read.');}
     }
    };
    await visit(root,0);result.push({name:reference.name,text:chunks.join(''),...(pageImages.length?{pageImages}:{}),fileCount:count,notice:[skipped?`${skipped} entries skipped because of type, sensitivity, parsing, or context limits.`:'',...notices].filter(Boolean).join(' ')||undefined});
   }
  }
  for(const file of [...result].reverse()){let omitted=false;while(imageBytes>maxImageBatchBytes&&file.pageImages?.length){const page=file.pageImages.pop()!;imageBytes-=Buffer.byteLength(page.image.split(',')[1],'base64');omitted=true;}if(omitted){file.notice=(file.notice??'').replace(/Page images supplied for pages [^.]+\./g,'')+' Some PDF page images were omitted to fit the shared 40 MB image budget; read_file can retrieve the requested pages.';if(file.document)file.document={...file.document,notice:file.notice};if(!file.pageImages?.length)delete file.pageImages;}}
  if(imageBytes>maxImageBatchBytes)throw Error('Attached images exceed 40 MB in one message.');signal?.throwIfAborted();if(references.some(reference=>!this.list(user).some(current=>current.id===reference.id&&current.path===reference.path&&current.kind===reference.kind)))throw Error('A selected file reference changed while context was being read. Select it again.');return result;
 }
 private async readText(file:string,limit:number){
  if(limit<=0)throw new Error('The selected files exceed the context limit.');if(!textTypes.has(path.extname(file).toLowerCase()))throw new Error('Attach text/code files, PDF, DOCX, XLSX, PPTX, PNG, JPEG, or WebP images.');
  const stat=await lstat(file);if(stat.isSymbolicLink()||stat.size>2*1024*1024)throw new Error('Text files must be regular files smaller than 2 MB.');const bytes=await readFile(file);if(bytes.includes(0))throw new Error('This file contains binary data.');const text=bytes.toString('utf8');return text.length>limit?text.slice(0,limit)+'\n[Truncated to fit context]':text;
 }
}
