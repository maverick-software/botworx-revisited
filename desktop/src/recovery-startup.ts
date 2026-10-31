import {lstat,realpath,readFile,writeFile,rename} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {randomUUID,createHash} from 'node:crypto';
import {validateClipboardRecord} from './clipboard-recovery';
import {verifyRecoveredClipboard} from './restored-clipboard';
import {loadRestoredSettings} from './restored-settings';
import {loadRestoredExternal} from './restored-external';
import {loadRestoredLayouts} from './restored-layouts';
import {verifyExternalReferences} from './external-backup';
import {prepareRestoredWorkspaces} from './restored-workspaces';
type PreparedRecovery={format:2;operationId:string;descriptorSha256:string;profile:string;publicRoot:string;status:string;phase:string;clipboardIndexSha256?:string;settingsIndexSha256?:string;externalIndexSha256?:string;layoutsIndexSha256?:string;workspaceIndexSha256?:string;windowsCredentialsImported?:boolean;windowsCredentialsManifestSha256?:string};
const same=(a:string,b:string)=>process.platform==='win32'?a.toLowerCase()===b.toLowerCase():a===b;
async function record(file:string,maximum=64*1024){const info=await lstat(file);if(!info.isFile()||info.isSymbolicLink()||info.nlink!==1||info.size>maximum||!same(await realpath(file),file))throw Error('The recovery startup record is linked or invalid.');return JSON.parse(await readFile(file,'utf8'));}
export async function recoveryStartup(profile:string,home=os.homedir()):Promise<{file:string;record:PreparedRecovery}|undefined>{
 const file=path.join(home,'.sylvana/recovery-state.json');let state:PreparedRecovery;try{state=await record(file);}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;for(const name of ['.sylvana-recovery-operation.json','.sylvana-workspaces-required.json','restored-workspaces']){try{await lstat(path.join(profile,name));}catch(markerError){if((markerError as NodeJS.ErrnoException).code==='ENOENT')continue;throw markerError;}throw Error('The restored profile is missing its recovery startup record. Preserve the profile and resume recovery.');}return;}
 if(state?.format!==2||!/^[a-f0-9-]{36}$/i.test(state.operationId)||!/^[a-f0-9]{64}$/.test(state.descriptorSha256))throw Error('The desktop recovery record is invalid. Preserve it before continuing.');
 if(state.windowsCredentialsManifestSha256){const sha=(bytes:Buffer|string)=>createHash('sha256').update(bytes).digest('hex'),manifestFile=path.join(profile,'.sylvana-windows-profile.json'),manifest=await record(manifestFile,1024*1024),choice=await record(path.join(profile,'.sylvana-windows-credentials.json'),1024*1024);if(sha(await readFile(manifestFile))!==state.windowsCredentialsManifestSha256||choice.format!==1||choice.imported!==state.windowsCredentialsImported||JSON.stringify(choice.manifest)!==JSON.stringify(manifest))throw Error('The Windows credential recovery binding changed. Preserve this profile.');if(state.status!=='completed'&&state.windowsCredentialsImported){const credentials=path.join(profile,'credentials.bin'),info=await lstat(credentials),localState=await record(path.join(profile,'Local State'),32*1024**2),key=localState.os_crypt;if(!info.isFile()||info.isSymbolicLink()||info.nlink!==1||!same(await realpath(credentials),credentials)||sha(await readFile(credentials))!==manifest.files['credentials.bin'].sha256||!key||sha(JSON.stringify([key.encrypted_key,key.app_bound_encrypted_key??null]))!==manifest.encryptionKeySha256)throw Error('The restored Windows credentials or encryption key changed before startup.');}}
 if(state.status!=='completed'&&(state.status!=='prepared'||state.phase!=='prepared'))throw Error('Desktop recovery preparation is incomplete. Resume the same verified recovery before starting the database. Existing data has been preserved.');
 if(state.workspaceIndexSha256)await prepareRestoredWorkspaces(profile,state.workspaceIndexSha256);
 else try{await lstat(path.join(profile,'.sylvana-workspaces-required.json'));throw Error('Required workspace recovery is absent from the database startup record.');}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}
 if(state.clipboardIndexSha256){const clipboard=validateClipboardRecord(await record(path.join(profile,'restored-clipboard-images.json'),16*1024**2)),required=await record(path.join(profile,'.sylvana-clipboard-required.json'));if(clipboard.indexSha256!==state.clipboardIndexSha256||required.format!==1||required.indexSha256!==clipboard.indexSha256)throw Error('Required clipboard recovery metadata changed.');if(state.status!=='completed')for(const account of clipboard.accounts)await verifyRecoveredClipboard(profile,clipboard,account,async()=>{});}
 if(state.settingsIndexSha256){const settings=await loadRestoredSettings(profile);if(!settings||settings.indexSha256!==state.settingsIndexSha256)throw Error('Required portable settings metadata changed.');}
 if(state.externalIndexSha256){const external=await loadRestoredExternal(profile);if(!external||external.indexSha256!==state.externalIndexSha256)throw Error('Required external recovery metadata changed.');if(state.status!=='completed')for(const account of external.accounts)await verifyExternalReferences(external,state.publicRoot,account.owner,async()=>{});}
 if(state.layoutsIndexSha256){const layouts=await loadRestoredLayouts(profile);if(!layouts||layouts.indexSha256!==state.layoutsIndexSha256)throw Error('Required layout recovery metadata changed.');}
 if(state.status==='completed')return;
 if(state.status!=='prepared'||state.phase!=='prepared')throw Error('Desktop recovery preparation is incomplete. Resume the same verified recovery before starting the database. Existing data has been preserved.');
 if(!same(path.resolve(profile),path.resolve(state.profile))||!same(path.resolve(state.publicRoot),path.join(home,'Sylvana Files')))throw Error('The prepared recovery belongs to another profile.');
 const marker=await record(path.join(profile,'.sylvana-recovery-operation.json')),outputs=await record(path.join(home,'.sylvana/public-output-recovery-operation.json'));
 for(const value of [marker,outputs])if(value?.format!==2||value.operationId!==state.operationId||value.descriptorSha256!==state.descriptorSha256)throw Error('The prepared recovery ownership changed.');
 return {file,record:state};
}
export async function completeRecoveryStartup(prepared:Awaited<ReturnType<typeof recoveryStartup>>){
 if(!prepared)return;const current=await record(prepared.file);
 if(current.status!=='prepared'||current.operationId!==prepared.record.operationId||current.descriptorSha256!==prepared.record.descriptorSha256||JSON.stringify(current)!==JSON.stringify(prepared.record))throw Error('The recovery operation changed during database startup.');
 if(current.workspaceIndexSha256)await prepareRestoredWorkspaces(current.profile,current.workspaceIndexSha256);
 if(JSON.stringify(await record(prepared.file))!==JSON.stringify(current))throw Error('The recovery operation changed during workspace verification.');
 const temporary=prepared.file+'.'+randomUUID()+'.tmp';await writeFile(temporary,JSON.stringify({...current,status:'completed',phase:'database-ready',databaseImported:true,completedAt:new Date().toISOString()},null,2),{flag:'wx',mode:0o600});await rename(temporary,prepared.file);
}
