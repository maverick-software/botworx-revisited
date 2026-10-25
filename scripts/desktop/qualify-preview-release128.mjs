import assert from 'node:assert/strict';
import path from 'node:path';
import {mkdir,readFile,writeFile,readdir} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {desktopOperation} from './operation-lock.mjs';
import {json,hash} from './phased-backup-control.mjs';

desktopOperation('bind the preview release to current source, compiled recovery and complete rendered interface evidence');
const root=path.resolve(import.meta.dirname,'../..'),sourceFile=(await json(path.join(root,'.supabase/desktop-draft-preview76/source-current.json'))).evidence,source=await json(sourceFile),pgFile=(await json(path.join(root,'.supabase/desktop-draft-preview76-postgres/current.json'))).evidence,pg=await json(pgFile),uiFile=path.resolve(process.argv[2]),nativeFile=path.resolve(process.argv[3]),wholeUiFile=(await json(path.join(root,'.supabase/desktop-agent-parity76-app/current.json'))).evidence,ui=await json(uiFile),native=await json(nativeFile),wholeUi=await json(wholeUiFile),out=path.join(root,'.supabase/desktop-draft-preview76','qualified128-'+Date.now()),build=path.join(out,'build'),exec=promisify(execFile);
assert(source.success&&pg.success&&pg.qaServicesStopped&&pg.package125ColdVerified);assert(ui.success&&ui.checks.length===9);assert(native.success&&native.qaServicesStopped&&native.creationPackageNative125?.actualCodex&&native.creationPackageNative125.requests.length===2);assert(wholeUi.success&&wholeUi.checks.length===23);assert.equal(pg.sourceQualification,sourceFile);assert.equal(native.sourceQualification,sourceFile);
const e={success:false,out,build,sourceOnly:true,installed:false,eligibleForFrozenCandidate:false,eligibleForProductionInstallation:false,fullGoalComplete:false,providerRequests:0,sourceHashes:{...source.sourceHashes},commands:[],receipts:{},controllerSha256:await hash(import.meta.filename)};
await mkdir(path.join(out,'tmp'),{recursive:true});
for(const family of['src','ui','runtime','database'])for(const entry of await readdir(path.join(root,'desktop',family),{recursive:true,withFileTypes:true})){if(!entry.isFile()||entry.name.endsWith('.pyc')||entry.parentPath.includes('__pycache__'))continue;const file=path.join(entry.parentPath,entry.name);e.sourceHashes[path.relative(root,file).replaceAll('\\','/')]=await hash(file);}
for(const[file,digest]of Object.entries(source.sourceHashes))assert.equal(e.sourceHashes[file],digest,file);
for(const[file,digest]of Object.entries(wholeUi.sourceHashes))assert.equal(await hash(path.join(root,file)),digest,file);
const env={...process.env,TEMP:path.join(out,'tmp'),TMP:path.join(out,'tmp')};delete env.ELECTRON_RUN_AS_NODE;delete env.NODE_OPTIONS;
async function command(name,args){try{const r=await exec(process.execPath,args,{cwd:root,env,windowsHide:true,timeout:120000,maxBuffer:1024*1024});await writeFile(path.join(out,name+'.log'),r.stdout+r.stderr);e.commands.push({name,success:true});return r.stdout;}catch(error){await writeFile(path.join(out,name+'.log'),String(error.stdout??'')+String(error.stderr??''));throw error;}}
try{
 await command('backend-types',['node_modules/typescript/bin/tsc','-p','desktop/tsconfig.json','--outDir',build,'--noEmitOnError']);await writeFile(path.join(build,'package.json'),'{"type":"commonjs"}');
 e.compiled={};for(const entry of await readdir(build,{recursive:true,withFileTypes:true})){if(!entry.isFile()||!/\.(js|json)$/.test(entry.name))continue;const file=path.join(entry.parentPath,entry.name),name=path.relative(build,file).replaceAll('\\','/'),digest=await hash(file);assert.equal(digest,await hash(path.join(source.build,name)),name+' differs from the build used by source and integration acceptance');e.compiled[name]=digest;}
 const recoveryFile=path.join(root,'.supabase/desktop-draft-preview76/recovery124-1792848860709/evidence.json'),recovery=await json(recoveryFile),recoverySource=await json(recovery.sourceQualification);assert(recovery.success&&recovery.actualWindowsEncryption&&recovery.actualPostgresImport&&recovery.sameWindowsUser);
 e.reusedEncryptedRecoveryModules={};for(const name of['recovery-startup.js','runtime.js','portable-backup.js','windows-credential-backup.js']){assert.equal(e.compiled[name],await hash(path.join(recoverySource.build,name)),name+' requires fresh encrypted recovery acceptance');e.reusedEncryptedRecoveryModules[name]=e.compiled[name];}e.receipts.encryptedRecovery={file:recoveryFile,sha256:await hash(recoveryFile)};
 const loader=path.join(out,'loader.cjs'),oldLoader=await readFile(path.join(source.out,'loader.cjs'),'utf8');assert(oldLoader.includes(JSON.stringify(source.build)));await writeFile(loader,oldLoader.replace(JSON.stringify(source.build),JSON.stringify(build)));
 const result=await command('recovery-startup',['--require',loader,'--test','--test-reporter=tap','desktop/tests/recovery-startup.test.cjs']);e.recoveryStartupCases=Number(result.match(/^# pass (\d+)/m)?.[1]);assert(e.recoveryStartupCases>0);
 for(const[name,file]of Object.entries({source:sourceFile,postgres:pgFile,skillsUi:uiFile,native:nativeFile,wholeUi:wholeUiFile}))e.receipts[name]={file,sha256:await hash(file)};
 for(const[file,digest]of Object.entries(e.sourceHashes))assert.equal(await hash(path.join(root,file)),digest,file);
 e.success=true;e.eligibleForFrozenCandidate=true;
}catch(error){e.error=error.stack;process.exitCode=1;}
const file=path.join(out,'evidence.json');await writeFile(file,JSON.stringify(e,null,2));if(e.success)await writeFile(path.join(root,'.supabase/desktop-draft-preview76/qualified128-current.json'),JSON.stringify({evidence:file},null,2));console.log(JSON.stringify({success:e.success,out,compiledModules:Object.keys(e.compiled??{}).length,recoveryStartupCases:e.recoveryStartupCases,eligibleForFrozenCandidate:e.eligibleForFrozenCandidate,error:e.error}));
