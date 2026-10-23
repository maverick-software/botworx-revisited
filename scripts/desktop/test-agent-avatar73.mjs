import assert from 'node:assert/strict';
import path from 'node:path';
import {mkdir,writeFile} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {createRequire} from 'node:module';
import {desktopOperation} from './operation-lock.mjs';
import {json,hash} from './phased-backup-control.mjs';
desktopOperation('verify actual73 raster decoding, crop and thumbnail formats');
const root=path.resolve(import.meta.dirname,'../..'),sourceFile=(await json(path.join(root,'.supabase/desktop-agent-presentation73/current.json'))).evidence,source=await json(sourceFile);assert(source.success);for(const [file,digest]of Object.entries(source.sourceHashes))assert.equal(await hash(path.join(root,file)),digest,file);
const out=path.join(root,'.supabase/desktop-agent-presentation73','raster-'+Date.now()),require=createRequire(import.meta.url);await mkdir(path.join(out,'temp'),{recursive:true});await mkdir(path.join(out,'profile'));const config=path.join(out,'config.json');await writeFile(config,JSON.stringify({out,build:source.build}));const env={...process.env,TEMP:path.join(out,'temp'),TMP:path.join(out,'temp')};delete env.ELECTRON_RUN_AS_NODE;delete env.NODE_OPTIONS;
try{const result=await promisify(execFile)(require('electron'),[path.join(root,'scripts/desktop/test-agent-avatar73-electron.cjs'),config],{cwd:root,env,windowsHide:true,timeout:60000,maxBuffer:1024*1024});await writeFile(path.join(out,'raster.log'),result.stdout+result.stderr);const e=await json(path.join(out,'raster-evidence.json'));assert(e.success);e.sourceQualification=sourceFile;e.controllerSha256=await hash(import.meta.filename);e.fixtureSha256=await hash(path.join(root,'scripts/desktop/test-agent-avatar73-electron.cjs'));await writeFile(path.join(out,'evidence.json'),JSON.stringify(e,null,2));console.log(JSON.stringify({success:true,evidence:path.join(out,'evidence.json'),checks:e.checks.length}));}catch(error){console.error('Raster verification needs inspection: '+out);if(error.stdout)console.log(String(error.stdout).slice(-3000));process.exitCode=1;}
