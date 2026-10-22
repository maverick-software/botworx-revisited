"""Closed-profile stage tests use generated files only, never the installed profile."""
import importlib.util
import json
from pathlib import Path
import sys
import tempfile
import unittest

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import stage_durable_profile as migration
from profile_location_activation import digest, inventory

spec = importlib.util.spec_from_file_location('activation_fixtures', HERE / 'test-profile-location-activation.py')
fixtures = importlib.util.module_from_spec(spec)
spec.loader.exec_module(fixtures)


class StageTests(unittest.TestCase):
    def setUp(self):
        base = Path('C:/Users/charl/AgentopiaQA/profile-stage-fixtures')
        base.mkdir(parents=True, exist_ok=True)
        self.temp = tempfile.TemporaryDirectory(prefix='generated-', dir=base)
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name).absolute()
        self.home = self.root / 'home'
        self.source = self.home / 'AppData/Roaming/Agentopia'
        self.target = self.home / '.agentopia/desktop/profile'
        self.source.mkdir(parents=True)
        self.instance = '12345678-1234-4123-8123-123456789abc'
        (self.source / 'runtime-binding.json').write_text(json.dumps({'format': 1, 'distribution': 'AgentopiaRuntime-' + self.instance, 'instanceId': self.instance}))
        (self.source / 'credentials.bin').write_bytes(b'generated encrypted data')
        (self.source / 'Local State').write_bytes(b'generated encryption metadata')
        (self.source / 'backups').mkdir()
        (self.source / 'backups/old.dump').write_bytes(b'retained history')
        self.image = self.home / 'AppData/Local/AgentopiaDesktop/app-0.44.42/resources/app.asar'
        self.image.parent.mkdir(parents=True)
        fixtures.archive(self.image)
        self.backup = self.root / 'recovery.json'
        self.backup.write_text(json.dumps({'success': True, 'distribution': 'AgentopiaRuntime-' + self.instance}))
        self.manifest = self.root / 'manifest.json'
        self.manifest.write_text(json.dumps({'success': True, 'manifest': {'files': {name: {'sha256': digest(self.source / name)} for name in ('credentials.bin', 'Local State', 'runtime-binding.json')}}}))
        self.plan = {'format': 1, 'windowsHome': str(self.home), 'source': str(self.source), 'target': str(self.target), 'out': str(self.root / 'evidence'), 'runtimeInstanceId': self.instance, 'backupEvidence': str(self.backup), 'backupEvidenceSha256': digest(self.backup), 'backupProfileManifest': str(self.manifest), 'backupProfileManifestSha256': digest(self.manifest), 'targetVersion': '0.44.42', 'installedArchive': str(self.image), 'installedArchiveSha256': digest(self.image), 'selectorSha256': __import__('hashlib').sha256(b'qualified-selector').hexdigest()}
        self.compatibility = self.root / 'compatibility.json'
        self.compatibility.write_text(json.dumps({'success': True, 'version': self.plan['targetVersion'], 'imageSha256': self.plan['installedArchiveSha256'], 'legacyAbsoluteLinksCompatible': True, 'closedPaneFailureVisible': True, 'coldRecovery': True, 'productionProfileChanged': False, 'realProviderRequests': 0}))
        self.plan.update(compatibilityEvidence=str(self.compatibility), compatibilityEvidenceSha256=digest(self.compatibility))
        self.closed = lambda: None
        self.repair = lambda target: {'success': True, 'homes': 0, 'threads': 0}

    def run_stage(self):
        return migration.stage(self.plan, self.closed, self.repair)

    def test_missing_compatibility_evidence_refuses_before_copying(self):
        del self.plan['compatibilityEvidence']
        with self.assertRaisesRegex(ValueError, 'compatibility'):
            self.run_stage()
        self.assertFalse(self.target.exists())
        self.assertFalse(Path(self.plan['out']).exists())

    def test_foreign_image_compatibility_is_refused_before_copying(self):
        evidence = json.loads(self.compatibility.read_text())
        evidence['imageSha256'] = '0' * 64
        self.compatibility.write_text(json.dumps(evidence))
        self.plan['compatibilityEvidenceSha256'] = digest(self.compatibility)
        with self.assertRaisesRegex(ValueError, 'compatibility'):
            self.run_stage()
        self.assertFalse(self.target.exists())
        self.assertFalse(Path(self.plan['out']).exists())

    def test_stage_verifies_current_bytes_retains_history_and_never_activates(self):
        original = inventory(self.source)
        result = self.run_stage()
        self.assertTrue(result['success'])
        self.assertFalse(result['activated'])
        self.assertEqual(result['compatibilityEvidence'], self.plan['compatibilityEvidence'])
        self.assertEqual(result['compatibilityEvidenceSha256'], self.plan['compatibilityEvidenceSha256'])
        self.assertIn('awaiting-encryption', result['phase'])
        self.assertEqual(inventory(self.source), original)
        self.assertEqual((self.target / 'credentials.bin').read_bytes(), b'generated encrypted data')
        self.assertFalse((self.target / 'backups').exists())
        self.assertEqual((self.source / 'backups/old.dump').read_bytes(), b'retained history')
        self.assertFalse((self.target.parent / 'profile-location.json').exists())

    def test_running_application_refuses_before_copying(self):
        def running():
            raise ValueError('running app')
        self.closed = running
        with self.assertRaises(ValueError):
            self.run_stage()
        self.assertFalse(self.target.exists())

    def test_old_application_cannot_stage_private_data(self):
        fixtures.archive(self.image, supported=False)
        self.plan['installedArchiveSha256'] = digest(self.image)
        with self.assertRaisesRegex(ValueError, 'does not support'):
            self.run_stage()
        self.assertFalse(self.target.exists())

    def test_newer_credentials_require_a_new_recovery(self):
        (self.source / 'credentials.bin').write_bytes(b'newer draft and session')
        with self.assertRaisesRegex(ValueError, 'differ from the recovery'):
            self.run_stage()
        self.assertFalse(self.target.exists())

    def test_occupied_target_is_retained(self):
        self.target.mkdir(parents=True)
        (self.target / 'keep.txt').write_bytes(b'existing stage')
        with self.assertRaises(ValueError):
            self.run_stage()
        self.assertEqual((self.target / 'keep.txt').read_bytes(), b'existing stage')

    def test_source_change_during_copy_refuses_activation(self):
        calls = []
        def closed():
            calls.append(1)
            if len(calls) == 2:
                (self.source / 'credentials.bin').write_bytes(b'new work after staging')
        self.closed = closed
        with self.assertRaisesRegex(ValueError, 'source changed'):
            self.run_stage()
        self.assertEqual((self.source / 'credentials.bin').read_bytes(), b'new work after staging')
        self.assertFalse((self.target.parent / 'profile-location.json').exists())

    def test_native_rebase_failure_preserves_source_and_unpublished_stage(self):
        self.repair = lambda target: {'success': False}
        before = inventory(self.source)
        with self.assertRaisesRegex(ValueError, 'rebasing'):
            self.run_stage()
        self.assertEqual(inventory(self.source), before)
        self.assertFalse((self.target.parent / 'profile-location.json').exists())


if __name__ == '__main__':
    unittest.main()
