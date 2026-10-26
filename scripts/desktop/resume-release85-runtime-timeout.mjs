// Resume only the documented pre-updater WSL startup timeout, preserving all other guards.
import assert from 'node:assert/strict';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {json,hash,closed} from './phased-backup-control.mjs';

assert.deepEqual(process.argv.slice(2),['--prepare']);
const root='F:/Agentopia',out='F:/Agentopia/.supabase/desktop-release85/1793036393888',job=path.join(out,'installation-1793036941194'),pointer=await json(path.join(root,'.supabase/desktop-release85/installation-current.json')),p=await json(path.join(out,'package-proof.json')),q=await json(path.join(out,'qualification.json')),e=await json(path.join(job,'evidence.json'));
assert.equal(path.resolve(pointer.job),path.resolve(job));assert.equal(path.resolve(pointer.proof),path.resolve(path.join(out,'package-proof.json')));
assert.equal(p.imageSha256,'6569d547fc5f9b401738c060c58ec413ab66e64564376ce8dad50371a721b903');assert(q.success&&e.closed?.normalNativeWindowCloseObserved&&!e.updaterInvoked&&!e.recovery&&!e.installed);
assert.equal(e.error,'WSL operation failed: The operation timed out because a response was not received from the virtual machine or container. \r\nError code: Wsl/Service/CreateInstance/HCS_E_CONNECTION_TIMEOUT');
assert.equal(path.resolve(e.existingRuntimeJob),path.resolve('F:/Agentopia/.supabase/desktop-normal-maintenance/1793036975237'));await closed();
const originalFile=path.join(root,'scripts/desktop/install-release77.mjs'),original=await readFile(originalFile,'utf8'),originalSha256=await hash(originalFile);assert.equal(originalSha256,'22d6e11cd03b5c30141e262ebafea8ae6eef08e3f6cc9b854198d312316998bc');assert.equal(q.sourceHashes['install-release77.mjs'],originalSha256);
const before="assert(e.closed?.normalNativeWindowCloseObserved&&!e.updaterInvoked&&!e.recovery&&e.error?.includes('maintenance-existing-runtime52.py'));",after="assert(e.closed?.normalNativeWindowCloseObserved&&!e.updaterInvoked&&!e.recovery&&(e.error?.includes('maintenance-existing-runtime52.py')||(path.resolve(e.job)===path.resolve("+JSON.stringify(job)+")&&e.error==="+JSON.stringify(e.error)+"&&path.resolve(e.existingRuntimeJob)===path.resolve("+JSON.stringify(e.existingRuntimeJob)+"))));";
assert.equal(original.split(before).length,2);const rootExpression="const root=path.resolve(import.meta.dirname,'../..'),";assert.equal(original.split(rootExpression).length,2);
let worker=original.replace(before,after).replace(rootExpression,'const root='+JSON.stringify(root)+',');const imports=[...worker.matchAll(/from '(\.\/[^']+)'/g)];assert.equal(imports.length,10);worker=worker.replace(/from '(\.\/[^']+)'/g,(_,relative)=>'from '+JSON.stringify(pathToFileURL(path.join(root,'scripts/desktop',relative)).href));
let reversed=worker;for(const match of imports)reversed=reversed.replace('from '+JSON.stringify(pathToFileURL(path.join(root,'scripts/desktop',match[1])).href),match[0]);reversed=reversed.replace('const root='+JSON.stringify(root)+',',rootExpression).replace(after,before);assert.equal(reversed,original);
const workerFile=path.join(job,'resume-reviewed85.mjs'),receipt={success:true,at:new Date().toISOString(),kind:'pre-updater-exact-WSL-timeout-resumption',job,worker:workerFile,workerSha256:createHash('sha256').update(worker).digest('hex'),originalController:originalFile,originalControllerSha256:originalSha256,qualificationSha256:await hash(path.join(out,'qualification.json')),proofSha256:await hash(path.join(out,'package-proof.json')),failedEvidenceSha256:await hash(path.join(job,'evidence.json')),transformations:{exactResumeGuard:1,canonicalRoot:1,relativeImports:10},reversibleExactDerivation:true,updaterPreviouslyInvoked:false,allBackupDatabaseCredentialAndNormalCloseChecksUnchanged:true,providerRequests:0};
await writeFile(workerFile,worker,{flag:'wx'});await writeFile(path.join(job,'resume-worker-proof.json'),JSON.stringify(receipt,null,2),{flag:'wx'});console.log(JSON.stringify(receipt));
