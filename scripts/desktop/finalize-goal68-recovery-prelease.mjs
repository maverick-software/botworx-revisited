import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
const file=path.join(import.meta.dirname,'test-autonomous-goal68-recovery.mjs');let text=await readFile(file,'utf8');
assert(text.includes('path:req.url,at:'));text=text.replace('path:req.url,at:',"path:req.url,deniedAlreadyRead:Number(req.url.split('/').at(-1))<3,at:");
assert(text.includes("assert(e.httpRequests.every(row=>Number(row.path.split('/').at(-1))>=3));"));text=text.replace("assert(e.httpRequests.every(row=>Number(row.path.split('/').at(-1))>=3));","assert(e.httpRequests.filter(row=>!row.deniedAlreadyRead).every(row=>Number(row.path.split('/').at(-1))>=3));");await writeFile(file,text);
const review=path.join(import.meta.dirname,'review-autonomous-goal68-recovery.mjs');text=await readFile(review,'utf8');text=text.replace("assert(e.httpRequests.length===9&&e.httpRequests.every(row=>Number(row.path.split('/').at(-1))>=3));assert.equal(new Set(e.httpRequests.map(row=>row.path)).size,9);","const successfulReads=e.httpRequests.filter(row=>!row.deniedAlreadyRead);assert(successfulReads.length===9&&successfulReads.every(row=>Number(row.path.split('/').at(-1))>=3));assert.equal(new Set(successfulReads.map(row=>row.path)).size,9);");await writeFile(review,text);
console.log('The already-read pages remain unavailable; an automatically reopened tab may be closed without a new model read.');
