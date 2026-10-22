import {execFileSync,spawnSync} from 'node:child_process';
import {readdirSync} from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {desktopOperation} from './operation-lock.mjs';desktopOperation('automated verification');
const root=path.resolve(import.meta.dirname,'../..');
if(process.platform==='win32'){
 const running=JSON.parse(execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',"ConvertTo-Json -Compress -InputObject @(Get-Process Agentopia -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Id)"],{encoding:'utf8',windowsHide:true}));
 if(!Array.isArray(running))throw new Error('The installed application state could not be verified.');
 if(running.length)throw new Error('Close the installed Agentopia application before running backend lifecycle tests. No application was stopped and no backend was started by this check.');
}
const require=createRequire(import.meta.url),{testDistribution}=require('../../desktop/tests/test-backend.cjs'),{privateDistribution}=require('../../desktop/build/runtime-binding.js'),{coreServicesReady}=require('../../desktop/build/runtime.js'),distribution=testDistribution();
if(process.env.AGENTOPIA_TEST_DISTRIBUTION===undefined){const names=execFileSync('wsl.exe',['--list','--quiet'],{encoding:'buffer',windowsHide:true}).toString('utf16le').replace(/^\uFEFF/,'').trim().split(/\r?\n/).filter(name=>privateDistribution(name.trim()));if(names.length!==1||names[0].trim()!==distribution)throw new Error('Select the intended test backend with AGENTOPIA_TEST_DISTRIBUTION. Multiple or migrated Agentopia registrations must be selected explicitly; the retained original has been left untouched.');}
const command=args=>execFileSync('wsl.exe',['--distribution',distribution,'--user','agentopia','--cd','/home/agentopia/app','--exec',...args],{encoding:'utf8',windowsHide:true,timeout:180000,maxBuffer:8*1024*1024});
try{
 const identity=command(['cat','/opt/agentopia/runtime-identity']).trim();
 if(identity!=='local.agentopia.desktop-runtime.v1')throw new Error('The test runtime identity could not be verified.');
 if(distribution!=='AgentopiaRuntime'&&command(['cat','/opt/agentopia/runtime-instance']).trim()!==distribution.slice('AgentopiaRuntime-'.length))throw new Error('The selected test runtime instance does not match its registration.');
 let ready=false;try{const status=JSON.parse(command(['supabase','stack','status','--output-format','json']));ready=!!status.env?.API_URL&&coreServicesReady(status);}catch{}
 if(!ready){console.log('Starting the existing Agentopia native test backend…');command(['supabase','start','--runtime','native','--eager','--exclude','analytics,pooler,studio']);}
 const status=JSON.parse(command(['supabase','stack','status','--output-format','json']));
 if(!status.env?.API_URL||!coreServicesReady(status))throw new Error('The native test backend is unavailable.');
}catch{throw new Error('Desktop tests require a provisioned AgentopiaRuntime installation. Open Agentopia once to finish provisioning, then retry.');}
const files=readdirSync(path.join(root,'desktop/tests')).filter(file=>file.endsWith('.test.cjs')).map(file=>path.join(root,'desktop/tests',file));
const result=spawnSync(process.execPath,['--test','--test-concurrency=1',...files],{cwd:root,stdio:'inherit'});
process.exitCode=result.status??1;
