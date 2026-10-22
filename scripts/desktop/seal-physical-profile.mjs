import {mkdir,readFile,copyFile,readdir,realpath,open,stat,rename} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import path from 'node:path';
import assert from 'node:assert/strict';
import {desktopOperation} from './operation-lock.mjs';
import {json,linux,hash,save,run,list,closed,registration,readerRegistration,removeReader,controlSelfTest} from './phased-backup-control.mjs';

const root=path.resolve(import.meta.dirname,'../..'),parent=path.join(root,'.supabase/desktop-installed-0448');
if(process.argv.includes('--self-test')){console.log(JSON.stringify(controlSelfTest()));process.exit(0);}
const oldId=process.argv[2];assert(/^\d{13}$/.test(oldId));
const prior=path.join(parent,'physical-backup-'+oldId),legacy=await json(path.join(prior,'intent.json'));
assert.equal((await realpath(prior)).toLowerCase(),prior.toLowerCase());
assert.equal(legacy.distribution,'AgentopiaRuntime-a91a4800-e08f-4440-a4ec-588762d01bfd');
assert.equal(legacy.roots.ordinary.windows.toLowerCase(),'c:\\users\\charl\\appdata\\roaming\\agentopia');
controlSelfTest();
if(!process.argv.includes('--execute')){console.log(JSON.stringify({executed:false,design:'Two-stage full backup; no files omitted',source:prior,utilityAndOwnershipTests:true,requiresTerminalOriginalJob:true,appMayReopen:false}));process.exit(0);}
desktopOperation('seal the closed current profile and cold database disk');
const resumes=(await readdir(prior)).filter(name=>/^resume-\d{13}\.json$/.test(name)).sort();assert(resumes.length);
const terminal=await json(path.join(prior,resumes.at(-1)));assert(!terminal.success&&terminal.error,'The original resume must have a terminal inspected failure.');
await closed();const before={registered:await list(false),running:await list(true)};
assert.deepEqual(before.registered,legacy.before.registered);assert.deepEqual(before.running,legacy.before.running);
assert(!before.running.includes(legacy.distribution)&&!before.running.includes('AgentopiaRuntime'));
const original=await registration(legacy.distribution);
assert.equal(path.win32.normalize(original.path.replace(/^\\\\\?\\/,'' )).toLowerCase(),path.join(legacy.roots.ordinary.windows,'wsl').toLowerCase());assert.equal(original.version,2);
const resumeIndex=process.argv.indexOf('--resume-seal'),resumeId=resumeIndex>=0?process.argv[resumeIndex+1]:null;
if(resumeIndex>=0)assert(/^\d{13}$/.test(resumeId??''));
const out=path.join(parent,'physical-backup-'+(resumeId??Date.now()));
if(!resumeId)await mkdir(out);assert.equal((await realpath(out)).toLowerCase(),out.toLowerCase());
const readerId=resumeId?(await json(path.join(out,'intent.json'))).reader.instanceId:randomUUID();
const config=resumeId?await json(path.join(out,'intent.json')):{...legacy,format:2,out,before,previousPartial:prior,
 reader:{distribution:'AgentopiaBackupReader-'+readerId,instanceId:readerId,storage:path.join(out,'reader-runtime')},
 profileStorage:'tar-fragments',currentSnapshotComplete:false,fullBackupComplete:false};
assert(config.format===2&&config.previousPartial===prior&&config.distribution===legacy.distribution&&config.instanceId===legacy.instanceId);assert.deepEqual(config.before,before);
let previous;
if(resumeId){
 previous=await json(path.join(out,'core-evidence.json'));assert(['exporting-cold-disk','sealing-current-profile'].includes(previous.phase)&&previous.error&&!previous.currentSnapshotComplete);
 await copyFile(path.join(out,'core-evidence.json'),path.join(out,'core-before-resume-'+Date.now()+'.json'));await copyFile(path.join(root,'scripts/desktop/seal-physical-profile.mjs'),path.join(out,'seal-controller-resume-'+Date.now()+'.mjs'));
 if(previous.phase==='sealing-current-profile'){
  assert(!before.registered.includes(config.reader.distribution));
  const saved=path.join(out,'supervisor-before-data-policy-'+Date.now());await mkdir(saved);
  for(const name of ['profile_archive.py','phased_backup.py']){await copyFile(path.join(out,name),path.join(saved,name));await copyFile(path.join(root,'scripts/desktop',name),path.join(out,name));}
  for(const name of ['ordinary-current.tar','overlay-current.tar']){const file=path.join(out,name);try{await stat(file);await rename(file,path.join(out,'incomplete-'+Date.now()+'-'+name));}catch(error){if(error.code!=='ENOENT')throw error;}}
 }
}
else{for(const name of ['profile_archive.py','phased_backup.py','phased-backup-control.mjs','seal-physical-profile.mjs'])await copyFile(path.join(root,'scripts/desktop',name),path.join(out,name));await save(path.join(out,'intent.json'),config);}
const update=await json(path.join(root,'.supabase/desktop-maintenance-0437/update.json'));
const resources=path.join(path.dirname(update.installedExecutable),'resources/resources'),archive=path.join(resources,'runtime.tar.gz');
for(const file of [archive,path.join(resources,'runtime.sha256')])assert.equal((await realpath(file)).toLowerCase(),file.toLowerCase());
assert.equal(await hash(archive),(await readFile(path.join(resources,'runtime.sha256'),'utf8')).trim());
const evidence={format:2,phase:'prepared',at:new Date().toISOString(),currentSnapshotComplete:false,fullBackupComplete:false,appMayReopen:false,
 source:out,instanceId:config.instanceId,distribution:config.distribution,reader:config.reader,providerRequests:0,productionMigrated:false,installed:false,before};
if(previous)evidence.previousExportError=previous.error;
const record=path.join(out,'core-evidence.json');await save(record,evidence);
let productionStarted=false,readerImported=false,complete=false;
try{
 const image=path.join(out,'runtime.vhdx');
 if(resumeId){
  evidence.runtimeFiles=await json(path.join(out,'runtime-capture.json'));assert(evidence.runtimeFiles.success&&evidence.runtimeFiles.criticalFiles===6);
  const manifest=await json(path.join(out,'current-database-backup/manifest.json'));
  for(const item of manifest.files){assert.equal(path.basename(item.name),item.name);assert.equal(await hash(path.join(out,'current-database-backup',item.name)),item.sha256);}
  const exported=await json(path.join(out,'export-evidence.json'));assert(exported.success&&exported.sourceStopped);assert.equal(path.normalize(exported.image.file),image);assert.equal(await hash(image),exported.image.sha256);evidence.runtimeImage={...exported.image,file:image};
 }else{
 evidence.phase='recording-cold-runtime-files';await save(record,evidence);productionStarted=true;
 evidence.runtimeFiles=JSON.parse(await run(['-d',config.distribution,'-u','agentopia','--exec','python3',linux(path.join(out,'phased_backup.py')),'runtime',linux(out)]));
 await closed();await run(['--terminate',config.distribution]);productionStarted=false;
 assert.deepEqual(await list(true),before.running);
 evidence.phase='exporting-cold-disk';await save(record,evidence);await new Promise(resolve=>setTimeout(resolve,2000));
 await run(['--export',config.distribution,image,'--format','vhd'],600000);
 const handle=await open(image,'r');try{const bytes=Buffer.alloc(8);assert.equal((await handle.read(bytes,0,8,0)).bytesRead,8);assert.equal(bytes.toString('ascii'),'vhdxfile');}finally{await handle.close();}
 evidence.runtimeImage={file:image,bytes:(await stat(image)).size,sha256:await hash(image),sourceDistribution:config.distribution};assert(evidence.runtimeImage.bytes>1024**3);
 }
 evidence.phase='importing-filesystem-reader';await save(record,evidence);await closed();
 await run(['--import',config.reader.distribution,config.reader.storage,archive,'--version','2'],600000);readerImported=true;
 await readerRegistration(config,out);
 await run(['-d',config.reader.distribution,'-u','root','--exec','python3','-c',"from pathlib import Path;assert Path('/opt/agentopia/runtime-identity').read_text().strip()=='local.agentopia.desktop-runtime.v1';assert not list(Path('/home/agentopia/.supabase/stacks').glob('*'));Path('/opt/agentopia/runtime-instance').write_text("+JSON.stringify(readerId)+")"]);
 evidence.phase='sealing-current-profile';await save(record,evidence);
 evidence.core=JSON.parse(await run(['-d',config.reader.distribution,'-u','agentopia','--exec','python3',linux(path.join(out,'phased_backup.py')),'core',linux(out)],0));
 assert(evidence.core.success);await closed();
 await readerRegistration(config,out);assert.deepEqual(await list(false),[...before.registered,config.reader.distribution].sort());assert.deepEqual(await list(true),[...before.running,config.reader.distribution].sort());
 assert.equal(await hash(image),evidence.runtimeImage.sha256);
 if(evidence.core.scope==='recoverable-profile-data'){await removeReader(config,out);readerImported=false;evidence.readerRemoved=true;assert.deepEqual(await list(false),before.registered);assert.deepEqual(await list(true),before.running);}
 Object.assign(evidence,{phase:'current-snapshot-sealed',currentSnapshotComplete:true,fullBackupComplete:false,scope:evidence.core.scope,dataPolicy:evidence.core.dataPolicy,coreArchiveSha256:evidence.core.coreArchiveSha256,profileArchiveHashes:evidence.core.profileArchiveHashes,inventoryFile:evidence.core.inventoryFile,inventorySha256:evidence.core.inventorySha256,sealedAt:new Date().toISOString(),appMayReopen:false,pending:'Cold-image import check before reopening; historical and generated-data archival remains incomplete and is outside current recoverable profile data.'});
 await save(record,evidence);await save(path.join(parent,'latest-core-backup.json'),{...evidence,evidence:record});complete=true;
 console.log(JSON.stringify({success:true,scope:'Current snapshot only; historical archival incomplete',evidence:record,currentSnapshotComplete:true,fullBackupComplete:false,appMayReopen:false,providerRequests:0,reader:config.reader.distribution}));
}catch(error){evidence.error=error.message;await save(record,evidence);throw Error('Current-profile seal stopped; inspect '+record,{cause:error});}
finally{
 if(productionStarted){try{await closed();await run(['--terminate',config.distribution]);}catch(error){evidence.productionCleanupError=error.message;await save(record,evidence);}}
 if(!complete&&(readerImported||(await list(false)).includes(config.reader.distribution))){await removeReader(config,out);evidence.failedReaderRemoved=true;await save(record,evidence);}
}
