"""Read-only recovery validation of the saved builder shapes used by the editor."""
from pathlib import Path
import copy
import hashlib
import importlib.util
import io
import json
import tarfile
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[2]
SPEC = importlib.util.spec_from_file_location('recovery85', ROOT / 'desktop/runtime/prepare-desktop-recovery.py')
RECOVERY = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(RECOVERY)
OWNER = '12345678-1234-4234-9234-123456789abc'
SOURCE = '22345678-1234-4234-9234-123456789abc'
CREATION = '32345678-1234-4234-9234-123456789abc'
SESSION = '42345678-1234-4234-9234-123456789abc'
REQUEST = '52345678-1234-4234-9234-123456789abc'


def draft(scope, receipts=None):
    parts = scope.split(':')
    source = None if parts[1] == 'new' else parts[1]
    creation = parts[2] if len(parts) == 3 else None
    payload = {'version': 2 if creation else 1, 'owner': OWNER, 'source': source,
               'sessionId': SESSION, 'prompt': 'Create a useful agent', 'thinking': 'default',
               'execution': {}, 'pending': None}
    if creation:
        payload['creationId'] = creation
    if receipts is not None:
        payload['builderAppliedIds'] = receipts
    if parts[0] == 'editor':
        payload = {'version': 1, 'owner': OWNER, 'source': source, 'form': {}}
    return {'version': 1, 'owner': OWNER, 'scope': scope, 'revision': 1, 'writeId': REQUEST,
            'payload': json.dumps(payload), 'updatedAt': '2026-10-26T10:00:00.000Z'}


def altered(scope, update):
    row = draft(scope)
    payload = json.loads(row['payload'])
    update(payload)
    row['payload'] = json.dumps(payload)
    return row


class BuilderRecoveryTests(unittest.TestCase):
    def validate(self, scope, row):
        RECOVERY.validate_editor_drafts({scope: row}, OWNER)

    def rejected(self, scope, row):
        with self.assertRaises((ValueError, TypeError)):
            self.validate(scope, row)

    def test_all_canonical_locations_with_and_without_receipts(self):
        for scope in ['builder:new', 'builder:' + SOURCE, 'builder:new:' + CREATION]:
            for receipts in [None, [], [REQUEST]]:
                with self.subTest(scope=scope, receipts=receipts):
                    self.validate(scope, draft(scope, receipts))

    def test_legacy_editor_and_preview_locations(self):
        for scope in ['editor:new', 'editor:' + SOURCE, 'preview:new', 'preview:' + SOURCE, 'preview:new:' + CREATION]:
            with self.subTest(scope=scope):
                self.validate(scope, draft(scope))

    def test_receipt_limit_and_canonical_identifiers(self):
        scope = 'builder:new:' + CREATION
        receipts = [f'{index:08x}-1234-4234-9234-123456789abc' for index in range(1001)]
        self.validate(scope, draft(scope, receipts[:1000]))
        for value in [receipts, [REQUEST, REQUEST], [REQUEST.upper()], ['wrong'], [3], {}, 'wrong', None]:
            with self.subTest(value=str(value)[:60]):
                self.rejected(scope, altered(scope, lambda payload: payload.update(builderAppliedIds=value)))

    def test_receipts_are_builder_only(self):
        for scope in ['preview:new', 'preview:new:' + CREATION, 'editor:new']:
            with self.subTest(scope=scope):
                self.rejected(scope, altered(scope, lambda payload: payload.update(builderAppliedIds=[])))

    def test_foreign_identity_and_unknown_fields_rejected(self):
        scope = 'builder:new:' + CREATION
        for update in [lambda value: value.update(owner=SOURCE), lambda value: value.update(source=SOURCE),
                       lambda value: value.update(creationId=SESSION), lambda value: value.update(extra=True),
                       lambda value: value.update(version=1)]:
            self.rejected(scope, altered(scope, update))
        row = draft(scope)
        row['owner'] = SOURCE
        self.rejected(scope, row)

    def test_invalid_locations_and_canonical_case_rejected(self):
        for scope in ['builder:' + SOURCE + ':' + CREATION, 'editor:new:' + CREATION,
                      'builder:new:wrong', 'builder:NEW', 'builder:' + SOURCE.upper(), 'other:new']:
            with self.subTest(scope=scope):
                self.rejected(scope, draft(scope))

    def test_pending_request_retains_creation_and_source_binding(self):
        for scope in ['builder:new', 'builder:' + SOURCE, 'builder:new:' + CREATION]:
            row = draft(scope, [REQUEST])
            payload = json.loads(row['payload'])
            pending = {'sessionId': SESSION, 'sourceAgentId': payload['source'], 'requestId': REQUEST}
            if 'creationId' in payload:
                pending['creationId'] = payload['creationId']
            payload['pending'] = pending
            row['payload'] = json.dumps(payload)
            self.validate(scope, row)
            for field, value in [('sessionId', REQUEST), ('sourceAgentId', OWNER), ('creationId', SESSION), ('requestId', 'invalid')]:
                bad = copy.deepcopy(row)
                changed = copy.deepcopy(payload)
                changed['pending'][field] = value
                bad['payload'] = json.dumps(changed)
                self.rejected(scope, bad)

    def test_active_draft_limit_and_tombstones(self):
        rows = {}
        for index in range(101):
            scope = f'builder:{index:08x}-1234-4234-9234-123456789abc'
            rows[scope] = draft(scope)
        RECOVERY.validate_editor_drafts(dict(list(rows.items())[:100]), OWNER)
        with self.assertRaisesRegex(ValueError, 'Too many active'):
            RECOVERY.validate_editor_drafts(rows, OWNER)
        for row in rows.values():
            row['payload'] = None
        RECOVERY.validate_editor_drafts(rows, OWNER)

    def test_builder_creation_journal_requires_existing_capability17(self):
        key = 'agentopia.editor-draft.' + OWNER + ':builder:new:' + CREATION
        row = {'version': 1, 'sequence': 1, 'key': key, 'raw': '{}'}
        data = json.dumps(row).encode()
        name = 'editor-draft-journals/0000000000000001-' + hashlib.sha256(data).hexdigest() + '.json'
        with tempfile.TemporaryDirectory(prefix='builder-recovery85-') as directory:
            archive = Path(directory) / 'journals.tar.gz'
            with tarfile.open(archive, 'w:gz') as tar:
                member = tarfile.TarInfo(name)
                member.size = len(data)
                tar.addfile(member, io.BytesIO(data))
            RECOVERY.validate_editor_journal_archive(archive, 17)
            with self.assertRaisesRegex(ValueError, 'newer recovery capability'):
                RECOVERY.validate_editor_journal_archive(archive, 16)


if __name__ == '__main__':
    unittest.main()
