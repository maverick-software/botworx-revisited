import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
const source='scripts/desktop/test-agent-draft-preview76-source.mjs',destination='scripts/desktop/test-agent-draft-preview112-source.mjs';
let text=await readFile(source,'utf8');const point='const e={success:false';assert(text.includes(point));
const additions=['prepare-preview-isolation112.mjs','test-preview-connections112-source.mjs','preview-remote-isolation112.mjs','preview-remote112-workflows.mjs','test-preview-connections112-broker.mjs'].map(name=>'scripts/desktop/'+name);
text=text.replace(point,'files.push('+additions.map(name=>JSON.stringify(name)).join(',')+');\r\n'+point).replace("'source-'+Date.now()","'source112-'+Date.now()");
await writeFile(destination,text,{flag:'wx'});
