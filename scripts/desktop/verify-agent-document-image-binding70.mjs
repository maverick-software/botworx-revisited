import assert from 'node:assert/strict';
import path from 'node:path';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {desktopOperation} from './operation-lock.mjs';
import {json,hash} from './phased-backup-control.mjs';

desktopOperation('bind saved native PDF image to the retained original without inference');
const root=path.resolve(import.meta.dirname,'../..');
const pointer=await json(path.join(root,'.supabase/desktop-agent-documents70-real/current.json'));
const cfg=await json(pointer.sourceIntent),candidate=await json(pointer.candidateFile);
const fixture=await json(path.join(cfg.out,'document-fixture.json'));
const extracted=await json(path.resolve(process.argv[2])),visualFile=path.resolve(process.argv[3]);
const visual=await json(visualFile);
assert(extracted.success&&extracted.found.length===1);
const row=extracted.found[0],cold=await json(extracted.sourceColdEvidence);
assert(path.resolve(row.file).startsWith(cfg.out+path.sep));
assert(visualFile.startsWith(cfg.out+path.sep));
assert(cold.success&&cold.phase==='cold'&&cold.controlledResponses===0);
assert.equal(cold.imageSha256,candidate.imageSha256);
assert(path.resolve(row.rollout).startsWith(path.join(cfg.profile,'codex')+path.sep));
const rollout=await readFile(row.rollout,'utf8');assert(Buffer.byteLength(rollout)<20*1024*1024);
const expected=new Set(fixture.directProof.inputs.flatMap(input=>input.images));
assert(expected.has(row.nativeInputSha256));
const matches=new Set();
function visit(value){
 if(typeof value==='string'&&value.startsWith('data:image/jpeg;base64,')){
  const digest=createHash('sha256').update(value).digest('hex');
  if(digest===row.nativeInputSha256)matches.add(value);
 }else if(Array.isArray(value))value.forEach(visit);
 else if(value&&typeof value==='object')Object.values(value).forEach(visit);
}
for(const line of rollout.split('\n'))if(line.trim())visit(JSON.parse(line));
assert.equal(matches.size,1,'The saved rollout must contain the exact recorded provider-bound image URL.');
const native=Buffer.from([...matches][0].split(',')[1],'base64');
assert(native.equals(await readFile(row.file)));
const source=path.join(cold.out,'scanned-page-three.jpg');
assert.equal(await hash(source),fixture.pageSha256);
assert.equal(visual.sourceJpegSha256,fixture.pageSha256);
assert.equal(visual.nativeJpegSha256,await hash(row.file));
assert(visual.sourceAndNativeViewed&&visual.receiptCode==='WH-63-ORCHID'&&visual.approvedTotal==='849.75'&&visual.page===3);
const out=path.join(cfg.out,'image-binding-'+Date.now());await mkdir(out);
const {stdout}=await promisify(execFile)(path.join(candidate.assets,'script-runtimes/python-3.14.8/python.exe'),[
 '-I','-B',path.join(root,'scripts/desktop/compare-document-image70.py'),candidate.assets,source,row.file,
],{windowsHide:true,timeout:30000,maxBuffer:1024*1024});
const comparison=JSON.parse(stdout);assert(comparison.success);
const evidence={success:true,at:new Date().toISOString(),out,imageSha256:candidate.imageSha256,
 sourceColdEvidence:extracted.sourceColdEvidence,rollout:row.rollout,rolloutSha256:await hash(row.rollout),
 nativeImage:row.file,nativeInputSha256:row.nativeInputSha256,providerBoundUrlExactlyMatched:true,
 originalRenderedPageSha256:fixture.pageSha256,comparison,visualAttestation:visualFile,
 visualAttestationSha256:await hash(visualFile),sameGeneratedReceiptContent:true,
 modelComprehensionTested:false,providerRequests:0,completedRequestsReplayed:0,productionAccess:false,
 explanation:'The recorded native input contains a resized and re-encoded JPEG of the retained PDF page. Exact URL binding, all-page and tile pixel comparisons, and visual inspection agree. JPEG bytes differ.',
};
const file=path.join(out,'evidence.json');await writeFile(file,JSON.stringify(evidence,null,2),{flag:'wx'});
await writeFile(path.join(cfg.out,'documents-image-binding-accepted.json'),JSON.stringify({success:true,evidence:file},null,2),{flag:'wx'});
console.log(JSON.stringify({success:true,evidence:file,sourceDimensions:comparison.sourceDimensions,nativeDimensions:comparison.nativeDimensions,psnrDb:comparison.psnrDb,providerRequests:0}));
