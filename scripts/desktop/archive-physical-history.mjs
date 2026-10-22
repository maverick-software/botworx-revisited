import {readFile,writeFile,unlink,copyFile,realpath} from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {json,linux,hash,save,run,list,readerRegistration,removeReader} from './phased-backup-control.mjs';

const root=path.resolve(import.meta.dirname,'../..'),parent=path.join(root,'.supabase/desktop-installed-0448'),id=process.argv[2];assert(/^\d{13}$/.test(id));
const out=path.join(parent,'physical-backup-'+id);assert.equal((await realpath(out)).toLowerCase(),out.toLowerCase());
const config=await json(path.join(out,'intent.json')),core=await json(path.join(out,'core-evidence.json'));
assert(config.format===2&&core.currentSnapshotComplete&&!core.fullBackupComplete);
assert(core.core?.scope!=='recoverable-profile-data','This all-files archival prototype is not part of the recoverable-data backup workflow. Historical copies remain intact in place.');
if(!process.argv.includes('--execute')){console.log(JSON.stringify({executed:false,currentSnapshotComplete:true,fullBackupComplete:false,source:out}));process.exit(0);}
const lock=path.join(out,'archive-operation-lock.json');let existing;try{existing=await json(lock);}catch(error){if(error.code!=='ENOENT')throw error;}
if(existing){let live=true;try{process.kill(existing.pid,0);}catch(error){if(error.code==='ESRCH')live=false;else throw error;}assert(!live,'This historical archive controller is still live.');await unlink(lock);}
await writeFile(lock,JSON.stringify({pid:process.pid,operation:'immutable historical archival',source:out}),{flag:'wx'});
process.on('exit',()=>{try{const fs=process.getBuiltinModule('fs');if(JSON.parse(fs.readFileSync(lock,'utf8')).pid===process.pid)fs.unlinkSync(lock);}catch{}});
await copyFile(path.join(root,'scripts/desktop/archive-physical-history.mjs'),path.join(out,'archive-controller-'+Date.now()+'.mjs'));
await readerRegistration(config,out);assert(!(await list(true)).includes('AgentopiaRuntime'));
assert.equal(await hash(path.join(out,'private-work-inventory.json')),core.inventorySha256);
assert.equal(await hash(core.runtimeImage.file),core.runtimeImage.sha256);
const evidence={format:2,phase:'archiving-history',at:new Date().toISOString(),currentSnapshotComplete:true,fullBackupComplete:false,source:out,instanceId:config.instanceId,distribution:config.distribution,providerRequests:0,productionMigrated:false,installed:false};
const record=path.join(out,'full-evidence.json');await save(record,evidence);let complete=false;
try{
 await run(['-d',config.reader.distribution,'-u','agentopia','--exec','python3',linux(path.join(out,'phased_backup.py')),'archives',linux(out)],0);
 evidence.archives=await json(path.join(out,'archive-evidence.json'));assert(evidence.archives.success);
 assert.equal(await hash(core.runtimeImage.file),core.runtimeImage.sha256);
 assert.equal(await hash(path.join(out,evidence.archives.restorationIndex)),evidence.archives.restorationIndexSha256);
 await removeReader(config,out);complete=true;
 Object.assign(evidence,{phase:'completed',fullBackupComplete:true,files:{success:true,files:Object.fromEntries(Object.entries(evidence.archives.counts).map(([label,value])=>[label,value.files])),bytes:Object.fromEntries(Object.entries(evidence.archives.counts).map(([label,value])=>[label,value.bytes]))},image:core.runtimeImage,readerRemoved:true,completedAt:new Date().toISOString(),success:true});
 await save(record,evidence);
 await save(path.join(parent,'latest-backup.json'),{format:2,success:true,physicalProfiles:true,storage:'tar-fragments',currentSnapshotComplete:true,fullBackupComplete:true,evidence:record,coreEvidence:path.join(out,'core-evidence.json'),coreArchive:path.join(out,'ordinary-current.tar'),restorationIndex:path.join(out,evidence.archives.restorationIndex),restorationIndexSha256:evidence.archives.restorationIndexSha256,runtimeImage:core.runtimeImage,files:evidence.files.files,bytes:evidence.files.bytes,roots:config.roots,installed:false,productionMigrated:false});
 console.log(JSON.stringify({success:true,evidence:record,fullBackupComplete:true,parts:evidence.archives.parts,files:evidence.files.files,readerRemoved:true,providerRequests:0}));
}catch(error){evidence.error=error.message;await save(record,evidence);throw Error('Historical archive stopped; inspect '+record,{cause:error});}
finally{if(!complete){await readerRegistration(config,out);if((await list(true)).includes(config.reader.distribution))await run(['--terminate',config.reader.distribution]);evidence.failedReaderStopped=true;await save(record,evidence);}}
