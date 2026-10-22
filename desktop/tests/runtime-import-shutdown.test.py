"""Exercise the delivered importer with a supervisor that returns before PostgreSQL exits."""
import contextlib
import hashlib
import io
import json
import os
from pathlib import Path
import runpy
from types import SimpleNamespace
import tempfile
import unittest
from unittest.mock import patch

RESOURCE = Path(os.environ.get('AGENTOPIA_MANAGE_RESOURCE', Path(__file__).parents[1] / 'runtime/manage.py')).resolve()


class ImportShutdown(unittest.TestCase):
    def execute_import(self, statuses, expected_error=None, mismatch=False):
        self.assertEqual(os.name, 'nt', 'The controlled importer fixture must run in Windows Python.')
        self.assertFalse(Path('/home/agentopia/.config/agentopia/runtime-secrets.json').exists())
        with tempfile.TemporaryDirectory(prefix='agentopia-import-boundary-') as directory:
            base = Path(directory)
            backup, data = base / 'backup', base / 'stack/data/server/data'
            backup.mkdir(); data.mkdir(parents=True)
            incoming, original = 'a' * 64, 'b' * 64
            (backup / 'pgsodium_root.key').write_text(incoming)
            key = data.parent / 'pgsodium_root.key'; key.write_text(original)
            (backup / 'manifest.json').write_text(json.dumps({'format': 1, 'postgres': 17, 'files': [
                {'name': 'pgsodium_root.key', 'sha256': hashlib.sha256(incoming.encode()).hexdigest()}]}))
            (data / 'postmaster.pid').write_text('77\n' + str(base / 'wrong' if mismatch else data.resolve()) + '\n')
            state = {'alive': statuses[0] != 3, 'polls': 0, 'time': 0, 'started': False, 'copied': False}
            real_copy = __import__('shutil').copyfile

            def check_output(args, **kwargs):
                if args[:3] == ['supabase', 'stack', 'status']:
                    return json.dumps({'runtime': 'native', 'env': {'DB_URL': 'postgres://fixture@localhost:59002/postgres'}})
                if Path(args[0]).name == 'psql':
                    statement = args[-1]
                    if 'to_regclass' in statement: return 't\n'
                    if 'source_digest' in statement: return '1\n'
                    if 'count(*) FROM auth.users' in statement: return '2\n'
                self.fail('Unexpected external command in controlled import')

            def run(args, **kwargs):
                if args == ['supabase', 'stop']: return SimpleNamespace(returncode=0)
                if Path(args[0]).name == 'pg_ctl':
                    self.assertEqual(args[1:3], ['-D', str(data.resolve())])
                    self.assertEqual(args[-1], 'status')
                    status = statuses[min(state['polls'], len(statuses) - 1)]
                    state['polls'] += 1
                    if status == 3: state['alive'] = False
                    return SimpleNamespace(returncode=status)
                if args[:2] == ['supabase', 'start']:
                    self.assertFalse(state['alive'], 'The previous PostgreSQL process still owns shared memory')
                    self.assertTrue(state['copied']); state['started'] = True
                    return SimpleNamespace(returncode=0)
                self.fail('Unexpected external command in controlled import')

            def copy(source, target, *args, **kwargs):
                self.assertFalse(state['alive'], 'The encryption root changed before PostgreSQL exited')
                state['copied'] = True
                return real_copy(source, target, *args, **kwargs)

            def glob(pattern):
                if pattern.endswith('/bin/psql'): return [str(base / 'bin/psql')]
                if pattern.endswith('/pgsodium_root.key'): return [str(key)]
                self.fail('Unexpected filesystem inventory')

            def sleep(seconds): state['time'] += seconds
            with patch('os.chdir'), patch('glob.glob', side_effect=glob), patch('subprocess.check_output', side_effect=check_output), patch('subprocess.run', side_effect=run), patch('shutil.copyfile', side_effect=copy), patch('time.monotonic', side_effect=lambda: state['time']), patch('time.sleep', side_effect=sleep), patch('sys.argv', [str(RESOURCE), 'import', str(backup)]), contextlib.redirect_stdout(io.StringIO()):
                if expected_error:
                    with self.assertRaisesRegex(expected_error[0], expected_error[1]): runpy.run_path(str(RESOURCE), run_name='__main__')
                else: runpy.run_path(str(RESOURCE), run_name='__main__')
            if expected_error:
                self.assertEqual(key.read_text(), original)
                self.assertFalse(state['started']); self.assertFalse(state['copied'])
            else:
                self.assertEqual(key.read_text(), incoming); self.assertTrue(state['started'])
            return state

    def test_already_stopped_database_can_restore(self):
        self.execute_import([3])

    def test_supervisor_return_does_not_allow_early_key_replacement_or_restart(self):
        state = self.execute_import([0, 0, 3]); self.assertEqual(state['polls'], 3)

    def test_slow_checkpoint_gets_time_to_finish(self):
        state = self.execute_import([0] * 200 + [3]); self.assertGreaterEqual(state['time'], 39)

    def test_timeout_preserves_the_existing_key_and_refuses_restart(self):
        self.execute_import([0], (TimeoutError, 'still stopping'))

    def test_unknown_process_status_preserves_the_key(self):
        self.execute_import([1], (RuntimeError, 'verify database shutdown'))

    def test_mismatched_data_directory_cannot_authorize_key_replacement(self):
        self.execute_import([0, 3], (RuntimeError, 'data directory'), mismatch=True)


if __name__ == '__main__': unittest.main()
