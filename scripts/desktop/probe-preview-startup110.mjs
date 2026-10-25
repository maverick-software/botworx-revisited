import assert from 'node:assert/strict';
import path from 'node:path';
import {createRequire} from 'node:module';
import {writeFile} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {json,hash,list} from './phased-backup-control.mjs';
import {desktopOperation} from './operation-lock.mjs';

desktopOperation('diagnose the failed isolated preview migration without ordinary profile access');
const root=path.resolve(import.meta.dirname,'../..'),out=path.join(root,'.supabase/desktop-draft-preview76-postgres/1792817500707'),intent=await json(path.join(out,'intent.json')),source=await json(intent.sourceFile),require=createRequire(import.meta.url),Module=require('node:module'),originalLoad=Module._load,exec=promisify(execFile);
assert(!(await list(true)).includes(intent.distribution));assert.equal(intent.distribution,'AgentopiaRuntime-1484f0b2-ae1f-4daf-94b4-96c888ef3f0a');
for(const[file,digest]of Object.entries(source.sourceHashes))assert.equal(await hash(path.join(root,file)),digest,file);
Module._load=function(name,...args){if(name==='electron')return {app:{isPackaged:false,getPath:()=>intent.profile},safeStorage:{}};return originalLoad.call(this,name,...args);};let Runtime;try{({Runtime}=require(path.join(source.build,'runtime.js')));}finally{Module._load=originalLoad;}
const e={probeCompleted:false,ordinaryProfileAccess:false,providerRequests:0,distribution:intent.distribution,sourceQualification:intent.sourceFile,controllerSha256:await hash(import.meta.filename),expectedRepaired:process.argv.includes('--expect-repaired'),resourceSqlSha256:await hash(path.join(intent.assets,'database/0074-agent-draft-previews.sql')),originalSqlSha256:source.sourceHashes['desktop/database/0074-agent-draft-previews.sql'],failures:[]},runtime=new Runtime(intent.assets,intent.profile,status=>console.log('Diagnostic runtime: '+status.message));
runtime.wsl=async(args,timeout=240000)=>{try{return (await exec('wsl.exe',args,{windowsHide:true,timeout,maxBuffer:16*1024*1024,encoding:'utf8'})).stdout.replaceAll('\0','').replace(/^\uFEFF/,'');}catch(error){const raw=String(error.stdout??'')+'\n'+String(error.stderr??''),file=path.join(out,(e.expectedRepaired?'startup-repaired-private-':'startup-probe-private-')+e.failures.length+'.txt');await writeFile(file,raw,{flag:'wx'});const lines=raw.split(/\r?\n/).filter(line=>/^(?:psql:|ERROR:|LINE \d+:)/.test(line)).map(line=>line.slice(0,1000));e.failures.push({command:args.includes('provision')?'provision':'runtime-maintenance',exitCode:error.code,privateLog:file,privateLogSha256:await hash(file),diagnosticLines:lines});throw Error('The isolated runtime command failed; private diagnostics were preserved.');}};
try{await runtime.start();e.startupSucceeded=true;}catch(error){e.error=String(error);}finally{await runtime.stop();e.qaServicesStopped=!(await list(true)).includes(intent.distribution);e.probeCompleted=true;await writeFile(path.join(out,e.expectedRepaired?'startup-repaired-evidence.json':'startup-probe-evidence.json'),JSON.stringify(e,null,2));}
if(e.expectedRepaired){assert.equal(e.startupSucceeded,true);assert.notEqual(e.resourceSqlSha256,e.originalSqlSha256);assert(e.qaServicesStopped);}console.log(JSON.stringify({probeCompleted:e.probeCompleted,startupSucceeded:e.startupSucceeded??false,qaServicesStopped:e.qaServicesStopped,failures:e.failures.map(({command,exitCode,diagnosticLines})=>({command,exitCode,diagnosticLines}))}));
