import {mkdir,readFile,writeFile,copyFile,realpath,stat,statfs,rename} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import {desktopOperation} from './operation-lock.mjs';
import {discoverActiveRecoveryScope} from './active-recovery-scope.mjs';
import {contextRecoveryArchive} from './context-recovery-chain.mjs';
import {captureCompressedColdImageFromReader} from './compressed-cold-image.mjs';
import {linuxColdImageReader} from './cold-image-linux-reader.mjs';
import {capturePrivateProfile} from './capture-private-profile.mjs';
import {capturePublicOutputs} from './public-output-recovery.mjs';
import {capturePortablePublicReferences} from './portable-public-reference-backup.mjs';
import {closed,list,run,linux,hash,registration,save} from './phased-backup-control.mjs';

desktopOperation('current private profile and bounded compressed cold-runtime recovery');
const root=path.resolve(import.meta.dirname,'../..'),records=path.join(root,'.supabase/desktop-profile-location'),backupName=process.argv[2],exec=promisify(execFile);
assert(process.argv.length===3&&/^\d{4}-\d{2}-\d{2}T[\d-]+\.\d{3}Z-manual$/.test(backupName??''),'Pass the newly completed in-app backup name');
await closed();
const adoption=JSON.parse(await readFile(path.join(root,'.supabase/desktop-platform-release/candidate-04447/private-profile-adoption.json'),'utf8'));assert(adoption.success&&adoption.version==='0.44.47');
// A focused document update keeps the same verified profile selector/runtime.
// Accept its archive identity only after recorded installed/reopening acceptance.
let expectedArchiveSha256=adoption.imageSha256;
try{const office=JSON.parse(await readFile(path.join(root,'.supabase/desktop-office-update/reopened.json'),'utf8'));assert(office.success&&office.version==='0.44.47'&&office.revision==='office-preview-3'&&office.normalReopeningPassed&&office.tablesCompared===126&&office.baseImageSha256===adoption.imageSha256);expectedArchiveSha256=office.imageSha256;}catch(error){if(error.code!=='ENOENT')throw error;}
try{const presentation=JSON.parse(await readFile(path.join(root,'.supabase/desktop-presentation-delivery/reopened.json'),'utf8'));assert(presentation.success&&presentation.version==='0.44.47'&&presentation.revision==='presentation-4'&&presentation.normalReopeningPassed&&presentation.tablesCompared===126&&presentation.baseImageSha256===expectedArchiveSha256);expectedArchiveSha256=presentation.imageSha256;}catch(error){if(error.code!=='ENOENT')throw error;}
expectedArchiveSha256=await contextRecoveryArchive(root,expectedArchiveSha256);
const recoveryBase=path.join(os.homedir(),'AgentopiaRecovery/private-profile-current');await mkdir(recoveryBase,{recursive:true});assert.equal((await realpath(recoveryBase)).toLowerCase(),recoveryBase.toLowerCase());const out=path.join(recoveryBase,String(Date.now()));await mkdir(out);assert.equal((await realpath(out)).toLowerCase(),out.toLowerCase());
const sid=(await exec('powershell.exe',['-NoProfile','-NonInteractive','-Command','[Security.Principal.WindowsIdentity]::GetCurrent().User.Value'],{encoding:'utf8',windowsHide:true})).stdout.trim();assert(/^S-1-5-[0-9-]+$/.test(sid));await exec('icacls.exe',[out,'/inheritance:r','/grant:r','*'+sid+':(OI)(CI)F','*S-1-5-18:(OI)(CI)F','/Q'],{windowsHide:true});
const scope=await discoverActiveRecoveryScope({archive:path.join(os.homedir(),'AppData/Local/AgentopiaDesktop/app-0.44.47/resources/app.asar'),expectedArchiveSha256,home:os.homedir(),work:out});
const before={registered:await list(false),running:await list(true)};assert(!before.running.includes(scope.distribution),'The bound runtime must already be stopped after normal app closure');
assert(before.registered.includes('Ubuntu'),'This redirected maintenance host requires its existing independent filesystem reader');
const initialSpace=await statfs(out),headroom=1536*1024**2;
assert(initialSpace.bavail*initialSpace.bsize>headroom+1024**3,'Preserve at least a GiB for profile capture and compressed output in addition to remaining headroom');
const config={format:3,at:new Date().toISOString(),out,scope,distribution:scope.distribution,instanceId:scope.instanceId,backupName,profileLinux:linux(scope.profile),installedResourcesLinux:linux(path.dirname(scope.installedArchive)),roots:{ordinary:{windows:scope.profile,linux:linux(scope.profile)}}};
await writeFile(path.join(out,'intent.json'),JSON.stringify(config,null,2),{flag:'wx'});
const evidence={at:config.at,out,phase:'prepared',success:false,scope,before,providerRequests:0,installed:false,fullGoalComplete:false};const record=()=>save(path.join(out,'evidence.json'),evidence);await record();
for(const name of ['capture_active_recovery.py','profile_archive.py','phased_backup.py','archived_account_owners.py'])await copyFile(path.join(root,'scripts/desktop',name),path.join(out,name));
let started=false,readerStarted=false;
try{
 started=true;evidence.phase='capturing-stopped-current-profile';await record();evidence.profile=JSON.parse(await run(['-d',scope.distribution,'-u','agentopia','--exec','python3',linux(path.join(out,'capture_active_recovery.py')),linux(out)],300000));await closed();await run(['--terminate',scope.distribution]);started=false;
 assert.deepEqual(await list(false),before.registered);assert.deepEqual(await list(true),before.running);assert.deepEqual(await registration(scope.distribution),scope.registry);assert.equal(await hash(scope.locationFile),scope.locationSha256);
 evidence.phase='copying-current-profile-with-native-windows-files';await record();evidence.profileCopy=await capturePrivateProfile(scope.profile,path.join(out,'active-profile'));await writeFile(path.join(out,'private-active-profile.json'),JSON.stringify(evidence.profileCopy,null,2),{flag:'wx'});evidence.profile.profileFiles=evidence.profileCopy.fileCount;delete evidence.profileCopy.manifest;await record();
 evidence.phase='capturing-public-export-family';await record();
 const publicRoot=path.join(os.homedir(),'Agentopia Files');
 let publicPresent=true;try{await stat(publicRoot);}catch(error){if(error.code==='ENOENT')publicPresent=false;else throw error;}
 if(publicPresent){const publicOutputs=await capturePublicOutputs(publicRoot,path.join(out,'public-outputs.tar.gz'),{headroomBytes:headroom});await writeFile(path.join(out,'public-outputs.json'),JSON.stringify(publicOutputs,null,2),{flag:'wx'});evidence.publicOutputs={archive:publicOutputs.destination,sha256:publicOutputs.archiveSha256,files:publicOutputs.fileCount,bytes:publicOutputs.bytes};
  evidence.phase='capturing-portable-public-references';await record();const references=await capturePortablePublicReferences({backupRoot:out,profileRecordFile:path.join(out,'private-active-profile.json'),publicRecordFile:path.join(out,'public-outputs.json'),accountRecordFile:path.join(out,'public-recovery-owners.json'),installedArchive:scope.installedArchive,expectedArchiveSha256:scope.installedArchiveSha256,electronExecutable:path.join(root,'node_modules/electron/dist/electron.exe')});evidence.publicReferences={accounts:references.accounts,references:references.references,receipt:path.join(out,'public-reference-index.json'),record:references.recordFile,recordSha256:references.recordSha256};
 }
 else evidence.publicOutputs={source:publicRoot,absentAtCapture:true,files:0};
 await record();
 const free=await statfs(out),maxCompressedBytes=Math.floor(free.bavail*free.bsize-headroom);assert(maxCompressedBytes>512*1024**2,'The compressed image needs a useful reserved budget');
 evidence.phase='compressing-cold-runtime';evidence.compressionBudget={freeBytes:free.bavail*free.bsize,headroom,maxCompressedBytes};await record();
 const pending=path.join(out,'runtime.vhdx.gz.incomplete'),reader=linuxColdImageReader('Ubuntu',scope.runtimeDiskLinux);readerStarted=true;evidence.sourceBytes=(await reader.inspect()).size;evidence.runtimeImage=await captureCompressedColdImageFromReader(pending,{...reader,maxCompressedBytes});if(!before.running.includes('Ubuntu'))await run(['--terminate','Ubuntu']);readerStarted=false;
 await closed();assert.deepEqual(await list(false),before.registered);assert.deepEqual(await list(true),before.running);assert.deepEqual(await registration(scope.distribution),scope.registry);assert.equal(await hash(scope.locationFile),scope.locationSha256);assert((await statfs(out)).bavail*(await statfs(out)).bsize>=headroom);
 const complete=path.join(out,'runtime.vhdx.gz');await rename(pending,complete);evidence.runtimeImage.file=complete;evidence.success=true;evidence.phase='complete';evidence.knownProfileAndColdDiskCaptured=true;await record();
 await writeFile(path.join(records,'active-private-recovery-current.json'),JSON.stringify({success:true,at:new Date().toISOString(),out,evidence:path.join(out,'evidence.json'),profile:scope.profile,distribution:scope.distribution,coldCompression:'gzip',freshLogicalBackup:backupName,providerRequests:0},null,2));console.log(JSON.stringify({success:true,out,profileFiles:evidence.profile.profileFiles,rawImageBytes:evidence.runtimeImage.rawBytes,compressedImageBytes:evidence.runtimeImage.compressedBytes,providerRequests:0}));
}catch(error){evidence.error=error.stack;await record();throw error;}finally{if(started)await run(['--terminate',scope.distribution]);if(readerStarted&&!before.running.includes('Ubuntu')&&(await list(true)).includes('Ubuntu'))await run(['--terminate','Ubuntu']);}
