import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import path from 'node:path';
import {existsSync} from 'node:fs';
import {prepareScriptRuntimes,scriptEnvironment} from './script-runtimes';
import manifest from './script-runtime-manifest.json';

const script=String.raw`import json,ntpath,sqlite3,sys
from pathlib import Path
stage=Path(sys.argv[1]);destination=sys.argv[2];prefixes=sys.argv[3:]
clean=lambda value:ntpath.normpath(str(value).removeprefix('\\\\?\\'))
normal=lambda value:ntpath.normcase(clean(value))
def mapped(value):
 if not value:return value,None
 for source in prefixes:
  if normal(value).startswith(normal(source)+'\\'):
   relative=ntpath.relpath(clean(value),clean(source))
   checked=stage.joinpath(*relative.split('\\'))
   if checked.is_symlink() or not checked.exists():raise ValueError('A copied native path is missing or linked')
   return ntpath.join(destination,relative),checked
 return value,None
database=stage/'state_5.sqlite'
connection=sqlite3.connect(database)
try:
 if connection.execute('PRAGMA integrity_check').fetchone()!=('ok',):raise ValueError('Native index integrity check failed')
 columns={row[1] for row in connection.execute('PRAGMA table_info(threads)')}
 if not {'id','rollout_path','agent_path'}<=columns:raise ValueError('Unsupported native index schema')
 changes=[]
 for identifier,rollout,agent in connection.execute('SELECT id,rollout_path,agent_path FROM threads'):
  new_rollout,file=mapped(rollout)
  if file is None or not file.is_file():raise ValueError('A native rollout is outside its copied home')
  with file.open(encoding='utf-8') as stream:header=json.loads(stream.readline())
  if header.get('type')!='session_meta' or header.get('payload',{}).get('id')!=identifier:raise ValueError('A copied rollout has a different thread identity')
  new_agent,_=mapped(agent)
  changes.append((new_rollout,new_agent,identifier))
 with connection:
  connection.executemany('UPDATE threads SET rollout_path=?,agent_path=? WHERE id=?',changes)
 connection.execute('PRAGMA wal_checkpoint(TRUNCATE)')
 if connection.execute('PRAGMA integrity_check').fetchone()!=('ok',):raise ValueError('Repaired native index integrity check failed')
 print(json.dumps({'success':True,'threads':len(changes),'rolloutBytesChanged':False}))
finally:connection.close()
`;

export async function rebaseNativeHome(stage:string,destination:string,legacy:string,physicalLegacy:string,resources?:string){
 if(!existsSync(path.join(stage,'state_5.sqlite')))return;
 if(!resources)throw new Error('The bundled runtime is required to preserve this native history. Original files have been retained.');
 await prepareScriptRuntimes(resources);
 const python=path.join(resources,'script-runtimes',manifest.python.directory,'python.exe');
 try{const {stdout}=await promisify(execFile)(python,['-I','-c',script,stage,destination,legacy,physicalLegacy],{env:scriptEnvironment(resources),windowsHide:true,timeout:60000,maxBuffer:100000});const result=JSON.parse(stdout);if(!result.success)throw new Error('Repair failed');}
 catch{throw new Error('The copied native history index could not be repaired. Original and partial copies have been retained.');}
}
