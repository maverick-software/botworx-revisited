"""Focused migration-comparator fixtures; never connects to a database."""
import copy, hashlib, json, tempfile, unittest
from pathlib import Path
from consolidation_row_checks79 import ConsolidationFingerprints, HOSTS, NEW_TABLES, canonical

OWNER='88888888-8888-4888-8888-888888888888';AGENT='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';SKILL='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';CREATION='cccccccc-cccc-4ccc-8ccc-cccccccccccc'
def digest(pkg):return hashlib.sha256(canonical(pkg).encode()).hexdigest()
def line(columns,row):
 def escaped(value):
  if value is None:return '\\N'
  if isinstance(value,bool):return 't' if value else 'f'
  value=canonical(value) if isinstance(value,(dict,list)) else str(value)
  return value.replace('\\','\\\\').replace('\t','\\t').replace('\n','\\n').replace('\r','\\r')
 return ('\t'.join(escaped(row.get(key)) for key in columns)+'\n').encode()

def fixture():
 hosts=[{'name':name,'package':{'manifest':{'name':name,'version':'1.0.0'}}} for name in sorted(HOSTS)]
 for host in hosts:host['digest']=digest(host['package'])
 files={'skills/research/SKILL.md':'SW5zdHJ1Y3Rpb25z','skills/research/scripts/read.py':'cHJpbnQoMSk='}
 source={'manifest':{'name':'codex-skills-01'},'files':files};version={'manifest':{'name':'skill-'+SKILL},'files':files}
 plugin=lambda name,pkg,source='bundled':{'user_id':OWNER,'name':name,'package':pkg,'digest':digest(pkg),'source':source,'enabled':True,'created_at':'2026-10-25 00:00:00+00'}
 grant=lambda name,enabled=True:{'user_id':OWNER,'plugin_name':name,'agent_id':AGENT,'enabled':enabled}
 archive={'auth.users':[{'id':OWNER}], 'vault.secrets':[{'id':'protected','secret':'CIPHERTEXT'}], 'public.agents':[{'id':AGENT,'user_id':OWNER,'metadata':{'settings':{'web_search_enabled':False}}}], 'public.desktop_plugins':[plugin('codex-skills-01',source,'imported'),plugin('serper-search',{'manifest':{'name':'serper-search'}})], 'public.desktop_agent_plugins':[grant('codex-skills-01'),grant('serper-search')], 'public.desktop_creation_tool_scopes':[{'user_id':OWNER,'creation_id':CREATION,'bound_agent_id':None,'grants':[{'name':'codex-skills-01','digest':digest(source)}],'revision':2,'write_id':'dddddddd-dddd-4ddd-8ddd-dddddddddddd','updated_at':'2026-10-24 00:00:00+00','retained_text':'Original user data'}], 'public.desktop_creation_retirements':[]}
 live=copy.deepcopy(archive);live['public.desktop_plugins'] += [plugin(r['name'],r['package']) for r in hosts]+[plugin('skill-'+SKILL,version,'imported')];live['public.desktop_agent_plugins'][1]['enabled']=False;live['public.desktop_agent_plugins'] += [grant(r['name']) for r in hosts]+[grant('skill-'+SKILL)]
 scope=live['public.desktop_creation_tool_scopes'][0];scope['grants'] += [{'name':r['name'],'digest':r['digest']} for r in hosts];scope['revision']+=len(hosts);scope['write_id']='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';scope['updated_at']='2026-10-25 00:00:00+00'
 added={name:[] for name in NEW_TABLES};added.update({'desktop_skills':[{'user_id':OWNER,'id':SKILL,'name':'Research','description':'Read evidence','files':files,'execution_name':'skill-'+SKILL,'enabled':True,'revision':1,'origin_plugin':'codex-skills-01','origin_directory':'research'}],'desktop_skill_grants':[{'user_id':OWNER,'skill_id':SKILL,'agent_id':AGENT,'enabled':True}],'desktop_skill_versions':[{'user_id':OWNER,'skill_id':SKILL,'execution_name':'skill-'+SKILL,'digest':digest(version),'package':version}],'desktop_skill_aliases':[{'user_id':OWNER,'skill_id':SKILL,'execution_name':'skill-'+SKILL,'digest':digest(version),'selection':'agentopia-plugin:codex-skills-01:'+digest(source)+':skills/research/SKILL.md'}],'desktop_skill_migrations':[{'user_id':OWNER,'plugin_name':'codex-skills-01','source_digest':digest(source),'receipt':{'skills':[{'id':SKILL,'directory':'research','files':len(files),'digest':digest(version)}],'grantsPerSkill':1}}],'desktop_host_plugin_migrations':[{'user_id':OWNER,'plugin_name':name} for name in sorted(HOSTS|{'search-explicit-v1'})]})
 columns={name:list(rows[0]) if rows else ['user_id','creation_id'] for name,rows in archive.items()};return {'hosts':hosts},archive,live,added,columns

class Checks(unittest.TestCase):
 def compare(self,mutate=lambda a,l,n:None):
  policy,archive,live,new,columns=fixture();mutate(archive,live,new)
  with tempfile.TemporaryDirectory(prefix='agentopia79-',dir='F:/Agentopia-Tmp') as temp:
   store=ConsolidationFingerprints(Path(temp)/'rows.sqlite',policy)
   try:
    for name,rows in archive.items():
     store.begin('archive',name,columns[name])
     for row in rows:store.row('archive',name,line(columns[name],row))
    expected=store.result('archive')
    for name,rows in live.items():
     store.begin('live',name,columns[name])
     for row in rows:store.row('live',name,line(columns[name],row))
    for name,rows in new.items():
     for row in rows:store.collect_new(name,line(['record'],{'record':row}))
    validation=store.verify_migration();self.assertEqual(store.result('live'),expected);return validation
   finally:store.close()
 def test_valid_migration_preserves_all_original_rows(self):self.assertEqual(self.compare()['standaloneSkills'],1)
 def test_changed_skill_resource_rejected(self):
  with self.assertRaises(AssertionError):self.compare(lambda a,l,n:n['desktop_skills'][0]['files'].update({'skills/research/SKILL.md':'changed'}))
 def test_deleted_original_row_rejected(self):
  with self.assertRaises(AssertionError):self.compare(lambda a,l,n:l['public.desktop_plugins'].pop(0))
 def test_changed_vault_ciphertext_rejected(self):
  with self.assertRaises(AssertionError):self.compare(lambda a,l,n:l['vault.secrets'][0].update(secret='REPLACED'))
 def test_changed_original_draft_text_rejected(self):
  with self.assertRaises(AssertionError):self.compare(lambda a,l,n:l['public.desktop_creation_tool_scopes'][0].update(retained_text='lost'))
 def test_missing_host_grant_rejected(self):
  with self.assertRaises(AssertionError):self.compare(lambda a,l,n:l['public.desktop_agent_plugins'].pop(2))
 def test_extra_unbound_plugin_rejected(self):
  with self.assertRaises((AssertionError,KeyError)):self.compare(lambda a,l,n:l['public.desktop_plugins'].append({**l['public.desktop_plugins'][0],'name':'unknown'}))
 def test_broadened_skill_grant_rejected(self):
  with self.assertRaises(AssertionError):self.compare(lambda a,l,n:n['desktop_skill_grants'][0].update(enabled=False))
 def test_unreviewed_credential_binding_rejected(self):
  with self.assertRaises(AssertionError):self.compare(lambda a,l,n:n['desktop_plugin_credentials'].append({'user_id':OWNER}))

if __name__=='__main__':unittest.main()
