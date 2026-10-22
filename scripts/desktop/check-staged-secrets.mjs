import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
const execute=promisify(execFile),root=path.resolve(import.meta.dirname,'../..');
let executable=process.env.GITLEAKS_EXECUTABLE;
if(!executable){try{executable=(await execute('git',['config','--get','hooks.gitleaksExecutable'],{cwd:root,encoding:'utf8'})).stdout.trim()}catch{}}
executable||='gitleaks';
const parent=process.env.AGENTOPIA_GIT_QA_ROOT??(process.platform==='win32'?'F:/Agentopia-Tmp':os.tmpdir()),out=path.join(parent,'agentopia-staged-secrets-'+Date.now()),snapshot=path.join(out,'source');await mkdir(snapshot,{recursive:true});
if(process.platform==='win32'){const sid=(await execute('powershell.exe',['-NoProfile','-NonInteractive','-Command','[Security.Principal.WindowsIdentity]::GetCurrent().User.Value'],{windowsHide:true,encoding:'utf8'})).stdout.trim();if(!/^S-1-5-[0-9-]+$/.test(sid))throw Error('Unable to protect the local scan snapshot');await execute('icacls.exe',[out,'/inheritance:r','/grant:r','*'+sid+':(OI)(CI)F','*S-1-5-18:(OI)(CI)F','/Q'],{windowsHide:true});}
await execute('git',['checkout-index','--all','--prefix='+snapshot.replaceAll('\\','/')+'/'],{cwd:root,windowsHide:true,maxBuffer:2*1024*1024});
const report=path.join(out,'findings.redacted.json');let passed=false,errorText='';
try{await execute(executable,['dir','.','--redact=100','--no-banner','--no-color','--gitleaks-ignore-path=.gitleaksignore','--report-format=json','--report-path='+report,'--log-level=error'],{cwd:snapshot,windowsHide:true,encoding:'utf8',maxBuffer:2*1024*1024});passed=true}catch(error){errorText=error.stderr??error.message;}
let findings=[];try{findings=JSON.parse(await readFile(report,'utf8'))}catch{}
const evidence={success:passed,at:new Date().toISOString(),out,stagedSnapshotOnly:true,networkRequests:0,findings:findings.map(f=>({file:f.File,line:f.StartLine,rule:f.RuleID})),rawCredentialsReturned:false};await writeFile(path.join(out,'evidence.json'),JSON.stringify(evidence,null,2));console.log(JSON.stringify({success:passed,findings:findings.length,evidence:path.join(out,'evidence.json')}));
if(!passed){if(errorText)console.error(errorText);process.exitCode=1;}
