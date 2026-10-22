import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {desktopOperation} from './operation-lock.mjs';
desktopOperation('seal the accepted database, profile, public files and portable reference index');
const root=path.resolve(import.meta.dirname,'../..'),out=path.resolve(process.argv[2]??''),json=async file=>JSON.parse(await readFile(file,'utf8')),sha=bytes=>createHash('sha256').update(bytes).digest('hex');assert.equal(process.argv.length,3);assert.equal(path.dirname(out),path.resolve('D:/Users/charl/AgentopiaRecovery/export-relocation-14'));
const checkpoint=await json(path.join(out,'ui-recovery.json')),publicOutputs=await json(path.join(out,'public-outputs.json')),captured=await json(path.join(out,'public-reference-index.json')),cold=await json(path.join(out,'public-reference-reopened.json'));assert(checkpoint.success&&publicOutputs.success&&captured.success&&cold.success&&cold.directLinks===4&&cold.coldReopeningPassed);
const descriptor={format:2,kind:'agentopia-desktop-recovery',codex:'0.163.0',requiresDesktopRecoveryFormat:2,providerReauthorizationRequired:true,fullApplicationRestoreProven:false};
for(const [field,file]of [['databaseManifest','current-database-backup/manifest.json'],['profileArchive','active-profile.tar.gz'],['profileManifest','private-profile.json'],['publicArchive','public-outputs.tar.gz'],['publicManifest','public-outputs.json'],['references',path.relative(out,captured.recordFile).replaceAll('\\','/')]]){assert(!file.startsWith('../')&&!path.isAbsolute(file));descriptor[field]={file,sha256:sha(await readFile(path.join(out,file)))};}
assert.equal(descriptor.profileArchive.sha256,checkpoint.profileArchiveSha256);assert.equal(descriptor.publicArchive.sha256,publicOutputs.archiveSha256);assert.equal(descriptor.references.sha256,captured.recordSha256);
await writeFile(path.join(out,'desktop-recovery.json'),JSON.stringify(descriptor,null,2),{flag:'wx'});console.log(JSON.stringify({success:true,out,resources:6,descriptorSha256:sha(await readFile(path.join(out,'desktop-recovery.json'))),requiresNewRecoveryRelease:true,productionChanged:false}));
