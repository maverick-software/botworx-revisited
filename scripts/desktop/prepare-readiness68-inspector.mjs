import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
const directory=import.meta.dirname;
let source=await readFile(path.join(directory,'inspect-live-readiness67.mjs'),'utf8');
assert(source.includes('desktop-scheduled-workspaces67-release')&&source.includes('desktop-live-readiness67'));
source=source.replaceAll('desktop-scheduled-workspaces67-release','desktop-agent-apps68-release').replaceAll('desktop-live-readiness67','desktop-live-readiness68');
await writeFile(path.join(directory,'inspect-live-readiness68.mjs'),source,{flag:'wx'});
console.log('Prepared protected read-only connection metadata inspection for68; no refresh or provider requests.');
