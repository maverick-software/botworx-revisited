import path from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {mkdir,lstat,readFile,writeFile,copyFile,rename,realpath} from 'node:fs/promises';
import {Secrets} from './secrets';
import {WorkspaceFiles} from './workspace';
import {AttachmentImages} from './attachment-images';
import {nativeOutputDirectory} from './native-output-path';
import {scheduledWorkspaceDirectory} from './scheduled-workspaces';
import {captureProfileWorkspacePayload} from './profile-workspace-backup';
import {createPortableBackup} from './portable-backup';
import {readPortableSettings} from './portable-settings';
import {backupDirectory,backupHash} from './backup-archives';
import {protectBackupFolder} from './backup-private-folder';
import {storageWithin} from './storage-files';
import {profileRecoveryDirectory,prepareProfileRecoveryDirectory} from './profile-recovery-directory';

const sha=(value:string|Buffer)=>createHash('sha256').update(value).digest('hex'),same=(a:string,b:string)=>process.platform==='win32'?a.toLowerCase()===b.toLowerCase():a===b;
const databaseNames=['auth.dump','application.dump','vault.dump','pgsodium_root.key','database.dump','recovery.dump'];
export const upgradeRecoveryDirectory=profileRecoveryDirectory;
type Options={profile:string;home:string;databaseBackup:string;restoreHelper:string;privatePaths:string[];progress?:(message:string)=>void;signal?:AbortSignal;gitExecutable?:string;reserveBytes?:number};
async function file(file:string,maximum:number){
 try{const before=await lstat(file);if(!before.isFile()||before.isSymbolicLink()||before.nlink!==1||before.size>maximum||!same(await realpath(file),file))throw Error('An upgrade recovery source is linked or invalid.');const bytes=await readFile(file),after=await lstat(file);if(before.ino!==after.ino||before.size!==after.size||before.mtimeMs!==after.mtimeMs)throw Error('An upgrade recovery source changed while reading it.');return bytes;}catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')return;throw error;}
}
/** Called during startup, before Broker construction or database provisioning.
 * The existing database/native directory remains the public backup location. */
export async function captureAutomaticUpgradeRecovery(options:Options){
 const {profile,home,databaseBackup}=options,signal=options.signal??AbortSignal.timeout(15*60000);
 if(!path.isAbsolute(profile)||!path.isAbsolute(home)||!same(path.dirname(databaseBackup),path.join(profile,'backups')))throw Error('Use this installation’s owned database backup.');await backupDirectory(profile);await backupDirectory(databaseBackup);
 const credentials=await file(path.join(profile,'credentials.bin'),64*1024**2),localState=await file(path.join(profile,'Local State'),32*1024**2),keyId=(bytes:Buffer|undefined)=>bytes?sha(JSON.stringify(JSON.parse(bytes.toString('utf8')).os_crypt??null)):null;
 if(credentials&&!localState)throw Error('The saved Windows credentials are missing their matching Local State. Preserve the profile before upgrading.');const key=keyId(localState),manifestBytes=await file(path.join(databaseBackup,'manifest.json'),16*1024**2);if(!manifestBytes)throw Error('The upgrade database snapshot is missing.');const manifest=JSON.parse(manifestBytes.toString('utf8'));
 if(manifest.format!==1||!Array.isArray(manifest.files)||manifest.files.some((row:any)=>!databaseNames.includes(row.name)||!/^[a-f0-9]{64}$/.test(row.sha256))||new Set(manifest.files.map((row:any)=>row.name)).size!==manifest.files.length)throw Error('The upgrade database manifest is invalid.');
 const verify=async()=>{signal.throwIfAborted();const current=await file(path.join(profile,'credentials.bin'),64*1024**2);if((current?sha(current):null)!==(credentials?sha(credentials):null)||keyId(await file(path.join(profile,'Local State'),32*1024**2))!==key||await backupHash(path.join(databaseBackup,'manifest.json'))!==sha(manifestBytes))throw Error('The original upgrade recovery profile or database snapshot changed.');};await verify();
 const secrets=new Secrets(profile);await secrets.load();await verify();const family=await prepareProfileRecoveryDirectory(profile,verify);
 const publicRoot=path.join(home,'Sylvana Files'),outputDirectory=nativeOutputDirectory(profile,home),workspaceRoot=scheduledWorkspaceDirectory(profile,outputDirectory),files=new WorkspaceFiles(secrets,undefined,[profile,family,...options.privatePaths]),images=new AttachmentImages(path.join(profile,'attachments')),external=new Map<string,{owner:string;reference:unknown}>();let last=0;
 const guard=async()=>{signal.throwIfAborted();if(Date.now()-last>500){await verify();last=Date.now();}};
 const references=(account:string)=>structuredClone(files.list(account)).filter(reference=>{const included=reference.source==='clipboard'||storageWithin(publicRoot,reference.path)||storageWithin(workspaceRoot,reference.path);if(!included)external.set(account+':'+reference.id,{owner:account,reference});return included;});
 let temporary:string|undefined;
 try{
  const result=await createPortableBackup({parent:family,windowsCredentials:process.platform==='win32',minimumRecoveryCapability:17,name:'upgrade-'+randomUUID(),profile,publicRoot,restoreHelper:options.restoreHelper,reserveBytes:options.reserveBytes,progress:options.progress,database:async destination=>{await mkdir(destination);for(const row of manifest.files){await guard();const source=path.join(databaseBackup,row.name);const info=await lstat(source);if(!info.isFile()||info.isSymbolicLink()||info.nlink!==1||!same(await realpath(source),source)||await backupHash(source)!==row.sha256)throw Error('An upgrade database resource changed.');await copyFile(source,path.join(destination,row.name));}await writeFile(path.join(destination,'manifest.json'),manifestBytes,{flag:'wx',mode:0o600});},references,image:(account,id)=>images.read(account,id),settings:account=>readPortableSettings(secrets,account),panes:account=>secrets.workspaceLayouts(account),checkExternalPath:value=>files.checkBackupPath(value),workspaces:(destination,owners,databaseManifestSha256)=>captureProfileWorkspacePayload({destination,profile,outputDirectory,owners,databaseManifestSha256,secrets,privatePaths:[family,...options.privatePaths],guard,signal,gitExecutable:options.gitExecutable,reserveBytes:options.reserveBytes})});temporary=result.destination;await verify();
  for(const row of manifest.files)if(await backupHash(path.join(databaseBackup,row.name))!==row.sha256)throw Error('The upgrade database resources changed after capture.');
  const windows=path.join(databaseBackup,'windows-profile'),windowsRecord=credentials?JSON.parse(await readFile(path.join(temporary,'windows-profile.json'),'utf8')):undefined,saved:Record<string,{sha256:string;bytes:number}>=windowsRecord?.files??{};
  await writeFile(path.join(databaseBackup,'application-update-scope.json'),JSON.stringify({format:1,scope:'application-update',externalReferences:[...external.values()],externalContentsCaptured:false,fullWorkspaceExport:false},null,2),{flag:'wx',mode:0o600});
  // Publish only the sealed portable resources. Raw snapshot scratch stays in
  // the private family for inspection; its old paths are data, never commands.
  const descriptorBytes=await readFile(path.join(temporary,'desktop-recovery.json')),descriptor=JSON.parse(descriptorBytes.toString('utf8')),resources=new Set<string>(),sealed:{file:string;sha256:string}[]=[];
  for(const entry of Object.values(descriptor))if(entry&&typeof entry==='object'&&'file' in entry){const resource=entry as {file:string;sha256:string},value=resource.file;if(value==='current-database-backup/manifest.json')resources.add('current-database-backup');else if(path.basename(value)===value&&value!=='desktop-recovery.json')resources.add(value);else throw Error('An upgrade resource left its portable bundle.');if(!/^[a-f0-9]{64}$/.test(resource.sha256))throw Error('An upgrade resource has no valid seal.');sealed.push(resource);}
  const checked=async(root:string,name:string,digest:string)=>{const target=path.join(root,name);await backupDirectory(path.dirname(target));const info=await lstat(target);if(!info.isFile()||info.isSymbolicLink()||info.nlink!==1||!same(await realpath(target),target)||await backupHash(target)!==digest)throw Error('A published upgrade recovery resource is missing or changed.');};
  if(descriptor.windowsProfileManifest)resources.add('windows-profile');for(const resource of sealed)await checked(temporary,resource.file,resource.sha256);
  for(const name of resources){await guard();try{await lstat(path.join(databaseBackup,name));throw Error('An upgrade recovery destination is already occupied.');}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}await rename(path.join(temporary,name),path.join(databaseBackup,name));}
  if(await backupHash(path.join(temporary,'Restore-Sylvana.ps1'))!==await backupHash(path.join(databaseBackup,'Restore-Sylvana.ps1')))throw Error('The upgrade restore helper changed.');await verify();
  await writeFile(path.join(databaseBackup,'RECOVERY.txt'),await readFile(path.join(temporary,'RECOVERY.txt'),'utf8')+'\r\nThe windows-profile folder is an additional private checkpoint of the encrypted provider settings and matching Local State for the original Windows account. Keep it private. Other Windows accounts must reconnect providers. External selected source folders remain in place; scheduled workspace copies and their independent recovery are included.\r\n');
  for(const resource of sealed)await checked(databaseBackup,resource.file,resource.sha256);for(const row of manifest.files)await checked(path.join(databaseBackup,'current-database-backup'),row.name,row.sha256);for(const [name,record]of Object.entries(saved))await checked(windows,name,record.sha256);await verify();
  await checked(temporary,'desktop-recovery.json',sha(descriptorBytes));await rename(path.join(temporary,'desktop-recovery.json'),path.join(databaseBackup,'desktop-recovery.json'));await checked(databaseBackup,'desktop-recovery.json',sha(descriptorBytes));return {destination:databaseBackup,workspaceFormat:12,rawCaptureDirectory:temporary};
 }catch(error){if(temporary)await writeFile(path.join(temporary,'BACKUP-INCOMPLETE.txt'),'This upgrade recovery did not finish publishing. Preserve the original profile and both retained backup directories.\r\n',{flag:'wx',mode:0o600}).catch(()=>{});throw error;}
}
