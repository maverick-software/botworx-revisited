import {execFile} from 'node:child_process';import {promisify} from 'node:util';import {mkdir,readFile,writeFile} from 'node:fs/promises';import {randomUUID,createHash} from 'node:crypto';import {createReadStream} from 'node:fs';import path from 'node:path';
const exec=promisify(execFile),out='F:/Sylvana/verification/web-only-login-implementation',root=path.resolve(import.meta.dirname,'../..');await mkdir(out,{recursive:true});
const production=process.argv.includes('--fresh-account');if(production){const ready=JSON.parse(await readFile(out+'/new-web-account-ready.json','utf8'));if(ready.email!=='mail@enspyredigital.com'||!ready.active)throw Error('New account setup has not been verified');await readFile(out+'/archive-current.json');}
const id=randomUUID(),distribution='SylvanaRuntime-'+id,storage=production?'F:/Sylvana-Data/profiles/'+id+'/runtime':out+'/generated-runtime-'+id,source='C:/Users/charl/AppData/Local/SylvanaDesktop/app-0.45.0/resources/resources';
const h=createHash('sha256');for await(const bytes of createReadStream(source+'/runtime.tar.gz'))h.update(bytes);if(h.digest('hex')!==(await readFile(source+'/runtime.sha256','utf8')).trim())throw Error('Runtime image verification failed');
const config={generated:!production,id,distribution,storage,out,root,profile:production?'F:/Sylvana-Data/profiles/'+id+'/profile':undefined,api:production?'http://127.0.0.1:57321':'http://127.0.0.1:58321'},label=production?'fresh-profile-runtime':'generated-runtime';await writeFile(out+'/'+label+'.json',JSON.stringify(config,null,2));await mkdir(storage,{recursive:true});if(config.profile)await mkdir(config.profile);
const run=async(file,args,timeout=300000)=>(await exec(file,args,{encoding:'utf8',windowsHide:true,timeout,maxBuffer:4000000})).stdout;
console.log(production?'Preparing the new account’s empty runtime on F:.':'Importing a generated, empty test runtime on F:.');await run('wsl.exe',['--import',distribution,storage,source+'/runtime.tar.gz','--version','2'],600000);
const linux=value=>'/mnt/'+value[0].toLowerCase()+value.slice(2).replaceAll('\\','/');
const script=`from pathlib import Path
import shutil,json
assert Path('/opt/sylvana/runtime-identity').read_text().strip()=='local.sylvana.desktop-runtime.v1'
Path('/opt/sylvana/runtime-instance').write_text(${JSON.stringify(id)})
source=Path(${JSON.stringify(linux(root))})
shutil.copytree(source/'desktop/database','/opt/sylvana/database',dirs_exist_ok=True)
for name in ['secure-runtime.py','database_state.py','manage.py']:shutil.copy2(source/'desktop/runtime'/name,Path('/opt/sylvana')/name)
config=(source/'desktop/resources/runtime/config.toml').read_text()
if ${production?'False':'True'}: config=config.replace('573','583').replace('sylvana-desktop','sylvana-web-login-test')
Path('/opt/sylvana/config-template.toml').write_text(config)
print(json.dumps({'emptyTestRuntimePrepared':True}))`;
await run('wsl.exe',['-d',distribution,'-u','root','--exec','python3','-c',script]);await run('wsl.exe',['-d',distribution,'-u','root','--exec','python3','/opt/sylvana/secure-runtime.py']);
const prefix=['-d',distribution,'-u','sylvana','--cd','/home/sylvana/app','--exec'];await run('wsl.exe',[...prefix,'supabase','start','--runtime','native','--eager','--exclude','analytics,pooler,studio']);await run('wsl.exe',[...prefix,'python3','/opt/sylvana/manage.py','provision']);
const inspect=`import json,subprocess,glob
from urllib.parse import urlparse
s=json.loads(subprocess.check_output(['supabase','stack','status','--output-format','json'],text=True,stderr=subprocess.DEVNULL));db=urlparse(s['env']['DB_URL']);p=glob.glob('/home/sylvana/.supabase/cache/stack/slim-services/postgres/*/linux-amd64/*/bin/psql')[0]
rows=subprocess.check_output([p,'-XqAt','-h','127.0.0.1','-p',str(db.port),'-U','supabase_admin','-d','postgres','-c',"select json_build_object('accounts',(select count(*) from auth.users),'schema',(select count(*) from sylvana_desktop.migrations))"],text=True)
print(rows.strip())`;
const info=JSON.parse(await run('wsl.exe',[...prefix,'python3','-c',inspect]));if(info.accounts!==0||info.schema!==92)throw Error('The generated runtime was not empty and current');await writeFile(out+'/'+label+'-ready.json',JSON.stringify({...config,...info,ready:true},null,2));console.log(JSON.stringify({ready:true,generated:!production,schema:info.schema,accounts:info.accounts}));
