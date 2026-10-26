"""Release85 retains schema90 and compares all original rows with the frozen strict policy."""
import unittest
import test_release81_preservation as release81
import test_release84_preservation as release84

class Release85Preservation(release81.Preservation):
 migration_guard=release84.Release84Preservation.migration_guard
 health_checksums=release84.Release84Preservation.health_checksums
 def test_agent_health_accepts85_schema90(self):self.audit_guard('0.44.85',90)
 def test_agent_health_rejects85_schema89(self):
  with self.assertRaises(AssertionError):self.audit_guard('0.44.85',89)
 def test_agent_health_rejects85_schema91(self):
  with self.assertRaises(AssertionError):self.audit_guard('0.44.85',91)
 def test_agent_health_rejects86(self):
  with self.assertRaises(AssertionError):self.audit_guard('0.44.86',90)
 def test_schema90_uses_existing0090_provenance(self):self.migration_guard()
 def test_existing_schema90_checksum_mismatch_rejected(self):
  with self.assertRaises(AssertionError):self.migration_guard(checksum='b'*64)
 def test_schema91_migration_rejected(self):
  with self.assertRaises(AssertionError):self.migration_guard(name='0091-other.sql',count=91)
 def test_both89_and90_health_checks_remain(self):self.health_checksums()
 def test_changed89_health_checksum_rejected(self):
  with self.assertRaises(AssertionError):self.health_checksums(old='c'*64)
 def test_changed90_health_checksum_rejected(self):
  with self.assertRaises(AssertionError):self.health_checksums(new='c'*64)

if __name__=='__main__':unittest.main()
