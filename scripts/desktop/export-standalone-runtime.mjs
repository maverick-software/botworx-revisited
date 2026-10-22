import {spawn,execFileSync} from 'node:child_process';
import {readFile,writeFile,stat} from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import {createHash} from 'node:crypto';
import {Transform} from 'node:stream';
import {pipeline} from 'node:stream/promises';
import tar from 'tar-stream';
import path from 'node:path';
import assert from 'node:assert/strict';
import {desktopOperation} from './operation-lock.mjs';
desktopOperation('stopped original database export and archive verification');
const root=path.resolve(import.meta.dirname,'../..'),out=path.join(root,'.supabase/desktop-standalone/migration'),archive=path.join(out,'runtime.tar'),checkpoint=path.join(out,'runtime-export.json'),wsl=path.join(process.env.SystemRoot,'System32/wsl.exe');
const backup=JSON.parse(await readFile(path.join(out,'backup.json'),'utf8'));assert(backup.success);await readFile(path.join(out,'data-before.json'));
assert.equal(execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',"@(Get-Process Agentopia -ErrorAction SilentlyContinue).Count"],{encoding:'utf8',windowsHide:true}).trim(),'0');
const running=()=>execFileSync(wsl,['--list','--running','--quiet'],{encoding:'utf16le',windowsHide:true}).trim().split(/\r?\n/).map(value=>value.trim()).filter(Boolean);assert(!running().includes('AgentopiaRuntime'));
try{await stat(archive);throw new Error('An export already exists. Inspect its checkpoint and process before recovery; do not export again.');}catch(error){if(error.code!=='ENOENT')throw error;}
const evidence={at:new Date().toISOString(),source:'AgentopiaRuntime',archive,phase:'exporting',parentPid:process.pid,sourceRetained:true,otherRunningBefore:running()};
const child=spawn(wsl,['--export','AgentopiaRuntime',archive],{windowsHide:true,stdio:['ignore','ignore','ignore']});evidence.pid=child.pid;await writeFile(checkpoint,JSON.stringify(evidence,null,2));
try{
 const code=await new Promise((resolve,reject)=>{child.once('error',reject);child.once('exit',resolve);});assert.equal(code,0,'WSL export failed. Preserve its output and checkpoint for inspection.');evidence.exitCode=code;evidence.phase='verifying';await writeFile(checkpoint,JSON.stringify(evidence,null,2));
 const digest=createHash('sha256'),extract=tar.extract();let entries=0,identity='',identityCount=0;
 extract.on('entry',(header,stream,next)=>{entries++;if(header.name.replace(/^\.\//,'')==='opt/agentopia/runtime-identity'){identityCount++;let value='';stream.on('data',chunk=>{value+=chunk.toString('utf8');if(value.length>1024)extract.destroy(new Error('Invalid runtime identity entry.'));});stream.on('end',()=>{identity=value.trim();next();});}else{stream.resume();stream.on('end',next);}});
 await pipeline(createReadStream(archive),new Transform({transform(chunk,_encoding,done){digest.update(chunk);done(null,chunk);}}),extract);
 assert.equal(identityCount,1);assert.equal(identity,'local.agentopia.desktop-runtime.v1');assert(entries>1000);assert(!running().includes('AgentopiaRuntime'));for(const other of evidence.otherRunningBefore)assert(running().includes(other));
 evidence.bytes=(await stat(archive)).size;evidence.sha256=digest.digest('hex');evidence.entries=entries;evidence.identityVerified=true;evidence.phase='completed';evidence.success=true;await writeFile(checkpoint,JSON.stringify(evidence,null,2));console.log(JSON.stringify(evidence));
}catch(error){evidence.success=false;evidence.error=error.message;await writeFile(checkpoint,JSON.stringify(evidence,null,2));throw error;}
