import path from 'node:path';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {desktopOperation} from './operation-lock.mjs';
import {hash,json} from './phased-backup-control.mjs';
desktopOperation('qualify creation package skill ownership125');
const root=path.resolve(import.meta.dirname,'../..'),out=path.join(root,'.supabase/desktop-draft-preview76','package125-unit-'+Date.now()),build=process.env.AGENTOPIA_PACKAGE125_BASE_BUILD??path.join(out,'build');await mkdir(out,{recursive:true});
const e={success:false,out,build,productionAccess:false,providerRequests:0,commands:[]};
async function run(name,args){const child=spawn(process.execPath,args,{cwd:root,windowsHide:true,env:{...process.env,AGENTOPIA_PREVIEW_BUILD:build}});let log='';for(const stream of[child.stdout,child.stderr])stream.on('data',bytes=>log+=bytes);const code=await new Promise((resolve,reject)=>{child.once('error',reject);child.once('close',resolve);});await writeFile(path.join(out,name+'.log'),log);e.commands.push({name,code});assert.equal(code,0,log.slice(-5000));return Number(log.match(/^# pass (\d+)/m)?.[1]??0);}
try{if(!process.env.AGENTOPIA_PACKAGE125_BASE_BUILD){await run('backend-types',['node_modules/typescript/bin/tsc','-p','desktop/tsconfig.json','--outDir',build,'--noEmitOnError']);await writeFile(path.join(build,'package.json'),'{"type":"commonjs"}');await run('interface-types',['node_modules/typescript/bin/tsc','-p','desktop/ui/tsconfig.json']);}e.cases=await run('creation-package',['--test','--test-reporter=tap','--test-concurrency=1','desktop/tests/creation-package-skills125.test.cjs','desktop/tests/preview-plugin-files.test.cjs','desktop/tests/preview-creation-resources.test.cjs']);e.success=true;}catch(error){e.error=error.stack;process.exitCode=1;}
e.controllerSha256=await hash(import.meta.filename);await writeFile(path.join(out,'evidence.json'),JSON.stringify(e,null,2));console.log(JSON.stringify({success:e.success,out,cases:e.cases,error:e.error?.slice(-1500)}));
