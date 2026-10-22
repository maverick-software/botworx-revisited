"""Generated fixtures only: activation refusal, durability and selector compatibility."""
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import struct
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location('activation', ROOT / 'scripts/desktop/profile_location_activation.py')
activation = importlib.util.module_from_spec(spec)
spec.loader.exec_module(activation)


def archive(file, contents=b'qualified-selector', supported=True):
    files = {'desktop-profile-location.js' if supported else 'old-profile.js': {'size': len(contents), 'offset': '0'}}
    header = json.dumps({'files': {'build': {'files': files}}}).encode()
    padding = b'\0' * ((-len(header)) % 4)
    header_size = 8 + len(header) + len(padding)
    file.write_bytes(struct.pack('<IIII', 4, header_size, header_size - 4, len(header)) + header + padding + contents)


class ActivationTests(unittest.TestCase):
    def setUp(self):
        base = Path('C:/Users/charl/AgentopiaQA/profile-activation-fixtures')
        base.mkdir(parents=True, exist_ok=True)
        self.temporary = tempfile.TemporaryDirectory(prefix='generated-', dir=base)
        self.addCleanup(self.temporary.cleanup)
        self.out = Path(self.temporary.name).absolute()
        self.home = self.out / 'home'
        self.source = self.home / 'AppData/Roaming/Agentopia'
        self.target = self.home / '.agentopia/desktop/profile'
        self.source.mkdir(parents=True)
        self.target.mkdir(parents=True)
        self.location = self.target.parent / 'profile-location.json'
        self.lock = self.target.parent / 'migration.lock'
        self.instance = '12345678-1234-4123-8123-123456789abc'
        binding = {'format': 1, 'distribution': 'AgentopiaRuntime-' + self.instance, 'instanceId': self.instance}
        for folder in (self.source, self.target):
            (folder / 'runtime-binding.json').write_text(json.dumps(binding))
            (folder / 'credentials.bin').write_bytes(b'generated ciphertext fixture')
        self.image = self.home / 'AppData/Local/AgentopiaDesktop/app-0.44.42/resources/app.asar'
        self.image.parent.mkdir(parents=True)
        (self.image.parent.parent / 'Agentopia.exe').write_bytes(b'generated path fixture; never executed')
        build = os.environ.get('AGENTOPIA_PROFILE_TEST_BUILD')
        self.selector = (Path(build) / 'desktop-profile-location.js').read_bytes() if build else b'qualified-selector'
        archive(self.image, self.selector)
        self.plan = {'format': 1, 'windowsHome': str(self.home), 'source': str(self.source), 'target': str(self.target), 'targetVersion': '0.44.42', 'installedArchive': str(self.image), 'installedArchiveSha256': activation.digest(self.image), 'selectorSha256': hashlib.sha256(self.selector).hexdigest(), 'runtimeInstanceId': self.instance}
        self.receipt('backupEvidence', {'success': True, 'distribution': binding['distribution']})
        self.receipt('copyEvidence', {'success': True, 'phase': 'completed'})
        self.receipt('encryptedEvidence', {'success': True, 'profile': str(self.target), 'credentialsDecrypted': True, 'providerRequests': 0})
        self.receipt('nativeEvidence', {'success': True, 'profile': str(self.target), 'savedRolloutsUnchanged': True, 'threadReads': 1, 'expectedThreads': 1, 'turnsStarted': 0, 'realProviderRequests': 0})
        self.receipt('compatibilityEvidence', {'success': True, 'version': self.plan['targetVersion'], 'imageSha256': self.plan['installedArchiveSha256'], 'legacyAbsoluteLinksCompatible': True, 'closedPaneFailureVisible': True, 'coldRecovery': True, 'productionProfileChanged': False, 'realProviderRequests': 0})
        self.seal()

    def receipt(self, name, value):
        file = self.out / (name + '.json')
        file.write_text(json.dumps(value))
        self.plan[name] = str(file)
        self.plan[name + 'Sha256'] = activation.digest(file)

    def seal(self):
        self.receipt('sourceSeal', activation.inventory(self.source))
        self.receipt('targetSeal', activation.inventory(self.target))

    def check(self, publish=False, closed=lambda: None):
        return activation.activate(self.plan, closed, publish)

    def test_missing_packaged_compatibility_refuses_before_publication_or_lock(self):
        del self.plan['compatibilityEvidence']
        del self.plan['compatibilityEvidenceSha256']
        with self.assertRaisesRegex(ValueError, 'compatibility'):
            self.check(True)
        self.assertFalse(self.lock.exists())
        self.assertFalse(self.location.exists())
        self.assertFalse((self.target / 'profile-migration.json').exists())

    def test_wrong_image_or_incomplete_link_and_recovery_acceptance_refuses(self):
        original = json.loads(Path(self.plan['compatibilityEvidence']).read_text())
        for patch in [{'imageSha256': '0' * 64}, {'version': '0.44.43'}, {'success': False}, {'legacyAbsoluteLinksCompatible': False}, {'closedPaneFailureVisible': False}, {'coldRecovery': False}, {'productionProfileChanged': True}, {'realProviderRequests': 1}]:
            with self.subTest(patch=patch):
                self.receipt('compatibilityEvidence', {**original, **patch})
                with self.assertRaisesRegex(ValueError, 'compatibility'):
                    self.check(True)
                self.assertFalse(self.lock.exists())
                self.assertFalse(self.location.exists())

    def test_changed_compatibility_receipt_is_refused_without_profile_writes(self):
        Path(self.plan['compatibilityEvidence']).write_text('{}')
        with self.assertRaisesRegex(ValueError, 'receipt changed'):
            self.check(True)
        self.assertFalse(self.location.exists())
        self.assertFalse(self.lock.exists())

    def test_check_does_not_activate_and_publication_matches_actual_selector(self):
        self.assertFalse(self.check()['published'])
        self.assertFalse(self.location.exists())
        self.assertFalse((self.target / 'profile-migration.json').exists())
        seen = []
        result = self.check(True, lambda: seen.append(self.lock.exists()))
        self.assertTrue(result['published'])
        self.assertIn(True, seen)
        self.assertFalse(self.lock.exists())
        record = json.loads(self.location.read_text())
        self.assertEqual(record['migrationSha256'], activation.digest(self.target / 'profile-migration.json'))
        self.assertEqual(json.loads((self.target / 'profile-migration.json').read_text())['compatibilityEvidenceSha256'], self.plan['compatibilityEvidenceSha256'])
        self.assertEqual((self.source / 'credentials.bin').read_bytes(), b'generated ciphertext fixture')
        build = os.environ.get('AGENTOPIA_PROFILE_TEST_BUILD')
        if build:
            options = {'platform': 'win32', 'packaged': True, 'testProfile': False, 'home': str(self.home), 'exe': str(self.image.parent.parent / 'Agentopia.exe'), 'appData': str(self.home / 'AppData/Roaming'), 'current': str(self.source)}
            code = "const{desktopProfile}=require(process.argv[1]);const x=desktopProfile(JSON.parse(process.argv[2]));if(x!==process.argv[3])throw Error('Activation record and application selector differ');"
            subprocess.run(['node', '-e', code, str(Path(build) / 'desktop-profile.js'), json.dumps(options), str(self.target)], check=True, capture_output=True)

    def test_active_application_and_existing_migration_refuse_publication(self):
        def running():
            raise ValueError('application running')
        with self.assertRaises(ValueError):
            self.check(True, running)
        self.assertFalse(self.location.exists())
        self.assertFalse(self.lock.exists())
        self.lock.write_text('another controller owns this lock')
        with self.assertRaises(FileExistsError):
            self.check(True)
        self.assertEqual(self.lock.read_text(), 'another controller owns this lock')

    def test_source_edits_new_files_and_target_edits_are_preserved_and_refused(self):
        for folder, name in [(self.source, 'credentials.bin'), (self.source, 'new-work.txt'), (self.target, 'credentials.bin')]:
            with self.subTest(folder=folder.name, name=name):
                file = folder / name
                original = file.read_bytes() if file.exists() else None
                file.write_bytes(b'newer work')
                with self.assertRaises(ValueError):
                    self.check(True)
                self.assertEqual(file.read_bytes(), b'newer work')
                self.assertFalse(self.location.exists())
                self.assertFalse(self.lock.exists())
                if original is None:
                    file.unlink()
                else:
                    file.write_bytes(original)

    def test_missing_encryption_native_validation_and_foreign_backup_are_refused(self):
        for name, patch in [('encryptedEvidence', {'credentialsDecrypted': False}), ('nativeEvidence', {'threadReads': 0}), ('backupEvidence', {'distribution': 'AgentopiaRuntime-foreign'})]:
            file = Path(self.plan[name])
            original = file.read_text()
            value = json.loads(original)
            value.update(patch)
            self.receipt(name, value)
            with self.assertRaises(ValueError):
                self.check(True)
            self.assertFalse(self.location.exists())
            file.write_text(original)
            self.plan[name + 'Sha256'] = activation.digest(file)

    def test_old_installed_application_cannot_activate_any_profile(self):
        archive(self.image, supported=False)
        self.plan['installedArchiveSha256'] = activation.digest(self.image)
        with self.assertRaisesRegex(ValueError, 'does not support'):
            self.check(True)
        self.assertFalse(self.location.exists())
        self.assertFalse(self.lock.exists())

    def test_runtime_binding_and_changed_receipt_are_refused(self):
        binding = self.target / 'runtime-binding.json'
        value = json.loads(binding.read_text())
        value['instanceId'] = '23456789-1234-4123-8123-123456789abc'
        binding.write_text(json.dumps(value))
        self.seal()
        with self.assertRaisesRegex(ValueError, 'bindings differ'):
            self.check(True)
        self.assertFalse(self.location.exists())
        receipt = Path(self.plan['nativeEvidence'])
        receipt.write_text('{}')
        with self.assertRaisesRegex(ValueError, 'receipt changed'):
            self.check(True)

    def test_a_second_launch_before_publication_keeps_both_profiles_unmodified(self):
        calls = []
        def closed():
            calls.append(1)
            if len(calls) == 4:
                raise ValueError('new launch detected')
        with self.assertRaises(ValueError):
            self.check(True, closed)
        self.assertFalse(self.location.exists())
        self.assertFalse(self.lock.exists())
        self.assertFalse((self.target / 'profile-migration.json').exists())

    def test_existing_activation_is_never_overwritten(self):
        self.check(True)
        original = self.location.read_bytes()
        with self.assertRaises(ValueError):
            self.check(True)
        self.assertEqual(self.location.read_bytes(), original)

    def test_linked_profile_file_is_refused(self):
        alias = self.target / 'aliased.bin'
        os.link(self.source / 'credentials.bin', alias)
        with self.assertRaises(ValueError):
            self.check(True)
        self.assertFalse(self.location.exists())

    def test_historical_backups_remain_pinned_in_the_original_store(self):
        backups = self.source / 'backups'
        backups.mkdir()
        (backups / 'old-recovery.dump').write_bytes(b'original historical recovery')
        st = backups.stat()
        self.plan['retainedSourceBackups'] = {'path': str(backups), 'present': True, 'device': st.st_dev, 'inode': st.st_ino}
        self.receipt('sourceSeal', activation.inventory(self.source, retain_backups=True))
        self.assertTrue(self.check(True)['published'])
        self.assertEqual((backups / 'old-recovery.dump').read_bytes(), b'original historical recovery')
        self.assertFalse((self.target / 'backups').exists())


if __name__ == '__main__':
    unittest.main()
