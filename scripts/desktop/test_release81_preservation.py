"""Accepted80 already contains service rows and its receipt; release81 permits no row exceptions."""
import ast, copy, tempfile, unittest
from pathlib import Path
from composio_service_row_checks80 import ComposioServiceFingerprints
from test_composio_service_row_checks80 import fixture
from test_consolidation_row_checks79 import line

class Preservation(unittest.TestCase):
 def audit_guard(self,version,schema):
  tree=ast.parse(Path(__file__).with_name('audit-agent-health75.py').read_text());checks=[]
  for node in tree.body:
   if isinstance(node,ast.Assign) and any(isinstance(target,ast.Name) and target.id in ('version','schema') for target in node.targets):checks.append(node)
   elif isinstance(node,ast.Assert) and isinstance(node.test,ast.Compare) and isinstance(node.test.left,ast.Name) and node.test.left.id=='version':checks.append(node)
   elif isinstance(node,ast.Assert) and isinstance(node.test,ast.BoolOp) and any(isinstance(child,ast.Name) and child.id=='schema' for child in ast.walk(node)):checks.append(node)
   elif isinstance(node,ast.If) and any(isinstance(child,ast.Name) and child.id=='version' for child in ast.walk(node.test)):checks.append(node)
  exec(compile(ast.Module(body=checks,type_ignores=[]),'<read-only audit version/schema guards>','exec'),{'expected':{'version':version,'schemaMigrationCount':schema}})
 def test_agent_health_accepts81_schema88(self):self.audit_guard('0.44.81',88)
 def test_agent_health_rejects81_other_schema(self):
  with self.assertRaises(AssertionError):self.audit_guard('0.44.81',87)
 def compare(self, change=lambda rows:None):
  _,_,accepted=fixture();live=copy.deepcopy(accepted);change(live)
  with tempfile.TemporaryDirectory(prefix='agentopia81-',dir='F:/Agentopia-Tmp') as temp:
   store=ComposioServiceFingerprints(Path(temp)/'rows.sqlite',{'version':80,'owner':None,'catalogRevision':None,'complete':False,'services':[]})
   try:
    for scope,data in [('archive',accepted),('live',live)]:
     for name,rows in data.items():
      columns=list(accepted[name][0]);store.begin(scope,name,columns)
      for row in rows:store.row(scope,name,line(columns,row))
    result=store.verify_migration();self.assertEqual(store.result('archive'),store.result('live'));return result
   finally:store.close()
 def test_existing_services_and_receipt_preserved(self):
  self.assertEqual(self.compare(),{'originalRowsStrictlyPreserved':True,'canonicalServicePlugins':0,'inheritedServiceGrants':0,'completeInventoryReceipt':0,'catalogRevisionVerified':None})
 def test_added_plugin_rejected(self):
  with self.assertRaises(AssertionError):self.compare(lambda rows:rows['public.desktop_plugins'].append({**rows['public.desktop_plugins'][-1],'name':'unapproved'}))
 def test_removed_receipt_rejected(self):
  with self.assertRaises(AssertionError):self.compare(lambda rows:rows['public.desktop_host_plugin_migrations'].pop())
 def test_changed_grant_rejected(self):
  with self.assertRaises(AssertionError):self.compare(lambda rows:rows['public.desktop_agent_plugins'][-1].update(enabled=False))
 def test_changed_agent_rejected(self):
  with self.assertRaises(AssertionError):self.compare(lambda rows:rows['public.agents'][0].update(settings={}))
 def test_changed_credentials_rejected(self):
  with self.assertRaises(AssertionError):self.compare(lambda rows:rows['public.desktop_plugin_credentials'][0].update(data={}))
 def test_changed_skill_rejected(self):
  with self.assertRaises(AssertionError):self.compare(lambda rows:rows['public.desktop_skills'][0].update(data={}))
 def test_changed_vault_rejected(self):
  with self.assertRaises(AssertionError):self.compare(lambda rows:rows['vault.secrets'][0].update(secret='changed'))

if __name__=='__main__':unittest.main()
