import {mkdir,writeFile,open} from 'node:fs/promises';
import {randomUUID,randomBytes,createHash} from 'node:crypto';
import {spawn} from 'node:child_process';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import {desktopOperation} from './operation-lock.mjs';

desktopOperation('prepare owned component upload fixture without inference');
const root=path.resolve(import.meta.dirname,'../..'),output=path.resolve(process.argv[2]??'');assert(output.startsWith(path.join(root,'.supabase')+path.sep));
await mkdir(output,{recursive:true});const nonce=randomUUID(),tag=randomBytes(3).toString('hex'),filename='report-'+tag+'.txt',directory=path.join(process.env.AGENTOPIA_COMPONENT_UPLOAD_FILE_ROOT??os.tmpdir(),'component-upload-'+nonce);await mkdir(directory,{recursive:true});
const file=path.join(directory,filename),first=Buffer.from('CONTROLLED-FIRST-'+nonce+'\n'),second=Buffer.from('CONTROLLED-EDITED-'+nonce+'\n'),record=bytes=>({size:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')}),config={format:1,nonce,output,file,filename,base:'/component-upload-'+nonce+'/',cookieName:'component-upload-'+randomUUID(),cookieValue:randomUUID(),controlToken:randomUUID(),first:record(first),second:record(second),secondBytes:second.toString('base64'),receipts:[0,1].map(()=> 'UPLOAD-'+randomBytes(8).toString('hex').toUpperCase())};
await writeFile(file,first,{flag:'wx'});const configFile=path.join(output,'config.json');await writeFile(configFile,JSON.stringify(config,null,2),{flag:'wx'});
const stdout=await open(path.join(output,'fixture.log'),'wx'),stderr=await open(path.join(output,'fixture-error.log'),'wx');
const child=spawn(process.execPath,[path.join(import.meta.dirname,'component-upload-fixture.mjs'),configFile],{cwd:root,windowsHide:true,detached:true,stdio:['ignore',stdout.fd,stderr.fd],env:{...process.env,AGENTOPIA_DESKTOP_OPERATION_PID:''}});child.unref();await writeFile(path.join(output,'fixture-process.json'),JSON.stringify({pid:child.pid,configFile},null,2),{flag:'wx'});await stdout.close();await stderr.close();console.log('Prepared owned benign file and persistent loopback fixture; no AI request was submitted.');
