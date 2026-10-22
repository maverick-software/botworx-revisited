import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {desktopOperation} from './operation-lock.mjs';
import {hash} from './phased-backup-control.mjs';

desktopOperation('prepare pinned 0.44.51 maintenance and recovery checks');
const root=path.resolve(import.meta.dirname,'../..'),dir=path.join(root,'scripts/desktop'),json=async p=>JSON.parse(await readFile(p,'utf8'));
const pointer=await json(path.join(root,'.supabase/desktop-release-04451/current.json')),proof=await json(pointer.proof),base=await json(proof.acceptedBase),installer=await json(path.join(proof.out,'installer-verified.json'));
assert(proof.success&&proof.version==='0.44.51'&&base.version==='0.44.50'&&installer.success);
assert((await json(path.join(proof.out,'database-upgrade-accepted.json'))).success);
assert((await json(path.join(proof.out,'capability9-restore-accepted.json'))).success);
assert.equal(await hash(proof.image),proof.imageSha256);assert.equal(await hash(installer.installer),installer.installerSha256);
const stamp=path.basename(proof.out);assert(/^\d{13}$/.test(stamp));
const replace=(s,a,b)=>{assert(s.includes(a),'Missing expected template: '+a);return s.replaceAll(a,b);};
const versions=s=>s.replaceAll('0.44.49','__OLD__').replaceAll('0.44.50','0.44.51').replaceAll('__OLD__','0.44.50').replaceAll('04449/1792536883499','04450/1792545647151').replaceAll('04450/1792545647151','04451/'+stamp);
// Handle the base path separately where it is intentionally the installed 50.
const common=s=>s.replaceAll('50.mjs','51.mjs').replaceAll('50.py','51.py').replaceAll('qualified50','qualified51').replaceAll('scope50','scope51').replaceAll('update50','update51').replaceAll('Update50.cmd','Update51.cmd').replaceAll('capability8','capability9').replaceAll('capability-8','capability-9');
const read=n=>readFile(path.join(dir,n),'utf8'),save=(n,s)=>writeFile(path.join(dir,n),s,{flag:'wx'});
let s=await read('cleanup-capability8-restore50.mjs');s=s.replaceAll('04450','04451').replaceAll('restore50','restore51').replaceAll('capability8','capability9').replaceAll('capability-8','capability-9');await save('cleanup-capability9-restore51.mjs',s);
s=await read('maintenance-update-command50.mjs');s=replace(s,'04450\\\\1792545647151','04451\\\\'+stamp).replaceAll('update50','update51');await save('maintenance-update-command51.mjs',s);
for(const name of ['test-maintenance-update-command50.mjs','test-maintenance-program50.mjs']){s=common(await read(name)).replaceAll('04450','04451');await save(name.replace('50.mjs','51.mjs'),s);}
s=await read('maintenance-program-rollback50.mjs');s=replace(s,'app-0.44.49','app-0.44.50');s=replace(s,'f3a19ed27797ba86ce052bef8955226fbd5ecb8b9c38ce5d5d7d52baebc42f14',base.imageSha256);s=replace(s,'04449/1792536883499','04450/1792545647151');await save('maintenance-program-rollback51.mjs',s);
s=replace(await read('maintenance-existing-runtime50.py'),'desktop-release-04450','desktop-release-04451');await save('maintenance-existing-runtime51.py',s);
s=common(await read('test-maintenance-existing-runtime50.py'));await save('test-maintenance-existing-runtime51.py',s);
s=await read('verify-maintenance-installation50.py');s=s.replaceAll('app-0.44.49','app-__OLD__').replaceAll('app-0.44.50','app-0.44.51').replaceAll('app-__OLD__','app-0.44.50');await save('verify-maintenance-installation51.py',s);
s=replace(await read('verify-maintenance-portable50.py'),"descriptor['requiresDesktopRecoveryFormat']==8","descriptor['requiresDesktopRecoveryFormat']==9");await save('verify-maintenance-portable51.py',s);
s=common(await read('test-maintenance-application-scope50.mjs')).replaceAll('04450','04451');await save('test-maintenance-application-scope51.mjs',s);
s=common(versions(await read('run-normal-maintenance50.mjs')));s=s.replace(/const currentSha=.*?;/,`const currentSha=${JSON.stringify(base.imageSha256)},nextSha=${JSON.stringify(proof.imageSha256)},setupSha=${JSON.stringify(installer.installerSha256)};`);await save('run-normal-maintenance51.mjs',s);
s=common(versions(await read('qualify-normal-maintenance50.mjs'))).replaceAll('portableCapability===8','portableCapability===9').replaceAll('launcher-batch-test50.log','launcher-batch-test51.log');await save('qualify-normal-maintenance51.mjs',s);
s=await read('request-normal-shutdown50.mjs');s=common(s).replaceAll('0.44.49','0.44.50').replaceAll('ordinary49','ordinary50').replaceAll('04449/1792536883499','04450/1792545647151');await save('request-normal-shutdown51.mjs',s);
s=(await readFile(path.join(root,'Run-Agentopia-Settings-Update50.cmd'),'utf8')).replaceAll('0.44.50','0.44.51').replaceAll('maintenance50.mjs','maintenance51.mjs');await writeFile(path.join(root,'Run-Agentopia-Settings-Update51.cmd'),s,{flag:'wx'});
console.log(JSON.stringify({success:true,version:proof.version,base:base.version,installerInvoked:false,productFilesChanged:false}));
