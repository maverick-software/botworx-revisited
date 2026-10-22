// Preserve the old verified cleanup. The new script can remove only C: app67
// after accepted68 data checks and a verified exact F: program rollback.
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
const directory=import.meta.dirname;
for(const file of ['remove-obsolete-build67.ps1','cleanup-obsolete-build67.mjs']){
 let source=await readFile(path.join(directory,file),'utf8');
 source=source.replace(/0\.44\.(66|67)/g,(_,version)=>'0.44.'+(Number(version)+1))
  .replaceAll('retired66','retired67').replaceAll('current-update67','current-update68')
  .replaceAll('desktop-scheduled-workspaces67-release','desktop-agent-apps68-release')
  .replaceAll('remove-obsolete-build67','remove-obsolete-build68').replaceAll('obsolete-build66','obsolete-build67');
 assert(!source.includes('0.44.66'));
 const target=file.replace('67','68');await writeFile(path.join(directory,target),source,{flag:'wx'});console.log('Prepared '+target);
}
