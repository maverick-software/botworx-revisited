// Repair the helper in this newly created backup; preserve its original bytes.
import {readFile,writeFile,lstat,realpath,copyFile,rename,access} from 'node:fs/promises';
import {constants} from 'node:fs';
import {createHash} from 'node:crypto';
import path from 'node:path';
import assert from 'node:assert/strict';
import {desktopOperation} from './operation-lock.mjs';
desktopOperation('publish verified restore guard in the new private-profile backup');
const name=process.argv[2];assert(/^\d{4}-\d{2}-\d{2}T[\d-]+\.\d{3}Z-manual$/.test(name??''));
const root=path.resolve(import.meta.dirname,'../..'),sha=b=>createHash('sha256').update(b).digest('hex'),source=path.join(root,'scripts/desktop/import-backup.ps1'),newHash=sha(await readFile(source)),proofFile='C:/Users/charl/AgentopiaQA/recovery-preflight/1792457551832/evidence.json',proof=JSON.parse((await readFile(proofFile,'utf8')).replace(/^\uFEFF/,''));
assert(proof.success&&proof.groups===18&&proof.helperSha256===newHash);const scoped=JSON.parse(await readFile(path.join(root,'.supabase/desktop-profile-location/active-recovery-scope-current.json'),'utf8')),scope=JSON.parse(await readFile(scoped.scope,'utf8'));assert(scope.success&&scope.profile==='C:\\Users\\charl\\.agentopia\\desktop\\profile');
const directory=path.join(scope.backupRoot,name),target=path.join(directory,'Restore-Agentopia.ps1');assert.equal((await realpath(directory)).toLowerCase(),directory.toLowerCase());const info=await lstat(target);assert(info.isFile()&&!info.isSymbolicLink()&&info.nlink===1);
const installed=path.join(path.dirname(scope.installedArchive),'resources/runtime/Restore-Agentopia.ps1'),oldHash=sha(await readFile(installed));assert.equal(sha(await readFile(target)),oldHash);const retained=path.join(directory,'Restore-Agentopia.from-installed-0.44.47.ps1'),temporary=path.join(directory,'Restore-Agentopia.checked-new.ps1');
await assert.rejects(access(path.join(directory,'RESTORE-HELPER-VERIFICATION.json')),e=>e.code==='ENOENT');await copyFile(target,retained,constants.COPYFILE_EXCL);assert.equal(sha(await readFile(retained)),oldHash);await copyFile(source,temporary,constants.COPYFILE_EXCL);assert.equal(sha(await readFile(temporary)),newHash);assert.equal(sha(await readFile(target)),oldHash);await rename(temporary,target);assert.equal(sha(await readFile(target)),newHash);
const receipt={success:true,at:new Date().toISOString(),backup:directory,helper:target,originalHelperRetained:retained,originalSha256:oldHash,verifiedSha256:newHash,verification:proofFile,groups:18,databaseArchivesChanged:false,installedResourcesChanged:false,providerRequests:0};await writeFile(path.join(directory,'RESTORE-HELPER-VERIFICATION.json'),JSON.stringify(receipt,null,2),{flag:'wx'});console.log(JSON.stringify(receipt));
