// Use the installed selector and registered runtime, rather than joining userData/wsl.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {extractFile} from '@electron/asar';
import path from 'node:path';
import assert from 'node:assert/strict';
import {registration,linux} from './phased-backup-control.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex');
const canonical=value=>path.win32.normalize(value.startsWith(String.fromCharCode(92,92,63,92))?value.slice(4):value).toLowerCase();
export function validateRegisteredRecoveryRuntime(profile,binding,found,home){
 const active=path.win32.join(home,'.agentopia/desktop/profile');assert.equal(canonical(profile),canonical(active),'Recovery must capture the published private profile');
 assert(binding.format===1&&/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(binding.instanceId));
 assert.equal(binding.distribution,'AgentopiaRuntime-'+binding.instanceId);assert.equal(found.name,binding.distribution);assert.equal(found.version,2);
 const legacy=path.win32.join(home,'AppData/Roaming/Agentopia/wsl'),privateDisk=path.win32.join(active,'wsl'),base=canonical(found.path);assert([canonical(legacy),canonical(privateDisk)].includes(base),'The registered runtime is outside the owned production roots');
 const storage=base===canonical(legacy)?legacy:privateDisk;
 return {profile:active,backupRoot:path.win32.join(active,'backups'),instanceId:binding.instanceId,distribution:binding.distribution,runtimeStorage:storage,runtimeDisk:path.win32.join(storage,'ext4.vhdx'),runtimeDiskLinux:linux(path.win32.join(storage,'ext4.vhdx')),runtimeRetainedOutsideProfile:base!==canonical(privateDisk)};
}
export async function discoverActiveRecoveryScope({archive,expectedArchiveSha256,home,work}){
 assert(path.win32.isAbsolute(home)&&path.win32.isAbsolute(archive)&&/^[a-f0-9]{64}$/.test(expectedArchiveSha256));assert.equal(sha(await readFile(archive)),expectedArchiveSha256);
 const library=path.join(work,'installed-selector');await mkdir(library,{recursive:true});await writeFile(path.join(library,'package.json'),'{"type":"commonjs"}',{flag:'wx'});const modules={};
 for(const name of ['desktop-profile-location.js','runtime-binding.js']){const data=extractFile(archive,'build/'+name);await writeFile(path.join(library,name),data,{flag:'wx'});modules[name]=sha(data);}
 const {migratedDesktopProfile}=createRequire(import.meta.url)(path.join(library,'desktop-profile-location.js')),exe=path.join(path.dirname(path.dirname(archive)),'Agentopia.exe');
 const profile=migratedDesktopProfile(exe,home);assert(profile,'A verified published profile is required for this recovery path');
 const binding=JSON.parse(await readFile(path.join(profile,'runtime-binding.json'),'utf8')),found=await registration(binding.distribution),scope=validateRegisteredRecoveryRuntime(profile,binding,found,home);
 const locationFile=path.join(path.dirname(profile),'profile-location.json'),location=await readFile(locationFile),migration=await readFile(path.join(profile,'profile-migration.json'));
 const record=JSON.parse(location);assert.equal(record.runtimeInstanceId,binding.instanceId);assert.equal(record.migrationSha256,sha(migration));
 return {...scope,installedArchive:archive,installedArchiveSha256:expectedArchiveSha256,selectorModules:modules,locationFile,locationSha256:sha(location),migrationReceiptSha256:sha(migration),registry:found,source:'Actual installed selector plus the matching WSL2 registry binding',providerRequests:0};
}
