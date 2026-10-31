const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),os=require('node:os'),fs=require('node:fs'),{spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'../..'),python=path.join(root,'desktop/resources/script-runtimes/python-3.14.8/python.exe');
test('full profile copies retain exact bytes, old backups, long Unicode paths and empty directories, and resume without replacing conflicts',()=>{
 const result=spawnSync(python,['-B',path.join(root,'scripts/desktop/test-profile-copy.py')],{cwd:root,encoding:'utf8',windowsHide:true,timeout:30000});assert.equal(result.status,0,result.stdout+result.stderr);assert.match(result.stderr,/Ran 8 tests/);assert.match(result.stderr,/\bOK\b/);
});
test('a Windows junction cannot redirect a profile copy into another folder',()=>{
 const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'sylvana-copy-junction-'));
 try{
  const source=path.join(temporary,'source'),external=path.join(temporary,'external'),destination=path.join(temporary,'copy');fs.mkdirSync(source);fs.mkdirSync(external);fs.writeFileSync(path.join(external,'private.txt'),'outside data');fs.symlinkSync(external,path.join(source,'redirect'),'junction');
  const result=spawnSync(python,['-B',path.join(root,'desktop/runtime/copy-desktop-profile.py'),source,destination,path.join(temporary,'state.json')],{cwd:root,encoding:'utf8',windowsHide:true,timeout:30000});assert.equal(result.status,1);assert.match(result.stderr,/linked or redirected/);assert.equal(fs.readFileSync(path.join(external,'private.txt'),'utf8'),'outside data');assert(!fs.existsSync(path.join(destination,'redirect','private.txt')));
 }finally{assert.equal(path.dirname(path.resolve(temporary)),path.resolve(os.tmpdir()));assert(path.basename(temporary).startsWith('sylvana-copy-junction-'));fs.rmSync(temporary,{recursive:true,force:true});}
});
