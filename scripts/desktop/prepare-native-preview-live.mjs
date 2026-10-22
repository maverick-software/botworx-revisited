import {mkdir,readFile,writeFile,realpath} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import path from 'node:path';
import assert from 'node:assert/strict';
const repo=path.resolve(import.meta.dirname,'../..'),id=String(Date.now()),marker='NATIVE31-'+id;
const base='C:/Users/charl/AgentopiaWorkspaces',folder=path.join(base,'Native preview '+id),out=path.join(repo,'.supabase/desktop-native-independent','ordinary-'+id);
await mkdir(base,{recursive:true});assert.equal((await realpath(base)).toLowerCase(),path.resolve(base).toLowerCase());await mkdir(folder);await mkdir(out,{recursive:true});
const resources='C:/Users/charl/AppData/Local/AgentopiaDesktop/app-0.44.31/resources/resources';
const pins=JSON.parse(await readFile(path.join(repo,'desktop/src/code-tool-manifest.json'))),scripts=JSON.parse(await readFile(path.join(repo,'desktop/src/script-runtime-manifest.json')));
const pwsh=path.join(resources,pins.powershell.directory,pins.powershell.entry),python=path.join(resources,'script-runtimes',scripts.python.directory,scripts.python.entry);
const expected='WORKSPACE-PREFLIGHT '+marker;
const checks=[];
for(const [name,exe,args] of [['powershell',pwsh,['-NoLogo','-NoProfile','-NonInteractive','-Command',"[IO.File]::WriteAllText((Join-Path (Get-Location) 'preflight-powershell.txt'),[Console]::In.ReadToEnd())"]],['python',python,['-c',"from pathlib import Path; import sys; Path('preflight-python.txt').write_text(sys.stdin.read())"]]]){
 const run=spawnSync(exe,args,{cwd:folder,input:expected,encoding:'utf8',windowsHide:true,timeout:10000});
 const bytes=await readFile(path.join(folder,'preflight-'+name+'.txt')).catch(()=>null);checks.push({name,exitCode:run.status,bytesVerified:bytes?.toString()===expected});
}
await writeFile(path.join(out,'workspace-preflight.json'),JSON.stringify({at:new Date().toISOString(),folder,checks,securitySettingsChanged:false,realProviderRequests:0},null,2));assert(checks.every(check=>check.exitCode===0&&check.bytesVerified));
const preview=`from functools import partial
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
import json, os, time
root=Path(__file__).resolve().parent
class Handler(SimpleHTTPRequestHandler):
    def log_message(self, format, *args): print(format % args, flush=True)
server=ThreadingHTTPServer(('127.0.0.1',0),partial(Handler,directory=str(root/'public')))
(root/'server-state.json').write_text(json.dumps({'host':'127.0.0.1','port':server.server_port,'pid':os.getpid(),'startedAt':time.time(),'marker':'${marker}'},indent=2))
print('PREVIEW http://127.0.0.1:'+str(server.server_port)+'/',flush=True)
server.serve_forever()
`;
await writeFile(path.join(folder,'preview.py'),preview);
await writeFile(path.join(folder,'BRIEF.txt'),'Generated verification folder. Create only local preview files here. The preflight files confirm that the installed PowerShell and Python wrote actual bytes here. Keep preview.py unchanged. No external network calls or user data. Marker: '+marker);
const prompt=marker+' Independent preview verification in this newly attached writable workspace. Use only this generated folder. Discover native spawn_agent and spawn exactly one background child. Give it this task: first complete a local 30-second PowerShell sleep; then create public/index.html with a readable heading and this marker. Respect steering delivered while working. Start provided preview.py unchanged with bundled Python as a retained native background command. Read server-state.json and verify the actual page with one loopback HTTP request. Write child-result.txt containing the actual URL and truthful verification result. Report back, leaving the server running for later dedicated Stop. Use native commands, never Agentopia run_command. No external network calls, no other children, no security-setting changes. Parent: immediately finish after successful spawn with exactly PARENT-READY '+marker+'. Do not wait for or close the child.';
const intent={at:new Date().toISOString(),phase:'prepared-not-sent',version:'0.44.31',imageSha256:'69964ce0bf472ae74646ae111d8f9234ec968e46ea85558ac305f01d89933434',provider:'openai-oauth',model:'gpt-6.1-sol',thinking:'high',marker,folder,prompt,originalConversation:'4d752d56-3037-4f5f-b7b6-5752add39e22',doNotReplay:true,openRouterRequestsAuthorized:false,expected:'Parent completes; one child responds to steering, creates a real page, reports automatically, and retained preview survives before scoped Stop.'};
await writeFile(path.join(out,'intent.json'),JSON.stringify(intent,null,2));await writeFile(path.join(repo,'.supabase/desktop-native-independent/prepared-preview.json'),JSON.stringify({out,folder,marker},null,2));
console.log(JSON.stringify({out,folder,marker,checks,previewSha256:createHash('sha256').update(preview).digest('hex')}));
