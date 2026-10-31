"""Schema90 adds passive validation while preserving every original saved row."""
import ast, re, unittest
from pathlib import Path
from test_release81_preservation import Preservation

class Release84Preservation(Preservation):
 def migration_guard(self,name='0090-agent-builder-resources.sql',count=90,checksum='a'*64,proof_checksum='a'*64):
  tree=ast.parse(Path(__file__).with_name('audit_logical_snapshot71.py').read_text())
  function=next(node for node in tree.body if isinstance(node,ast.FunctionDef) and node.name=='audit')
  guard=next(node for node in ast.walk(function) if isinstance(node,ast.If) and isinstance(node.test,ast.Compare) and isinstance(node.test.left,ast.Name) and node.test.left.id=='expected_new_migration' and any(isinstance(child,ast.Name) and child.id=='metadata' for child in ast.walk(node)))
  schemas=next(node for node in function.body if isinstance(node,ast.Assign) and any(isinstance(target,ast.Name) and target.id=='migration_schemas' for target in node.targets))
  exec(compile(ast.Module(body=[schemas,guard],type_ignores=[]),'<migration checksum binding>','exec'),{'expected_new_migration':{'name':name,'sha256':proof_checksum},'metadata':{'migrations':count,'newMigrationChecksum':checksum},'re':re})
 def health_checksums(self,old='a'*64,new='b'*64):
  tree=ast.parse(Path(__file__).with_name('audit-agent-health75.py').read_text())
  checks=[node for node in tree.body if isinstance(node,ast.If) and any(isinstance(child,ast.Name) and child.id=='schema' for child in ast.walk(node.test))]
  def require(condition,*labels):assert condition,labels
  exec(compile(ast.Module(body=checks,type_ignores=[]),'<installed89 and90 checksum checks>','exec'),{'schema':90,'expected':{'expectedUnifiedInstructionsChecksum':'a'*64,'expectedAgentBuilderResourcesChecksum':'b'*64},'require':require,'sql':lambda query:{'checksum':old if '0089-' in query else new}})
 def test_health90_checks_both_migrations(self):self.health_checksums()
 def test_health90_rejects_changed89_checksum(self):
  with self.assertRaises(AssertionError):self.health_checksums(old='c'*64)
 def test_health90_rejects_changed90_checksum(self):
  with self.assertRaises(AssertionError):self.health_checksums(new='c'*64)
 def test_installed90_checksum_matches_proof(self):self.migration_guard()
 def test_installed89_still_supported(self):self.migration_guard(name='0089-unified-agent-instructions.sql',count=89)
 def test_checksum_mismatch_rejected(self):
  with self.assertRaises(AssertionError):self.migration_guard(checksum='b'*64)
 def test_invalid_digest_rejected(self):
  with self.assertRaises(AssertionError):self.migration_guard(proof_checksum="a'*64")
 def test_undeclared_name_rejected(self):
  with self.assertRaises(AssertionError):self.migration_guard(name='0091-other.sql')
 def test_old_count_rejected(self):
  with self.assertRaises(AssertionError):self.migration_guard(count=89)
 def test_agent_health_accepts84_schema90(self):self.audit_guard('0.44.84',90)
 def test_agent_health_rejects84_schema89(self):
  with self.assertRaises(AssertionError):self.audit_guard('0.44.84',89)
 def test_agent_health_rejects85(self):
  with self.assertRaises(AssertionError):self.audit_guard('0.44.85',90)

if __name__=='__main__':unittest.main()
