import assert from 'node:assert/strict';
import path from 'node:path';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {desktopOperation} from './operation-lock.mjs';
desktopOperation('verify account Composio preview selection in isolated PostgreSQL');
const root=path.resolve(import.meta.dirname,'../..'),read=async file=>JSON.parse(await readFile(file,'utf8')),current=await read(path.join(root,'.supabase/desktop-composio161/current.json')),compiled=path.join(current.out,'build'),intent=await read(path.join(root,'.supabase/desktop-release77/1792894173144/qa-intent.json'));
assert(intent.distribution==='AgentopiaRuntime-b521a8fe-d803-4031-af23-4bb51f4e1e56'&&intent.portBase===60748);assert(intent.profile.startsWith('F:\\Agentopia-Acceptance\\'));const binding=await read(path.join(intent.profile,'runtime-binding.json'));assert.equal(binding.distribution,intent.distribution);
const require=createRequire(import.meta.url),{Runtime}=require(path.join(compiled,'runtime.js')),{composioMcpPlugin,pluginDigest}=require(path.join(compiled,'plugin-validation.js')),runtime=new Runtime(intent.assets,intent.profile,state=>console.log('QA runtime: '+state.message)),out=path.join(root,'.supabase/desktop-composio161','postgres-'+Date.now());await mkdir(out,{recursive:true});
const migration=await readFile(path.join(root,'desktop/database/0084-account-composio-preview.sql'),'utf8'),quote=text=>"'"+text.replaceAll("'","''")+"'",pkg=quote(JSON.stringify(composioMcpPlugin)),digest=quote(pluginDigest(composioMcpPlugin));
const setup=`DO $test$ DECLARE a uuid; b uuid; creation uuid:=gen_random_uuid(); scope jsonb; source jsonb; BEGIN
 SELECT id INTO a FROM auth.users ORDER BY id LIMIT 1;SELECT id INTO b FROM auth.users WHERE id<>a ORDER BY id LIMIT 1;IF a IS NULL OR b IS NULL THEN RAISE EXCEPTION 'Two isolated QA users required';END IF;
 INSERT INTO desktop_plugins(user_id,name,package,digest,source,enabled) VALUES(a,'composio-connect',${pkg}::jsonb,${digest},'bundled',true) ON CONFLICT(user_id,name) DO UPDATE SET package=excluded.package,digest=excluded.digest,source='bundled',enabled=true;
 scope:=desktop_write_creation_tool_scope(a,creation,0,gen_random_uuid(),jsonb_build_array(jsonb_build_object('name','composio-connect','digest',${digest})));
 source:=jsonb_build_object('id','mcp:'||desktop_creation_connection_id((scope->>'id')::uuid,'composio-connect','composio')::text,'plugin','composio-connect');
 PERFORM desktop_validate_creation_remote_source(a,(scope->>'id')::uuid,source);
 BEGIN PERFORM desktop_validate_creation_remote_source(b,(scope->>'id')::uuid,source);RAISE EXCEPTION 'foreign owner accepted';EXCEPTION WHEN OTHERS THEN IF SQLERRM='foreign owner accepted' THEN RAISE;END IF;END;
 BEGIN PERFORM desktop_validate_creation_remote_source(a,gen_random_uuid(),source);RAISE EXCEPTION 'unselected scope accepted';EXCEPTION WHEN OTHERS THEN IF SQLERRM='unselected scope accepted' THEN RAISE;END IF;END;
 UPDATE desktop_plugins SET enabled=false WHERE user_id=a AND name='composio-connect';
 BEGIN PERFORM desktop_validate_creation_remote_source(a,(scope->>'id')::uuid,source);RAISE EXCEPTION 'disabled plugin accepted';EXCEPTION WHEN OTHERS THEN IF SQLERRM='disabled plugin accepted' THEN RAISE;END IF;END;
 UPDATE desktop_plugins SET enabled=true,source='imported' WHERE user_id=a AND name='composio-connect';
 BEGIN PERFORM desktop_validate_creation_remote_source(a,(scope->>'id')::uuid,source);RAISE EXCEPTION 'imported impersonator accepted';EXCEPTION WHEN OTHERS THEN IF SQLERRM='imported impersonator accepted' THEN RAISE;END IF;END;
 UPDATE desktop_plugins SET source='bundled',digest=repeat('f',64) WHERE user_id=a AND name='composio-connect';
 BEGIN PERFORM desktop_validate_creation_remote_source(a,(scope->>'id')::uuid,source);RAISE EXCEPTION 'changed digest accepted';EXCEPTION WHEN OTHERS THEN IF SQLERRM='changed digest accepted' THEN RAISE;END IF;END;
END $test$;`;
const evidence={success:false,at:new Date().toISOString(),out,actualPostgres:true,transactionRolledBack:false,ordinaryProfileWrites:false,providerRequests:0,migrationSha256:createHash('sha256').update(migration).digest('hex')};
try{const ready=await runtime.start();assert.notEqual(new URL(ready.env.API_URL).port,'57320');
 const code=`import os,json,glob,subprocess,sys,base64
from pathlib import Path
from urllib.parse import urlparse,unquote
assert Path('/opt/agentopia/runtime-instance').read_text().strip()==sys.argv[2]
s=json.loads(subprocess.check_output(['supabase','stack','status','--output-format','json'],text=True));u=urlparse(s['env']['DB_URL']);assert u.port==60750 and u.port!=57322
p=glob.glob('/home/agentopia/.supabase/cache/stack/slim-services/postgres/*/linux-amd64/*/bin/psql')[0]
r=subprocess.run([p,'-XqAt','-v','ON_ERROR_STOP=1','-h','127.0.0.1','-p',str(u.port),'-U','supabase_admin','-d','postgres'],input=base64.b64decode(sys.argv[1]).decode(),text=True,capture_output=True,env=dict(os.environ,PGPASSWORD=unquote(u.password or '')))
if r.returncode: raise RuntimeError(r.stderr)
print('transaction-checked-and-rolled-back')`;
 const answer=await runtime.command(['python3','-c',code,Buffer.from('BEGIN;\n'+migration+'\n'+setup+'\nROLLBACK;').toString('base64'),intent.instance]);assert.equal(answer.trim(),'transaction-checked-and-rolled-back');evidence.transactionRolledBack=true;evidence.checks=['owned selected bundled account connector accepted','foreign owner denied','unselected scope denied','disabled plugin denied','imported impersonator denied','changed package digest denied'];evidence.success=true;
}finally{await runtime.stop();evidence.qaRuntimeStopped=true;await writeFile(path.join(out,'evidence.json'),JSON.stringify(evidence,null,2));console.log('PostgreSQL evidence: '+path.join(out,'evidence.json'));}
