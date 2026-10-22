import {_electron} from '@playwright/test';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import {createHash,randomUUID} from 'node:crypto';
import path from 'node:path';
import assert from 'node:assert/strict';
import {desktopOperation} from './operation-lock.mjs';
desktopOperation('Electron migration archive checksum regression');
const root=path.resolve(import.meta.dirname,'../..'),out=path.join(root,'.supabase/desktop-standalone/archive-check-'+randomUUID()),image=path.join(root,'desktop/staging/out/Agentopia-win32-x64/resources/app.asar');await mkdir(out,{recursive:true});
const digest=createHash('sha256');for await(const bytes of createReadStream(image))digest.update(bytes);const expected=digest.digest('hex'),identity=randomUUID(),target=path.join(out,'fake-appdata','Agentopia'),stage=path.join(out,'fake-source');
await writeFile(path.join(out,'adoption.json'),JSON.stringify({format:1,instanceId:identity,source:stage,target,success:true}));
const config={format:1,version:'0.43.0',output:out,appData:path.dirname(target),stage,image,imageSha256:expected,resources:path.join(root,'desktop/staging/out/Agentopia-win32-x64/resources/resources'),binding:{format:1,distribution:'AgentopiaRuntime-'+identity,instanceId:identity}};
const entry=path.join(out,'main.cjs');
await mkdir(path.join(out,'helper-profile'));
await writeFile(entry,`const {app}=require('electron'),fs=require('node:fs');app.setPath('userData',${JSON.stringify(path.join(out,'helper-profile'))});app.whenReady().then(async()=>{let result;try{await require(${JSON.stringify(path.join(root,'desktop/runtime/adopt-standalone.cjs'))})(${JSON.stringify(config)},${JSON.stringify(path.dirname(target))});result={success:false,error:'Completed checkpoints must refuse adoption.'};}catch(error){result={success:error.message.includes('This adoption is already complete.'),error:error.message};}fs.writeFileSync(${JSON.stringify(path.join(out,'result.json'))},JSON.stringify(result));});`);
let app;try{app=await _electron.launch({executablePath:path.join(root,'node_modules/electron/dist/electron.exe'),args:[entry],timeout:60000});let result;for(let n=0;n<200;n++){try{result=JSON.parse(await readFile(path.join(out,'result.json'),'utf8'));break;}catch(error){if(error.code!=='ENOENT')throw error;}await new Promise(resolve=>setTimeout(resolve,100));}assert(result?.success,result?.error??'Electron archive regression timed out.');console.log('PASS actual Electron: raw application-archive checksum matches Node; an already completed migration stops before Windows profile access.');}finally{await app?.close();}
