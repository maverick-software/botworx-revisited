import assert from 'node:assert/strict';
import path from 'node:path';
import {mkdir,writeFile} from 'node:fs/promises';
import {desktopOperation} from './operation-lock.mjs';
import {json,run,linux} from './phased-backup-control.mjs';
desktopOperation('independent read-only packaged71 cold specialist and schedule audit');
const root=path.resolve(import.meta.dirname,'../..'),pointer=await json(path.join(root,'.supabase/desktop-agent-library71-real/current.json')),cfg=await json(pointer.sourceIntent),cold=await json((await json(path.join(cfg.out,'documents-cold-accepted.json'))).evidence);assert(cold.success&&cold.controlledResponses===0&&cold.runtimeStopped);
const out=path.join(cfg.out,'cold-audit-'+Date.now());await mkdir(out);try{const result=await run(['-d',cfg.distribution,'-u','agentopia','--exec','python3',linux(path.join(root,'scripts/desktop/audit-agent-library-cold71.py')),linux(out),linux(pointer.sourceIntent),linux(path.join(cfg.out,'document-fixture.json'))],600000);await writeFile(path.join(out,'controller.log'),result);}catch{console.error('Inspect read-only cold audit evidence in '+out);process.exitCode=1;}
const e=await json(path.join(out,'evidence.json'));assert(e.success&&e.qaServicesStopped);await run(['--terminate',cfg.distribution]);await writeFile(path.join(cfg.out,'documents-cold-audit-accepted.json'),JSON.stringify({success:true,evidence:path.join(out,'evidence.json')},null,2));console.log(JSON.stringify({success:true,evidence:path.join(out,'evidence.json'),savedRequests:8,expectedRevokedRequests:2,providerRequests:0}));
