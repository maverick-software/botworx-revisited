import assert from 'node:assert/strict';
import path from 'node:path';
import {mkdir,writeFile} from 'node:fs/promises';
import {desktopOperation} from './operation-lock.mjs';
import {json,hash,run,linux} from './phased-backup-control.mjs';
desktopOperation('long-history file lookup through disposable real PostgreSQL and PostgREST');
const root=path.resolve(import.meta.dirname,'../..'),qualification=await json(path.resolve(process.argv[2]??''));assert(qualification.success&&qualification.build);
for(const [name,digest]of Object.entries(qualification.sourceHashes))assert.equal(await hash(path.join(root,name)),digest,'Frozen source changed: '+name);
const out=path.join(root,'.supabase/desktop-chat-file-history69','postgres-'+Date.now()),temp=path.join('F:/Agentopia-Acceptance',path.basename(out));await mkdir(out);await mkdir(temp);
try{const output=await run(['-d','AgentopiaRuntime-a91a4800-e08f-4440-a4ec-588762d01bfd','-u','agentopia','--exec','python3',linux(path.join(root,'scripts/desktop/test-file-history69-postgres.py')),linux(out),qualification.build,temp],180000);await writeFile(path.join(out,'controller.log'),output);const e=await json(path.join(out,'evidence.json'));assert(e.success);for(const [name,digest]of Object.entries(qualification.sourceHashes))assert.equal(await hash(path.join(root,name)),digest);console.log(JSON.stringify({success:true,out,checks:e.clientChecks.length,installed:false,providerRequests:0}));}catch(error){console.error('Inspect disposable database evidence in '+out);throw error;}
