const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
const {snapshotResponseFiles,responseFileChanges}=require('../build/response-file-changes.js'),{observedFileChanges,undoableEdits}=require('../build/turn-presentation.js');
const signal=()=>AbortSignal.timeout(10000);
async function fixture(run){const root=await fs.mkdtemp(path.join(os.tmpdir(),'sylvana-response-files-'));try{await run(root);}finally{await fs.rm(root,{recursive:true,force:true});}}
test('working-folder snapshots detect actual creation, modification, deletion and binary output with net line counts',()=>fixture(async root=>{
 await fs.writeFile(path.join(root,'modify.txt'),'old\n');await fs.writeFile(path.join(root,'delete.txt'),'gone\n');const before=await snapshotResponseFiles(root,signal());
 await fs.writeFile(path.join(root,'new.txt'),'one\ntwo\n');await fs.writeFile(path.join(root,'modify.txt'),'new\n');await fs.unlink(path.join(root,'delete.txt'));await fs.writeFile(path.join(root,'report.docx'),Buffer.from([80,75,0,1]));
 const result=responseFileChanges(before,await snapshotResponseFiles(root,signal())),rows=Object.fromEntries(result.files.map(f=>[f.relativePath,f]));assert.equal(result.notice,undefined);assert.equal(result.files.length,4);
 assert.deepEqual([rows['new.txt'].kind,rows['new.txt'].added,rows['new.txt'].removed],['created',2,0]);assert.deepEqual([rows['modify.txt'].kind,rows['modify.txt'].added,rows['modify.txt'].removed],['modified',1,1]);assert.deepEqual([rows['delete.txt'].kind,rows['delete.txt'].added,rows['delete.txt'].removed],['deleted',0,1]);assert(rows['report.docx'].binary&&!rows['report.docx'].text);assert.equal(rows['report.docx'].added,null);assert.equal(rows['report.docx'].before,null);assert.equal(rows['report.docx'].after,null);
}));
test('net-zero work, excluded credential/dependency paths and cancelled or incomplete inventories never invent a deletion',()=>fixture(async root=>{
 await fs.writeFile(path.join(root,'note.txt'),'kept\n');await fs.writeFile(path.join(root,'.env'),'PRIVATE');await fs.mkdir(path.join(root,'node_modules'));await fs.writeFile(path.join(root,'node_modules','secret.txt'),'PRIVATE');const before=await snapshotResponseFiles(root,signal());assert.deepEqual([...before.files.keys()],['note.txt']);
 await fs.writeFile(path.join(root,'note.txt'),'temporary');await fs.writeFile(path.join(root,'note.txt'),'kept\n');assert.equal(responseFileChanges(before,await snapshotResponseFiles(root,signal())).files.length,0);
 assert.equal(responseFileChanges(before,{...before,complete:false,files:new Map()}).files.length,0);assert.equal(responseFileChanges(before,{...before,identity:'replacement',files:new Map()}).files.length,0);
 const abort=new AbortController();abort.abort();assert.equal((await snapshotResponseFiles(root,abort.signal)).complete,false);
}));
test('large text is distinguished from binary and changed text snapshots stay bounded',()=>fixture(async root=>{
 const before=await snapshotResponseFiles(root,signal());await fs.writeFile(path.join(root,'large.txt'),'x'.repeat(160001));const row=responseFileChanges(before,await snapshotResponseFiles(root,signal())).files[0];assert(!row.text&&!row.binary);assert.equal(row.added,null);assert.equal(row.after,null);
}));
test('observations survive serialized history, avoid duplicate host patches and respect restored receipts',()=>{
 const file={key:'workspace:note.txt',path:'C:/work/note.txt',relativePath:'note.txt',kind:'created',text:true,binary:false,before:null,after:'new\n',beforeHash:null,afterHash:'h',added:1,removed:0},native={workspaceChanges:[file]},tool={id:'t',name:'write_file',status:'completed',preview:{path:file.path,relativePath:'note.txt',referenceId:'ref',before:null,after:'new\n',beforeHash:null,afterHash:'h'}};
 assert.deepEqual(observedFileChanges(JSON.parse(JSON.stringify(native)),[]),[file]);assert.equal(observedFileChanges(native,[tool]).length,0);assert.equal(observedFileChanges(native,[{...tool,status:'reverted'}]).length,0);
 const remove={id:'m',name:'manage_file',status:'completed',arguments:{reference_id:'ref'},result:{changed:true,kind:'file',action:'remove',operation_id:'operation',absolute_path:'C:/work/other.txt',path:'other.txt'}};assert.equal(observedFileChanges(undefined,[remove])[0].kind,'deleted');assert.deepEqual(undoableEdits([remove]).map(t=>t.id),['m']);assert.equal(observedFileChanges(undefined,[{...remove,status:'reverted'}]).length,0);
});
