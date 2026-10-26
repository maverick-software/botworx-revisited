"""Release83 inherits strict user row preservation, and requires schema89."""
import ast, unittest
from test_release81_preservation import Preservation
from pathlib import Path

class Release83Preservation(Preservation):
 def migration_guard(self,count=89,checksum='a'*64):
  tree=ast.parse(Path(__file__).with_name('audit_logical_snapshot71.py').read_text())
  function=next(node for node in tree.body if isinstance(node,ast.FunctionDef) and node.name=='audit')
  guard=next(node for node in ast.walk(function) if isinstance(node,ast.If) and isinstance(node.test,ast.Compare) and isinstance(node.test.left,ast.Name) and node.test.left.id=='expected_new_migration' and any(isinstance(child,ast.Name) and child.id=='metadata' for child in ast.walk(node)))
  import re
  schemas=next(node for node in function.body if isinstance(node,ast.Assign) and any(isinstance(target,ast.Name) and target.id=='migration_schemas' for target in node.targets))
  exec(compile(ast.Module(body=[schemas,guard],type_ignores=[]),'<migration checksum binding>','exec'),{'expected_new_migration':{'name':'0089-unified-agent-instructions.sql','sha256':'a'*64},'metadata':{'migrations':count,'newMigrationChecksum':checksum},'re':re})
 def test_installed89_checksum_matches_proof(self):self.migration_guard()
 def test_installed89_checksum_mismatch_rejected(self):
  with self.assertRaises(AssertionError):self.migration_guard(checksum='b'*64)
 def test_installed88_count_rejected(self):
  with self.assertRaises(AssertionError):self.migration_guard(count=88)
 def test_agent_health_accepts83_schema89(self):self.audit_guard('0.44.83',89)
 def test_agent_health_rejects83_schema88(self):
  with self.assertRaises(AssertionError):self.audit_guard('0.44.83',88)
 def test_agent_health_rejects85(self):
  with self.assertRaises(AssertionError):self.audit_guard('0.44.85',89)

if __name__=='__main__':unittest.main()
