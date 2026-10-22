import {readFile,writeFile,readdir,stat,mkdir,cp} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import assert from 'node:assert/strict';
const root=path.resolve(import.meta.dirname,'../..'),[checkId,storageId,uiId]=process.argv.slice(2);for(const id of [checkId,storageId,uiId])assert(/^\d{13}$/.test(id));
const parent=path.join(root,'.supabase/desktop-plugin-updates'),checks=path.join(parent,'check-'+checkId),storage=path.join(parent,'storage-'+storageId),ui=path.join(parent,'ui-'+uiId);
const json=async file=>JSON.parse(await readFile(file,'utf8')),hash=b=>createHash('sha256').update(b).digest('hex');
const unit=await json(path.join(checks,'evidence.json')),sql=await json(path.join(storage,'evidence.json')),view=await json(path.join(ui,'evidence.json')),child=await json(path.join(checks,'update-child-evidence.json'));
assert(unit.success&&unit.passed===42&&unit.backendTypecheck&&unit.rendererTypecheck);assert(sql.success&&sql.checks.length===8&&sql.disposableDatabaseRemoved&&sql.productionUnchanged);assert(view.success&&view.checks.length===6);
assert(child.success&&child.actualCodex&&child.interruptedOnPackageUpdate&&child.streamAborted&&child.noFurtherProviderRequests&&child.revokedRestoreBlockedBeforeInference);
for(const [file,digest]of Object.entries(unit.sources))assert.equal(hash(await readFile(path.join(root,file))),digest,'Source changed after qualification: '+file);
assert.equal(sql.applied['0058-plugin-updates.sql'],unit.sources['desktop/database/0058-plugin-updates.sql']);
const candidate=path.join(root,'.supabase/desktop-goal-limits/candidate-0447/source/desktop');
const files=async directory=>{const result=[];for(const name of await readdir(directory,{recursive:true}))if((await stat(path.join(directory,name))).isFile())result.push(name.replaceAll('\\','/'));return result.sort();};
const changes=[];for(const area of ['src','ui','database']){
 const originals=await files(path.join(candidate,area)),current=await files(path.join(root,'desktop',area));
 for(const file of originals)assert(current.includes(file),'A previously qualified file disappeared: '+area+'/'+file);
 for(const file of current)if(!originals.includes(file)||hash(await readFile(path.join(root,'desktop',area,file)))!==hash(await readFile(path.join(candidate,area,file))))changes.push(area+'/'+file);
}
assert.deepEqual(changes.sort(),['database/0058-plugin-updates.sql','src/broker.ts','src/native-plugin-skills.ts','src/plugin-contracts.ts','src/plugin-update.ts','src/plugins.ts','ui/PluginManager.tsx'].sort());
const out=path.join(parent,'qualification-'+Date.now());await mkdir(out);
for(const area of ['src','ui','database','tests'])await cp(path.join(root,'desktop',area),path.join(out,'source/desktop',area),{recursive:true});
for(const name of ['tsconfig.json','package.json'])await cp(path.join(root,'desktop',name),path.join(out,'source/desktop',name));
for(const name of ['package.json','package-lock.json'])await cp(path.join(root,name),path.join(out,'source',name));
const scripts=['test-plugin-updates.mjs','test-plugin-update-storage.mjs','test-plugin-update-storage.py','test-plugin-update-ui.mjs','record-plugin-updates.mjs'];
for(const name of scripts)await cp(path.join(root,'scripts/desktop',name),path.join(out,'source/scripts/desktop',name));
const frozen={};for(const file of await files(path.join(out,'source')))frozen[file]=hash(await readFile(path.join(out,'source',file)));
const compiled={};for(const file of await files(unit.build))compiled[file]=hash(await readFile(path.join(unit.build,file)));
const proof={success:true,at:new Date().toISOString(),sourceOnly:true,packaged:false,installed:false,requiredSchema:58,
 changes,source:path.join(out,'source'),sourceHashes:frozen,compiled:unit.build,compiledHashes:compiled,
 focusedAndRegressionChecks:42,actualNativePluginUpdate:true,updatedNativeInputsBothProviders:true,databaseChecks:8,uiChecks:6,
 unitEvidence:path.join(checks,'evidence.json'),unitEvidenceSha256:hash(await readFile(path.join(checks,'evidence.json'))),
 storageEvidence:path.join(storage,'evidence.json'),storageEvidenceSha256:hash(await readFile(path.join(storage,'evidence.json'))),
 uiEvidence:path.join(ui,'evidence.json'),uiEvidenceSha256:hash(await readFile(path.join(ui,'evidence.json'))),
 actualChildEvidence:path.join(checks,'update-child-evidence.json'),actualChildEvidenceSha256:hash(await readFile(path.join(checks,'update-child-evidence.json'))),
 production:sql.after,productionMigrated:false,providerRequests:0,
 remaining:['qualified package containing migration 0058','live ChatGPT acceptance after fresh authorization','ordinary installed update, restart and credential retention','full-profile backup and installer/reboot/clean-machine gates','broader desktop parity']};
await writeFile(path.join(out,'evidence.json'),JSON.stringify(proof,null,2),{flag:'wx'});await writeFile(path.join(parent,'latest-source.json'),JSON.stringify({success:true,at:proof.at,sourceOnly:true,requiredSchema:58,evidence:path.join(out,'evidence.json'),evidenceSha256:hash(await readFile(path.join(out,'evidence.json')))},null,2));
console.log(JSON.stringify({success:true,sourceOnly:true,changes,focusedAndRegressionChecks:42,databaseChecks:8,uiChecks:6,compiledModules:Object.keys(compiled).length,sourceFiles:Object.keys(frozen).length,out},null,2));
