// Read-only binding of a maintenance capture to the published private profile.
import assert from 'node:assert/strict';
import {readFile,lstat,realpath} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
const native={readFile:file=>readFile(file),inspect:file=>lstat(file),realpath:file=>realpath(file)};
const same=(a,b)=>path.win32.normalize(a).toLowerCase()===path.win32.normalize(b).toLowerCase();
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
export async function assertRelocatedMaintenanceSource(cfg,io=native){
 const directory=path.join(cfg.sourceHome,'.agentopia/desktop'),original=path.join(directory,'profile');
 const canonical=async value=>assert(same(await io.realpath(value),value),'Private profile storage resolves elsewhere');
 const read=async(file,maximum)=>{
  const info=await io.inspect(file);assert(info.isFile()&&!info.isSymbolicLink()&&info.nlink===1&&info.size<=maximum,'Private profile metadata is linked or oversized');await canonical(file);return Buffer.from(await io.readFile(file));
 };
 const base=await io.inspect(directory);assert(base.isDirectory()&&!base.isSymbolicLink());await canonical(directory);
 const location=JSON.parse(await read(path.join(directory,'profile-location.json'),4096));
 assert.equal(Object.keys(location).sort().join(','),'format,installationRoot,kind,migrationSha256,profile,runtimeInstanceId');
 assert(location.format===2&&location.kind==='verified-profile-migration'&&typeof location.runtimeInstanceId==='string'&&uuid.test(location.runtimeInstanceId));
 assert(typeof location.installationRoot==='string'&&same(location.installationRoot,path.join(cfg.sourceHome,'AppData/Local/AgentopiaDesktop')),'The location belongs to another Windows installation');
 assert(typeof location.profile==='string'&&/^[a-z]:\\Agentopia-Data\\profiles\\[a-f0-9-]{36}\\profile$/i.test(location.profile));
 assert(same(location.profile,path.win32.join(location.profile.slice(0,3),'Agentopia-Data/profiles',location.runtimeInstanceId,'profile'))&&same(location.profile,cfg.sourceProfile),'The capture does not match the published profile');
 const target=await io.inspect(cfg.sourceProfile);assert(target.isDirectory()&&!target.isSymbolicLink());await canonical(cfg.sourceProfile);
 const bytes=await read(path.join(cfg.sourceProfile,'profile-migration.json'),4*1024**2),migration=JSON.parse(bytes);
 assert(typeof location.migrationSha256==='string'&&/^[a-f0-9]{64}$/.test(location.migrationSha256)&&digest(bytes)===location.migrationSha256);
 assert(migration.format===2&&migration.kind==='verified-profile-relocation'&&migration.status==='complete'&&migration.runtimeInstanceId===location.runtimeInstanceId);
 assert(typeof migration.source==='string'&&same(migration.source,original)&&typeof migration.destination==='string'&&same(migration.destination,cfg.sourceProfile));
 assert(migration.encryptedStorageVerified===true&&migration.nativeHistoryVerified===true&&Number.isSafeInteger(migration.files)&&migration.files>0);
 for(const key of ['copyManifestSha256','priorMigrationSha256'])assert(typeof migration[key]==='string'&&/^[a-f0-9]{64}$/.test(migration[key]));
 const binding=JSON.parse(await read(path.join(cfg.sourceProfile,'runtime-binding.json'),4096));assert.deepEqual(binding,{format:1,distribution:'AgentopiaRuntime-'+location.runtimeInstanceId,instanceId:location.runtimeInstanceId});
 return {profile:location.profile,runtimeInstanceId:location.runtimeInstanceId,selectorSha256:digest(await read(path.join(directory,'profile-location.json'),4096))};
}
