import assert from 'node:assert/strict';
import path from 'node:path';
import {mkdir,writeFile} from 'node:fs/promises';
import {desktopOperation} from './operation-lock.mjs';
import {prepareOwnedRuntime75} from './prepare-owned-runtime75.mjs';
import {json,hash} from './phased-backup-control.mjs';
desktopOperation('prepare fresh isolated installed75 Computer Use and longer live-task acceptance');
const root=path.resolve(import.meta.dirname,'../..'),records=path.join(root,'.supabase/desktop-live-validation76');await mkdir(records,{recursive:true});
const current=path.join(records,'current.json');
try{await json(current);throw Error('Inspect the existing validation runtime before preparing another');}catch(error){if(error.code!=='ENOENT')throw error;}
const candidateFile=(await json(path.join(root,'.supabase/desktop-agent-creation75-candidate/current.json'))).proof,proof=await json(candidateFile);
const installed='C:/Users/charl/AppData/Local/AgentopiaDesktop/app-0.44.75/resources/app.asar';assert.equal(await hash(installed),proof.imageSha256);
const parent=path.join(root,'.supabase/desktop-agent-creation75-packaged','76-live-'+Date.now());await mkdir(parent,{recursive:true});
await writeFile(current,JSON.stringify({parent,candidateFile,sourceIntent:path.join(parent,'source/intent.json'),purpose:'fresh live Computer Use and longer autonomous acceptance76',priorFixtureReused:false},null,2),{flag:'wx'});
await prepareOwnedRuntime75({parent,role:'source',candidateFile});
