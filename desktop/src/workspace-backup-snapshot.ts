import path from 'node:path';
import {createHash} from 'node:crypto';
import {lstat,mkdir} from 'node:fs/promises';
import {storageDirectory,storageUuid,storageWithin} from './storage-files';
import type {ScheduledWorkspaces} from './scheduled-workspaces';
import {captureWorkspaceGit,type GitRecovery,type GitRecoveryProgress} from './workspace-recovery-git';
import {workspaceRecoveryInventory,writeWorkspaceRecovery,verifyWorkspaceRecovery,type RecoveryArtifact} from './workspace-recovery-files';

export type WorkspaceSnapshotProgress=
 |{phase:'planned';owner:string;run:string;operation:string;destination:string}
 |{phase:'allocated';rootIdentity:string}
 |{phase:'git';value:GitRecoveryProgress}
 |{phase:'verified';artifact:RecoveryArtifact};
type Guard=()=>Promise<void>;
const changed=()=>Error('The workspace or its Git state changed during backup. Keep the original and capture a new snapshot.');

/** Internal backup/removal capture. The caller persists planned progress before
 * allocation and retains incomplete output on failure. This function never
 * changes a saved run, attaches files, removes its source or starts inference. */
export async function captureWorkspaceSnapshot(
 workspaces:ScheduledWorkspaces,scope:{owner:string;run:string;operation:string;destination:string;extraCommits?:string[]},
 guard:Guard,signal:AbortSignal,progress:(value:WorkspaceSnapshotProgress)=>Promise<void>,
){
 const {owner,run,operation,destination}=scope;
 if(![owner,run,operation].every(storageUuid)||!path.isAbsolute(destination)||path.basename(destination)!==operation||path.basename(path.dirname(destination))!==owner)throw Error('Use a valid owned workspace backup destination.');
 const check=async()=>{signal.throwIfAborted();await guard();signal.throwIfAborted();};
 await check();const retained=await workspaces.inspectRetained(owner,run,check),journal=retained.journal;
 if(storageWithin(journal.path,destination)||storageWithin(destination,journal.path)||storageWithin(journal.workspace.commonDirectory,destination)||storageWithin(destination,journal.workspace.commonDirectory))throw Error('Save the workspace backup outside its source and Git metadata.');
 await storageDirectory(path.dirname(destination));
 try{await lstat(destination);throw Error('The workspace backup destination is occupied. Keep that operation for inspection; create a new backup.');}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}
 await progress({phase:'planned',owner,run,operation,destination});await check();await mkdir(destination);await storageDirectory(destination);
 const initial=await lstat(destination,{bigint:true}),rootIdentity=createHash('sha256').update([initial.dev,initial.ino,initial.birthtimeNs].join(':')).digest('hex');
 const owned=async()=>{await check();await storageDirectory(destination);const current=await lstat(destination,{bigint:true});if(createHash('sha256').update([current.dev,current.ino,current.birthtimeNs].join(':')).digest('hex')!==rootIdentity)throw Error('The owned workspace backup destination was replaced.');};
 await progress({phase:'allocated',rootIdentity});await owned();
 const inventory=await workspaceRecoveryInventory(journal.path,owned,signal);let git:GitRecovery|undefined;
 if(retained.git){
  const directory=path.join(destination,'git');await owned();await mkdir(directory);
  const commands=await workspaces.recoveryCommands(owner,run,directory,owned,signal);
  git=await captureWorkspaceGit({owner,run,operation,gitDirectory:retained.git.directory,commonDirectory:journal.workspace.commonDirectory,output:directory,extraCommits:scope.extraCommits},commands,owned,signal,value=>progress({phase:'git',value}),proof=>workspaces.verifyRecoveryBundle(owner,run,directory,proof,owned,signal));
 }
 const artifact=await writeWorkspaceRecovery(journal.path,inventory,git?.extras??[],{owner,run,operation,git:git?{head:git.head,metadata:git.metadata,policy:git.policy,validation:git.validation}:null},path.join(destination,'workspace.tar.gz'),owned,signal);
 const manifest=await verifyWorkspaceRecovery(artifact,owned,signal);
 if((await workspaceRecoveryInventory(journal.path,owned,signal)).fingerprint!==inventory.fingerprint)throw changed();
 const current=await workspaces.inspectRetained(owner,run,owned);if(JSON.stringify(current)!==JSON.stringify(retained))throw changed();
 const recoveryInventory=await workspaceRecoveryInventory(destination,owned,signal);await owned();await progress({phase:'verified',artifact});await owned();
 return {artifact,manifest,git,rootFingerprint:inventory.fingerprint,files:inventory.files,bytes:inventory.bytes,recoveryBytes:recoveryInventory.bytes,gitDirectory:retained.git?.directory,gitIdentity:retained.git?.identity};
}
