import {execFileSync} from 'node:child_process';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import path from 'node:path';
import assert from 'node:assert/strict';
import {desktopOperation} from './operation-lock.mjs';
desktopOperation('rolled-back native goal accounting qualification');
const root=path.resolve(import.meta.dirname,'../..'),distribution='AgentopiaRuntime-a91a4800-e08f-4440-a4ec-588762d01bfd',running=execFileSync('wsl.exe',['--list','--running','--quiet'],{encoding:'buffer',windowsHide:true}).toString('utf16le').replace(/^\uFEFF/,'').split(/\r?\n/).map(s=>s.trim());assert(running.includes(distribution));assert(!running.includes('AgentopiaRuntime'));
const out=path.join(root,'.supabase/desktop-native-goals/storage-'+Date.now()),schema='owned_goal_'+randomUUID().replaceAll('-',''),owner=randomUUID(),other=randomUUID(),ids={},values=[];await mkdir(out,{recursive:true});
const literal=value=>"'"+JSON.stringify(value).replaceAll("'","''")+"'::jsonb",uuid=value=>"'"+value+"'::uuid";
function goal(name,used=0){const id=randomUUID();ids[name]=id;values.push(`INSERT INTO ${schema}.desktop_goals VALUES (${uuid(id)},${uuid(owner)},${used},now());`);return id;}
function request(goal,state,{requestOwner=owner,nativeOwner=owner}={}){const id=randomUUID(),message=randomUUID();values.push(`INSERT INTO ${schema}.chat_messages_v2 VALUES (${uuid(message)},${literal({goal_id:goal})});`,`INSERT INTO ${schema}.desktop_requests VALUES (${uuid(id)},${uuid(message)},${uuid(requestOwner)});`);if(state!==undefined)values.push(`INSERT INTO ${schema}.desktop_codex_turns VALUES (${uuid(id)},${uuid(nativeOwner)},${literal(state)});`);}
const main=goal('native_and_legacy');request(main);request(main,{goalTurns:3});request(main,{goalTurns:9},{requestOwner:other,nativeOwner:other});request(main,{goalTurns:9},{nativeOwner:other});const retained=goal('existing_usage_preserved',9);request(retained,{goalTurns:2});
for(const [name,state]of Object.entries({zero:{goalTurns:0},negative:{goalTurns:-3},string:{goalTurns:'3'},too_large:{goalTurns:1e20},bounded:{goalTurns:99}}))request(goal(name),state);
let migration=await readFile(path.join(root,'desktop/database/0056-native-goal-turn-recovery.sql'),'utf8');assert(migration.includes('SET search_path=public'));migration=migration.replaceAll('public.',schema+'.').replace('SET search_path=public','SET search_path='+schema);
const sql=`BEGIN; CREATE SCHEMA ${schema}; CREATE TABLE ${schema}.desktop_goals(id uuid,user_id uuid,turns_used integer,updated_at timestamptz); CREATE TABLE ${schema}.chat_messages_v2(id uuid,metadata jsonb); CREATE TABLE ${schema}.desktop_requests(id uuid,user_message_id uuid,user_id uuid); CREATE TABLE ${schema}.desktop_codex_turns(request_id uuid,user_id uuid,state jsonb);\n${values.join('\n')}\n${migration}\nSELECT ${schema}.desktop_recover_goal_turns(); SELECT json_object_agg(id,turns_used) FROM ${schema}.desktop_goals; ROLLBACK;`;
await writeFile(path.join(out,'intent.json'),JSON.stringify({at:new Date().toISOString(),schema,distribution,generatedSchemaOnly:true,rollback:true,productionMigration:false,serviceStarts:0},null,2));
const script=`import glob,json,os,subprocess,sys
from urllib.parse import urlparse,unquote
os.chdir('/home/agentopia/app')
state=json.loads(subprocess.check_output(['supabase','stack','status','--output-format','json'],text=True))
assert state['runtime']=='native'
db=urlparse(state['env']['DB_URL'])
binary=glob.glob('/home/agentopia/.supabase/cache/stack/slim-services/postgres/*/linux-amd64/*/bin/psql')[0]
env=dict(os.environ,PGPASSWORD=unquote(db.password or ''),PGAPPNAME='agentopia_owned_native_goal_storage')
args=[binary,'-X','-q','-v','ON_ERROR_STOP=1','-At','-h','127.0.0.1','-p',str(db.port),'-U','supabase_admin','-d','postgres']
query="SELECT json_build_object('users',(SELECT count(*) FROM auth.users),'conversations',(SELECT count(*) FROM public.conversation_sessions),'messages',(SELECT count(*) FROM public.chat_messages_v2),'migrations',(SELECT count(*) FROM agentopia_desktop.migrations),'function',md5(pg_get_functiondef('public.desktop_recover_goal_turns()'::regprocedure)))"
before=json.loads(subprocess.check_output(args+['-c',query],text=True,env=env))
fixture=json.load(sys.stdin)
result=subprocess.run(args,input=fixture['sql'],text=True,env=env,capture_output=True,check=True).stdout
after=json.loads(subprocess.check_output(args+['-c',query],text=True,env=env))
assert before==after
remaining=subprocess.check_output(args+['-c',"SELECT count(*) FROM pg_namespace WHERE nspname='"+fixture['schema']+"'"],text=True,env=env).strip()
assert remaining=='0'
print(json.dumps({'before':before,'after':after,'result':result,'schemaRemoved':True}))
`;
const result=JSON.parse(execFileSync('wsl.exe',['-d',distribution,'-u','agentopia','--exec','python3','-c',script],{encoding:'utf8',windowsHide:true,timeout:30000,input:JSON.stringify({schema,sql})})),actual=JSON.parse(result.result.trim()),expected={native_and_legacy:5,existing_usage_preserved:9,zero:1,negative:1,string:1,too_large:1,bounded:10};for(const [name,count]of Object.entries(expected))assert.equal(actual[ids[name]],count,name);assert.deepEqual(result.before,result.after);assert.equal(result.before.migrations,45);const evidence={success:true,at:new Date().toISOString(),realPostgres:true,checks:Object.keys(expected),schemaRemoved:result.schemaRemoved,productionMigration:false,serviceStarts:0,liveInferenceRequests:0,before:result.before,after:result.after};await writeFile(path.join(out,'evidence.json'),JSON.stringify(evidence,null,2));console.log(JSON.stringify({success:true,checks:evidence.checks.length,out},null,2));
