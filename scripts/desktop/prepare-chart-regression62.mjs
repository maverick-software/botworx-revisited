import assert from 'node:assert/strict';
import path from 'node:path';
import {readFile,writeFile} from 'node:fs/promises';
const folder=import.meta.dirname;
let source=await readFile(path.join(folder,'test-presentation-viewer.mjs'),'utf8');
const old="path.resolve('C:/Users/charl/AgentopiaQA/presentation-viewer',String(Date.now()))";
assert(source.includes(old));source=source.replace(old,"path.join(root,'.supabase/desktop-chart-regression62',String(Date.now()))").replaceAll('.supabase/desktop-presentation-ui/current.json','.supabase/desktop-chart-regression62/current.json');
await writeFile(path.join(folder,'test-chart-regression62.mjs'),source,{flag:'wx'});console.log(JSON.stringify({success:true,newOutputDrive:'F:',productionAccess:false,providerRequests:0}));
