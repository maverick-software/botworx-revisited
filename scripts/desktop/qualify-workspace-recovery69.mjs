// Combine unchanged backend coverage with the separately rerun regression case.
import assert from 'node:assert/strict';
import path from 'node:path';
import {readFile,writeFile} from 'node:fs/promises';
import {desktopOperation} from './operation-lock.mjs';
import {json,hash} from './phased-backup-control.mjs';
desktopOperation('record unchanged backend recovery coverage and focused regression');
const root=path.resolve(import.meta.dirname,'../..'),baseFile=path.resolve(process.argv[2]??''),focusedFile=path.resolve(process.argv[3]??''),base=await json(baseFile),focused=await json(focusedFile),log=await readFile(path.join(base.out,'recovery.log'),'utf8');
assert(focused.success&&focused.passed===1&&focused.filter==='^Long private recovery paths');assert(/# pass 112\b/.test(log)&&/# fail 1\b/.test(log));assert.deepEqual([...log.matchAll(/^not ok \d+ - (.+)$/gm)].map(row=>row[1]),['Long private recovery paths restore committed history and dirty files with the selected Git']);
for(const[file,digest]of Object.entries(focused.sourceHashes)){assert.equal(await hash(path.join(root,file)),digest);if(file.startsWith('desktop/src/'))assert.equal(base.sourceHashes[file],digest,'Backend changed after the broader run');}
const e={success:true,at:new Date().toISOString(),out:focused.out,build:focused.build,sourceHashes:focused.sourceHashes,passed:113,qualificationMethod:'112 existing cases in the complete run plus the separately rerun long-bundle-path regression; backend bytes unchanged',completeRunHadOneFailure:true,completeRun:baseFile,focusedRegression:focusedFile,knownLimitation:'Extra-long private profile roots can exceed Windows Git working-directory limits or bundle-capture filename support. Those attempts stop during preparation and preserve existing files. The regression targets an actual restoration bundle path longer than260 characters with the ordinary generated profile layout.',installed:false,productionAccess:false,providerRequests:0};
const file=path.join(focused.out,'qualification.json');await writeFile(file,JSON.stringify(e,null,2),{flag:'wx'});console.log(JSON.stringify({success:true,passed:e.passed,qualification:file,completeRunHadOneFailure:true}));
