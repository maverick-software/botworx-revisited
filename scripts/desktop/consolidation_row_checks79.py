"""Release79-specific checks for intentional additive plugin/skill migration.

Every pre-existing row is still fingerprinted. Only verified search restrictions
and appended host grants are projected back to their exact archived row bytes.
"""
import hashlib
import json
import re
import uuid
from logical_row_fingerprints71 import Fingerprints

HOSTS={'agentopia-browser','agentopia-files-terminal','agentopia-computer','agentopia-workspace-agents','agentopia-documents-planning','agentopia-schedules','composio'}
NEW_TABLES=('desktop_skills','desktop_skill_grants','desktop_skill_migrations','desktop_skill_aliases','desktop_skill_versions','desktop_host_plugin_migrations','desktop_plugin_credentials')
KEYS={'public.desktop_plugins':('user_id','name'),'public.desktop_agent_plugins':('user_id','plugin_name','agent_id'),'public.agents':('id',),'public.desktop_creation_tool_scopes':('user_id','creation_id'),'public.desktop_creation_retirements':('user_id','creation_id')}

def unescape(value):
 if value==b'\\N': return None
 text=value.decode('utf-8')
 return re.sub(r'\\([0-7]{1,3}|.)',lambda m:chr(int(m[1],8)) if m[1][0] in '01234567' else {'t':'\t','n':'\n','r':'\r','b':'\b','f':'\f','v':'\v','\\':'\\'}.get(m[1],m[1]),text)

def decode(columns,line): return dict(zip(columns,(unescape(part) for part in line[:-1].split(b'\t'))))
def canonical(value): return json.dumps(value,sort_keys=True,ensure_ascii=False,separators=(',',':'))
def truth(value): return value is True or value=='t'
def search_allowed(agent):
 value=(json.loads(agent.get('metadata') or '{}') or {}).get('settings',{}).get('web_search_enabled')
 return value is True or value=='true'

def validate_host_policy(policy):
 assert set(policy)=={'hosts'} and {r['name'] for r in policy['hosts']}==HOSTS
 for row in policy['hosts']:
  assert set(row)=={'name','package','digest'} and row['package']['manifest']['name']==row['name']
  assert hashlib.sha256(canonical(row['package']).encode()).hexdigest()==row['digest']
 return {r['name']:r for r in policy['hosts']}

class ConsolidationFingerprints(Fingerprints):
 def __init__(self,file,policy):
  super().__init__(file);self.hosts=validate_host_policy(policy);self.new_tables=NEW_TABLES;self.extra=[];self.transformed=[];self.accounts_known=set();self.validation=None
  self.db.execute('CREATE TABLE original_data(name TEXT,key TEXT,content BLOB,PRIMARY KEY(name,key))')
  self.db.execute('CREATE TABLE new_data(name TEXT,content TEXT)')
 def key(self,name,row):return canonical([row[k] for k in KEYS[name]])
 def original(self,name,key):
  found=self.db.execute('SELECT content FROM original_data WHERE name=? AND key=?',(name,canonical(key))).fetchone()
  return decode(self.tables[('archive',name)]['columns'],found[0]) if found else None
 def originals(self,name):
  if ('archive',name) not in self.tables:return []
  return [decode(self.tables[('archive',name)]['columns'],row[0]) for row in self.db.execute('SELECT content FROM original_data WHERE name=?',(name,))]
 def rows(self,name):return [json.loads(row[0]) for row in self.db.execute('SELECT content FROM new_data WHERE name=?',(name,))]
 def collect_new(self,name,line):
  assert name in NEW_TABLES
  value=json.loads(unescape(line[:-1]));assert isinstance(value,dict)
  self.db.execute('INSERT INTO new_data VALUES(?,?)',(name,canonical(value)))
 def row(self,scope,name,line):
  if scope=='archive' and name in KEYS:
   row=decode(self.tables[(scope,name)]['columns'],line);self.db.execute('INSERT INTO original_data VALUES(?,?,?)',(name,self.key(name,row),line))
  if scope=='archive' and name=='auth.users':self.accounts_known.add(decode(self.tables[(scope,name)]['columns'],line)['id'])
  if scope=='live' and name in ('public.desktop_plugins','public.desktop_agent_plugins','public.desktop_creation_tool_scopes'):
   columns=self.tables[(scope,name)]['columns'];row=decode(columns,line);old=self.db.execute('SELECT content FROM original_data WHERE name=? AND key=?',(name,self.key(name,row))).fetchone()
   if old is None:
    assert name!='public.desktop_creation_tool_scopes','Migration created an unexpected draft';self.extra.append((name,row));return
   if line!=old[0]:
    original=decode(columns,old[0]);self.verify_transform(name,original,row);self.transformed.append({'table':name,'key':self.key(name,row)});line=old[0]
  super().row(scope,name,line)
 def verify_transform(self,name,old,row):
  if name=='public.desktop_agent_plugins':
   assert row['plugin_name'] in ('serper-search','tavily-search') and not truth(row['enabled']) and truth(old['enabled'])
   agent=self.original('public.agents',[row['agent_id']]);assert agent and agent['user_id']==row['user_id']
   assert not search_allowed(agent)
   assert {k:v for k,v in old.items() if k!='enabled'}=={k:v for k,v in row.items() if k!='enabled'}
  elif name=='public.desktop_creation_tool_scopes':
   assert old['bound_agent_id'] is None and not self.original('public.desktop_creation_retirements',[old['user_id'],old['creation_id']])
   before=json.loads(old['grants']);after=json.loads(row['grants']);added=[g for g in after if g not in before]
   assert added and len(added)==len({g['name'] for g in added}) and len(after)==len(before)+len(added)
   assert all(g in after for g in before)
   for grant in added:assert grant=={'name':grant['name'],'digest':self.hosts[grant['name']]['digest']}
   assert int(row['revision'])==int(old['revision'])+len(added);uuid.UUID(row['write_id']);assert row['updated_at']>=old['updated_at']
   assert {k:v for k,v in old.items() if k not in ('grants','revision','write_id','updated_at')}=={k:v for k,v in row.items() if k not in ('grants','revision','write_id','updated_at')}
  else:raise AssertionError('Unapproved original row change: '+name)
 def verify_migration(self):
  assert not self.rows('desktop_plugin_credentials'),'No credential writes belong to upgrade qualification'
  skills=self.rows('desktop_skills');versions=self.rows('desktop_skill_versions');grants=self.rows('desktop_skill_grants');aliases=self.rows('desktop_skill_aliases');receipts=self.rows('desktop_skill_migrations');host_receipts=self.rows('desktop_host_plugin_migrations')
  skill_by={(r['user_id'],r['id']):r for r in skills};assert len(skill_by)==len(skills)
  version_by={(r['user_id'],r['execution_name']):r for r in versions};assert len(version_by)==len(versions)==len(skills)
  sources={};original_grants=self.originals('public.desktop_agent_plugins')
  for row in skills:
   owner=row['user_id'];assert owner in self.accounts_known and row['revision']==1;uuid.UUID(row['id']);assert row['execution_name']=='skill-'+row['id']
   source=self.original('public.desktop_plugins',[owner,row['origin_plugin']]);assert source and source['source']=='imported' and truth(source['enabled'])==row['enabled'];package=json.loads(source['package']);assert 'mcp' not in package
   files={k:v for k,v in package['files'].items() if k.startswith('skills/'+row['origin_directory']+'/')};assert row['files']==files and files and 'skills/'+row['origin_directory']+'/SKILL.md' in files
   key=(owner,row['origin_plugin']);merged=sources.setdefault(key,{});assert not set(merged)&set(files);merged.update(files)
   version=version_by[(owner,row['execution_name'])];assert version['skill_id']==row['id'] and version['package']['files']==files and version['package']['manifest']['name']==row['execution_name'] and 'mcp' not in version['package'];assert hashlib.sha256(canonical(version['package']).encode()).hexdigest()==version['digest']
   expected={(g['agent_id'],truth(g['enabled'])) for g in original_grants if g['user_id']==owner and g['plugin_name']==row['origin_plugin']};actual={(g['agent_id'],g['enabled']) for g in grants if g['user_id']==owner and g['skill_id']==row['id']};assert actual==expected
   matches=[a for a in aliases if a['user_id']==owner and a['skill_id']==row['id']];assert len(matches)==1;alias=matches[0];assert alias['selection']=='agentopia-plugin:'+row['origin_plugin']+':'+source['digest']+':skills/'+row['origin_directory']+'/SKILL.md' and alias['execution_name']==row['execution_name'] and alias['digest']==version['digest']
  assert len(aliases)==len(skills) and all((g['user_id'],g['skill_id']) in skill_by for g in grants)
  assert len(receipts)==len(sources)
  for receipt in receipts:
   key=(receipt['user_id'],receipt['plugin_name']);source=self.original('public.desktop_plugins',list(key));assert source and receipt['source_digest']==source['digest'] and sources[key]==json.loads(source['package'])['files']
   owned=[s for s in skills if (s['user_id'],s['origin_plugin'])==key];record=receipt['receipt'];assert len(record['skills'])==len(owned) and {r['id'] for r in record['skills']}=={s['id'] for s in owned}
   assert record['grantsPerSkill']==len([g for g in original_grants if (g['user_id'],g['plugin_name'])==key])
   for entry in record['skills']:
    s=skill_by[(receipt['user_id'],entry['id'])];assert entry=={'id':s['id'],'directory':s['origin_directory'],'files':len(s['files']),'digest':version_by[(s['user_id'],s['execution_name'])]['digest']}
  for row in host_receipts:assert row['user_id'] in self.accounts_known and row['plugin_name'] in HOSTS|{'search-explicit-v1'}
  receipt_keys={(r['user_id'],r['plugin_name']) for r in host_receipts};assert len(receipt_keys)==len(host_receipts)
  for table,row in self.extra:
   owner=row['user_id'];assert owner in self.accounts_known
   if table=='public.desktop_plugins':
    if row['name'] in HOSTS:
     pinned=self.hosts[row['name']];assert row['source']=='bundled' and truth(row['enabled']) and row['digest']==pinned['digest'] and json.loads(row['package'])==pinned['package'] and (owner,row['name']) in receipt_keys
    else:
     version=version_by[(owner,row['name'])];s=skill_by[(owner,version['skill_id'])];assert row['source']=='imported' and truth(row['enabled'])==s['enabled'] and row['digest']==version['digest'] and json.loads(row['package'])==version['package']
   else:
    agent=self.original('public.agents',[row['agent_id']]);assert agent and agent['user_id']==owner
    if row['plugin_name'] in HOSTS:assert truth(row['enabled']) and (owner,row['plugin_name']) in receipt_keys
    elif row['plugin_name']=='serper-search':
     assert (owner,'search-explicit-v1') in receipt_keys and not any(g['user_id']==owner and g['agent_id']==row['agent_id'] and g['plugin_name'] in ('serper-search','tavily-search') for g in original_grants)
     assert truth(row['enabled'])==search_allowed(agent)
    else:
     version=version_by[(owner,row['plugin_name'])];assert any(g['user_id']==owner and g['skill_id']==version['skill_id'] and g['agent_id']==row['agent_id'] and g['enabled']==truth(row['enabled']) for g in grants)
  extra_plugins={(r['user_id'],r['name']):r for table,r in self.extra if table=='public.desktop_plugins'}
  extra_grants={(r['user_id'],r['plugin_name'],r['agent_id']):r for table,r in self.extra if table=='public.desktop_agent_plugins'}
  assert len(extra_plugins)==len([r for table,r in self.extra if table=='public.desktop_plugins'])
  assert len(extra_grants)==len([r for table,r in self.extra if table=='public.desktop_agent_plugins'])
  for owner,name in receipt_keys:
   if name not in HOSTS:continue
   assert (owner,name) in extra_plugins or self.original('public.desktop_plugins',[owner,name])
   for agent in self.originals('public.agents'):
    if agent['user_id']==owner:assert (owner,name,agent['id']) in extra_grants or self.original('public.desktop_agent_plugins',[owner,name,agent['id']])
  for owner,execution in version_by:
   assert (owner,execution) in extra_plugins
   version=version_by[(owner,execution)]
   for grant in grants:
    if grant['user_id']==owner and grant['skill_id']==version['skill_id']:assert (owner,execution,grant['agent_id']) in extra_grants
  for row in self.transformed:
   if row['table']=='public.desktop_creation_tool_scopes':
    owner=json.loads(row['key'])[0];assert all((owner,name) in receipt_keys for name in HOSTS)
  self.validation={'standaloneSkills':len(skills),'skillResourcesAndGrantsReconciled':True,'additionalPluginAndGrantRows':len(self.extra),'verifiedRestrictiveSearchAndDraftRows':len(self.transformed),'newTablesChecked':len(NEW_TABLES),'credentialBindingsRemainEmpty':True}
  return self.validation
