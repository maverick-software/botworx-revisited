import {readFile,writeFile} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import path from 'node:path';
import assert from 'node:assert/strict';
const root=path.resolve(import.meta.dirname,'../..'),exec=promisify(execFile),id=process.argv[2];assert(/^\d{13}$/.test(id));assert(process.argv.includes('--execute'));
const out=path.join(root,'.supabase/desktop-workspace-agents/local-session-transfer',id),evidence=JSON.parse(await readFile(path.join(out,'evidence.json'),'utf8'));
assert(evidence.success&&evidence.preparedOnly&&evidence.administratorValidated&&evidence.nonSessionValuesUnchanged&&evidence.canonicalWrites===0);
const maintenance=JSON.parse(await readFile(path.join(root,'.supabase/desktop-maintenance-0437/update.json'),'utf8'));
const processes=await exec('powershell.exe',['-NoProfile','-NonInteractive','-Command',"@(Get-Process Agentopia -ErrorAction SilentlyContinue).Count"],{encoding:'utf8',windowsHide:true});assert.equal(processes.stdout.trim(),'0','Close Agentopia normally before committing the repair');
const linux=value=>'/mnt/'+value[0].toLowerCase()+value.slice(2).replaceAll('\\','/');
const script=`import hashlib,json,os,sys,uuid
from pathlib import Path
out=Path(sys.argv[1]);assert out.parent==Path('/mnt/d/Users/charl/software/Agentopia/.supabase/desktop-workspace-agents/local-session-transfer')
assert Path('/opt/agentopia/runtime-instance').read_text().strip()==sys.argv[2]
e=json.loads((out/'evidence.json').read_text());profile=Path('/mnt/c/Users/charl/AppData/Roaming/Agentopia');assert profile.resolve()==profile
target=profile/'credentials.bin';retained=Path('/mnt/c/Users/charl/AppData/Local/Packages/OpenAI.Codex_2p2nqsd0c76g0/LocalCache/Roaming/Agentopia/credentials.bin')
assert target.is_file() and not target.is_symlink() and not retained.is_symlink()
digest=lambda data:hashlib.sha256(data).hexdigest()
before=target.read_bytes();assert digest(before)==e['ordinaryBeforeSha256'],'Ordinary credentials changed; repair refused'
assert digest(retained.read_bytes())==e['retainedBeforeSha256'],'Retained credentials changed; repair refused'
prepared=(out/'prepared-profile/credentials.bin').read_bytes();assert digest(prepared)==e['preparedSha256']
with (out/'ordinary-before.bin').open('xb') as stream:stream.write(before);stream.flush();os.fsync(stream.fileno())
temporary=profile/('credentials.bin.session-repair-'+str(uuid.uuid4()))
with temporary.open('xb') as stream:stream.write(prepared);stream.flush();os.fsync(stream.fileno())
assert digest(target.read_bytes())==e['ordinaryBeforeSha256']
os.replace(temporary,target)
assert digest(target.read_bytes())==e['preparedSha256'] and digest(retained.read_bytes())==e['retainedBeforeSha256']
print(json.dumps({'success':True,'canonicalWrites':1,'localSessionOnly':True,'ordinaryAfterSha256':e['preparedSha256'],'retainedUnchanged':True,'oauthRequests':0,'inferenceRequests':0}))
`;
const result=await exec('wsl.exe',['-d',maintenance.distribution,'-u','agentopia','--exec','python3','-c',script,linux(out),maintenance.distribution.slice('AgentopiaRuntime-'.length)],{encoding:'utf8',windowsHide:true,timeout:30000});
const committed=JSON.parse(result.stdout);assert(committed.success);await writeFile(path.join(out,'commit.json'),JSON.stringify({...committed,at:new Date().toISOString()},null,2),{flag:'wx'});console.log(JSON.stringify(committed,null,2));
