import {readFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import assert from 'node:assert/strict';
const root=path.resolve(import.meta.dirname,'../..'),candidate=path.join(root,'.supabase/desktop-child-presentation/candidate-0444-r2'),units=JSON.parse(await readFile(path.join(candidate,'units/evidence.json'),'utf8'));assert(units.success&&units.passed===84);const result=spawnSync(process.execPath,['scripts/desktop/test-plugin-child-ui.mjs'],{cwd:root,env:{...process.env,AGENTOPIA_CHILD_EVIDENCE:path.join(candidate,'units'),AGENTOPIA_CHILD_UI_CANDIDATE:candidate,AGENTOPIA_CHILD_PRESENTATION:'1',AGENTOPIA_CHILD_UI_OUTPUT:path.join(candidate,'child-ui')},encoding:'utf8',windowsHide:true,maxBuffer:8*1024*1024});if(result.stdout)process.stdout.write(result.stdout);if(result.stderr)process.stderr.write(result.stderr);assert.equal(result.status,0,'Inspect '+path.join(candidate,'child-ui/evidence.json'));
