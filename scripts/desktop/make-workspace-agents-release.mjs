import {spawnSync} from 'node:child_process';
import {readFileSync,writeFileSync,readdirSync,statSync,realpathSync,existsSync,createReadStream} from 'node:fs';
import {createHash} from 'node:crypto';
import path from 'node:path';
import assert from 'node:assert/strict';
import {desktopOperation} from './operation-lock.mjs';
desktopOperation('make private persistent-agent installer');
const root=path.resolve(import.meta.dirname,'../..'),candidate=path.join(root,'.supabase/desktop-workspace-agents/candidate-0440'),stage=path.join(candidate,'staging');
const json=file=>JSON.parse(readFileSync(file,'utf8')),hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const hashFile=async file=>{const digest=createHash('sha256');for await(const bytes of createReadStream(file))digest.update(bytes);return digest.digest('hex');};
assert(json(path.join(candidate,'package-proof.json')).success);assert(json(path.join(candidate,'../built-ui/evidence.json')).success);assert.equal(json(path.join(stage,'package.json')).version,'0.44.0');assert.equal(realpathSync(stage).toLowerCase(),stage.toLowerCase());assert(realpathSync(path.join(stage,'out')).toLowerCase().startsWith(candidate.toLowerCase()+path.sep));
// Same bounded large-payload helper adjustment used by desktop:make. Restore
// the three pinned vendor files in finally, including on Forge failure.
const helpers=['WriteZipToSetup.exe','rcedit.exe','Setup.exe'].map(name=>{const file=path.join(root,'node_modules/electron-winstaller/vendor',name),original=readFileSync(file),adjusted=Buffer.from(original),pe=adjusted.readUInt32LE(0x3c);assert.equal(adjusted.toString('ascii',pe,pe+4),'PE\0\0');if(adjusted.readUInt16LE(pe+4)===0x14c)adjusted.writeUInt16LE(adjusted.readUInt16LE(pe+22)|0x20,pe+22);return {file,original,adjusted};});
try{for(const helper of helpers)writeFileSync(helper.file,helper.adjusted);const forge=json(path.join(root,'node_modules/@electron-forge/cli/package.json'));const result=spawnSync(process.execPath,[path.join(root,'node_modules/@electron-forge/cli',forge.bin['electron-forge']),'make',stage],{cwd:root,env:process.env,stdio:'inherit',windowsHide:true});assert.equal(result.status,0,'Private installer creation failed. Inspect Squirrel output before repeating.');}finally{for(const helper of helpers)writeFileSync(helper.file,helper.original);}
for(const helper of helpers)assert.equal(hash(readFileSync(helper.file)),hash(helper.original));
const directory=path.join(stage,'out/make/squirrel.windows/x64'),full=readdirSync(directory).find(name=>name.endsWith('-full.nupkg')),installer=path.join(directory,'AgentopiaSetup.exe');assert(full&&existsSync(installer));assert(statSync(installer).size>=statSync(path.join(directory,full)).size*.9,'Installer payload was not embedded.');
const image=path.join(stage,'out/Agentopia-win32-x64/resources/app.asar'),proof=json(path.join(candidate,'package-proof.json'));assert.equal(hash(readFileSync(image)),proof.imageSha256,'The installer rebuild changed the qualified application image. Requalify before installation.');
const result={success:true,at:new Date().toISOString(),version:'0.44.0',installer,installerSha256:await hashFile(installer),installerBytes:statSync(installer).size,imageSha256:proof.imageSha256,vendorHelpersRestored:true,installed:false,productionMigrated:false,liveAcceptancePending:true};writeFileSync(path.join(candidate,'installer-proof.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
