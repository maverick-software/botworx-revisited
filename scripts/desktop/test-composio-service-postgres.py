"""Validate the service capability migration only in isolated QA, with all changes rolled back."""
import glob,json,os,subprocess
from pathlib import Path
from urllib.parse import urlparse,unquote
assert Path('/opt/agentopia/runtime-instance').read_text().strip()=='b521a8fe-d803-4031-af23-4bb51f4e1e56'
state=json.loads(subprocess.check_output(['supabase','status','--output-format','json'],text=True,stderr=subprocess.DEVNULL));url=urlparse(state['env']['DB_URL']);assert url.port==60750
root=Path(__file__).resolve().parents[2];migration=(root/'desktop/database/0088-composio-service-capabilities.sql').read_text();f=json.loads((root/'desktop/tests/fixtures/composio-services.json').read_text(encoding='utf-8-sig'))
fixture=r"""
DO $test$
DECLARE owner uuid; foreign_owner uuid; a uuid=gen_random_uuid(); b uuid=gen_random_uuid(); scope jsonb; items jsonb='ITEMS'; parent jsonb='PARENT'; g text; q text; password text;
BEGIN
 SELECT id INTO owner FROM auth.users ORDER BY id LIMIT 1; SELECT id INTO foreign_owner FROM auth.users WHERE id<>owner ORDER BY id LIMIT 1;
 IF owner IS NULL OR foreign_owner IS NULL THEN RAISE EXCEPTION 'Two QA accounts required'; END IF;
 INSERT INTO agents(id,user_id,name,description,active,metadata) VALUES(a,owner,'Service migration QA','Rolled back',true,'{}'),(b,owner,'Explicit revocation QA','Rolled back',true,'{}');
 DELETE FROM desktop_host_plugin_migrations WHERE user_id=owner AND plugin_name='composio-services-v1';
 INSERT INTO desktop_plugins(user_id,name,package,digest,source,enabled) VALUES(owner,'composio-connect',parent->'package',parent->>'digest','bundled',false) ON CONFLICT(user_id,name) DO UPDATE SET enabled=false;
 INSERT INTO desktop_agent_plugins(user_id,plugin_name,agent_id,enabled) VALUES(owner,'composio-connect',a,true),(owner,'composio-connect',b,false);
 g=items#>>'{0,package,manifest,name}';q=items#>>'{1,package,manifest,name}';password=items#>>'{2,package,manifest,name}';
 PERFORM desktop_sync_composio_service_plugins(owner,jsonb_build_array(items->0,items->2),false);
 IF EXISTS(SELECT 1 FROM desktop_agent_plugins WHERE user_id=owner AND agent_id=a AND plugin_name=g) OR EXISTS(SELECT 1 FROM desktop_host_plugin_migrations WHERE user_id=owner AND plugin_name='composio-services-v1') THEN RAISE EXCEPTION 'Partial inventory marked complete or granted access'; END IF;
 INSERT INTO desktop_agent_plugins(user_id,plugin_name,agent_id,enabled) VALUES(owner,password,a,false);
 PERFORM desktop_sync_composio_service_plugins(owner,jsonb_build_array(items->0,items->2),true);
 IF NOT EXISTS(SELECT 1 FROM desktop_agent_plugins WHERE user_id=owner AND agent_id=a AND plugin_name=g AND enabled) THEN RAISE EXCEPTION 'Saved enabled umbrella assignment lost while account disabled'; END IF;
 IF EXISTS(SELECT 1 FROM desktop_agent_plugins WHERE user_id=owner AND agent_id=a AND plugin_name=password AND enabled) OR EXISTS(SELECT 1 FROM desktop_agent_plugins WHERE user_id=owner AND agent_id=b AND plugin_name=g AND enabled) THEN RAISE EXCEPTION 'Explicit service or umbrella revocation lost'; END IF;
 IF EXISTS(SELECT 1 FROM desktop_plugins WHERE user_id=owner AND name='composio-connect' AND enabled) THEN RAISE EXCEPTION 'Global account enablement changed'; END IF;
 PERFORM desktop_sync_composio_service_plugins(owner,jsonb_build_array(items->1),true);
 IF EXISTS(SELECT 1 FROM desktop_agent_plugins WHERE user_id=owner AND agent_id=a AND plugin_name=q) THEN RAISE EXCEPTION 'Future service received automatic legacy grant'; END IF;
 UPDATE desktop_agent_plugins SET enabled=false WHERE user_id=owner AND agent_id=a AND plugin_name=g;
 PERFORM desktop_sync_composio_service_plugins(owner,jsonb_build_array(items->0),true);
 IF EXISTS(SELECT 1 FROM desktop_agent_plugins WHERE user_id=owner AND agent_id=a AND plugin_name=g AND enabled) THEN RAISE EXCEPTION 'Repeat sync restored revoked service'; END IF;
 IF EXISTS(SELECT 1 FROM desktop_plugins WHERE user_id=foreign_owner AND name IN(g,q,password)) THEN RAISE EXCEPTION 'Cross-account service installation'; END IF;
 BEGIN PERFORM desktop_sync_composio_service_plugins(owner,jsonb_build_array(jsonb_set(items->0,'{package,mcp,mcpServers,service,url}','"https://other.invalid"')),false);RAISE EXCEPTION 'Forged endpoint accepted';EXCEPTION WHEN OTHERS THEN IF SQLERRM='Forged endpoint accepted' THEN RAISE;END IF;END;
 BEGIN PERFORM desktop_composio_service_package('composio','Composio');RAISE EXCEPTION 'Management capability accepted';EXCEPTION WHEN OTHERS THEN IF SQLERRM='Management capability accepted' THEN RAISE;END IF;END;
 UPDATE desktop_plugins SET enabled=true WHERE user_id=owner AND name='composio-connect';
 scope=desktop_write_creation_tool_scope(owner,gen_random_uuid(),0,gen_random_uuid(),jsonb_build_array(jsonb_build_object('name',g,'digest',items#>>'{0,digest}')));
 PERFORM desktop_validate_creation_remote_source(owner,(scope->>'id')::uuid,jsonb_build_object('id','mcp:'||desktop_creation_connection_id((scope->>'id')::uuid,g,'service')::text,'plugin',g));
 BEGIN PERFORM desktop_validate_creation_remote_source(foreign_owner,(scope->>'id')::uuid,jsonb_build_object('id','mcp:'||desktop_creation_connection_id((scope->>'id')::uuid,g,'service')::text,'plugin',g));RAISE EXCEPTION 'Foreign draft source accepted';EXCEPTION WHEN OTHERS THEN IF SQLERRM='Foreign draft source accepted' THEN RAISE;END IF;END;
 IF has_function_privilege('authenticated','desktop_sync_composio_service_plugins(uuid,jsonb,boolean)','EXECUTE') THEN RAISE EXCEPTION 'Client could forge service inventory'; END IF;
END $test$;
""".replace('ITEMS',json.dumps(f['items']).replace("'","''")).replace('PARENT',json.dumps(f['parent']).replace("'","''"))
psql=glob.glob('/home/agentopia/.supabase/cache/stack/slim-services/postgres/*/linux-amd64/*/bin/psql')[0]
r=subprocess.run([psql,'-XqAt','-v','ON_ERROR_STOP=1','-h','127.0.0.1','-p',str(url.port),'-U','supabase_admin','-d','postgres'],input='BEGIN;\n'+migration+'\n'+fixture+'\nROLLBACK;',capture_output=True,text=True,env=dict(os.environ,PGPASSWORD=unquote(url.password or '')))
if r.returncode:raise RuntimeError(r.stderr)
print(json.dumps({'success':True,'isolatedPort':url.port,'transactionRolledBack':True,'providerRequests':0,'checks':['partial inventory grants nothing','complete snapshot preserves saved enabled legacy grant while global disabled','global and individual revocations retained','leading underscore canonical package accepted','future service not auto-assigned','repeat does not restore revoked grant','account isolation','forged endpoint denied','platform capability denied','creation service source uses owned shared auth','foreign creation denied','client cannot forge inventory']}))
