import assert from 'node:assert/strict';
import path from 'node:path';
import {mkdir,writeFile} from 'node:fs/promises';
import {desktopOperation} from './operation-lock.mjs';
import {json,hash,run,linux} from './phased-backup-control.mjs';
desktopOperation('qualify persistent documents in the complete owned restored QA database');
const root=path.resolve(import.meta.dirname,'../..'),qualification=await json((await json(path.join(root,'.supabase/desktop-agent-documents70/current.json'))).evidence);assert(qualification.success);
for(const [file,digest]of Object.entries(qualification.sourceHashes))assert.equal(await hash(path.join(root,file)),digest);
const out=path.join(root,'.supabase/desktop-agent-documents70','postgres-'+Date.now()),temp=path.join('F:/Agentopia-Acceptance',path.basename(out));await mkdir(out);await mkdir(temp);
try{const output=await run(['-d','AgentopiaRuntime-0d473265-a4e8-4919-9e7f-9181ae61fed5','-u','agentopia','--exec','python3',linux(path.join(root,'scripts/desktop/test-agent-documents70-postgres.py')),linux(out),qualification.build,temp],600000);await writeFile(path.join(out,'controller.log'),output);}catch{console.error('The QA database check stopped. Inspect '+out);process.exitCode=1;}
const e=await json(path.join(out,'evidence.json'));for(const [file,digest]of Object.entries(qualification.sourceHashes))assert.equal(await hash(path.join(root,file)),digest);console.log(JSON.stringify({success:e.success,out,checks:e.checks.length,sourceOnly:true,installed:false,productionAccess:false,providerRequests:0,error:e.error}));if(!e.success)process.exitCode=1;
