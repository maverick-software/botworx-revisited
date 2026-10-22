// Permit the windowless storage reader to inspect one sealed, unpublished
// migration target. The ordinary QA-only restriction remains the default.
import {readFile,lstat,realpath,access} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import {closed} from './phased-backup-control.mjs';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const same=(a,b)=>path.win32.normalize(a).toLowerCase()===path.win32.normalize(b).toLowerCase();
const windows=value=>value.startsWith('/mnt/')?value[5].toUpperCase()+':\\'+value.slice(7).replaceAll('/','\\'):value;
export function validateMigrationStorageAuthority(cfg,plan,stage,copy,home){
 assert(!cfg.seed&&!cfg.writeProbe&&!cfg.exerciseGuard,'A real staged profile permits read-only storage checks');
 assert(plan.format===1&&same(plan.windowsHome,home));
 const source=path.win32.join(home,'AppData/Roaming/Agentopia'),target=path.win32.join(home,'.agentopia/desktop/profile');
 assert(same(plan.source,source)&&same(plan.target,target)&&same(cfg.profile,target));
 assert(/^\d+\.\d+\.\d+$/.test(plan.targetVersion));
 assert(same(plan.installedArchive,path.win32.join(home,'AppData/Local/AgentopiaDesktop','app-'+plan.targetVersion,'resources/app.asar')));
 assert(plan.installedArchiveSha256===cfg.imageSha256&&/^[a-f0-9]{64}$/.test(cfg.imageSha256));
 assert(/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(plan.runtimeInstanceId));
 assert(stage.success&&stage.phase==='staged-awaiting-encryption-and-native-read-validation'&&stage.activated===false&&stage.providerRequests===0&&stage.nativeRebase?.success);
 assert(same(stage.source,source)&&same(stage.target,target)&&stage.runtimeInstanceId===plan.runtimeInstanceId);
 assert(stage.copyEvidenceSha256===plan.copyEvidenceSha256&&stage.sourceSealSha256===plan.sourceSealSha256);
 assert(copy.success&&copy.phase==='completed'&&copy.files>0&&same(windows(copy.source),source)&&same(windows(copy.destination),target));
}
export async function authorizeStorageProfile(cfg){
 const ownProfiles=path.join(path.resolve(cfg.out),'profiles')+path.sep;
 if(path.resolve(cfg.profile).startsWith(ownProfiles))return;
 assert(typeof cfg.migrationPlanFile==='string'&&/^[a-f0-9]{64}$/.test(cfg.migrationPlanSha256??''),'A sealed migration plan is required outside QA profiles');
 const owned=path.resolve('C:/Users/charl/AgentopiaQA/production-profile47'),planFile=path.resolve(cfg.migrationPlanFile),job=path.dirname(planFile);
 assert.equal(path.dirname(job),owned);assert(/^\d{13}$/.test(path.basename(job)));assert.equal(path.basename(planFile),'plan.json');
 async function checked(file,expected){const info=await lstat(file);assert(info.isFile()&&!info.isSymbolicLink()&&info.nlink===1);assert(same(await realpath(file),path.resolve(file)));const bytes=await readFile(file);assert.equal(sha(bytes),expected);return JSON.parse(bytes);}
 const plan=await checked(planFile,cfg.migrationPlanSha256);assert(same(plan.out,path.join(job,'stage')));
 assert(same(plan.stageEvidence,path.join(plan.out,'stage-evidence.json'))&&same(plan.copyEvidence,path.join(plan.out,'copy-evidence.json'))&&same(plan.sourceSeal,path.join(plan.out,'source-seal.json')));
 const stage=await checked(plan.stageEvidence,plan.stageEvidenceSha256),copy=await checked(plan.copyEvidence,plan.copyEvidenceSha256);
 await checked(plan.sourceSeal,plan.sourceSealSha256);
 validateMigrationStorageAuthority(cfg,plan,stage,copy,os.homedir());
 assert(same(await realpath(cfg.profile),path.resolve(cfg.profile)));
 for(const name of ['credentials.bin','Local State','runtime-binding.json']){const file=path.join(cfg.profile,name),info=await lstat(file);assert(info.isFile()&&!info.isSymbolicLink()&&info.nlink===1&&same(await realpath(file),file));}
 for(const file of [path.join(cfg.profile,'profile-migration.json'),path.join(path.dirname(cfg.profile),'profile-location.json'),path.join(path.dirname(cfg.profile),'migration.lock')]){await assert.rejects(access(file),error=>error.code==='ENOENT','The staged profile must remain unpublished');}
 const binding=JSON.parse(await readFile(path.join(cfg.profile,'runtime-binding.json'),'utf8'));
 assert(binding.format===1&&binding.instanceId===plan.runtimeInstanceId&&binding.distribution==='AgentopiaRuntime-'+plan.runtimeInstanceId);
 await closed();
}
