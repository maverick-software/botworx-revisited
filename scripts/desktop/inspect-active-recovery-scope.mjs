import {mkdir,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import {desktopOperation} from './operation-lock.mjs';
import {discoverActiveRecoveryScope} from './active-recovery-scope.mjs';
import {contextRecoveryArchive} from './context-recovery-chain.mjs';
desktopOperation('inspect current published recovery roots without copying data');
const root=path.resolve(import.meta.dirname,'../..'),accepted=JSON.parse(await readFile(path.join(root,'.supabase/desktop-platform-release/candidate-04447/private-profile-adoption.json'),'utf8'));assert(accepted.success&&accepted.version==='0.44.47');
let expectedArchiveSha256=accepted.imageSha256;
for(const [file,revision]of [['desktop-office-update/reopened.json','office-preview-3'],['desktop-presentation-delivery/reopened.json','presentation-4']]){
 try{const receipt=JSON.parse(await readFile(path.join(root,'.supabase',file),'utf8'));assert(receipt.success&&receipt.version==='0.44.47'&&receipt.revision===revision&&receipt.normalReopeningPassed&&receipt.tablesCompared===126&&receipt.baseImageSha256===expectedArchiveSha256);expectedArchiveSha256=receipt.imageSha256;}catch(error){if(error.code!=='ENOENT')throw error;}
}
expectedArchiveSha256=await contextRecoveryArchive(root,expectedArchiveSha256);
const work=path.resolve('C:/Users/charl/AgentopiaQA/active-recovery-scope',String(Date.now()));await mkdir(work,{recursive:true});
const scope=await discoverActiveRecoveryScope({archive:path.join(os.homedir(),'AppData/Local/AgentopiaDesktop/app-0.44.47/resources/app.asar'),expectedArchiveSha256,home:os.homedir(),work});
const receipt={success:true,at:new Date().toISOString(),work,...scope,productionChanged:false,filesCopied:0,scope:'Recovery roots verified; no backup or restore is claimed by this inspection.'};
await writeFile(path.join(work,'scope.json'),JSON.stringify(receipt,null,2),{flag:'wx'});await writeFile(path.join(root,'.supabase/desktop-profile-location/active-recovery-scope-current.json'),JSON.stringify({success:true,work,scope:path.join(work,'scope.json')},null,2));console.log(JSON.stringify(receipt));
