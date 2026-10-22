import {parentPort,workerData} from 'node:worker_threads';
import {unzipSync} from 'fflate';
import {SaxesParser,type SaxesTagNS} from 'saxes';
import {getDocumentProxy} from 'unpdf';
import path from 'node:path';
import {workbookLayout} from './spreadsheet-layout';
import {sharedFormulas} from './shared-formulas';
import {maxDocumentBytes,type DocumentPreview,type DocumentSection,type DocumentKind} from './document-contracts';
const maxText=Math.max(1,Math.min(160000,workerData.limit??160000)),maxUnits=200,maxXML=8*1024*1024;
class DocumentFailure extends Error{}
const fail=(message:string):never=>{throw new DocumentFailure(message);};
globalThis.fetch=async()=>{throw new Error('External document resources are disabled.');};
function xml(bytes:Uint8Array,open?:(node:SaxesTagNS)=>void,text?:(value:string)=>void,close?:(node:SaxesTagNS)=>void){
 if(bytes.length>maxXML)fail('A document XML part exceeds 8 MB. Use a smaller document.');
 let value:string;try{const type=bytes[0]===255&&bytes[1]===254?'utf-16le':bytes[0]===254&&bytes[1]===255?'utf-16be':'utf-8';value=new TextDecoder(type,{fatal:true}).decode(bytes);}catch{fail('The document contains invalid text encoding.');}
 if(/<!DOCTYPE|<!ENTITY/i.test(value!))fail('Document type definitions and custom XML entities are unsupported.');
 const parser=new SaxesParser({xmlns:true});let depth=0;
 parser.on('opentag',node=>{if(++depth>100)fail('The document XML is nested too deeply.');open?.(node);});parser.on('text',value=>text?.(value));parser.on('cdata',value=>text?.(value));parser.on('closetag',node=>{close?.(node);depth--;});parser.on('doctype',()=>fail('Document type definitions are unsupported.'));parser.write(value!).close();
}
const attr=(node:SaxesTagNS,name:string)=>Object.values(node.attributes).find(a=>a.name===name)?.value??'';
const localAttr=(node:SaxesTagNS,name:string)=>Object.values(node.attributes).find(a=>a.local===name&&a.uri.includes('/relationships'))?.value??'';
function packageFiles(bytes:Uint8Array){
 let count=0,total=0,expanded=0;const seen=new Set<string>();
 return unzipSync(bytes,{filter:file=>{
  if(++count>4000)fail('The Office file has more than 4,000 package entries.');
  if(file.name.includes('\\')||file.name.startsWith('/')||file.name.split('/').includes('..')||seen.has(file.name))fail('The Office package has invalid or duplicate paths.');seen.add(file.name);
  if(!Number.isSafeInteger(file.originalSize)||file.originalSize>16*1024*1024||(expanded+=file.originalSize)>64*1024*1024)fail('The Office package expands beyond the 64 MB preview limit. Use a smaller document.');
  const selected=/^(?:\[Content_Types\]\.xml|word\/(?:document|header\d+|footer\d+|footnotes|endnotes|comments)\.xml|xl\/(?:workbook|sharedStrings|styles)\.xml|xl\/theme\/theme1\.xml|xl\/_rels\/workbook\.xml\.rels|xl\/worksheets\/[^/]+\.xml|ppt\/presentation\.xml|ppt\/_rels\/presentation\.xml\.rels|ppt\/slides\/[^/]+\.xml|ppt\/slides\/_rels\/[^/]+\.xml\.rels|ppt\/notesSlides\/[^/]+\.xml)$/i.test(file.name);
  if(!selected)return false;
  if(!Number.isSafeInteger(file.originalSize)||file.originalSize>maxXML||(total+=file.originalSize)>32*1024*1024)fail('The Office document expands beyond the reader’s XML limits. Use a smaller document.');
  if(file.compression!==0&&file.compression!==8)fail('This Office compression format is unsupported.');return true;
 }});
}
function requirePart(files:Record<string,Uint8Array>,name:string){return files[name]??fail('The document is missing a required package part.');}
function relationships(files:Record<string,Uint8Array>,name:string,base:string,type:string){
 const result=new Map<string,string>();xml(requirePart(files,name),node=>{if(node.local!=='Relationship'||!attr(node,'Type').endsWith('/'+type)||attr(node,'TargetMode').toLowerCase()==='external')return;const id=attr(node,'Id'),target=decodeURIComponent(attr(node,'Target'));if(!id||!target||/^[a-z]+:/i.test(target)||target.includes('\\'))fail('A document relationship is invalid.');const resolved=path.posix.resolve('/'+base,target).slice(1);if(!resolved.startsWith(base.split('/')[0]+'/')||result.has(id))fail('A document relationship leaves its package or repeats an identifier.');result.set(id,resolved);});return result;
}
function paragraphText(bytes:Uint8Array,word:boolean){
 let result='',inside=0;xml(bytes,node=>{if(node.local==='t'&&(word?node.uri.includes('wordprocessingml'):node.uri.includes('drawingml')))inside++;if(word&&node.local==='tab')result+='\t';if(node.local==='br')result+='\n';},value=>{if(inside)result+=value;if(result.length>maxText+maxXML)fail('The document contains too much text.');},node=>{if(node.local==='t'&&inside)inside--;if(node.local==='p')result+='\n';if(node.local==='tc')result=result.replace(/\n+$/,'')+'\t';if(node.local==='tr')result=result.trimEnd()+'\n';});return result.replace(/[ \t]+\n/g,'\n').replace(/\n{3,}/g,'\n\n').trim();
}
class Sections{
 sections:DocumentSection[]=[];characters=0;truncated=false;
 add(section:DocumentSection){section={...section,label:section.label.slice(0,200)};const header='--- '+section.label+' ---\n',separator=this.sections.length?2:0,budget=maxText-this.characters-header.length-separator;if(this.sections.length>=maxUnits||budget<=0){this.truncated=true;return false;}if(section.text.length>budget){section={...section,text:section.text.slice(0,budget),rows:undefined};this.truncated=true;}this.characters+=section.text.length+header.length+separator;this.sections.push(section);return !this.truncated;}
 result(kind:DocumentKind,totalUnits:number,notice?:string):DocumentPreview{
  const text=this.sections.map(s=>'--- '+s.label+' ---\n'+s.text).join('\n\n'),hasText=this.sections.some(section=>section.text.trim());return {kind,totalUnits,unitsRead:this.sections.length,truncated:this.truncated,hasText,sections:this.sections,text,notice:[notice,this.truncated?'Only the displayed sections and text were extracted because the document reached a reading limit.':!hasText?'No selectable text was found. This may be a scanned or image-only document.':undefined].filter(Boolean).join(' ')||undefined};
 }
}
async function pdf(bytes:Uint8Array){
 if(!new TextDecoder().decode(bytes.subarray(0,1024)).includes('%PDF-'))fail('This file is not a recognized PDF.');
 const doc=await getDocumentProxy(bytes,{useWorkerFetch:false,enableXfa:false,useSystemFonts:false,useWasm:false,standardFontDataUrl:undefined,cMapUrl:undefined,verbosity:0});
 try{const result=new Sections(),pagesWithoutText:number[]=[];for(let i=1;i<=doc.numPages;i++){if(i>maxUnits){result.truncated=true;break;}const page=await doc.getPage(i),content=await page.getTextContent();const text=content.items.map(item=>'str' in item?item.str+(item.hasEOL?'\n':' '):'').join('').trim();page.cleanup();if(!text)pagesWithoutText.push(i);if(!result.add({label:'Page '+i,text}))break;}return {...result.result('pdf',doc.numPages),...(pagesWithoutText.length?{pagesWithoutText}:{})};}finally{await doc.loadingTask.destroy();}
}
function word(files:Record<string,Uint8Array>){
 const parts=['word/document.xml',...Object.keys(files).filter(name=>/^word\/(header\d+|footer\d+|footnotes|endnotes|comments)\.xml$/.test(name)).sort()],result=new Sections();
 for(const name of parts)if(!result.add({label:name==='word/document.xml'?'Document':name.split('/').at(-1)!.replace('.xml',''),text:paragraphText(requirePart(files,name),true)}))break;
 return result.result('word',parts.length,'Text and tables are extracted. Page layout, drawings, embedded files, and tracked deletions are excluded.');
}
function presentation(files:Record<string,Uint8Array>){
 const order:string[]=[];xml(requirePart(files,'ppt/presentation.xml'),node=>{if(node.local==='sldId')order.push(localAttr(node,'id'));});const rels=relationships(files,'ppt/_rels/presentation.xml.rels','ppt','slide'),result=new Sections();
 for(const [index,id] of order.entries()){
  const file=rels.get(id)??fail('A presentation slide relationship is missing.');let text=paragraphText(requirePart(files,file),false);const relFile=path.posix.dirname(file)+'/_rels/'+path.posix.basename(file)+'.rels';
  if(files[relFile])for(const note of relationships(files,relFile,path.posix.dirname(file),'notesSlide').values())text+='\n\nSpeaker notes:\n'+paragraphText(requirePart(files,note),false);
  if(!result.add({label:'Slide '+(index+1),text}))break;
 }return result.result('presentation',order.length,'Slide text, tables, and speaker notes are extracted. Images, charts, and presentation layout are excluded.');
}
function spreadsheet(files:Record<string,Uint8Array>){
 const strings:string[]=[];let current='',inside=0,inString=false;
 if(files['xl/sharedStrings.xml'])xml(files['xl/sharedStrings.xml'],node=>{if(node.local==='si'){current='';inString=true;}if(node.local==='t'&&inString)inside++;},value=>{if(inside)current+=value;},node=>{if(node.local==='t'&&inside)inside--;if(node.local==='si'){if(strings.length>=100000)fail('The workbook has too many shared text values.');strings.push(current);inString=false;}});
 const sheets:{id:string;name:string;hidden:boolean}[]=[];let date1904=false;xml(requirePart(files,'xl/workbook.xml'),node=>{if(node.local==='sheet')sheets.push({id:localAttr(node,'id'),name:attr(node,'name'),hidden:!!attr(node,'state')&&attr(node,'state')!=='visible'});if(node.local==='workbookPr')date1904=['1','true'].includes(attr(node,'date1904'));});
 const rels=relationships(files,'xl/_rels/workbook.xml.rels','xl','worksheet'),chartSheets=relationships(files,'xl/_rels/workbook.xml.rels','xl','chartsheet'),styles:number[]=[],formats=new Map<number,string>();let cellXfs=false;
 if(files['xl/styles.xml'])xml(files['xl/styles.xml'],node=>{if(node.local==='numFmt')formats.set(Number(attr(node,'numFmtId')),attr(node,'formatCode'));if(node.local==='cellXfs')cellXfs=true;else if(node.local==='xf'&&cellXfs)styles.push(Number(attr(node,'numFmtId')));},undefined,node=>{if(node.local==='cellXfs')cellXfs=false;});
 const dateValue=(value:string,style:number)=>{const n=Number(value),format=styles[style],custom=(formats.get(format)??'').replace(/"[^"]*"|\\.|\[[^\]]*\]/g,'');if(!value.trim()||!Number.isFinite(n)||!([14,15,16,17,18,19,20,21,22,27,30,36,45,46,47,50,57].includes(format)||/[ymdhis]/i.test(custom)))return value;if(!date1904&&Math.floor(n)===60)return '1900-02-29 (Excel serial '+value+')';const milliseconds=(date1904?Date.UTC(1904,0,1):Date.UTC(1899,11,n<60?31:30))+n*86400000;if(!Number.isFinite(milliseconds)||Math.abs(milliseconds)>8640000000000000)return value;return new Date(milliseconds).toISOString().replace('T',' ').replace(/\.\d{3}Z$/,'');};
 const result=new Sections();for(const sheet of sheets){
  if(chartSheets.has(sheet.id)){if(!result.add({label:'Chart sheet: '+sheet.name,text:''}))break;continue;}const file=rels.get(sheet.id)??fail('A workbook sheet relationship is missing.'),rows:NonNullable<DocumentSection['rows']>=[],shared=sharedFormulas(requirePart(files,file),xml);let row={label:'',cells:[] as {address:string;text:string}[]},cell:{address:string;type:string;style:number;value:string;formula:string}|null=null,field='',cells=0;
  xml(requirePart(files,file),node=>{if(node.local==='row')row={label:attr(node,'r')+(attr(node,'hidden')==='1'?' (hidden)':''),cells:[]};if(node.local==='c'){if(++cells>100000)fail('A worksheet has too many cells to read.');cell={address:attr(node,'r'),type:attr(node,'t'),style:Number(attr(node,'s')||0),value:'',formula:''};}if(cell&&['v','f','t'].includes(node.local))field=node.local;},value=>{if(!cell)return;if(field==='f')cell.formula+=value;else if(field==='v'||field==='t')cell.value+=value;},node=>{if(node.local===field)field='';if(node.local==='c'&&cell){let value=cell.type==='s'?strings[Number(cell.value)]??'[Missing shared string]':cell.type==='b'?(cell.value==='1'?'TRUE':'FALSE'):['n',''].includes(cell.type)?dateValue(cell.value,cell.style):cell.value;const resolved=shared.resolve(cell.address);if(resolved?.formula)cell.formula=resolved.formula;if(resolved?.unavailable)value+=(value?' [shared formula unavailable]':'Shared formula unavailable');if(cell.formula)value+=(value?' [formula: ':'Formula (not calculated): ')+cell.formula+(value?']':'');row.cells.push({address:cell.address,text:value});cell=null;}if(node.local==='row')rows.push(row);});
  const text=rows.map(row=>row.cells.map(cell=>cell.address+': '+cell.text).join('\t')).join('\n');if(!result.add({label:'Sheet: '+sheet.name+(sheet.hidden?' (hidden)':''),text,rows:rows.slice(0,100).map(row=>({...row,cells:row.cells.slice(0,30)})),tableLimited:rows.length>100||rows.some(row=>row.cells.length>30)}))break;
 }return {...result.result('spreadsheet',sheets.length,'Cell values and cached formula results are read without recalculating formulas. Workbook layout, charts, and embedded files are excluded.'),workbook:workbookLayout(files,xml)};
}
async function run(){try{const {data,extension}=workerData;if(!(data instanceof Uint8Array)||!data.length||data.length>maxDocumentBytes)fail('The document exceeds the 20 MB reading limit.');let result:DocumentPreview;if(extension==='.pdf')result=await pdf(data);else{const files=packageFiles(data);requirePart(files,'[Content_Types].xml');result=extension==='.docx'?word(files):extension==='.xlsx'?spreadsheet(files):extension==='.pptx'?presentation(files):fail('Unsupported document format.');}parentPort?.postMessage({ok:true,result});}catch(error){parentPort?.postMessage({ok:false,error:error instanceof DocumentFailure?error.message:(error as Error).name==='PasswordException'?'This PDF is password-protected. Attach an unlocked copy.':'The document is damaged, encrypted, or not a recognized supported file. Try saving a new PDF, DOCX, XLSX, or PPTX copy.'});}}
void run();
