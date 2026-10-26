"""Run only against the isolated QA instance; all schema and fixture changes roll back."""
import glob, json, os, subprocess
from pathlib import Path
from urllib.parse import urlparse, unquote

assert Path('/opt/agentopia/runtime-instance').read_text().strip() == 'b521a8fe-d803-4031-af23-4bb51f4e1e56'
state = json.loads(subprocess.check_output(['supabase', 'status', '--output-format', 'json'], text=True, stderr=subprocess.DEVNULL))
url = urlparse(state['env']['DB_URL'])
assert url.port == 60750
migration = Path('/mnt/f/Agentopia-Consolidation/skills/desktop/database/0085-independent-skills.sql').read_text()
fixture = r"""
DO $test$
DECLARE owner uuid; foreign_owner uuid; agent uuid; skill uuid=gen_random_uuid(); current_id uuid=gen_random_uuid();
 original jsonb; envelope jsonb; edited jsonb; batch jsonb; selected text; source_name text='skill-migration-qa';
BEGIN
 SELECT id INTO owner FROM auth.users ORDER BY id LIMIT 1;
 SELECT id INTO foreign_owner FROM auth.users WHERE id<>owner ORDER BY id LIMIT 1;
 SELECT id INTO agent FROM agents WHERE user_id=owner LIMIT 1;
 IF owner IS NULL OR foreign_owner IS NULL OR agent IS NULL THEN RAISE EXCEPTION 'QA accounts and agent required'; END IF;
 original=jsonb_build_object('skills/one/SKILL.md','aW5zdHJ1Y3Rpb25zDQo=','skills/one/assets/raw.bin','AP+AAQ==');
 envelope=jsonb_build_object('manifest',jsonb_build_object('name','skill-'||skill::text,'version','1.0.0','description','QA'),'files',original);
 INSERT INTO desktop_plugins(user_id,name,package,digest,source,enabled) VALUES(owner,source_name,jsonb_build_object('manifest',jsonb_build_object('name',source_name),'files',original),repeat('a',64),'imported',false);
 INSERT INTO desktop_agent_plugins(user_id,plugin_name,agent_id,enabled) VALUES(owner,source_name,agent,true);
 batch=jsonb_build_array(jsonb_build_object('id',skill,'directory','one','files',original,'name','One','description','QA','execution_name','skill-'||skill::text,'package',envelope,'digest',repeat('b',64)));
 -- A partial copy must fail within its subtransaction and leave no skill or receipt behind.
 BEGIN
  PERFORM desktop_migrate_skill_package(owner,source_name,repeat('a',64),jsonb_set(batch,'{0,files}',original-'skills/one/assets/raw.bin'));
  RAISE EXCEPTION 'incomplete copy accepted';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM='incomplete copy accepted' THEN RAISE; END IF; END;
 IF EXISTS(SELECT 1 FROM desktop_skills WHERE user_id=owner AND id=skill) OR EXISTS(SELECT 1 FROM desktop_skill_migrations WHERE user_id=owner AND plugin_name=source_name) THEN RAISE EXCEPTION 'partial migration persisted'; END IF;
 PERFORM desktop_migrate_skill_package(owner,source_name,repeat('a',64),batch);
 PERFORM desktop_migrate_skill_package(owner,source_name,repeat('a',64),batch);
 IF (SELECT count(*) FROM desktop_skills WHERE user_id=owner AND origin_plugin=source_name)<>1 OR (SELECT files<>original OR enabled FROM desktop_skills WHERE user_id=owner AND id=skill) THEN RAISE EXCEPTION 'migration bytes/state mismatch'; END IF;
 IF NOT EXISTS(SELECT 1 FROM desktop_skill_grants WHERE user_id=owner AND skill_id=skill AND agent_id=agent AND enabled) THEN RAISE EXCEPTION 'grant lost'; END IF;
 selected='agentopia-plugin:'||source_name||':'||repeat('a',64)||':skills/one/SKILL.md';
 IF desktop_selected_skill_allowed(owner,agent,selected) THEN RAISE EXCEPTION 'disabled skill allowed'; END IF;
 PERFORM desktop_control_skill(owner,skill,NULL,true);
 IF NOT desktop_selected_skill_allowed(owner,agent,selected) OR desktop_selected_skill_allowed(foreign_owner,agent,selected) THEN RAISE EXCEPTION 'alias authority mismatch'; END IF;
 BEGIN PERFORM desktop_assign_plugin(owner,'skill-'||skill::text,agent,false);RAISE EXCEPTION 'plugin changed skill grant';EXCEPTION WHEN OTHERS THEN IF SQLERRM='plugin changed skill grant' THEN RAISE;END IF;END;
 BEGIN PERFORM desktop_control_skill(foreign_owner,skill,agent,false);RAISE EXCEPTION 'foreign owner changed skill';EXCEPTION WHEN OTHERS THEN IF SQLERRM='foreign owner changed skill' THEN RAISE;END IF;END;
 edited=jsonb_set(envelope,'{manifest,name}',to_jsonb('skill-'||current_id::text));edited=jsonb_set(edited,'{files,skills/one/SKILL.md}','"bmV3IGluc3RydWN0aW9ucw=="');
 PERFORM desktop_save_skill(owner,skill,1,'One edited','QA',edited,repeat('c',64));
 BEGIN PERFORM desktop_save_skill(owner,skill,1,'stale','QA',envelope,repeat('b',64));RAISE EXCEPTION 'stale save accepted';EXCEPTION WHEN OTHERS THEN IF SQLERRM='stale save accepted' THEN RAISE;END IF;END;
 PERFORM desktop_migrate_skill_package(owner,source_name,repeat('a',64),batch);
 IF (SELECT revision<>2 OR files<>edited->'files' FROM desktop_skills WHERE user_id=owner AND id=skill) OR (SELECT package<>envelope FROM desktop_skill_versions WHERE user_id=owner AND execution_name='skill-'||skill::text) OR (SELECT package->'files'<>original FROM desktop_plugins WHERE user_id=owner AND name=source_name) THEN RAISE EXCEPTION 'repeat lost edit or original bytes'; END IF;
 UPDATE agents SET active=false WHERE id=agent;
 PERFORM desktop_control_skill(owner,skill,agent,false);
 IF desktop_selected_skill_allowed(owner,agent,selected) THEN RAISE EXCEPTION 'revoked retired grant allowed'; END IF;
 BEGIN PERFORM desktop_control_skill(owner,skill,agent,true);RAISE EXCEPTION 'retired grant enabled';EXCEPTION WHEN OTHERS THEN IF SQLERRM='retired grant enabled' THEN RAISE;END IF;END;
END $test$;
"""
psql = glob.glob('/home/agentopia/.supabase/cache/stack/slim-services/postgres/*/linux-amd64/*/bin/psql')[0]
result = subprocess.run([psql, '-XqAt', '-v', 'ON_ERROR_STOP=1', '-h', '127.0.0.1', '-p', str(url.port), '-U', 'supabase_admin', '-d', 'postgres'], input='BEGIN;\n'+migration+'\n'+fixture+'\nROLLBACK;', capture_output=True, text=True, env=dict(os.environ, PGPASSWORD=unquote(url.password or '')))
if result.returncode:
 raise RuntimeError(result.stderr)
print(json.dumps({'success': True, 'isolatedPort': url.port, 'transactionRolledBack': True, 'providerRequests': 0, 'checks': ['interrupted migration rolls back', 'repeat migration deduplicates', 'binary and instruction bytes preserved', 'disabled state preserved', 'grants retained', 'alias authorization follows independent record', 'foreign owner rejected', 'direct plugin assignment rejected', 'edit creates immutable version', 'stale edit rejected', 'repeat migration preserves later edit', 'retired agent grant can be revoked and cannot be reenabled']}))
