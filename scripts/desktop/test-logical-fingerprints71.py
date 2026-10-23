"""Exercise preservation-sensitive fingerprints with generated data only."""
import io
import json
import sys
import tempfile
import tracemalloc
import unittest
from pathlib import Path
from unittest.mock import patch
from logical_row_fingerprints71 import Fingerprints

OUTPUT = Path(sys.argv[1])
assert OUTPUT.is_dir()
METRICS = {}


class AuditTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(dir=OUTPUT)
        self.store = Fingerprints(Path(self.temp.name) / 'rows.sqlite')

    def tearDown(self):
        self.store.close()
        self.temp.cleanup()

    def table(self, scope, rows, name='public.documents', columns=None):
        self.store.begin(scope, name, columns or ['id', 'bytes'])
        for row in rows:
            self.store.row(scope, name, row)

    def test_order_and_duplicate_multiplicity(self):
        self.table('archive', [b'a\t01\n', b'b\t02\n', b'a\t01\n'])
        self.table('live', [b'b\t02\n', b'a\t01\n', b'a\t01\n'])
        self.assertEqual(self.store.result('archive'), self.store.result('live'))
        self.assertEqual(self.store.result('archive')['public.documents']['rows'], 3)

    def test_missing_duplicate_changes_fingerprint(self):
        self.table('archive', [b'a\t01\n', b'a\t01\n'])
        self.table('live', [b'a\t01\n'])
        self.assertNotEqual(self.store.result('archive'), self.store.result('live'))

    def test_original_byte_change_is_detected(self):
        self.table('archive', [b'original\t\\\\xdeadbeef\n'])
        self.table('live', [b'original\t\\\\xdeadbeee\n'])
        self.assertNotEqual(self.store.result('archive'), self.store.result('live'))

    def test_auth_signin_timestamps_are_the_only_ignored_columns(self):
        columns = ['id', 'encrypted_password', 'role', 'last_sign_in_at', 'updated_at']
        self.table('archive', [b'owner\thash\tadmin\tyesterday\tyesterday\n'], 'auth.users', columns)
        self.table('live', [b'owner\thash\tadmin\ttoday\ttoday\n'], 'auth.users', columns)
        self.assertEqual(self.store.result('archive'), self.store.result('live'))

    def test_auth_password_change_is_detected(self):
        columns = ['id', 'encrypted_password', 'role']
        self.table('archive', [b'owner\toriginal-password-hash\tadmin\n'], 'auth.users', columns)
        self.table('live', [b'owner\tchanged-password-hash\tadmin\n'], 'auth.users', columns)
        self.assertNotEqual(self.store.result('archive'), self.store.result('live'))

    def test_auth_role_change_is_detected(self):
        columns = ['id', 'encrypted_password', 'role']
        self.table('archive', [b'owner\tpassword-hash\tadmin\n'], 'auth.users', columns)
        self.table('live', [b'owner\tpassword-hash\tmember\n'], 'auth.users', columns)
        self.assertNotEqual(self.store.result('archive'), self.store.result('live'))

    def test_copy_framing_and_escaped_fields(self):
        self.store.archive(io.BytesIO(b'SET x=1;\nCOPY public.documents (id, bytes) FROM stdin;\na\tcontains\\tand\\ntext\n\\.\n'), 'public')
        self.assertEqual(self.store.result('archive')['public.documents']['rows'], 1)
        with self.assertRaises(ValueError):
            self.store.archive(io.BytesIO(b'COPY public.other (id) FROM stdin;\na\n'), 'public')

    def test_invalid_columns_and_duplicate_sections_fail(self):
        with self.assertRaises(AssertionError):
            self.store.begin('archive', 'public.bad', ['id);DROP TABLE agents;'])
        self.table('archive', [])
        with self.assertRaises(AssertionError):
            self.table('archive', [])
        with self.assertRaises(AssertionError):
            self.store.row('archive', 'public.documents', b'only-one-column\n')

    def test_oversized_and_unterminated_rows_fail(self):
        with patch('logical_row_fingerprints71.MAX_COPY_ROW', 128):
            with self.assertRaises(ValueError):
                self.store.archive(io.BytesIO(b'x' * 129 + b'\n'), 'public')
        with self.assertRaises(ValueError):
            self.store.archive(io.BytesIO(b'no-newline'), 'public')

    def test_512_mib_stream_does_not_accumulate_document_bytes(self):
        row = b'a\t' + b'b' * (1024 * 1024 - 3) + b'\n'
        self.store.begin('archive', 'public.documents', ['id', 'bytes'])
        tracemalloc.start()
        for _ in range(512):
            self.store.row('archive', 'public.documents', row)
        _, peak = tracemalloc.get_traced_memory()
        tracemalloc.stop()
        METRICS['pythonTracedPeakBytes'] = peak
        self.assertLess(peak, 8 * 1024 * 1024)
        self.assertEqual(self.store.result('archive')['public.documents']['rows'], 512)


with (OUTPUT / 'unit-tests.log').open('w') as log:
    result = unittest.TextTestRunner(stream=log, verbosity=2).run(unittest.defaultTestLoader.loadTestsFromTestCase(AuditTests))
summary = {'success': result.wasSuccessful(), 'cases': result.testsRun, 'failures': len(result.failures), 'errors': len(result.errors),
           'generatedOnly': True, 'streamedDocumentPayloadMiB': 512, 'pythonTracedPeakLimitMiB': 8, **METRICS}
(OUTPUT / 'unit-evidence.json').write_text(json.dumps(summary, indent=2))
print(json.dumps(summary))
sys.exit(0 if result.wasSuccessful() else 1)
