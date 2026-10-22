import {mkdir,writeFile,copyFile,readFile} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {createRequire} from 'node:module';
import path from 'node:path';
import assert from 'node:assert/strict';
const exec=promisify(execFile),require=createRequire(import.meta.url),root=path.resolve(import.meta.dirname,'../..');
const recovery=path.resolve(process.argv[2]);
assert(recovery.startsWith(path.join(root,'.supabase/desktop-runtime-recovery')+path.sep));
const out=path.join(recovery,'draft-inspection-'+Date.now());await mkdir(out);
const sources={ordinary:'C:/Users/charl/AppData/Roaming/Agentopia',overlay:'C:/Users/charl/AppData/Local/Packages/OpenAI.Codex_2p2nqsd0c76g0/LocalCache/Roaming/Agentopia'};
for(const [label,source] of Object.entries(sources)){
 const before=path.join(out,label+'-before');await mkdir(before);
 await exec('tar.exe',['-xf',path.join(recovery,label+'-profile-core.tar'),'-C',before,'./Local State','./credentials.bin'],{windowsHide:true});
 const current=path.join(out,label+'-current');await mkdir(current);
 for(const name of ['Local State','credentials.bin'])await copyFile(path.join(source,name),path.join(current,name));
}
const linux=value=>'/mnt/'+value[0].toLowerCase()+value.slice(2).replaceAll('\\','/');
const physical=path.join(out,'physical.py');await writeFile(physical,`import json,shutil,sys\nfrom pathlib import Path\nout=Path(sys.argv[1])\nsources=json.loads(sys.argv[2])\nfor label,source in sources.items():\n target=out/(label+'-physical');target.mkdir()\n for name in ['Local State','credentials.bin']:shutil.copyfile(Path(source)/name,target/name)\n images=[str(p.relative_to(Path(source)/'attachments')) for p in (Path(source)/'attachments').rglob('*.bin')]\n (target/'images.json').write_text(json.dumps(images))\n`);
await exec('wsl.exe',['-d','AgentopiaRuntime-a91a4800-e08f-4440-a4ec-588762d01bfd','-u','agentopia','--exec','python3',linux(physical),linux(out),JSON.stringify(Object.fromEntries(Object.entries(sources).map(([k,v])=>[k,linux(v)])))],{windowsHide:true,timeout:20000});
const helper=path.join(out,'main.cjs');
await writeFile(helper,`const {app,safeStorage}=require('electron'),fs=require('node:fs'),path=require('node:path');
const out=${JSON.stringify(out)},sources=${JSON.stringify(sources)},conversation='4d752d56-3037-4f5f-b7b6-5752add39e22';
app.setPath('userData',path.join(out,'helper-profile'));fs.mkdirSync(app.getPath('userData'));fs.copyFileSync(path.join(out,'ordinary-before/Local State'),path.join(app.getPath('userData'),'Local State'));
app.commandLine.appendSwitch('disable-background-networking');
app.whenReady().then(()=>{const evidence={at:new Date().toISOString(),canonicalWrites:0,providerRequests:0,profiles:{}};try{
 for(const label of Object.keys(sources))for(const phase of ['before','current','physical']){
  const values=JSON.parse(safeStorage.decryptString(fs.readFileSync(path.join(out,label+'-'+phase,'credentials.bin')))),drafts=[];
  for(const [key,entries] of Object.entries(values))if(key.startsWith('chat-drafts:')){
   const draft=entries?.['conversation:'+conversation];if(!draft)continue;const owner=key.slice('chat-drafts:'.length),references=values['files:'+owner]??[],ids=draft.options?.files??[];
   drafts.push({owner,scope:'conversation:'+conversation,textLength:(draft.text??draft.value??'').length,ids,references:ids.map(id=>{const ref=references.find(row=>row.id===id);return {id,registered:!!ref,source:ref?.source,encryptedImageExists:fs.existsSync(path.join(sources[label],'attachments',owner,id+'.bin'))};}),registeredFiles:references.length});
  }
  evidence.profiles[label+'-'+phase]={savedSession:!!values.session,sessionExpiry:values.session?new Date(JSON.parse(Buffer.from(values.session.access_token.split('.')[1],'base64url')).exp*1000).toISOString():null,drafts};
 }
 evidence.success=true;
}catch(error){evidence.error=error.message;evidence.success=false;}fs.writeFileSync(path.join(out,'evidence.json'),JSON.stringify(evidence,null,2));console.log(JSON.stringify(evidence));app.exit(evidence.success?0:1);});`);
const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
const result=await exec(require('electron'),[helper],{cwd:root,env,windowsHide:true,timeout:30000,maxBuffer:1024*1024});
const evidence=JSON.parse(await readFile(path.join(out,'evidence.json'),'utf8'));assert(evidence.success);console.log(JSON.stringify(evidence,null,2));
