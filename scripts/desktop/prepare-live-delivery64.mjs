import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
const folder=import.meta.dirname;
const source=await readFile(path.join(folder,'inspect-live-readiness63.mjs'),'utf8');assert(source.includes('desktop-pdf-pages-release63')&&source.includes('desktop-live-readiness63'));
await writeFile(path.join(folder,'inspect-live-readiness64.mjs'),source.replaceAll('desktop-pdf-pages-release63','desktop-google-editor-release64').replaceAll('desktop-live-readiness63','desktop-live-readiness64'),{flag:'wx'});
console.log(JSON.stringify({prepared:'read-only64 connection metadata inspection',productionWrites:0,providerRequests:0}));
