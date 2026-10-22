import {spawn,execFile} from 'node:child_process';
import {mkdir,writeFile,readFile,copyFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {promisify} from 'node:util';
import path from 'node:path';
import assert from 'node:assert/strict';

const require=createRequire(import.meta.url),exec=promisify(execFile),root=path.resolve(import.meta.dirname,'../..');
const compareRetained=process.argv.includes('--compare-retained');
const previousIndex=process.argv.indexOf('--compare-ordinary'),previousId=previousIndex<0?undefined:process.argv[previousIndex+1];
assert(previousId===undefined||/^\d{13}$/.test(previousId),'Use a recorded ordinary-profile inspection timestamp.');
const previousSource=previousId?path.join(root,'.supabase/desktop-workspace-agents/authorization',previousId,'private-source'):undefined;
let update=JSON.parse(await readFile(path.join(root,'.supabase/desktop-maintenance-0437/update.json'),'utf8'));
assert(update.success&&update.phase==='completed'&&update.version==='0.43.7');
if(process.argv.includes('--current-installation')){
 let installed;try{installed=JSON.parse(await readFile(path.join(root,'.supabase/desktop-platform-release/candidate-04424/installed-verification/evidence.json'),'utf8'));}catch(error){if(error.code!=='ENOENT')throw error;installed=JSON.parse(await readFile(path.join(root,'.supabase/desktop-goal-queue/candidate-04417/installed-verification/evidence.json'),'utf8'));}
 assert(installed.success&&installed.installed&&installed.productionMigrated&&((installed.version==='0.44.24'&&installed.schema===67)||(installed.version==='0.44.17'&&installed.schema===59)));
 update={...update,version:installed.version,installedExecutable:path.join('C:/Users/charl/AppData/Local/AgentopiaDesktop','app-'+installed.version,'Agentopia.exe')};
}
assert.equal(update.ordinaryProfile.toLowerCase(),'c:\\users\\charl\\appdata\\roaming\\agentopia');
assert(/^AgentopiaRuntime-[a-f0-9-]{36}$/.test(update.distribution));
const decode=bytes=>(bytes.includes(0)?bytes.toString('utf16le'):bytes.toString('utf8')).replace(/^\uFEFF/,'').trim();
const running=decode((await exec('wsl.exe',['--list','--running','--quiet'],{encoding:'buffer',windowsHide:true})).stdout).split(/\r?\n/).map(s=>s.trim());
assert(running.includes(update.distribution),'The owned runtime must already be running; inspection does not start it.');
const out=path.join(root,'.supabase/desktop-workspace-agents/authorization',String(Date.now()));await mkdir(out,{recursive:true});
const sid=(await exec('powershell.exe',['-NoProfile','-NonInteractive','-Command','[Security.Principal.WindowsIdentity]::GetCurrent().User.Value'],{encoding:'utf8',windowsHide:true})).stdout.trim();
assert(/^S-1-5-[0-9-]+$/.test(sid));await exec('icacls.exe',[out,'/inheritance:r','/grant:r','*'+sid+':(OI)(CI)F','*S-1-5-18:(OI)(CI)F','/Q'],{windowsHide:true});
await copyFile(path.join(root,'scripts/desktop/inspect-physical-authorization.mjs'),path.join(out,'inspector.mjs'));
const linux=value=>'/mnt/'+value[0].toLowerCase()+value.slice(2).replaceAll('\\','/');
// Windows package virtualization can redirect individual profile children.
const physical=`import hashlib,json,os,sys
from pathlib import Path
os.umask(0o077)
source=Path(sys.argv[1]);target=Path(sys.argv[2]);instance=sys.argv[3]
assert source==Path('/mnt/c/Users/charl/AppData/Roaming/Agentopia') and source.resolve()==source
assert Path('/opt/agentopia/runtime-instance').read_text().strip()==instance
assert target.parent.parent==Path('/mnt/d/Users/charl/software/Agentopia/.supabase/desktop-workspace-agents/authorization')
target.mkdir()
files={}
for name in ('Local State','credentials.bin'):
 file=source/name
 assert file.is_file() and not file.is_symlink()
 data=file.read_bytes();checksum=hashlib.sha256(data).hexdigest()
 with (target/name).open('xb') as stream:stream.write(data)
 assert hashlib.sha256(file.read_bytes()).hexdigest()==checksum
 assert hashlib.sha256((target/name).read_bytes()).hexdigest()==checksum
 files[name]={'bytes':len(data),'sha256':checksum,'modifiedAt':file.stat().st_mtime}
retained={}
if sys.argv[4]=='1':
 base=Path('/mnt/c/Users/charl/AppData/Local/Packages/OpenAI.Codex_2p2nqsd0c76g0/LocalCache/Roaming/Agentopia')
 assert base.resolve()==base
 destination=target.parent/'retained-source';destination.mkdir()
 for name in ('Local State','credentials.bin'):
  file=base/name
  assert file.is_file() and not file.is_symlink()
  data=file.read_bytes();checksum=hashlib.sha256(data).hexdigest()
  with (destination/name).open('xb') as stream:stream.write(data)
  assert hashlib.sha256(file.read_bytes()).hexdigest()==checksum
  assert hashlib.sha256((destination/name).read_bytes()).hexdigest()==checksum
  retained[name]={'bytes':len(data),'sha256':checksum,'modifiedAt':file.stat().st_mtime}
(target.parent/'physical-source.json').write_text(json.dumps({'physicalOrdinaryProfile':True,'sourceFilesUnchanged':True,'files':files,'retainedFiles':retained},indent=2))
`;
const snapshot=path.join(out,'private-source');
await exec('wsl.exe',['-d',update.distribution,'-u','agentopia','--exec','python3','-c',physical,linux(update.ordinaryProfile),linux(snapshot),update.distribution.slice('AgentopiaRuntime-'.length),compareRetained?'1':'0'],{encoding:'buffer',windowsHide:true,timeout:30000});
const main=path.join(out,'main.cjs');
await writeFile(main,`const {app}=require('electron'),fs=require('node:fs'),path=require('node:path');
const out=${JSON.stringify(out)},snapshot=${JSON.stringify(snapshot)},installed=${JSON.stringify(path.join(path.dirname(update.installedExecutable),'resources/app.asar/build/secrets.js'))};
for(const name of ['Local State','credentials.bin'])if(fs.realpathSync.native(path.join(snapshot,name)).toLowerCase()!==path.join(snapshot,name).toLowerCase())throw Error('The staged physical source resolved elsewhere');
app.setPath('userData',path.join(out,'helper-profile'));fs.mkdirSync(app.getPath('userData'),{recursive:true});fs.copyFileSync(path.join(snapshot,'Local State'),path.join(app.getPath('userData'),'Local State'));
app.commandLine.appendSwitch('disable-background-networking');global.fetch=async()=>{throw Error('Network access is disabled for authorization inspection');};
app.whenReady().then(async()=>{const result={at:new Date().toISOString(),currentProfile:true,physicalOrdinaryProfile:true,renewalAttempted:false,inferenceRequests:0,canonicalCredentialWrites:0};
try{const {Secrets}=require(installed),store=new Secrets(snapshot);await store.load();
 const session=store.get('session'),owner=session?.access_token?JSON.parse(Buffer.from(session.access_token.split('.')[1],'base64url').toString('utf8')).sub:null,connection=owner?store.get('openai:'+owner):null;
 const models=owner?store.get('models:openai-oauth:'+owner):null;
 result.hasSavedLocalSession=!!owner;result.hasSavedConnection=!!connection;result.planScope=!!connection?.scope?.split(' ').includes('chatgpt.tokens.use.direct');
 result.secondsRemaining=Number.isFinite(connection?.expires_at)?Math.floor((connection.expires_at-Date.now())/1000):null;
 result.cachedChatGPTModels=Array.isArray(models)?models.length:0;result.preferChatGPT=owner?store.get('prefer-chatgpt:'+owner)!==false:null;
 if(${compareRetained}){const prior=new Secrets(path.join(out,'retained-source'));await prior.load();const old=owner?prior.get('openai:'+owner):null;result.retainedComparison={hasConnectionForCurrentUser:!!old,sameClientId:!!old&&old.client_id===connection?.client_id,sameSubject:!!old&&old.subject===connection?.subject,sameRefreshCredential:!!old&&old.refresh_token===connection?.refresh_token,sameAccessCredential:!!old&&old.access_token===connection?.access_token,expiryDifferenceSeconds:old&&connection?Math.floor((connection.expires_at-old.expires_at)/1000):null,currentHasRecordedIssue:!!owner&&!!store.get('openai-issue:'+owner)};}
 if(${!!previousSource}){const previous=${JSON.stringify(previousSource??'')};for(const name of ['Local State','credentials.bin'])if(fs.realpathSync.native(path.join(previous,name)).toLowerCase()!==path.join(previous,name).toLowerCase())throw Error('Previous physical source redirected');const prior=new Secrets(previous);await prior.load();const old=owner?prior.get('openai:'+owner):null;result.ordinaryComparison={previousInspection:${JSON.stringify(previousId??null)},hasConnectionForCurrentUser:!!old,sameClientId:!!old&&old.client_id===connection?.client_id,sameSubject:!!old&&old.subject===connection?.subject,sameRefreshCredential:!!old&&old.refresh_token===connection?.refresh_token,sameAccessCredential:!!old&&old.access_token===connection?.access_token,expiryDifferenceSeconds:old&&connection?Math.floor((connection.expires_at-old.expires_at)/1000):null};const router=store.get('openrouter'),oldRouter=prior.get('openrouter');result.openRouterComparison={hasSharedConnection:!!router?.key,sameCredential:!!router?.key&&router.key===oldRouter?.key,sameDefaultModel:store.get('openrouter-default')===prior.get('openrouter-default')};}
 result.readyForLiveQualification=!!connection?.access_token&&result.planScope&&result.secondsRemaining>600;result.success=true;
}catch(error){result.success=false;result.error=error.message;}
fs.writeFileSync(path.join(out,'evidence.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));app.exit(result.success?0:1);});`);
const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
const code=await new Promise((resolve,reject)=>{const child=spawn(require('electron'),[main],{cwd:root,env,windowsHide:true,stdio:'inherit'});child.once('error',reject);child.once('exit',code=>resolve(code??1));});
console.log('Authorization evidence: '+path.join(out,'evidence.json'));process.exitCode=code;
