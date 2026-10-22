import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
const folder=import.meta.dirname,source=await readFile(path.join(folder,'qualify-agent-controls-04464.mjs'),'utf8');assert(source.includes('desktop-google-editor-release64')&&source.includes('evidence.passed>=962'));
const target=source.replaceAll('desktop-google-editor-release64','desktop-delivery-repair-release65').replaceAll('desktop-agent-controls64','desktop-agent-controls65').replaceAll('controls64-','controls65-').replaceAll('0.44.64','0.44.65').replace('evidence.passed>=962','evidence.passed===1004');await writeFile(path.join(folder,'qualify-agent-controls-04465.mjs'),target,{flag:'wx'});console.log(JSON.stringify({prepared:true,expectedChecks:1004,providerRequests:0}));
