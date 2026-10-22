import {readFile,writeFile,mkdir,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {spawn} from 'node:child_process';
import path from 'node:path';
import assert from 'node:assert/strict';
import {listPackage,statFile,extractFile} from '@electron/asar';

const root=path.resolve(import.meta.dirname,'../..');
const candidate=path.join(root,'.supabase/desktop-goal-queue/candidate-04417');
const base=path.join(root,'.supabase/desktop-goal-queue/candidate-04416');
const json=async file=>JSON.parse(await readFile(file,'utf8'));
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const proof=await json(path.join(candidate,'package-proof.json'));
const prior=await json(path.join(base,'qualification.json'));
const out=path.join(candidate,'qualification-'+Date.now());
await mkdir(out);
const result={...proof,at:new Date().toISOString(),productionAccess:false,inferenceRequests:0,installed:false};
try {
  assert(proof.success&&prior.success);
  assert.equal(hash(await readFile(proof.image)),proof.imageSha256);
  assert.equal(hash(await readFile(prior.image)),prior.imageSha256);
  for(const [file,digest] of Object.entries(proof.sourceHashes)) assert.equal(hash(await readFile(path.join(proof.source,file))),digest);
  const files=archive=>listPackage(archive).map(file=>file.replaceAll('\\','/').replace(/^\//,'')).filter(file=>!statFile(archive,path.normalize(file)).files).sort();
  const entries=files(proof.image);
  assert.deepEqual(entries,files(prior.image));
  let unchangedArchiveFiles=0;
  for(const file of entries) {
    if(file==='package.json')continue;
    assert.equal(hash(extractFile(proof.image,path.normalize(file))),hash(extractFile(prior.image,path.normalize(file))),file);
    unchangedArchiveFiles++;
  }
  async function inventory(directory,prefix='') {
    let rows=[];
    for(const entry of await readdir(directory,{withFileTypes:true})) {
      assert(!entry.isSymbolicLink());
      if(entry.isDirectory()) rows.push(...await inventory(path.join(directory,entry.name),prefix+entry.name+'/'));
      else rows.push([prefix+entry.name,hash(await readFile(path.join(directory,entry.name)))]);
    }
    return rows.sort((a,b)=>a[0].localeCompare(b[0]));
  }
  const resources=path.join(proof.portableDirectory,'resources/resources');
  const priorResources=path.join(prior.portableDirectory,'resources/resources');
  const ui=await inventory(path.join(resources,'ui'));
  assert.deepEqual(ui,await inventory(path.join(priorResources,'ui')));
  assert.equal(prior.unitChecks,71);
  assert.equal((prior.rendererOutput.match(/^PASS /gm)||[]).length,9);
  const asset=path.join(resources,'runtime/manage.py');
  assert.equal(hash(await readFile(asset)),proof.sourceHashes['runtime/manage.py']);
  const output=await new Promise((resolve,reject)=>{
    const child=spawn('python',['-X','utf8',path.join(root,'desktop/tests/runtime-import-shutdown.test.py'),'-v'],{cwd:root,env:{...process.env,AGENTOPIA_MANAGE_RESOURCE:asset},windowsHide:true});
    let output='';
    for(const stream of [child.stdout,child.stderr])stream.on('data',bytes=>output+=bytes);
    child.on('error',reject);
    child.on('close',async code=>{
      await writeFile(path.join(out,'runtime-import.log'),output);
      code===0?resolve(output):reject(Error('Delivered importer checks failed: '+output));
    });
  });
  assert.match(output,/Ran 6 tests/);assert.match(output,/\bOK\b/);
  Object.assign(result,{success:true,phase:'controlled-qualification-complete',runtimeChecks:6,runtimeAssetSha256:hash(await readFile(asset)),inheritedChecks:{backend:71,renderer:9,evidence:prior.evidence,reason:'Every archived executable module and every delivered renderer asset is byte-identical to the tested 0.44.16 image.',unchangedArchiveFiles,unchangedRendererFiles:ui.length},exactRuntimeResource:true});
} catch(error) {
  Object.assign(result,{success:false,error:error.stack});process.exitCode=1;
}
await writeFile(path.join(out,'evidence.json'),JSON.stringify(result,null,2));
await writeFile(path.join(candidate,'qualification.json'),JSON.stringify({...result,evidence:path.join(out,'evidence.json')},null,2));
console.log(JSON.stringify({success:result.success,runtimeChecks:result.runtimeChecks,inheritedChecks:result.inheritedChecks,error:result.error,out},null,2));
