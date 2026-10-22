import hashlib
import importlib.util
import json
from pathlib import Path
import shutil
import sqlite3
import tempfile
import unittest
from contextlib import contextmanager

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location('relocation', ROOT / 'desktop/runtime/relocate-native-profile.py')
relocation = importlib.util.module_from_spec(spec)
spec.loader.exec_module(relocation)


def digest(file):
    return hashlib.sha256(file.read_bytes()).hexdigest()


@contextmanager
def database(file):
    connection = sqlite3.connect(file)
    try:
        with connection:
            yield connection
    finally:
        connection.close()


class RelocationTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory(prefix='agentopia-native-relocation-')
        self.base = Path(self.temporary.name)
        def cleanup():
            self.assertEqual(self.base.resolve().parent, Path(tempfile.gettempdir()).resolve())
            self.assertTrue(self.base.name.startswith('agentopia-native-relocation-'))
            self.temporary.cleanup()
        self.addCleanup(cleanup)
        self.source = self.base / 'Original profile'
        self.stage = self.base / 'Staged profile'
        self.stage.mkdir()
        self.manifest = dict(format=1, codex='0.163.0', sourceProfile=str(self.source), destinationProfile=str(self.stage), state='copied')
        self.marker()

    def marker(self):
        (self.stage / relocation.MARKER).write_text(json.dumps(self.manifest), encoding='utf-8')

    def home(self, scope='scope', identifier='01999999-0000-7000-8000-000000000001', cwd=None):
        relative = Path('codex/owner/openrouter') / scope
        source_home = self.source / relative
        sessions = source_home / 'sessions/2026/10/17'
        sessions.mkdir(parents=True)
        rollout = sessions / ('rollout-2026-10-17T10-18-25-' + identifier + '.jsonl')
        rollout.write_text(json.dumps(dict(type='session_meta', payload=dict(id=identifier))) + '\n' + json.dumps({'literal': str(source_home), 'text': 'café 🟢'}) + '\n', encoding='utf-8')
        workspace = self.source / 'workspaces/owner' / scope
        workspace.mkdir(parents=True)
        staged_workspace = self.stage / workspace.relative_to(self.source)
        staged_workspace.mkdir(parents=True)
        index = source_home / 'state_5.sqlite'
        with database(index) as connection:
            connection.execute('CREATE TABLE threads(id TEXT PRIMARY KEY,rollout_path TEXT,cwd TEXT,agent_path TEXT,archived INTEGER,tokens_used INTEGER,parent_id TEXT)')
            connection.execute('INSERT INTO threads VALUES(?,?,?,?,?,?,?)', (identifier, str(rollout), str(cwd or workspace), None, 1, 123, 'parent-thread'))
        history = source_home / 'thread_history_1.sqlite'
        with database(history) as connection:
            connection.execute('CREATE TABLE thread_items(item_json TEXT,rollout_byte_offset INTEGER)')
            connection.execute('INSERT INTO thread_items VALUES(?,?)', (json.dumps({'original': str(source_home)}), 789))
        staged_home = self.stage / relative
        staged_home.parent.mkdir(parents=True, exist_ok=True)
        shutil.copytree(source_home, staged_home)
        return source_home, staged_home, rollout

    def test_repair_keeps_rollouts_history_relationships_and_external_paths(self):
        first, copied, rollout = self.home()
        external = self.base / 'External project'
        external.mkdir()
        _, other, _ = self.home('other', '01999999-0000-7000-8000-000000000002', external)
        source_hashes = {p: digest(p) for p in self.source.rglob('*') if p.is_file()}
        history_hash = digest(copied / 'thread_history_1.sqlite')
        result = relocation.repair(self.stage)
        self.assertEqual((result['homes'], result['threads']), (2, 2))
        with database(copied / 'state_5.sqlite') as connection:
            row = connection.execute('SELECT rollout_path,cwd,archived,tokens_used,parent_id FROM threads').fetchone()
        self.assertEqual(row[0], str(self.stage / rollout.relative_to(self.source)))
        self.assertIn('T10-18-25', row[0])
        self.assertEqual(row[1], str(self.stage / 'workspaces/owner/scope'))
        self.assertEqual(row[2:], (1, 123, 'parent-thread'))
        with database(other / 'state_5.sqlite') as connection:
            self.assertEqual(connection.execute('SELECT cwd FROM threads').fetchone()[0], str(external))
        self.assertEqual(digest(copied / 'thread_history_1.sqlite'), history_hash)
        self.assertEqual(digest(self.stage / rollout.relative_to(self.source)), digest(rollout))
        self.assertEqual({p: digest(p) for p in source_hashes}, source_hashes)
        self.assertEqual(relocation.repair(self.stage), result, 'Interrupted repairs can be verified or repeated safely')

    def test_all_homes_are_validated_before_any_path_is_changed(self):
        _, good, _ = self.home('good')
        _, bad, rollout = self.home('bad', '01999999-0000-7000-8000-000000000002')
        (self.stage / rollout.relative_to(self.source)).unlink()
        before = digest(good / 'state_5.sqlite')
        with self.assertRaisesRegex(ValueError, 'missing'):
            relocation.repair(self.stage)
        self.assertEqual(digest(good / 'state_5.sqlite'), before)
        self.assertEqual(json.loads((self.stage / relocation.MARKER).read_text())['state'], 'copied')

    def test_manifest_requires_a_completed_separate_copy_and_exact_pinned_version(self):
        for patch in [dict(format=2), dict(codex='future'), dict(state='copying'), dict(destinationProfile=str(self.source)), dict(sourceProfile=str(self.stage / 'nested'))]:
            with self.subTest(patch=patch):
                original = dict(self.manifest)
                self.manifest.update(patch)
                self.marker()
                with self.assertRaises(ValueError):
                    relocation.repair(self.stage)
                self.manifest = original
        self.marker()

    def test_foreign_rollouts_and_wrong_thread_identity_are_rejected(self):
        _, copied, rollout = self.home()
        index = copied / 'state_5.sqlite'
        with database(index) as connection:
            connection.execute('UPDATE threads SET rollout_path=?', (str(self.source / 'codex-other/foreign.jsonl'),))
        with self.assertRaisesRegex(ValueError, 'outside'):
            relocation.repair(self.stage)
        with database(index) as connection:
            connection.execute('UPDATE threads SET rollout_path=?,id=?', (str(rollout), 'wrong-thread'))
        with self.assertRaisesRegex(ValueError, 'match'):
            relocation.repair(self.stage)

    def test_namespace_prefix_case_comparison_and_filename_case(self):
        source = r'C:\Users\Alice\AppData\Roaming\Agentopia'
        target = Path(r'D:\Private profile')
        original = '\\\\?\\' + source.upper() + r'\codex\Owner\rollout-2026-10-17T10-00-00.jsonl'
        self.assertEqual(relocation.mapped(original, source, target), str(target / 'codex/Owner/rollout-2026-10-17T10-00-00.jsonl'))
        self.assertFalse(relocation.within(source + '-other', source))
        self.assertEqual(relocation.mapped(r'C:\External\KeepCase', source, target), r'C:\External\KeepCase')

    def test_missing_or_unsupported_native_schema_stops_before_repair(self):
        _, copied, _ = self.home()
        with database(copied / 'state_5.sqlite') as connection:
            connection.execute('DROP TABLE threads')
        with self.assertRaisesRegex(ValueError, 'schema'):
            relocation.repair(self.stage)

    def test_reserved_compact_home_can_move_before_its_first_turn(self):
        _, initialized, _ = self.home()
        binding = dict(format=1, owner='01999999-0000-7000-8000-000000000001', provider='openai-oauth', scope='reserved')
        key = hashlib.sha256(json.dumps(binding, separators=(',', ':')).encode()).hexdigest()[:32]
        reserved = self.stage / 'codex/_/openai-oauth' / key
        reserved.mkdir(parents=True)
        marker = reserved / '.agentopia-scope.json'
        marker.write_text(json.dumps(binding), encoding='utf-8')
        before = digest(marker)
        result = relocation.repair(self.stage)
        self.assertEqual((result['homes'], result['threads']), (1, 1))
        self.assertEqual(digest(marker), before)
        self.assertFalse((reserved / 'state_5.sqlite').exists())
        self.assertEqual(relocation.repair(self.stage), result)

    def test_missing_index_with_retained_rollouts_is_never_treated_as_empty(self):
        _, copied, _ = self.home()
        (copied / 'state_5.sqlite').unlink()
        with self.assertRaisesRegex(ValueError, 'history without its index'):
            relocation.repair(self.stage)
        self.assertFalse((copied / 'state_5.sqlite').exists())
        self.assertEqual(json.loads((self.stage / relocation.MARKER).read_text())['state'], 'copied')

    def test_compact_binding_mismatch_stops_before_any_index_changes(self):
        _, good, _ = self.home()
        reserved = self.stage / 'codex/_/openai-oauth' / ('a' * 32)
        reserved.mkdir(parents=True)
        (reserved / '.agentopia-scope.json').write_text(json.dumps(dict(format=1, owner='different', provider='openai-oauth', scope='reserved')))
        before = digest(good / 'state_5.sqlite')
        with self.assertRaisesRegex(ValueError, 'different scope binding'):
            relocation.repair(self.stage)
        self.assertEqual(digest(good / 'state_5.sqlite'), before)

    def test_failed_legacy_cache_and_initialized_compact_successor_move_together(self):
        _, initialized, _ = self.home()
        binding = dict(format=1, owner='01999999-0000-7000-8000-000000000001', provider='openrouter', scope='scope')
        key = hashlib.sha256(json.dumps(binding, separators=(',', ':')).encode()).hexdigest()[:32]
        compact = self.stage / 'codex/_/openrouter' / key
        compact.parent.mkdir(parents=True)
        shutil.copytree(initialized, compact)
        old = self.source / initialized.relative_to(self.stage)
        new = self.source / compact.relative_to(self.stage)
        with database(compact / 'state_5.sqlite') as connection:
            rollout = connection.execute('SELECT rollout_path FROM threads').fetchone()[0]
            connection.execute('UPDATE threads SET rollout_path=?', (str(new / Path(rollout).relative_to(old)),))
        (compact / '.agentopia-scope.json').write_text(json.dumps(binding))
        failed = self.stage / 'codex' / binding['owner'] / 'openrouter/failed/tmp/arg0-windows'
        failed.mkdir(parents=True)
        cache = failed / 'startup-cache.txt'
        cache.write_text('retained cache from failed initialization')
        before = digest(cache)
        result = relocation.repair(self.stage)
        self.assertEqual((result['homes'], result['threads']), (2, 2))
        self.assertEqual(digest(cache), before)
        self.assertFalse((failed.parents[1] / 'state_5.sqlite').exists())


if __name__ == '__main__':
    unittest.main(verbosity=2)
