import path from 'node:path';
import {createHash} from 'node:crypto';
import {copyFile, lstat, readFile,writeFile} from 'node:fs/promises';
import {constants} from 'node:fs';
import {storageDirectory, storageUuid, storageWithin} from './storage-files';
import {readGitRecoveryPolicy,gitRecoveryPolicyId,type GitRecoveryPolicy} from './workspace-git-policy';
import {workspaceBundlePack} from './workspace-git-bundle';
import {
 recoveryFile, workspaceRecoveryInventory, writeWorkspaceRecovery, verifyWorkspaceRecovery,
 type RecoveryArtifact, type RecoveryExtra,
} from './workspace-recovery-files';

/** Commands are supplied by the trusted worktree host, with its installed Git,
 * identity checks, disabled hooks/filters/network and bounded process limits.
 * indexFile/gitDirectory are app-created private copies, never project input. */
export type GitRecoveryCommand = (args:string[], options?:{input?:string;indexFile?:string;gitDirectory?:string})=>Promise<string>;
export type GitRecoveryProgress = {
 phase:'planned'|'reference'|'bundled'|'complete'; reference:string; commit?:string;
};
export type GitRecoveryValidationInput={bundle:string;bundleSha256:string;head:string;commit:string;reference:string;policy:GitRecoveryPolicy};
export type GitRecoveryValidation={version:1;bundleSha256:string;head:string;commit:string;reference:string;packChecksum:string;policySha256:string;at:string};
export type GitRecovery = {
 head:string; commit:string; reference:string; indexSha256?:string; indexEntries:number;
 metadataFingerprint:string; metadata:RecoveryArtifact; extras:RecoveryExtra[];policy:GitRecoveryPolicy;validation?:GitRecoveryValidation;
};
const object = (value:string) => {
 const hash=value.trim();
 if(!/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(hash))throw Error('Git returned an invalid recovery object.');
 return hash;
};
const same=(a:string,b:string)=>process.platform==='win32'?path.normalize(a).toLowerCase()===path.normalize(b).toLowerCase():path.normalize(a)===path.normalize(b);
const unchanged=()=>Error('Git state changed while creating recovery. Keep the workspace and review it again.');

/** Captures local history and staged blobs without changing the checkout,
 * source branch or source index. A Git bundle alone does not contain the index.
 * A temporary recovery commit keeps staged/conflict blobs reachable in it. */
export async function captureWorkspaceGit(
 scope:{owner:string;run:string;operation:string;gitDirectory:string;commonDirectory:string;output:string;extraCommits?:string[]},
 git:GitRecoveryCommand, guard:()=>Promise<void>, signal:AbortSignal,
 progress:(value:GitRecoveryProgress)=>Promise<void>,
 verify?:(value:GitRecoveryValidationInput)=>Promise<GitRecoveryValidation>,
):Promise<GitRecovery>{
 for(const id of [scope.owner,scope.run,scope.operation])if(!storageUuid(id))throw Error('Invalid workspace recovery identity.');
 const {gitDirectory,commonDirectory,output}=scope;
 if(storageWithin(gitDirectory,output)||storageWithin(output,gitDirectory)||storageWithin(commonDirectory,output))throw Error('Git recovery must be outside repository metadata.');
 await guard();signal.throwIfAborted();
 await storageDirectory(gitDirectory);await storageDirectory(commonDirectory);await storageDirectory(output);
 const before=await workspaceRecoveryInventory(gitDirectory,guard,signal);
 if(before.entries.some(entry=>entry.kind==='file'&&entry.path.endsWith('.lock')))throw Error('Git is writing this workspace. Wait for it to finish before creating recovery.');
 // A compact fixed namespace avoids Windows' path limit in deeply nested
 // projects. The authenticated operation journal retains all three identities.
 const reference='refs/agentopia/recovery/'+createHash('sha256').update([scope.owner,scope.run,scope.operation].join(':')).digest('hex');
 await progress({phase:'planned',reference});
 const head=object(await git(['rev-parse','--verify','--end-of-options','HEAD^{commit}']));
 const policy=await readGitRecoveryPolicy(commonDirectory,head.length,guard,signal),policySha256=gitRecoveryPolicyId(policy);
 const index=(await git(['rev-parse','--path-format=absolute','--git-path','index'])).trim();
 if(!same(index,path.join(gitDirectory,'index')))throw Error('The workspace index is outside its verified Git metadata.');
 const extra:RecoveryExtra[]=[];
 let indexSha256:string|undefined,indexEntries=0;
 if(scope.extraCommits!==undefined&&(!Array.isArray(scope.extraCommits)||scope.extraCommits.length>10000))throw Error('Too many prior workspace recovery commits. Keep the original history for inspection.');
 const objects=new Map<string,'blob'|'tree'>(),parents=new Set<string>([head,...(scope.extraCommits??[]).map(object)]);
 let hasIndex=true;
 try{await lstat(index);}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;hasIndex=false;}
 if(hasIndex){
  const original=await recoveryFile(index,guard,signal);indexSha256=original.sha256;
  const saved=path.join(output,'index.bin');await guard();signal.throwIfAborted();
  await copyFile(index,saved,constants.COPYFILE_EXCL);
  if((await recoveryFile(saved,guard,signal)).sha256!==indexSha256)throw unchanged();
  // Git resolves sharedindex.* relative to GIT_DIR, even with GIT_INDEX_FILE.
  // A private HEAD/common-dir shell keeps those reads and timestamp refreshes
  // in recovery storage while still using the verified original object store.
  await copyFile(path.join(gitDirectory,'HEAD'),path.join(output,'HEAD'),constants.COPYFILE_EXCL);
  await writeFile(path.join(output,'commondir'),commonDirectory.replaceAll('\\','/')+'\n',{flag:'wx',mode:0o600});
  const privateIndex={indexFile:saved,gitDirectory:output};
  // Reading a split index through Git can refresh its shared file's timestamp.
  // Put its verified shared files beside the private copy first; every index
  // inspection and conversion then operates on those copies exclusively.
  const sharedFiles=before.entries.filter(entry=>entry.kind==='file'&&/^sharedindex\.(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(entry.path));
  if(sharedFiles.length>128||sharedFiles.reduce((sum,entry)=>sum+entry.size,0)>1024**3)throw Error('The shared indexes need manual recovery. Keep this workspace.');
  for(const entry of sharedFiles){
   const copy=path.join(output,entry.path);await guard();signal.throwIfAborted();
   await copyFile(path.join(gitDirectory,entry.path),copy,constants.COPYFILE_EXCL);
   if((await recoveryFile(copy,guard,signal)).sha256!==entry.sha256)throw unchanged();
  }
  const shared=(await git(['rev-parse','--path-format=absolute','--shared-index-path'],privateIndex)).trim();
  if(shared){
   if(!same(path.dirname(shared),output)||!sharedFiles.some(entry=>entry.path===path.basename(shared)))throw Error('The shared index left its private recovery copy.');
   await guard();signal.throwIfAborted();await git(['update-index','--no-split-index'],privateIndex);
  }
  // Resolve-undo entries can contain blobs no longer present in normal stages.
  const rows=await git(['ls-files','--stage','--resolve-undo','-z'],privateIndex);
  for(const row of rows.split('\0').filter(Boolean)){
   const match=/^(100644|100755|120000|160000|040000) ([a-f0-9]{40}|[a-f0-9]{64}) ([0-3])\t[\s\S]+$/.exec(row);
   if(!match||++indexEntries>250000)throw Error('The workspace index cannot be preserved automatically. Keep it for manual recovery.');
   if(match[1]!=='160000')objects.set(match[2],match[1]==='040000'?'tree':'blob');
  }
  extra.push({name:'index.bin',path:saved,...await recoveryFile(saved,guard,signal)});
 }
 const reflog=(await git(['reflog','show','--format=%H','HEAD'])).split(/\r?\n/).filter(Boolean);
 if(reflog.length>10000)throw Error('The workspace has too much local history for automatic recovery. Keep it for manual review.');
 for(const commit of reflog)parents.add(object(commit));
 // Preserve objects referenced by operation state, including a conflict's
 // auto-merge tree and commits that were subsequently reset or rebased away.
 const referenced=new Set<string>();
 for(const entry of before.entries){
  if(entry.kind!=='file'||entry.size>8*1024*1024||entry.path==='index'||/^sharedindex\./.test(entry.path))continue;
  const text=await readFile(path.join(gitDirectory,...entry.path.split('/')),'utf8');
  for(const match of text.matchAll(/\b(?:[a-f0-9]{64}|[a-f0-9]{40})\b/g)){if(!/^0+$/.test(match[0]))referenced.add(match[0]);}
  if(referenced.size>10000)throw Error('The workspace has too much operation history for automatic recovery. Keep it for review.');
 }
 if(referenced.size){
  const checks=(await git(['cat-file','--batch-check=%(objectname) %(objecttype)'],{input:[...referenced].join('\n')+'\n'})).trim().split(/\r?\n/);
  if(checks.length!==referenced.size)throw Error('Git did not verify every recovery object.');
  const wanted=[...referenced];
  for(let i=0;i<checks.length;i++){
   const match=/^([a-f0-9]{40}|[a-f0-9]{64}) (commit|tree|blob|missing)$/.exec(checks[i]);
   if(!match||match[1]!==wanted[i]||match[2]==='missing')throw Error('A missing or unsupported Git object needs manual recovery.');
   if(match[2]==='commit')parents.add(match[1]);else if(match[2]==='blob'||match[2]==='tree')objects.set(match[1],match[2]);
  }
 }
 if(parents.size>10000)throw Error('The workspace has too much recovery history. Keep it for manual review.');
 const tree=object(await git(['mktree','-z'],{input:[...objects].map(([hash,type])=>(type==='tree'?'040000':'100644')+' '+type+' '+hash+'\t'+hash+'\0').join('')}));
 const commit=object(await git(['-c','commit.gpgSign=false','commit-tree',tree,...[...parents].flatMap(parent=>['-p',parent]),'-m','Agentopia private workspace recovery']));
 await guard();signal.throwIfAborted();
 await git(['update-ref','--no-deref',reference,commit,'0'.repeat(commit.length)]);
 await progress({phase:'reference',reference,commit});
 const bundle=path.join(output,'history.bundle');
 try{await lstat(bundle);throw Error('The recovery bundle destination is occupied.');}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}
 await guard();signal.throwIfAborted();await git(['bundle','create',bundle,reference,'--']);
 // Git for Windows cannot open some long bundle filenames. Both commands
 // inspect only the bounded header; the independent import verifies the pack.
 const pack=await workspaceBundlePack(bundle,head.length===64?32:20,guard,signal);
 if(pack.commit!==commit||pack.reference!==reference)throw Error('The recovery bundle contains another history.');
 await git(['bundle','verify','-'],{input:pack.header});
 const heads=(await git(['bundle','list-heads','-'],{input:pack.header})).trim();
 if(heads!==commit+' '+reference)throw Error('The recovery bundle contains another history.');
 extra.push({name:'history.bundle',path:bundle,...await recoveryFile(bundle,guard,signal)});
 await progress({phase:'bundled',reference,commit});
 if(object(await git(['rev-parse','--verify','--end-of-options','HEAD^{commit}']))!==head)throw unchanged();
 if(hasIndex&&(await recoveryFile(index,guard,signal)).sha256!==indexSha256)throw unchanged();
 if((await workspaceRecoveryInventory(gitDirectory,guard,signal)).fingerprint!==before.fingerprint)throw unchanged();
 const metadata=await writeWorkspaceRecovery(gitDirectory,before,[],{purpose:'Git operation-state recovery; inspect before restoring metadata',policy},path.join(output,'git-state.tar.gz'),guard,signal);
 await verifyWorkspaceRecovery(metadata,guard,signal);
 if((await workspaceRecoveryInventory(gitDirectory,guard,signal)).fingerprint!==before.fingerprint||object(await git(['rev-parse','--verify','--end-of-options','HEAD^{commit}']))!==head)throw unchanged();
 extra.push({name:'git-state.tar.gz',path:metadata.path,...await recoveryFile(metadata.path,guard,signal)});
 const validation=verify?await verify({bundle,bundleSha256:extra.find(file=>file.name==='history.bundle')!.sha256,head,commit,reference,policy}):undefined;
 if(verify&&(!validation||validation.version!==1||validation.head!==head||validation.commit!==commit||validation.reference!==reference||validation.bundleSha256!==extra.find(file=>file.name==='history.bundle')!.sha256||validation.policySha256!==policySha256))throw Error('The independent Git recovery proof does not match this bundle.');
 if(gitRecoveryPolicyId(await readGitRecoveryPolicy(commonDirectory,head.length,guard,signal))!==policySha256)throw Error('The Git history policy changed during recovery capture.');
 if((await workspaceRecoveryInventory(gitDirectory,guard,signal)).fingerprint!==before.fingerprint||object(await git(['rev-parse','--verify','--end-of-options','HEAD^{commit}']))!==head)throw unchanged();
 await guard();signal.throwIfAborted();
 await git(['update-ref','--no-deref','-d',reference,commit]);
 await progress({phase:'complete',reference,commit});
 return {head,commit,reference,indexSha256,indexEntries,metadataFingerprint:before.fingerprint,metadata,extras:extra,policy,...(validation?{validation}:{})};
}
