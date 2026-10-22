import {readFile,writeFile,mkdir,realpath,lstat,stat} from 'node:fs/promises';
import {writeFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import path from 'node:path';
import assert from 'node:assert/strict';
import {desktopOperation} from './operation-lock.mjs';
desktopOperation('diagnose private plugin review profile paths without inference');
const root=path.resolve(import.meta.dirname,'../..'),base=path.resolve('C:/Users/charl/AgentopiaQA/plugin-compatibility/1792385923176'),cfg=JSON.parse(await readFile(path.join(base,'intent.json'))),prior=JSON.parse(await readFile(path.join(base,'evidence.json'))),sha=bytes=>createHash('sha256').update(bytes).digest('hex'),out=path.join(base,'profile-root-diagnosis-'+Date.now());
assert.equal(cfg.version,'0.44.32');assert(prior.success===false&&prior.checks.length===18);await mkdir(out);
const image=path.join(base,'program/resources/app.asar');assert.equal(sha(await readFile(image)),cfg.imageSha256);
const require=createRequire(path.join(base,'archived/package.json')),{parsePluginArchive}=require('./build/plugin-import.js'),{NativePluginSkills}=require('./build/native-plugin-skills.js'),fixture=prior.publicPlugins.packages.find(p=>p.format==='portable'),pkg=parsePluginArchive(await readFile(fixture.selected));
const evidence={at:new Date().toISOString(),imageSha256:cfg.imageSha256,originalFailure:path.join(base,'evidence.json'),realProviderRequests:0,sqlWrites:0,productionAccess:false,cases:[]};
process.on('uncaughtExceptionMonitor',error=>writeFileSync(path.join(out,'evidence.json'),JSON.stringify({...evidence,fatalError:error.stack},null,2)));
for(const [label,directory]of [['logical',cfg.logicalProfile],['physical',cfg.profile]]){
 const actual=await realpath(directory),st=await lstat(directory),service=new NativePluginSkills({skillPackages:async()=>[]},directory,path.join(base,'program/resources/resources')),entry={label,directory,length:directory.length,actual,actualLength:actual.length,symbolicLink:st.isSymbolicLink(),same:actual.toLowerCase()===directory.toLowerCase()};
 evidence.currentCase=entry;await writeFile(path.join(out,'evidence.json'),JSON.stringify(evidence,null,2));
 try{entry.review=await service.validatePackage(prior.fixtureUser,pkg,async()=>{});entry.success=true;}catch(error){entry.success=false;entry.error=error.stack;}
 evidence.cases.push(entry);await writeFile(path.join(out,'evidence.json'),JSON.stringify(evidence,null,2));console.log(JSON.stringify({label,success:entry.success,rootAliases:!entry.same,error:entry.error?.split('\n')[0],skills:entry.review?.length}));
}
await assert.rejects(stat(prior.publicPlugins.helperMarker),{code:'ENOENT'});evidence.helperExecuted=false;assert.equal(sha(await readFile(image)),cfg.imageSha256);await writeFile(path.join(out,'evidence.json'),JSON.stringify(evidence,null,2));console.log(JSON.stringify({out,cases:evidence.cases.map(e=>({label:e.label,success:e.success}))}));
