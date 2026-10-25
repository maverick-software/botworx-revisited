import assert from 'node:assert/strict';
import path from 'node:path';
import {createRequire} from 'node:module';
import {spawn} from 'node:child_process';
import * as fs from 'node:fs/promises';
import {desktopOperation} from './operation-lock.mjs';
import {json,hash} from './phased-backup-control.mjs';

desktopOperation('reproduce a Windows sharing refusal during native skill publication');
assert.equal(process.platform,'win32');
const root=path.resolve(import.meta.dirname,'../..'),sourceFile=process.argv[2]?path.resolve(process.argv[2]):path.join(root,'.supabase/desktop-draft-preview76/source-1792814785190/evidence.json'),expectRepaired=process.argv.includes('--expect-repaired'),source=await json(sourceFile),out=path.join(root,'.supabase/desktop-draft-preview76','rename109-probe-'+Date.now()),workspace=path.join('F:/Agentopia-Acceptance','rename109-'+Date.now()),require=createRequire(import.meta.url),promises=require('node:fs/promises'),rename=promises.rename;
await fs.mkdir(out,{recursive:true});await fs.mkdir(workspace,{recursive:true});
const {capturePreviewWorkspaceSkills,NativePreviewWorkspaceSkills}=require(path.join(source.build,'preview-workspace-skills.js')),skill=path.join(workspace,'.agents/skills/proof'),selection=path.join(skill,'SKILL.md');await fs.mkdir(skill,{recursive:true});await fs.writeFile(selection,'---\nname: proof\ndescription: Windows publication probe.\n---\nExact captured note109\n');
const snapshot=await capturePreviewWorkspaceSkills('rename-probe109',[{id:'owned-folder109',path:workspace,kind:'folder'}],[selection],async()=>{},()=>{}),e={success:false,sourceQualification:sourceFile,sourceQualificationSha256:await hash(sourceFile),controllerSha256:await hash(import.meta.filename),realProviderRequests:0,ordinaryProfileAccess:false,windowsHandle:true,expectRepaired,denials:[]};
const python=String.raw`import ctypes,sys
from ctypes import wintypes
k=ctypes.WinDLL('kernel32',use_last_error=True)
k.CreateFileW.argtypes=[wintypes.LPCWSTR,wintypes.DWORD,wintypes.DWORD,ctypes.c_void_p,wintypes.DWORD,wintypes.DWORD,wintypes.HANDLE]
k.CreateFileW.restype=wintypes.HANDLE
k.CloseHandle.argtypes=[wintypes.HANDLE]
h=k.CreateFileW(sys.argv[1],0x80000000,3,None,3,0x02000000,None)
if h==ctypes.c_void_p(-1).value: raise ctypes.WinError(ctypes.get_last_error())
print('LOCKED',flush=True)
sys.stdin.readline()
assert k.CloseHandle(h)
`;
let held=false;
promises.rename=async(from,to)=>{
 if(held)return rename(from,to);held=true;
 const child=spawn('python',['-c',python,from],{windowsHide:true,stdio:['pipe','pipe','pipe']});let output='',error='';child.stderr.on('data',bytes=>error+=bytes);await new Promise((resolve,reject)=>{child.once('error',reject);child.stdout.on('data',bytes=>{output+=bytes;if(output.includes('LOCKED'))resolve();});child.once('exit',code=>{if(!output.includes('LOCKED'))reject(Error(error||'Handle helper exited '+code));});});
 try{return await rename(from,to);}catch(error){e.denials.push({code:error.code,syscall:error.syscall,targetExisted:await fs.lstat(to).then(()=>true,()=>false)});throw error;}
 finally{const exited=new Promise(resolve=>child.once('exit',resolve));child.stdin.end('\n');await exited;}
};
try{const roots=await new NativePreviewWorkspaceSkills(path.join(workspace,'private')).materialize(snapshot,async()=>{});assert.equal(await fs.readFile(path.join(roots[0].directory,'SKILL.md'),'utf8'),await fs.readFile(selection,'utf8'));e.materializedExactBytes=true;}catch(error){e.materializeError={code:error.code,syscall:error.syscall};}finally{promises.rename=rename;}
assert.equal(e.denials.length,1);assert(['EBUSY','EPERM','EACCES'].includes(e.denials[0].code));assert.equal(e.denials[0].targetExisted,false);if(expectRepaired){assert.equal(e.materializedExactBytes,true);assert.equal(e.materializeError,undefined);}else assert.equal(e.materializeError?.code,e.denials[0].code);e.verifiedReproduction=true;e.originalFailureCode='EPERM';e.originalHandleCauseConfirmed=false;e.success=true;
await fs.writeFile(path.join(out,'evidence.json'),JSON.stringify(e,null,2));console.log(JSON.stringify({success:true,evidence:path.join(out,'evidence.json'),denials:e.denials,materializeError:e.materializeError}));
