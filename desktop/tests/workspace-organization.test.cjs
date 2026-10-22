const test=require('node:test'),assert=require('node:assert/strict');
const {randomUUID}=require('node:crypto');
const {applyWorkspaceChange}=require('../build/workspace-layout.js');
const {organizeTabs,reorderTabs,revealTreeFolder,toggleTreeFolder,validateTreeViews}=require('../build/workspace-organization.js');
const reference={id:randomUUID(),kind:'folder',name:'Workspace',path:'C:\\work'};
const pane=()=>({open:true,width:600,tree:true,treeWidth:210,referenceId:reference.id,tabs:['one','two','three'].map(id=>({id,kind:'browser',name:id,url:'https://example.com/'+id})),active:'two'});
test('tab organization retains the selected document, chooses a neighboring tab on close, and leaves source state intact',()=>{
 const original=pane();assert.deepEqual(reorderTabs(original,'one','three').tabs.map(t=>t.id),['two','three','one']);assert.equal(reorderTabs(original,'one','three').active,'two');assert.deepEqual(organizeTabs(original,'two','right').tabs.map(t=>t.id),['one','two']);assert.deepEqual(organizeTabs(original,'two','others').tabs.map(t=>t.id),['two']);assert.equal(organizeTabs(original,'two','close').active,'three');assert.equal(organizeTabs(original,'three','close').active,'two');assert.equal(organizeTabs(original,'two','all').active,null);assert.deepEqual(organizeTabs(original,'two','left').tabs.map(t=>t.id),['two','one','three']);assert.deepEqual(original,pane());
});
test('expanded directory metadata follows a folder move and its descendants, retains unrelated folders and is not applied twice',()=>{
 const original={...pane(),treeViews:{[reference.id]:{expanded:['docs','docs/research','other'],filter:'note',followActive:false}}},move={revision:1,referenceId:reference.id,action:'move',from:'C:\\work\\docs',to:'C:\\work\\archive\\docs'};
 const next=applyWorkspaceChange(original,[reference],move);assert.deepEqual(next.treeViews[reference.id],{expanded:['archive','archive/docs','archive/docs/research','other'],filter:'note',followActive:false});assert.equal(applyWorkspaceChange(next,[reference],move),next);assert.deepEqual(original.treeViews[reference.id].expanded,['docs','docs/research','other']);
 const removed=applyWorkspaceChange(next,[reference],{revision:2,referenceId:reference.id,action:'remove',from:'C:\\work\\archive\\docs'});assert.deepEqual(removed.treeViews[reference.id].expanded,['archive','other']);
});
test('folder expansion crosses owned nested grants when an item moves out of its original granted parent',()=>{
 const alias={...reference,id:randomUUID(),path:'C:\\work\\docs'},original={...pane(),treeViews:{[alias.id]:{expanded:['research','research/design'],filter:'',followActive:true}}};
 const next=applyWorkspaceChange(original,[reference,alias],{revision:1,referenceId:reference.id,action:'move',from:'C:\\work\\docs\\research',to:'C:\\work\\archive\\research'});
 assert.deepEqual(next.treeViews[alias.id].expanded,[]);assert.deepEqual(next.treeViews[reference.id].expanded,['archive','archive/research','archive/research/design']);
});
test('folder navigation enforces its watch budget and keeps collapsed descendant preferences available for reopening',()=>{
 const view={expanded:['docs','docs/research'],filter:'notes',followActive:false};assert.deepEqual(toggleTreeFolder(view,'docs',false).expanded,['docs/research']);assert.deepEqual(revealTreeFolder(toggleTreeFolder(view,'docs',false),'docs').expanded,['docs/research','docs']);
 assert.throws(()=>validateTreeViews({[reference.id]:{...view,expanded:Array(2)}},[reference]),/Invalid saved folder path/);
 assert.throws(()=>revealTreeFolder({...view,expanded:Array.from({length:63},(_,i)=>'dir'+i)},'next'),/63 folders/);
 assert.equal(validateTreeViews({[randomUUID()]:view},[reference])&&Object.keys(validateTreeViews({[randomUUID()]:view},[reference])).length,0);
});
