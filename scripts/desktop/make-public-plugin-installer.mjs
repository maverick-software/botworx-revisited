import {readFile,writeFile,mkdir,cp,readdir,stat,realpath,statfs} from 'node:fs/promises';
import {createReadStream,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import path from 'node:path';
import assert from 'node:assert/strict';
import {desktopOperation} from './operation-lock.mjs';

desktopOperation('make installer from qualified platform payload');
const root=path.resolve(import.meta.dirname,'../..'),work=path.join(root,'.supabase/desktop-platform-release/candidate-04432'),version='0.44.32';
const require=createRequire(import.meta.url),json=async file=>JSON.parse(await readFile(file,'utf8'));
const hash=async file=>{const h=createHash('sha256');for await(const bytes of createReadStream(file))h.update(bytes);return h.digest('hex');};
assert(!existsSync(path.join(work,'delivery-blocker.json')),'This candidate has a reproduced application failure and cannot be packaged for installation.');
const proof=await json(path.join(work,'package-proof.json')),qualified=await json(path.join(work,'qualification.json'));
assert(proof.success&&qualified.success&&proof.version===version&&proof.migrations===69);assert.equal(proof.imageSha256,qualified.imageSha256);assert.equal(await hash(proof.image),qualified.imageSha256);
const accepted=await json(path.join(work,'full-packaged-acceptance.json'));assert(accepted.success&&accepted.version===version&&accepted.schema===69&&accepted.checks.length===30&&accepted.publicPlugins.phase==='cold-reopen-verified');assert.equal(accepted.imageSha256,proof.imageSha256);assert.equal(await hash(accepted.evidence),accepted.evidenceSha256);
// The maker adds Squirrel.exe to its input. Give it an independent copy so the
// qualified portable package and every previous candidate remain immutable.
const artifacts=path.resolve('C:/Users/charl/AgentopiaQA/plugin-installer');await mkdir(artifacts,{recursive:true});assert.equal((await realpath(artifacts)).toLowerCase(),artifacts.toLowerCase());const capacity=await statfs(artifacts);assert(capacity.bavail*capacity.bsize>15*1024**3);const job=path.join(artifacts,String(Date.now()));await mkdir(job);const stage=path.join(job,'input'),out=path.join(job,'installer');
await writeFile(path.join(work,'installer-intent.json'),JSON.stringify({at:new Date().toISOString(),pid:process.pid,version,source:proof.portableDirectory,imageSha256:proof.imageSha256,artifactRoot:job,stage,out,installed:false,productionMigrated:false}),{flag:'wx'});
await cp(proof.portableDirectory,stage,{recursive:true});await mkdir(out);
const vendor=path.join(root,'node_modules/electron-winstaller/vendor'),originals=path.join(job,'helper-originals');await mkdir(originals);
const helpers=[];
for(const name of ['WriteZipToSetup.exe','rcedit.exe','Setup.exe']){
 const file=path.join(vendor,name),original=await readFile(file),adjusted=Buffer.from(original),pe=adjusted.readUInt32LE(0x3c);assert.equal(adjusted.toString('ascii',pe,pe+4),'PE\0\0');
 if(adjusted.readUInt16LE(pe+4)===0x14c)adjusted.writeUInt16LE(adjusted.readUInt16LE(pe+22)|0x20,pe+22);
 await writeFile(path.join(originals,name),original,{flag:'wx'});helpers.push({file,original,adjusted});
}
try{
 for(const helper of helpers)await writeFile(helper.file,helper.adjusted);
 await require('electron-winstaller').createWindowsInstaller({appDirectory:stage,outputDirectory:out,name:'AgentopiaDesktop',version,exe:'Agentopia.exe',setupExe:'AgentopiaSetup.exe',authors:'Agentopia',description:'Agentopia private desktop workspace',noMsi:true});
}finally{for(const helper of helpers)await writeFile(helper.file,helper.original);}
for(const helper of helpers)assert.equal(await hash(helper.file),createHash('sha256').update(helper.original).digest('hex'));
assert.equal(await hash(proof.image),qualified.imageSha256);assert.equal(await hash(path.join(stage,'resources/app.asar')),qualified.imageSha256);
const full=(await readdir(out)).find(name=>name.endsWith('-full.nupkg')),installer=path.join(out,'AgentopiaSetup.exe');assert(full);assert((await stat(installer)).size>(await stat(path.join(out,full))).size*.9);
const result={artifactRoot:job,stage,helperOriginals:originals,success:true,at:new Date().toISOString(),version,installer,installerSha256:await hash(installer),installerBytes:(await stat(installer)).size,fullPackage:path.join(out,full),imageSha256:qualified.imageSha256,migrations:69,madeFromExistingQualifiedPackage:true,vendorHelpersRestored:true,installed:false,productionMigrated:false,liveAcceptancePending:false};
await writeFile(path.join(work,'installer-proof.json'),JSON.stringify(result,null,2),{flag:'wx'});console.log(JSON.stringify(result,null,2));
