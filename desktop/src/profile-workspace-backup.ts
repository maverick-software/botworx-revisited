import path from 'node:path';
import type {Secrets} from './secrets';
import {WorkspaceFiles} from './workspace';
import {ScheduledWorkspaces,scheduledWorkspaceDirectory} from './scheduled-workspaces';
import {ScheduledWorkspaceMaintenance} from './scheduled-workspace-maintenance';
import {captureWorkspacePayload} from './workspace-backup-payload';
import {backupDirectory} from './backup-archives';
import {storageWithin} from './storage-files';
import {pendingWorkspaceUpgradeOwners,WorkspaceUpgradeReviewRequired} from './workspace-upgrade-pending';

type ReadStore=Pick<Secrets,'get'|'scheduledWorkspaceIds'|'scheduledWorkspaceRecoveryIds'|'workspaceImportIds'>;
type Options={profile:string;outputDirectory:string;destination:string;owners:string[];databaseManifestSha256:string;secrets:ReadStore;privatePaths:string[];guard:()=>Promise<void>;signal:AbortSignal;gitExecutable?:string;reserveBytes?:number};

/** A closed-profile reader for maintenance. It never signs in, starts queues,
 * attaches files or changes the credential store. The caller must verify that
 * its decrypted store and database snapshot belong to this closed profile. */
export async function captureProfileWorkspacePayload(options:Options){
 const {profile,outputDirectory,secrets,guard,signal}=options;
 await guard();signal.throwIfAborted();await backupDirectory(profile);
 if((await pendingWorkspaceUpgradeOwners({profile,workspaces:scheduledWorkspaceDirectory(profile,outputDirectory),owners:options.owners,secrets,guard,signal})).length)throw new WorkspaceUpgradeReviewRequired();
 const blocked=async():Promise<never>=>{throw Error('A closed-profile workspace backup cannot change application state.');};
 const readonly={get:secrets.get.bind(secrets),scheduledWorkspaceIds:secrets.scheduledWorkspaceIds.bind(secrets),scheduledWorkspaceRecoveryIds:secrets.scheduledWorkspaceRecoveryIds.bind(secrets),set:blocked,setMany:blocked};
 const files=new WorkspaceFiles(readonly as unknown as Secrets,undefined,[profile,...options.privatePaths]);
 const scratch=path.join(options.destination,'workspace-capture');
 const workspaces=new ScheduledWorkspaces(readonly,{list:owner=>files.list(owner),attach:blocked,checkPath:value=>files.checkPath(value),checkBackupPath:value=>{if(!storageWithin(scratch,value))files.checkBackupPath(value);}},scheduledWorkspaceDirectory(profile,outputDirectory),options.gitExecutable),recovery=path.join(profile,'scheduled-recovery');
 const maintenance=new ScheduledWorkspaceMaintenance(readonly,workspaces,recovery,{guard:async()=>{await guard();},busy:()=>false,exclusive:blocked,withFiles:blocked,state:blocked,references:owner=>files.list(owner),forget:blocked,attach:blocked,reveal:blocked});
 const payload=await captureWorkspacePayload({destination:options.destination,recovery,owners:options.owners,databaseManifestSha256:options.databaseManifestSha256,secrets:readonly,workspaces,maintenance,references:owner=>files.list(owner),guard,signal,reserveBytes:options.reserveBytes});
 await guard();signal.throwIfAborted();return payload;
}
