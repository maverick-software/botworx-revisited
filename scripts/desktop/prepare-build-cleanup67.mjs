// Scope cleanup to the previous ordinary installed build, after new acceptance.
import {readFile,writeFile} from 'node:fs/promises';import path from 'node:path';
const dir=import.meta.dirname,bump=text=>text.replace(/0\.44\.(65|66)/g,(_,n)=>'0.44.'+(Number(n)+1));
let ps=bump(await readFile(path.join(dir,'remove-obsolete-build66.ps1'),'utf8')).replaceAll('obsolete-build65','obsolete-build66');
await writeFile(path.join(dir,'remove-obsolete-build67.ps1'),ps,{flag:'wx'});
let js=bump(await readFile(path.join(dir,'cleanup-obsolete-build66.mjs'),'utf8')).replace('retired56','retired66').replaceAll('current-update66','current-update67').replaceAll('desktop-workspace-paths-release66','desktop-scheduled-workspaces67-release').replaceAll('remove-obsolete-build66','remove-obsolete-build67').replaceAll('obsolete-build65','obsolete-build66');
await writeFile(path.join(dir,'cleanup-obsolete-build67.mjs'),js,{flag:'wx'});
console.log('Prepared exact previous-build cleanup; installed acceptance and verified F rollback are mandatory.');
