from contextlib import contextmanager
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location('profile_copy', ROOT / 'desktop/runtime/copy-desktop-profile.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class CopyTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='agentopia-profile-copy-')
        self.base = Path(self.temp.name)
        self.source, self.destination = self.base / 'source', self.base / 'copied'
        self.record = self.base / 'copy-state.json'
        self.source.mkdir()
        def cleanup():
            self.assertEqual(self.base.resolve().parent, Path(tempfile.gettempdir()).resolve())
            self.assertTrue(self.base.name.startswith('agentopia-profile-copy-'))
            self.temp.cleanup()
        self.addCleanup(cleanup)

    def put(self, name, data=b'original'):
        file = self.source / name
        file.parent.mkdir(parents=True, exist_ok=True)
        file.write_bytes(data)
        return file

    def copy(self, resume=False):
        return module.copy_profile(self.source, self.destination, self.record, resume)

    def test_verified_bytes_metadata_empty_directories_and_recovery_history(self):
        self.put('credentials.bin', b'ciphertext\x00\xff')
        self.put('Local State', b'encryption metadata')
        self.put('backups/older/native/notes Café 🟢.jsonl', b'unchanged backup')
        self.put('codex/owner/openrouter/scope/sessions/2026/rollout-2026-10-17T10-00-00.jsonl')
        (self.source / 'workspaces/empty').mkdir(parents=True)
        result = self.copy()
        self.assertTrue(result['success'])
        self.assertEqual(result['files'], 4)
        self.assertTrue((self.destination / 'workspaces/empty').is_dir())
        for file in self.source.rglob('*'):
            if file.is_file():
                self.assertEqual(file.read_bytes(), (self.destination / file.relative_to(self.source)).read_bytes())
        entries = [json.loads(line) for line in Path(result['manifest']).read_text().splitlines()]
        self.assertEqual(len(entries), 4)
        self.assertTrue(all(len(row['sha256']) == 64 for row in entries))
        self.assertEqual(self.copy(True)['files'], 4)

    def test_preview_copy_retains_history_and_custom_skills_while_omitting_seeded_transients(self):
        keep=['draft-previews/codex/owner/openrouter/scope/sessions/saved.jsonl','draft-previews/codex/owner/openrouter/scope/skills/custom/tmp/notes.md','draft-previews/workspaces/owner/scope/output.md']
        omitted=['draft-previews/codex/owner/openrouter/scope/tmp/helper.exe','draft-previews/codex/owner/openrouter/scope/skills/.system/seed/SKILL.md']
        for name in keep+omitted:self.put(name)
        self.assertEqual(self.copy()['files'],len(keep))
        for name in keep:self.assertEqual((self.source/name).read_bytes(),(self.destination/name).read_bytes())
        for name in omitted:self.assertFalse((self.destination/name).exists())

    def test_only_known_transient_paths_are_excluded(self):
        for name in ['wsl/ext4.vhdx', 'Cache/cache', 'test-profiles/fixture/file', 'upload-probe-old/file', 'codex/owner/openai-oauth/scope/.tmp/cache', 'codex/owner/openai-oauth/scope/skills/.system/system.md', 'lockfile']:
            self.put(name)
        for name in ['workspaces/Cache/user.md', 'codex/owner/openai-oauth/scope/skills/custom/.system/user.md', 'backups/older/Cache/old.bin']:
            self.put(name)
        result = self.copy()
        self.assertEqual(result['files'], 3)
        self.assertEqual(len(result['skipped']), 7)
        self.assertTrue((self.source / 'wsl/ext4.vhdx').is_file())

    def test_occupied_destination_and_mismatched_resume_record_are_rejected(self):
        self.destination.mkdir()
        with self.assertRaisesRegex(ValueError, 'already exists'):
            self.copy()
        self.record.write_text(json.dumps(dict(format=1, source='foreign', destination=str(self.destination))))
        with self.assertRaisesRegex(ValueError, 'different operation'):
            self.copy(True)

    def test_conflicting_destination_bytes_are_preserved_during_resume(self):
        self.put('private.md')
        self.copy()
        (self.destination / 'private.md').write_bytes(b'newer destination')
        with self.assertRaisesRegex(ValueError, 'differ'):
            self.copy(True)
        self.assertEqual((self.destination / 'private.md').read_bytes(), b'newer destination')
        self.assertEqual((self.source / 'private.md').read_bytes(), b'original')

    def test_nested_roots_or_records_inside_a_profile_are_rejected(self):
        for destination, record in [(self.source / 'nested', self.record), (self.base, self.record), (self.destination, self.source / 'state.json'), (self.destination, self.destination / 'state.json')]:
            with self.subTest(destination=destination, record=record):
                with self.assertRaises(ValueError):
                    module.copy_profile(self.source, destination, record)

    def test_unexpected_destination_files_do_not_become_a_successful_copy(self):
        self.put('kept.md')
        self.copy()
        (self.destination / 'unrecognized.bin').write_bytes(b'preserve for inspection')
        with self.assertRaisesRegex(ValueError, 'unexpected destination'):
            self.copy(True)

    def test_long_unicode_names_keep_their_spelling_and_bytes(self):
        relative = '/'.join(['Folder with spaces ' + str(n) + 'x' * 30 for n in range(7)]) + '/' + 'Café 🟢 ' + 'x' * 210 + '.md'
        source = self.put(relative, 'Long Windows path café 🟢\n'.encode('utf-8'))
        result = self.copy()
        self.assertTrue(result['success'])
        self.assertEqual((self.destination / relative).read_bytes(), source.read_bytes())


if __name__ == '__main__':
    unittest.main(verbosity=2)
