import {execFile} from 'node:child_process';import {promisify} from 'node:util';import {readFile,writeFile,mkdir} from 'node:fs/promises';import path from 'node:path';import assert from 'node:assert/strict';
const root=path.resolve(import.meta.dirname,'../..'),fixture=path.join(root,'.supabase/desktop-packaged-live/1792308533986'),intent=JSON.parse(await readFile(path.join(fixture,'intent.json'),'utf8')),prior=JSON.parse(await readFile(path.join(fixture,'evidence.json'),'utf8')),out=path.join(root,'.supabase/desktop-goal-queue/storage-'+Date.now()),exec=promisify(execFile);await mkdir(out);assert.equal(intent.distribution,'AgentopiaRuntime-'+intent.instanceId);assert.match(prior.fixtureUser,/^[a-f0-9-]{36}$/i);
const run=async(args,timeout=60000)=>(await exec('wsl.exe',args,{encoding:'utf8',windowsHide:true,timeout,maxBuffer:8*1024*1024})).stdout.replaceAll('\0','').replace(/^\uFEFF/,'').trim();
const before=(await run(['--list','--running','--quiet'])).split(/\r?\n/).filter(Boolean);assert(!before.includes(intent.distribution));assert(before.includes(intent.production));const processes=JSON.parse((await exec('powershell.exe',['-NoProfile','-NonInteractive','-Command',"@(Get-CimInstance Win32_Process -Filter \"name='Agentopia.exe' OR name='node.exe'\" | Select-Object ExecutablePath,CommandLine)|ConvertTo-Json -Compress"],{encoding:'utf8',windowsHide:true})).stdout);assert(!processes.some(row=>row.ExecutablePath?.toLowerCase()===path.join(fixture,'program/Agentopia.exe').toLowerCase()||row.CommandLine?.includes('test-packaged-live.mjs')));
const migration=await readFile(path.join(root,'desktop/database/0059-inline-goals.sql'),'utf8'),linux=file=>'/mnt/'+file[0].toLowerCase()+file.slice(2).replaceAll('\\','/'),python=path.join(out,'check.py');
await writeFile(python,`import json,os,glob,subprocess
from urllib.parse import urlparse,unquote
os.chdir('/home/agentopia/app')
status=json.loads(subprocess.check_output(['supabase','stack','status','--output-format','json'],text=True))
url=urlparse(status['env']['DB_URL']);env=dict(os.environ,PGPASSWORD=unquote(url.password or ''),PGAPPNAME='agentopia_inline_goal_fixture')
binary=glob.glob('/home/agentopia/.supabase/cache/stack/slim-services/postgres/*/linux-amd64/*/bin/psql')[0]
sql=${JSON.stringify('BEGIN;\n'+migration+`\nDO $test$ DECLARE chat record;p uuid;g jsonb;finite uuid;rev bigint;recovered uuid;first_record record;BEGIN
 SELECT c.conversation_id,c.agent_id INTO chat FROM conversation_sessions c WHERE c.user_id='${prior.fixtureUser}' AND NOT EXISTS(SELECT 1 FROM desktop_plans p WHERE p.conversation_id=c.conversation_id) LIMIT 1;
 IF chat IS NULL THEN RAISE EXCEPTION 'No isolated fixture chat';END IF;
 INSERT INTO desktop_plans(user_id,conversation_id,agent_id,title,steps,updated_by) VALUES('${prior.fixtureUser}',chat.conversation_id,chat.agent_id,'Inline goal storage test',jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'text','Complete owned test','status','pending')),'user') RETURNING id,revision INTO p,rev;
 g:=desktop_implement_plan('${prior.fixtureUser}',p,rev,NULL);IF (g->>'max_turns') IS NOT NULL THEN RAISE EXCEPTION 'Unlimited plan goal was capped';END IF;
 UPDATE desktop_goals SET status='paused' WHERE id=(g->>'id')::uuid;
 SELECT revision INTO rev FROM desktop_plans WHERE id=p;
 g:=desktop_implement_plan('${prior.fixtureUser}',p,rev,3);finite:=(g->>'id')::uuid;IF (g->>'max_turns')::int<>3 THEN RAISE EXCEPTION 'Explicit limit changed';END IF;
 UPDATE desktop_goals SET status='paused' WHERE id=finite;
 SELECT revision INTO rev FROM desktop_plans WHERE id=p;
 g:=desktop_implement_plan('${prior.fixtureUser}',p,rev,NULL);IF (SELECT max_turns FROM desktop_goals WHERE id=finite)<>3 THEN RAISE EXCEPTION 'Existing goal was modified';END IF;
 BEGIN PERFORM desktop_implement_plan('${prior.fixtureUser}',p,rev-1,NULL);RAISE EXCEPTION 'Unexpected stale revision accepted';EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE 'The plan changed.%' THEN RAISE;END IF;END;
 BEGIN PERFORM desktop_implement_plan(gen_random_uuid(),p,rev,NULL);RAISE EXCEPTION 'Unexpected account accepted';EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE 'Plan not found.%' THEN RAISE;END IF;END;
 IF has_function_privilege('authenticated','desktop_implement_plan(uuid,uuid,bigint,integer)','EXECUTE') OR NOT has_function_privilege('service_role','desktop_implement_plan(uuid,uuid,bigint,integer)','EXECUTE') THEN RAISE EXCEPTION 'Plan function grants changed';END IF;
 SELECT * INTO first_record FROM desktop_requests WHERE user_id='${prior.fixtureUser}' AND status='completed' ORDER BY created_at LIMIT 1;
 IF first_record IS NULL THEN RAISE EXCEPTION 'No saved fixture request for recovery';END IF;
 INSERT INTO desktop_goals(user_id,agent_id,objective,max_turns) VALUES('${prior.fixtureUser}',first_record.agent_id,'Recover interrupted first response',NULL) RETURNING id INTO recovered;
 UPDATE chat_messages_v2 SET metadata=metadata||jsonb_build_object('goal_id',recovered) WHERE id=first_record.user_message_id;
 PERFORM desktop_recover_goal_turns();
 IF (SELECT conversation_id FROM desktop_goals WHERE id=recovered) IS DISTINCT FROM first_record.conversation_id THEN RAISE EXCEPTION 'Interrupted goal lost its chat';END IF;
 RAISE NOTICE 'INLINE_GOAL_STORAGE_OK';END $test$;ROLLBACK;`)}
p=subprocess.run([binary,'-h','127.0.0.1','-p',str(url.port),'-U','supabase_admin','-d','postgres','-X','-v','ON_ERROR_STOP=1'],input=sql,text=True,capture_output=True,env=env)
if p.returncode or 'INLINE_GOAL_STORAGE_OK' not in p.stderr: raise RuntimeError(p.stdout+'\\n'+p.stderr)
print(json.dumps({'success':True,'checks':['unlimited plan goal','explicit limit retained','earlier goal unchanged','stale revision refused','other account refused','service-only execution','interrupted first-turn conversation recovered'],'rolledBack':True,'inferenceRequests':0}))
`);
const evidence={at:new Date().toISOString(),privateRuntime:intent.distribution,productionAccess:false,inferenceRequests:0};let started=false;
try{assert.equal(await run(['-d',intent.distribution,'-u','agentopia','--exec','cat','/opt/agentopia/runtime-instance']),intent.instanceId);started=true;try{await run(['-d',intent.distribution,'-u','agentopia','--cd','/home/agentopia/app','--exec','supabase','start','--runtime','native','--eager','--exclude','analytics,pooler,studio,rest,storage'],240000);evidence.compositionReady=true;}catch(error){if(!String(error.stderr).includes('readiness timed out'))throw error;evidence.compositionReady=false;evidence.componentReadinessFailure=true;}Object.assign(evidence,JSON.parse(await run(['-d',intent.distribution,'-u','agentopia','--exec','python3',linux(python)])));}
catch(error){evidence.success=false;evidence.error=String(error.stderr??error.message);process.exitCode=1;}
finally{if(started){await run(['-d',intent.distribution,'-u','agentopia','--cd','/home/agentopia/app','--exec','supabase','stop']).catch(()=>{});await run(['--terminate',intent.distribution],30000);}evidence.privateRuntimeStopped=!(await run(['--list','--running','--quiet'])).split(/\r?\n/).includes(intent.distribution);await writeFile(path.join(out,'evidence.json'),JSON.stringify(evidence,null,2));console.log(JSON.stringify({...evidence,out},null,2));}
