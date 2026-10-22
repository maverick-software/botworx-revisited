const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),os=require('node:os');
const {readFile,writeFile,mkdtemp,rm,mkdir,copyFile}=require('node:fs/promises'),{randomUUID,createHash}=require('node:crypto'),{zipSync}=require('fflate');
const {DocumentReader}=require('../build/documents.js'),{WorkspaceFiles}=require('../build/workspace.js'),{WorkspaceTools}=require('../build/workspace-tools.js'),{providerHistory}=require('../build/composer.js');
const fixture=name=>readFile(path.join(__dirname,'fixtures/documents',name));
class Secrets{values=new Map();get(k){return this.values.get(k);}async set(k,v){this.values.set(k,v);}}

test('visual workspace reads include original bytes while AI context stays extracted and owner-scoped',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'agentopia-visual-document-')),file=path.join(root,'report.docx'),secrets=new Secrets(),files=new WorkspaceFiles(secrets),tools=new WorkspaceTools(files);
 try{const bytes=await fixture('sample.docx');await writeFile(file,bytes);const selected=await files.attach('owner',[{path:file}]),id=selected.selected[0],options={permission:'files',mode:'chat',thinking:'default',files:[id]};
  const visual=await tools.view('owner',options,{reference_id:id,path:''});assert.equal(visual.document.visual.extension,'.docx');assert.deepEqual(Buffer.from(visual.document.visual.base64,'base64'),bytes);
  const text=await tools.read('owner',options,{reference_id:id,path:''});assert.equal(text.document.visual,undefined);assert(text.content.includes('WORD-ALPHA-641'));
  const context=await files.context('owner',[id],'files');assert(!JSON.stringify(context).includes(bytes.toString('base64')));assert(!JSON.stringify(context).includes('"visual"'));
  await assert.rejects(tools.view('another-owner',options,{reference_id:id,path:''}));
 }finally{await files.documents.close();await rm(root,{recursive:true,force:true});}
});
test('real PDF and Office files preserve pages, Unicode, dates, formula results, slide order and speaker notes',async()=>{
 const reader=new DocumentReader();try{
  const results=await Promise.all(['pdf','docx','xlsx','pptx'].map(async ext=>reader.read('owner',await fixture('sample.'+ext),'.'+ext)));
  const [pdf,word,book,slides]=results;assert.equal(pdf.totalUnits,2);assert(pdf.sections[1].text.includes('PDF-PAGE-TWO-909'));assert(word.text.includes('WORD-ALPHA-641'));assert(word.text.includes('café and 東京'));assert(word.text.includes('HEADER-DOCX-194'));assert(word.text.includes('Orchids\t7'));
  assert(book.text.includes('2026-10-15'));assert(book.text.includes('D2: TRUE'));assert(book.text.includes('D3: FALSE'));assert(book.text.includes('E2: Formula (not calculated): B2*2'));assert(book.text.includes('E3: 10 [formula: B2+B3]'));assert(book.sections[1].label.includes('(hidden)'));assert.equal(book.sections[0].rows[1].cells[1].text,'7');
  assert(slides.sections[0].text.includes('SLIDE-SECOND-147'));assert(slides.sections[1].text.includes('SLIDE-DELTA-572'));assert(slides.sections[1].text.includes('NOTES-ECHO-219'));for(const result of results){assert(result.hasText);assert(!result.truncated);assert(result.text.length<=160000);}
 }finally{await reader.close();}
});
test('PowerPoint visual bytes are returned only for an authorized workspace view, while model context remains extracted',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'agentopia-presentation-bytes-')),file=path.join(root,'slides.pptx'),files=new WorkspaceFiles(new Secrets()),tools=new WorkspaceTools(files);
 try{const bytes=await fixture('sample.pptx');await writeFile(file,bytes);const selected=await files.attach('owner',[{path:file}]),id=selected.selected[0],options={permission:'files',mode:'chat',thinking:'default',files:[id]};
  const viewed=await tools.view('owner',options,{reference_id:id,path:''});assert.equal(viewed.document.visual.extension,'.pptx');assert.deepEqual(Buffer.from(viewed.document.visual.base64,'base64'),bytes);assert.match(viewed.document.sections[0].text,/SLIDE-SECOND-147/);
  const read=await tools.read('owner',options,{reference_id:id,path:''});assert.equal(read.document.visual,undefined);const context=await files.context('owner',[id],'files');assert(!JSON.stringify(context).includes('"visual"'));assert(!JSON.stringify(context).includes(bytes.toString('base64')));
  await assert.rejects(tools.view('other',options,{reference_id:id,path:''}));await assert.rejects(tools.view('owner',{...options,permission:'chat'},{reference_id:id,path:''}));
 }finally{await files.documents.close();assert(path.resolve(root).startsWith(path.resolve(os.tmpdir())+path.sep));await rm(root,{recursive:true,force:true});}
});
test('passwords, image-only PDFs, invalid bytes and context truncation have explicit outcomes',async()=>{
 const reader=new DocumentReader();try{
  const empty=await reader.read('owner',await fixture('image-only.pdf'),'.pdf');assert.equal(empty.hasText,false);assert.match(empty.notice,/No selectable text/);
  await assert.rejects(reader.read('owner',await fixture('password.pdf'),'.pdf'),/password-protected/);await assert.rejects(reader.read('owner',Buffer.from('not a PDF'),'.pdf'),/recognized PDF/);
  const partial=await reader.read('owner',await fixture('sample.pdf'),'.pdf',{limit:45});assert(partial.truncated);assert(partial.text.length<=45);assert(partial.unitsRead<partial.totalUnits);assert.match(partial.notice,/reading limit/);
 }finally{await reader.close();}
});
test('Office archives reject traversal, duplicate parts, oversized expansion and custom XML entities before extraction',async()=>{
 const reader=new DocumentReader(),body='<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Safe text</w:t></w:r></w:p></w:body></w:document>',parts={'[Content_Types].xml':Buffer.from('<Types/>'),'word/document.xml':Buffer.from(body)};
 try{
  await assert.rejects(reader.read('owner',zipSync({...parts,'../escape.xml':Buffer.from('bad')}),'.docx'),/invalid or duplicate paths/);
  const duplicate=Buffer.from(zipSync({...parts,'word/documenx.xml':Buffer.from(body)})),from=Buffer.from('word/documenx.xml'),to=Buffer.from('word/document.xml');for(let at=duplicate.indexOf(from);at!==-1;at=duplicate.indexOf(from,at+to.length))to.copy(duplicate,at);
  await assert.rejects(reader.read('owner',duplicate,'.docx'),/duplicate paths/);
  await assert.rejects(reader.read('owner',zipSync({...parts,'word/document.xml':Buffer.from('x'.repeat(8*1024*1024+1))}),'.docx'),/expands beyond/);
  await assert.rejects(reader.read('owner',zipSync({...parts,'word/document.xml':Buffer.from('<!DOCTYPE w:document [<!ENTITY private "PRIVATE_MUST_NOT_ECHO">]>'+body)}),'.docx'),error=>/custom XML entities/.test(error.message)&&!error.message.includes('PRIVATE_MUST_NOT_ECHO'));
 }finally{await reader.close();}
});
test('document cancellation is owner-bound, covers queued and not-yet-started reads, and recovers capacity after timeout',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'agentopia-doc-cancel-')),workerFile=path.join(root,'busy.cjs');await writeFile(workerFile,'setInterval(()=>{},1000);');const settings={workerFile,timeoutMs:2000},reader=new DocumentReader(settings),bytes=await fixture('sample.pdf');
 try{
  const ids=[randomUUID(),randomUUID(),randomUUID()],one=reader.read('one',bytes,'.pdf',{id:ids[0]}),two=reader.read('two',bytes,'.pdf',{id:ids[1]}),three=reader.read('three',bytes,'.pdf',{id:ids[2]});let secondEnded=false;two.finally(()=>{secondEnded=true;}).catch(()=>{});
  const a=assert.rejects(one,/cancelled/),b=assert.rejects(two,/cancelled/),c=assert.rejects(three,/cancelled/);reader.cancel('one',ids[1]);reader.cancel('one',ids[0]);await a;assert.equal(secondEnded,false);reader.cancelOwner('two');reader.cancelOwner('three');await Promise.all([b,c]);
  const early=randomUUID();reader.cancel('one',early);await assert.rejects(reader.read('one',bytes,'.pdf',{id:early}),/cancelled/);
  const generation=reader.generation('one');reader.cancelOwner('one');await assert.rejects(reader.read('one',bytes,'.pdf',{generation}),/cancelled/);
  settings.timeoutMs=80;await assert.rejects(reader.read('one',bytes,'.pdf'),/exceeded 30 seconds/);settings.timeoutMs=30000;delete settings.workerFile;assert((await reader.read('one',bytes,'.pdf')).text.includes('PDF-BRAVO-285'));
 }finally{await reader.close();assert(path.resolve(root).startsWith(path.resolve(os.tmpdir())+path.sep));await rm(root,{recursive:true,force:true});}
});
test('document context keeps permission checks, bounded folder sources and immutable read-only tool results',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'agentopia-doc-context-')),files=new WorkspaceFiles(new Secrets(),{showMessageBox:async()=>({response:0})});
 try{
  for(const ext of ['pdf','docx','xlsx','pptx'])await copyFile(path.join(__dirname,'fixtures/documents','sample.'+ext),path.join(root,'sample.'+ext));await writeFile(path.join(root,'.env'),'PRIVATE_CREDENTIAL');
  const refs=await files.add('owner',[root,path.join(root,'sample.pdf')]),folder=refs.find(r=>r.kind==='folder'),pdf=refs.find(r=>r.kind==='file');await assert.rejects(files.context('other',[pdf.id],'files'),/another account/);assert.equal((await files.context('owner',[pdf.id],'ask'))[0].document.totalUnits,2);await assert.rejects(files.context('owner',[pdf.id],'chat'),/Chat only/);
  const context=await files.context('owner',[pdf.id],'files');assert.equal(context[0].document.totalUnits,2);assert(!('sections' in context[0].document));for(const provider of ['openai-oauth','openrouter']){const rows=[{role:'user',content:{text:'Read this',files:context}}];assert(JSON.stringify(providerHistory(rows,provider,true)).includes('2 of 2 pages'));assert(!JSON.stringify(providerHistory(rows,provider,false)).includes('PDF-BRAVO-285'));}
  const folderContext=await files.context('owner',[folder.id],'files');assert.equal(folderContext[0].fileCount,4);assert(folderContext[0].text.includes('SLIDE-SECOND-147'));assert(!JSON.stringify(folderContext).includes('PRIVATE_CREDENTIAL'));
  const tools=new WorkspaceTools(files),options={permission:'ask',mode:'chat',thinking:'default',files:[folder.id]},args={reference_id:folder.id,path:'sample.pdf'},before=createHash('sha256').update(await readFile(path.join(root,'sample.pdf'))).digest('hex'),read=await tools.read('owner',options,args);assert(read.readOnly);assert.equal(read.document.kind,'pdf');assert(!('sections' in read.document));assert.equal((await tools.view('owner',options,args)).document.sections.length,2);await assert.rejects(tools.preview('owner',options,{...args,expected_hash:null,content:'overwrite',reason:'not allowed'}),/Only text\/code/);assert.equal(createHash('sha256').update(await readFile(path.join(root,'sample.pdf'))).digest('hex'),before);
 }finally{await files.documents.close();assert(path.resolve(root).startsWith(path.resolve(os.tmpdir())+path.sep));await rm(root,{recursive:true,force:true});}
});
