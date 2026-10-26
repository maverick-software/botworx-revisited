"""Controlled release80 row fixtures; no database, credentials or updater access."""
import copy,hashlib,tempfile,unittest
from pathlib import Path
from composio_service_row_checks80 import ComposioServiceFingerprints,package,canonical
from test_consolidation_row_checks79 import line
OWNER='88888888-8888-4888-8888-888888888888';AGENT='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
def fixture():
 pkg=package('gmail','Gmail');name=pkg['manifest']['name'];plugin={'user_id':OWNER,'name':name,'package':pkg,'digest':hashlib.sha256(canonical(pkg).encode()).hexdigest(),'source':'bundled','enabled':True,'created_at':'2026-10-26 00:00:00+00'}
 original={'auth.users':[{'id':OWNER}],'vault.secrets':[{'id':'private','secret':'ORIGINAL'}],'public.agents':[{'id':AGENT,'user_id':OWNER,'settings':{'original':True}}],'public.desktop_plugins':[{'user_id':OWNER,'name':'composio-connect','package':{'manifest':{'name':'composio-connect'}},'digest':'old','source':'bundled','enabled':False,'created_at':'2026-10-25 00:00:00+00'}],'public.desktop_agent_plugins':[{'user_id':OWNER,'plugin_name':'composio-connect','agent_id':AGENT,'enabled':True}],'public.desktop_host_plugin_migrations':[{'user_id':OWNER,'plugin_name':'agentopia-browser','completed_at':'2026-10-25 00:00:00+00'}]}
 for table in ['desktop_skills','desktop_skill_grants','desktop_skill_migrations','desktop_skill_aliases','desktop_skill_versions','desktop_plugin_credentials']:original['public.'+table]=[{'id':'original','data':{'preserve':'unchanged'}}]
 live=copy.deepcopy(original);live['public.desktop_plugins'].append(plugin);live['public.desktop_agent_plugins'].append({'user_id':OWNER,'plugin_name':name,'agent_id':AGENT,'enabled':True});live['public.desktop_host_plugin_migrations'].append({'user_id':OWNER,'plugin_name':'composio-services-v1','completed_at':'2026-10-26 00:00:00+00'})
 return {'version':80,'owner':OWNER,'catalogRevision':'a'*64,'complete':True,'services':[{'slug':'gmail','title':'Gmail'}]},original,live
class Checks(unittest.TestCase):
 def compare(self,mutate=lambda p,a,l:None):
  policy,archive,live=fixture();mutate(policy,archive,live)
  with tempfile.TemporaryDirectory(prefix='agentopia80-',dir='F:/Agentopia-Tmp') as temp:
   store=ComposioServiceFingerprints(Path(temp)/'rows.sqlite',policy)
   try:
    for scope,data in [('archive',archive),('live',live)]:
     for name,rows in data.items():
      columns=list(archive[name][0]);store.begin(scope,name,columns)
      for row in rows:store.row(scope,name,line(columns,row))
    result=store.verify_migration();self.assertEqual(store.result('archive'),store.result('live'));return result
   finally:store.close()
 def test_valid_existing79_rows_preserved(self):self.assertEqual(self.compare()['inheritedServiceGrants'],1)
 def test_changed_vault_rejected(self):
  with self.assertRaises(AssertionError):self.compare(lambda p,a,l:l['vault.secrets'][0].update(secret='changed'))
 def test_changed_agent_rejected(self):
  with self.assertRaises(AssertionError):self.compare(lambda p,a,l:l['public.agents'][0].update(settings={}))
 def test_changed_original_grant_rejected(self):
  with self.assertRaises(AssertionError):self.compare(lambda p,a,l:l['public.desktop_agent_plugins'][0].update(enabled=False))
 def test_changed_skill_resource_rejected(self):
  with self.assertRaises(AssertionError):self.compare(lambda p,a,l:l['public.desktop_skills'][0].update(data={'lost':True}))
 def test_changed_original_plugin_credential_rejected(self):
  with self.assertRaises(AssertionError):self.compare(lambda p,a,l:l['public.desktop_plugin_credentials'][0].update(data={}))
 def test_forged_package_rejected(self):
  with self.assertRaises(AssertionError):self.compare(lambda p,a,l:l['public.desktop_plugins'][-1]['package']['mcp']['mcpServers']['service'].update(url='https://attacker.invalid'))
 def test_wrong_owner_rejected(self):
  with self.assertRaises(AssertionError):self.compare(lambda p,a,l:l['public.desktop_plugins'][-1].update(user_id=AGENT))
 def test_incomplete_inventory_rejected(self):
  with self.assertRaises(AssertionError):self.compare(lambda p,a,l:p.update(complete=False))
 def test_missing_receipt_rejected(self):
  with self.assertRaises(AssertionError):self.compare(lambda p,a,l:l['public.desktop_host_plugin_migrations'].pop())
 def test_missing_inherited_grant_rejected(self):
  with self.assertRaises(AssertionError):self.compare(lambda p,a,l:l['public.desktop_agent_plugins'].pop())
 def test_removed_original_skill_rejected(self):
  with self.assertRaises(AssertionError):self.compare(lambda p,a,l:l['public.desktop_skills'].clear())
if __name__=='__main__':unittest.main()
