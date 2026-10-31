"""Qualify consolidation SQL in the existing isolated QA database; always roll back."""
import glob, json, os, subprocess
from pathlib import Path
from urllib.parse import urlparse, unquote

assert Path('/opt/agentopia/runtime-instance').read_text().strip() == 'b521a8fe-d803-4031-af23-4bb51f4e1e56'
state = json.loads(subprocess.check_output(['supabase', 'status', '--output-format', 'json'], text=True, stderr=subprocess.DEVNULL))
url = urlparse(state['env']['DB_URL'])
assert url.port == 60750
root = Path('/mnt/f/Agentopia-Consolidation/runtime')
migrations = '\n'.join((root / 'desktop/database' / name).read_text() for name in ['0086-host-plugin-ownership.sql', '0087-account-plugin-credentials.sql'])
names = ['agentopia-browser','agentopia-files-terminal','agentopia-computer','agentopia-workspace-agents','agentopia-documents-planning','agentopia-schedules','composio']
packages = json.dumps([{'name': name, 'package': {'manifest': {'name': name}}, 'digest': 'a'*64} for name in names])
fixture = r"""
DO $test$
DECLARE owner uuid; foreign_owner uuid; agent uuid=gen_random_uuid(); creation uuid=gen_random_uuid(); scope jsonb; revision bigint; secret_id uuid;
BEGIN
 SELECT id INTO owner FROM auth.users ORDER BY id LIMIT 1;
 SELECT id INTO foreign_owner FROM auth.users WHERE id<>owner ORDER BY id LIMIT 1;
 IF owner IS NULL OR foreign_owner IS NULL THEN RAISE EXCEPTION 'QA users required'; END IF;
 INSERT INTO agents(id,user_id,name,description,active,metadata) VALUES(agent,owner,'Consolidation QA','Rolled back',true,'{"settings":{"web_search_enabled":false}}');
 INSERT INTO desktop_plugins(user_id,name,package,digest,source) VALUES(owner,'serper-search','{}',repeat('a',64),'bundled'),(owner,'tavily-search','{}',repeat('a',64),'bundled') ON CONFLICT DO NOTHING;
 INSERT INTO desktop_agent_plugins(user_id,plugin_name,agent_id,enabled) VALUES(owner,'tavily-search',agent,true);
 scope=desktop_write_creation_tool_scope(owner,creation,0,gen_random_uuid(),'[]');
 PERFORM desktop_seed_host_plugins(owner,'PACKAGES'::jsonb);
 IF (SELECT count(*) FROM desktop_agent_plugins WHERE user_id=owner AND agent_id=agent AND enabled AND plugin_name LIKE 'agentopia-%')<>6 THEN RAISE EXCEPTION 'prior host capabilities lost'; END IF;
 IF EXISTS(SELECT 1 FROM desktop_agent_plugins WHERE user_id=owner AND agent_id=agent AND plugin_name='tavily-search' AND enabled) OR EXISTS(SELECT 1 FROM desktop_agent_plugins WHERE user_id=owner AND agent_id=agent AND plugin_name='serper-search') THEN RAISE EXCEPTION 'search intersection or service choice lost'; END IF;
 scope=desktop_creation_tool_scope(owner,creation); revision=(scope->>'revision')::bigint;
 IF jsonb_array_length(scope->'grants')<>7 THEN RAISE EXCEPTION 'existing creation access lost'; END IF;
 UPDATE desktop_agent_plugins SET enabled=false WHERE user_id=owner AND agent_id=agent AND plugin_name='agentopia-browser';
 scope=desktop_write_creation_tool_scope(owner,creation,revision,gen_random_uuid(),'[]'); revision=(scope->>'revision')::bigint;
 PERFORM desktop_seed_host_plugins(owner,'PACKAGES'::jsonb);
 scope=desktop_creation_tool_scope(owner,creation);
 IF (scope->>'revision')::bigint<>revision OR scope->'grants'<>'[]'::jsonb OR EXISTS(SELECT 1 FROM desktop_agent_plugins WHERE user_id=owner AND agent_id=agent AND plugin_name='agentopia-browser' AND enabled) THEN RAISE EXCEPTION 'repeat seed overwrote deselection'; END IF;
 PERFORM desktop_store_plugin_credential(owner,'serper-search','qa-synthetic-value');
 SELECT vault_secret_id INTO secret_id FROM desktop_plugin_credentials WHERE user_id=owner AND plugin_name='serper-search';
 IF secret_id IS NULL OR NOT EXISTS(SELECT 1 FROM vault.secrets WHERE id=secret_id) OR EXISTS(SELECT 1 FROM desktop_plugin_credentials WHERE user_id=foreign_owner AND vault_secret_id=secret_id) THEN RAISE EXCEPTION 'credential ownership mismatch'; END IF;
 PERFORM desktop_store_plugin_credential(owner,'serper-search','qa-replacement-value');
 IF EXISTS(SELECT 1 FROM vault.secrets WHERE id=secret_id) THEN RAISE EXCEPTION 'replaced secret retained'; END IF;
 PERFORM desktop_store_plugin_credential(owner,'serper-search',NULL);
 IF NOT EXISTS(SELECT 1 FROM desktop_plugin_credentials WHERE user_id=owner AND plugin_name='serper-search' AND NOT enabled AND vault_secret_id IS NULL) THEN RAISE EXCEPTION 'credential removal did not persist opt out'; END IF;
 IF has_function_privilege('authenticated','desktop_store_plugin_credential(uuid,text,text)','EXECUTE') OR has_table_privilege('authenticated','desktop_plugin_credentials','SELECT') THEN RAISE EXCEPTION 'credential metadata bypass'; END IF;
END $test$;
""".replace('PACKAGES', packages.replace("'", "''"))
psql = glob.glob('/home/agentopia/.supabase/cache/stack/slim-services/postgres/*/linux-amd64/*/bin/psql')[0]
result = subprocess.run([psql, '-XqAt', '-v', 'ON_ERROR_STOP=1', '-h', '127.0.0.1', '-p', str(url.port), '-U', 'supabase_admin', '-d', 'postgres'], input='BEGIN;\n'+migrations+'\n'+fixture+'\nROLLBACK;', capture_output=True, text=True, env=dict(os.environ, PGPASSWORD=unquote(url.password or '')))
if result.returncode:
 raise RuntimeError(result.stderr)
print(json.dumps({'success':True,'isolatedPort':url.port,'transactionRolledBack':True,'providerRequests':0,'checks':['existing host grants retained','search false intersects explicit grant','Tavily service choice retained','existing creation scope refreshed','repeat preserves account and draft deselections','account credential stored in Vault','replacement cleans retired synthetic secret','removal persists account opt out','authenticated role cannot bypass broker']}))
