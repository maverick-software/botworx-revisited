import assert from 'node:assert/strict';
import path from 'node:path';
import {readFile,writeFile} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {desktopOperation} from './operation-lock.mjs';
desktopOperation('read saved coordination rehearsal outcome');
const root=path.resolve(import.meta.dirname,'../..'),out=path.join(root,'.supabase/desktop-packaged-coordination/1792351914223'),e=JSON.parse(await readFile(path.join(out,'evidence.json'),'utf8')),exec=promisify(execFile);
assert.equal(e.distribution,'AgentopiaRuntime-'+e.instanceId);assert.equal(e.storage,path.join(out,'wsl'));assert(e.failureClosedNormally&&e.success===false);
const registry=JSON.parse((await exec('powershell.exe',['-NoProfile','-NonInteractive','-Command',"Get-ChildItem 'HKCU:/Software/Microsoft/Windows/CurrentVersion/Lxss'|ForEach-Object {$r=Get-ItemProperty $_.PSPath;if($r.DistributionName -eq '"+e.distribution+"'){@{name=$r.DistributionName;path=$r.BasePath}|ConvertTo-Json -Compress}}"],{windowsHide:true,encoding:'utf8'})).stdout);
assert.equal(path.win32.normalize(registry.path.replace(/^\\\\\?\\/,'' )).toLowerCase(),e.storage.toLowerCase());
const run=async args=>(await exec('wsl.exe',['-d',e.distribution,'-u','agentopia','--cd','/home/agentopia/app','--exec',...args],{windowsHide:true,encoding:'utf8',timeout:240000,maxBuffer:4*1024*1024})).stdout;
const script=`import os,json,glob,subprocess
from urllib.parse import urlparse,unquote
from pathlib import Path
assert Path('/opt/agentopia/runtime-instance').read_text().strip()==${JSON.stringify(e.instanceId)}
s=json.loads(subprocess.check_output(['supabase','stack','status','--output-format','json'],text=True));u=urlparse(s['env']['DB_URL']);assert u.port==${e.ports.database}
binary=glob.glob('/home/agentopia/.supabase/cache/stack/slim-services/postgres/*/linux-amd64/*/bin/psql')[0]
env=dict(os.environ,PGPASSWORD=unquote(u.password or ''),PGOPTIONS='-c default_transaction_read_only=on')
queries={
'requests':"SELECT json_agg(json_build_object('id',id,'status',status,'error',error,'conversation',conversation_id)) FROM desktop_requests WHERE user_id='${e.fixtureUser}'",
'turns':"SELECT coalesce(json_agg(to_jsonb(t)),'[]') FROM desktop_codex_turns t WHERE user_id='${e.fixtureUser}'",
'tools':"SELECT coalesce(json_agg(to_jsonb(t)),'[]') FROM desktop_tool_calls t WHERE user_id='${e.fixtureUser}'",
'deliveries':"SELECT coalesce(json_agg(to_jsonb(t)),'[]') FROM desktop_chat_deliveries t WHERE user_id='${e.fixtureUser}'"}
result={}
for key,query in queries.items():
 r=subprocess.run([binary,'-XqAt','-v','ON_ERROR_STOP=1','-h','127.0.0.1','-p',str(u.port),'-U','supabase_admin','-d','postgres'],input=query+';\\n',env=env,text=True,capture_output=True)
 assert r.returncode==0,r.stderr
 result[key]=json.loads(r.stdout)
print(json.dumps(result))`;
let started=false;
try{
 assert.equal((await run(['cat','/opt/agentopia/runtime-instance'])).trim(),e.instanceId);
 await run(['supabase','start','--runtime','native','--eager','--exclude','analytics,pooler,studio']);started=true;
 const result=JSON.parse(await run(['python3','-c',script]));await writeFile(path.join(out,'private-saved-outcome.json'),JSON.stringify(result,null,2));
 console.log(JSON.stringify({requests:result.requests,nativeTurns:result.turns.length,tools:result.tools.map(t=>({name:t.name,status:t.status,error:t.error})),deliveries:result.deliveries.length},null,2));
}finally{if(started)await run(['supabase','stop']);await exec('wsl.exe',['--terminate',e.distribution],{windowsHide:true,timeout:30000});}
