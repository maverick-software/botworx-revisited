import {readFile,writeFile,open,stat} from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {desktopOperation} from './operation-lock.mjs';
import {json,hash,run,list,closed,registration} from './phased-backup-control.mjs';

desktopOperation('finish previously verified goal and queue backup export');
const root=path.resolve(import.meta.dirname,'../..');
const candidate=path.join(root,'.supabase/desktop-goal-queue/candidate-04417');
const out=path.join(root,'.supabase/desktop-goal-queue/upgrade-backup-1792341034014');
const file=path.join(out,'evidence.json'),evidence=await json(file),release=await json(path.join(candidate,'release-proof.json'));
assert.equal(evidence.phase,'exporting-cold-database');assert(evidence.capture.success);
assert.equal(evidence.capture.runtime.logicalBackupRoot,'ordinary');assert.equal(evidence.imageSha256,release.imageSha256);
const distribution='AgentopiaRuntime-a91a4800-e08f-4440-a4ec-588762d01bfd';assert.equal(evidence.distribution,distribution);
await closed();assert.deepEqual(await list(true),evidence.before.running);
const bound=await registration(distribution);
assert.equal(path.win32.normalize(bound.path.replace(/^\\\\\?\\/,'')).toLowerCase(),'c:\\users\\charl\\appdata\\roaming\\agentopia\\wsl');
const previousFailure=path.join(out,'first-export-failure.json');
try{await writeFile(previousFailure,await readFile(file),{flag:'wx'});}catch(error){if(error.code!=='EEXIST')throw error;assert.equal((await json(previousFailure)).phase,'exporting-cold-database');}
const image=path.join(out,'runtime-retry2.vhdx');
await run(['--export',distribution,image,'--format','vhd'],600000);
const handle=await open(image,'r');try{const bytes=Buffer.alloc(8);await handle.read(bytes,0,8,0);assert.equal(bytes.toString('ascii'),'vhdxfile');}finally{await handle.close();}
evidence.runtimeImage={file:image,bytes:(await stat(image)).size,sha256:await hash(image)};
assert(evidence.runtimeImage.bytes>1024**3);
await closed();assert.deepEqual(await list(false),evidence.before.registered);assert.deepEqual(await list(true),evidence.before.running);
Object.assign(evidence,{phase:'complete',success:true,error:undefined,exportRecovery:'Retried only the cold export after the first sharing-violation failure; completed captures were retained.'});
await writeFile(file,JSON.stringify(evidence,null,2));
await writeFile(path.join(candidate,'upgrade-backup.json'),JSON.stringify({success:true,at:new Date().toISOString(),out,evidence:file,imageSha256:release.imageSha256,installed:false,productionMigrated:false},null,2),{flag:'wx'});
console.log(JSON.stringify({success:true,out,profiles:evidence.capture.profiles,databaseFiles:evidence.capture.runtime.logicalBackupFiles,coldImageBytes:evidence.runtimeImage.bytes},null,2));
