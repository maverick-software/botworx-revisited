"""Reuse the full strict row comparison cases and verify the82 health/schema guard."""
import unittest
from test_release81_preservation import Preservation

class Release82Preservation(Preservation):
 def test_agent_health_accepts82_schema88(self):self.audit_guard('0.44.82',88)
 def test_agent_health_rejects82_other_schema(self):
  with self.assertRaises(AssertionError):self.audit_guard('0.44.82',87)

if __name__=='__main__':unittest.main()
