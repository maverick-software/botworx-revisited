import assert from 'node:assert/strict';
import path from 'node:path';
import {readFile,writeFile} from 'node:fs/promises';
const directory=import.meta.dirname,old=await readFile(path.join(directory,'qualify-agent-controls-04466.mjs'),'utf8');let source=old;
for(const [from,to]of [['0.44.66','0.44.67'],['.supabase/desktop-workspace-paths-release66/current.json','.supabase/desktop-scheduled-workspaces67-candidate/current.json'],['.supabase/desktop-agent-controls66','.supabase/desktop-agent-controls67'],["'controls66-'","'controls67-'"],['evidence.passed===1006','evidence.passed>=1008']]){assert(source.includes(from),from);source=source.replaceAll(from,to);}
const file=path.join(directory,'qualify-agent-controls67.mjs');await writeFile(file,source,{flag:'wx'});console.log(JSON.stringify({success:true,file,source:'qualified 0.44.66 archived-module harness',newCandidate:true,productionAccess:false}));
