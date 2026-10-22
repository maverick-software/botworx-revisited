import path from 'node:path';
import type {Secrets} from './secrets';
import {loadRestoredWorkspaces} from './restored-workspaces';
import {workspaceImportId,type WorkspaceImportReceipt} from './workspace-backup-import';
import {storageUuid} from './storage-files';

export class WorkspaceUpgradeReviewRequired extends Error{
 constructor(){super('Review the unfinished workspace recovery before creating a complete upgrade backup.');this.name='WorkspaceUpgradeReviewRequired';}
}
type Options={profile:string;workspaces:string;owners:string[];secrets:Pick<Secrets,'get'|'workspaceImportIds'>;guard:()=>Promise<void>;signal:AbortSignal};
function need(value:unknown,message:string):asserts value{if(!value)throw Error(message);}

/** Only a verified current checkpoint can enter authenticated upgrade review.
 * Unknown or malformed old receipts remain a hard hold, rather than opening an
 * unrelated recovery or silently omitting the account's original graph. */
export async function pendingWorkspaceUpgradeOwners(options:Options){
 const {profile,workspaces,owners,secrets,guard,signal}=options;
 need(owners.every(storageUuid)&&new Set(owners).size===owners.length,'The upgrade account set is invalid.');await guard();signal.throwIfAborted();
 const loaded=await loadRestoredWorkspaces(profile,guard,signal),pending=new Set<string>(),recovery=path.join(profile,'scheduled-recovery');
 for(const owner of owners){
  await guard();signal.throwIfAborted();
  const expected=loaded?.binding.owners.includes(owner)?workspaceImportId(loaded.binding,owner,workspaces,recovery):undefined;
  for(const id of secrets.workspaceImportIds(owner)){
   const receipt=secrets.get<WorkspaceImportReceipt>('scheduled-workspace-import:'+owner+':'+id);
   need(receipt&&receipt.version===1&&receipt.owner===owner&&receipt.id===id&&['preparing','prepared','complete','uncertain'].includes(receipt.phase),'A workspace import record is invalid. Preserve the profile and inspect its recovery metadata.');
   if(receipt.phase!=='complete')need(expected===id,'An unfinished workspace import belongs to a different checkpoint. Preserve its retained files and original recovery before upgrading.');
   if(id===expected){
    need(receipt.indexSha256===loaded!.record.indexSha256&&receipt.workspaces===workspaces&&receipt.recovery===recovery&&path.dirname(receipt.staging)===profile&&/^wi-[a-f0-9]{16}$/.test(path.basename(receipt.staging)),'The required workspace import binding changed.');
    if(receipt.phase!=='complete')pending.add(owner);
   }
  }
  if(expected){
   const record=loaded!.record,account=record.records.accounts.find(row=>row.owner===owner);
   const containsData=record.references?.some(row=>row.owner===owner)||record.nodes.some(row=>row.owner===owner)||record.captures.some(row=>row.owner===owner)||account?.journals.length||account?.operations.length;
   if(containsData&&!secrets.get<WorkspaceImportReceipt>('scheduled-workspace-import:'+owner+':'+expected))pending.add(owner);
  }
 }
 await guard();signal.throwIfAborted();return [...pending];
}
