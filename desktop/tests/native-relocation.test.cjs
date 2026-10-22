const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),{spawnSync}=require('node:child_process');
const fs=require('node:fs'),os=require('node:os');
test('staged native relocation preserves history and refuses incomplete, foreign or unsupported data',()=>{
 const root=path.resolve(__dirname,'../..'),python=path.join(root,'desktop/resources/script-runtimes/python-3.14.8/python.exe');
 const result=spawnSync(python,['-B',path.join(root,'scripts/desktop/test-native-relocation.py')],{cwd:root,encoding:'utf8',windowsHide:true,timeout:30000});
 assert.equal(result.status,0,(result.stdout||'')+(result.stderr||''));
 assert.match(result.stderr,/Ran 10 tests/);assert.match(result.stderr,/\bOK\b/);
});
test('a copied native profile cannot redirect the repair through a Windows junction',()=>{
 const root=path.resolve(__dirname,'../..'),python=path.join(root,'desktop/resources/script-runtimes/python-3.14.8/python.exe'),temporary=fs.mkdtempSync(path.join(os.tmpdir(),'agentopia-relocation-junction-'));
 try{
  const source=path.join(temporary,'original'),stage=path.join(temporary,'stage'),external=path.join(temporary,'external');
  fs.mkdirSync(stage);fs.mkdirSync(external);fs.writeFileSync(path.join(external,'untouched.txt'),'original outside the stage');fs.symlinkSync(external,path.join(stage,'codex'),'junction');
  const marker={format:1,codex:'0.163.0',sourceProfile:source,destinationProfile:stage,state:'copied'};fs.writeFileSync(path.join(stage,'.agentopia-native-relocation.json'),JSON.stringify(marker));
  const result=spawnSync(python,['-B',path.join(root,'desktop/runtime/relocate-native-profile.py'),stage],{cwd:root,encoding:'utf8',windowsHide:true,timeout:30000});
  assert.equal(result.status,1);assert.match(result.stderr,/links or junctions/);assert.equal(fs.readFileSync(path.join(external,'untouched.txt'),'utf8'),'original outside the stage');assert.equal(JSON.parse(fs.readFileSync(path.join(stage,'.agentopia-native-relocation.json'),'utf8')).state,'copied');
 }finally{
  assert.equal(path.dirname(path.resolve(temporary)),path.resolve(os.tmpdir()));assert(path.basename(temporary).startsWith('agentopia-relocation-junction-'));fs.rmSync(temporary,{recursive:true,force:true});
 }
});
