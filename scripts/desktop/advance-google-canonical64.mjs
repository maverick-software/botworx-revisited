import {readFile,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const edits=[
 ['desktop/ui/ChatLink.tsx',"setPosition({x:bounds.left,y:bounds.bottom});setMenu(true);","openContext(bounds.left,bounds.bottom);"],
 ['desktop/ui/ChatLink.tsx',"/\\.xlsx/i.test(href??'')","/\\.xlsx/i.test(fileName)"],
 ['scripts/desktop/google-document-packaged64-workflow.mjs',"'['+file.label+'](agentopia-file://'+selected.selected[index]+'/'+encodeURIComponent(file.name)+')'","'['+file.label+'](agentopia-file://'+selected.selected[index]+'/)'"],
 ['scripts/desktop/qualify-google-layout64.mjs',"new Set(['desktop/ui/GoogleDocumentDialog.tsx','scripts/desktop/test-google-documents64-ui.mjs'])","new Set(['desktop/ui/GoogleDocumentDialog.tsx','desktop/ui/ChatLink.tsx','scripts/desktop/test-google-documents64-ui.mjs'])"],
 ['scripts/desktop/qualify-google-layout64.mjs',"Only Google document account-button layout and its narrow/light UI case changed. Backend, permissions, recovery and all previously qualified source files outside that UI component remain byte-identical.","Only Google document account-button layout, canonical file-link action discovery and their UI cases changed. Backend, permissions, recovery and all other previously qualified source files remain byte-identical."],
 ['scripts/desktop/test-google-documents64-ui.mjs',"if(action==='workspace.read'){","if(action==='workspace.link')return {kind:'file',referenceId:references[0].id,path:'',name:'Sample.docx'};\n if(action==='workspace.read'){"],
 ['scripts/desktop/test-google-documents64-ui.mjs',"<ChatLink href={'agentopia-file://'+references[0].id+'/Sample.docx'}>Sample.docx</ChatLink>","<ChatLink href={'file:///F:/Generated-UI-Fixture/Sample.docx'}>Sample.docx</ChatLink><ChatLink href={'agentopia-file://'+references[0].id+'/'}>Opaque office link</ChatLink>"],
 ];
for(const [file,before,after]of edits){const source=await readFile(file,'utf8');assert.equal(source.split(before).length,2,file+' unique anchor');await writeFile(file,source.replace(before,after));}
