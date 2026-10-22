import {readFile,writeFile} from 'node:fs/promises';import path from 'node:path';
const dir=import.meta.dirname,source=await readFile(path.join(dir,'inspect-live-readiness66.mjs'),'utf8');
await writeFile(path.join(dir,'inspect-live-readiness67.mjs'),source.replaceAll('desktop-workspace-paths-release66','desktop-scheduled-workspaces67-release').replaceAll('desktop-live-readiness66','desktop-live-readiness67'),{flag:'wx'});
console.log('Prepared current-package connection metadata inspection with no provider requests.');
