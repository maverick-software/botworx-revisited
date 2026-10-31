import {readFileSync,lstatSync,realpathSync} from 'node:fs';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {parseRuntimeBinding} from './runtime-binding';

export type ProfileLocationIO={
 realpath:(value:string)=>string;
 inspect:(value:string)=>{isFile:()=>boolean;isDirectory:()=>boolean;isSymbolicLink:()=>boolean;nlink:number;size:number};
 readFile:(value:string)=>string;
};
const nativeIO:ProfileLocationIO={realpath:value=>realpathSync.native(value),inspect:value=>lstatSync(value),readFile:value=>readFileSync(value,'utf8')};
const equal=(a:string,b:string)=>path.win32.normalize(a).toLowerCase()===path.win32.normalize(b).toLowerCase();
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const invalid=()=>new Error('The verified Windows profile migration is incomplete or its physical storage no longer matches this installation. Restore its verified profile and migration record before reopening.');

/** One reserved private root, also valid as a portable backup's source label. */
export function relocatedProfileRoot(value:string){
 const match=/^[a-z]:\\Sylvana-Data\\profiles\\([a-f0-9-]{36})\\profile$/i.exec(value);
 return !!match&&uuid.test(match[1].toLowerCase());
}

// A location record is published only after copying and verifying a closed
// profile. Format 1 keeps the original outside-AppData layout. Format 2 binds
// one canonical local-drive private folder to the same runtime and Windows home.
// This path is outside AppData, whose individual files can be redirected even
// when realpath(directory) reports the ordinary Windows directory.
export function migratedDesktopProfile(exe:string,home:string|undefined,io:ProfileLocationIO=nativeIO):string|undefined{
 if(!home||!path.win32.isAbsolute(home)||home.startsWith('\\\\'))return;
 const installation=/^([a-z]:\\.+?\\AppData\\Local\\SylvanaDesktop)\\app-\d+\.\d+\.\d+(?:-[a-z0-9.-]+)?\\Sylvana\.exe$/i.exec(path.win32.normalize(exe));
 if(!installation)return;
 const directory=path.win32.join(io.realpath(home),'.sylvana','desktop'),recordFile=path.win32.join(directory,'profile-location.json');
 // Activation owns this cross-profile lock before its final stopped-process
 // check. A new launch must not open either store while selection is changing.
 try{io.inspect(path.win32.join(directory,'migration.lock'));throw invalid();}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw invalid();}
 let recordStat;try{recordStat=io.inspect(recordFile);}catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')return;throw invalid();}
 function directoryChecked(value:string){const st=io.inspect(value);if(!st.isDirectory()||st.isSymbolicLink()||!equal(io.realpath(value),value))throw invalid();}
 function fileChecked(value:string,maximum:number){const st=io.inspect(value);if(!st.isFile()||st.isSymbolicLink()||st.nlink!==1||st.size>maximum||!equal(io.realpath(value),value))throw invalid();return io.readFile(value);}
 try{
  if(!recordStat.isFile())throw invalid();directoryChecked(directory);
  const record=JSON.parse(fileChecked(recordFile,4096)) as Record<string,unknown>;
  if(Object.keys(record).sort().join(',')!=='format,installationRoot,kind,migrationSha256,profile,runtimeInstanceId'||![1,2,3,4].includes(record.format as number)||record.kind!=='verified-profile-migration'||typeof record.installationRoot!=='string'||!equal(record.installationRoot,installation[1])||typeof record.runtimeInstanceId!=='string'||!uuid.test(record.runtimeInstanceId)||typeof record.migrationSha256!=='string'||!/^[a-f0-9]{64}$/.test(record.migrationSha256))throw invalid();
  const original=path.win32.join(directory,'profile');let profile=original;
  if(record.format===1){if(record.profile!=='profile')throw invalid();}
  else{
   // Fixed private layout keeps inactive and other-account stores excluded by
   // file tools, even when they are not the currently selected userData folder.
   if(typeof record.profile!=='string'||!relocatedProfileRoot(record.profile))throw invalid();
   const expected=path.win32.join(record.profile.slice(0,3),'Sylvana-Data','profiles',record.runtimeInstanceId,'profile');
   if(!equal(record.profile,expected))throw invalid();profile=record.profile;
  }
  directoryChecked(profile);
  const receipt=fileChecked(path.win32.join(profile,'profile-migration.json'),4*1024*1024);
  if(createHash('sha256').update(receipt).digest('hex')!==record.migrationSha256)throw invalid();
  const migration=JSON.parse(receipt);
  if(record.format===4){
   const archive=fileChecked(path.win32.join(profile,'previous-profile-archive.json'),1024*1024);
   if(migration?.format!==4||migration.kind!=='verified-fresh-profile'||migration.status!=='complete'||migration.encryptedStorageVerified!==true||migration.runtimeInstanceId!==record.runtimeInstanceId||!equal(migration.destination,profile)||!relocatedProfileRoot(migration.archivedProfile)||equal(migration.archivedProfile,profile)||createHash('sha256').update(archive).digest('hex')!==migration.archiveReceiptSha256)throw invalid();
   const receipt=JSON.parse(archive);if(receipt.status!=='verified-archive'||!equal(receipt.profile,migration.archivedProfile)||typeof receipt.databaseManifestSha256!=='string'||!/^[a-f0-9]{64}$/.test(receipt.databaseManifestSha256)||typeof receipt.profileArchiveSha256!=='string'||!/^[a-f0-9]{64}$/.test(receipt.profileArchiveSha256))throw invalid();
  }else{
  if(migration?.format!==record.format||migration.status!=='complete'||migration.encryptedStorageVerified!==true||migration.nativeHistoryVerified!==true||!Number.isSafeInteger(migration.files)||migration.files<1||typeof migration.copyManifestSha256!=='string'||!/^[a-f0-9]{64}$/.test(migration.copyManifestSha256))throw invalid();
  if(record.format===3&&(migration.kind!=='verified-brand-migration'||migration.runtimeInstanceId!==record.runtimeInstanceId||typeof migration.destination!=='string'||!equal(migration.destination,profile)||typeof migration.priorMigrationSha256!=='string'||!/^[a-f0-9]{64}$/.test(migration.priorMigrationSha256)))throw invalid();
  if(record.format===2&&(migration.kind!=='verified-profile-relocation'||typeof migration.source!=='string'||!equal(migration.source,original)||typeof migration.destination!=='string'||!equal(migration.destination,profile)||migration.runtimeInstanceId!==record.runtimeInstanceId||typeof migration.priorMigrationSha256!=='string'||!/^[a-f0-9]{64}$/.test(migration.priorMigrationSha256)))throw invalid();
  }
  const binding=parseRuntimeBinding(JSON.parse(fileChecked(path.win32.join(profile,'runtime-binding.json'),4096)));
  if(binding.instanceId!==record.runtimeInstanceId)throw invalid();
  return profile;
 }catch{throw invalid();}
}
