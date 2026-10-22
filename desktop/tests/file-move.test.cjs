const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),os=require('node:os');
const {mkdtemp,writeFile,readFile,mkdir,readdir,realpath,rm}=require('node:fs/promises');
const {prepareFileMove}=require('../build/file-move.js');
const script=path.resolve(__dirname,'../runtime/file-actions.ps1');
test('Windows moves preserve files and directory contents, refuse occupied destinations and support case-only names',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'agentopia-file-move-')),signal=new AbortController().signal;
 const move=async(from,to)=>{const helper=await prepareFileMove(script,signal);try{await helper.commit(path.join(root,from),path.join(root,to));}finally{await helper.close();}};
 try{
  await writeFile(path.join(root,'original.md'),'KEEP-ORIGINAL');await writeFile(path.join(root,'occupied.md'),'KEEP-DESTINATION');
  await assert.rejects(move('original.md','occupied.md'),/destination already exists/);assert.equal(await readFile(path.join(root,'original.md'),'utf8'),'KEEP-ORIGINAL');assert.equal(await readFile(path.join(root,'occupied.md'),'utf8'),'KEEP-DESTINATION');
  await move('original.md','renamed.md');await assert.rejects(readFile(path.join(root,'original.md')),/ENOENT/);assert.equal(await readFile(path.join(root,'renamed.md'),'utf8'),'KEEP-ORIGINAL');
  await move('renamed.md','Renamed.md');assert.equal(path.basename(await realpath(path.join(root,'Renamed.md'))),'Renamed.md');
  await mkdir(path.join(root,'folder'));await writeFile(path.join(root,'folder','nested.md'),'NESTED');await move('folder','moved-folder');assert.equal(await readFile(path.join(root,'moved-folder','nested.md'),'utf8'),'NESTED');
  await move('moved-folder','moved-folder');assert.equal(await readFile(path.join(root,'moved-folder','nested.md'),'utf8'),'NESTED');
 }finally{assert(path.resolve(root).startsWith(path.join(os.tmpdir(),'agentopia-file-move-')));await rm(root,{recursive:true,force:true});}
});
test('closing a prepared Windows helper without committing leaves its source untouched',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'agentopia-file-move-'));
 try{await writeFile(path.join(root,'notes.md'),'UNCHANGED');const helper=await prepareFileMove(script,new AbortController().signal);await helper.close();assert.deepEqual(await readdir(root),['notes.md']);assert.equal(await readFile(path.join(root,'notes.md'),'utf8'),'UNCHANGED');}
 finally{assert(path.resolve(root).startsWith(path.join(os.tmpdir(),'agentopia-file-move-')));await rm(root,{recursive:true,force:true});}
});
