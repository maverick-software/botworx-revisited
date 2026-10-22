"""Publish a verified relocated profile last. Never copy or delete account data.

The caller supplies sealed recovery/copy/encryption/native/packaged-compatibility
receipts. A check-only call writes nothing. Startup is held by migration.lock
while the staged receipt and location record are published atomically.
"""
import argparse
import hashlib
import json
import ntpath
import os
from pathlib import Path
import re
import stat
import uuid
import importlib.util

_spec = importlib.util.spec_from_file_location('verified_profile_location', Path(__file__).with_name('profile_location_activation.py'))
_shared = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_shared)
physical, canonical, regular, digest = _shared.physical, _shared.canonical, _shared.regular, _shared.digest
checked_json, inventory = _shared.checked_json, _shared.inventory
archive_member, migration_compatibility, closed_windows = _shared.archive_member, _shared.migration_compatibility, _shared.closed_windows


def require(value, message):
    if not value:
        raise ValueError(message)


def folder(value):
    directory = physical(value)
    for item in (directory, *directory.parents):
        info = item.lstat()
        require(stat.S_ISDIR(info.st_mode) and not stat.S_ISLNK(info.st_mode)
                and not getattr(info, 'st_file_attributes', 0) & 0x400,
                'Private relocation storage contains a link or redirection.')
    return directory


def write_atomic(file, data):
    temporary = file.with_name(file.name + '.' + str(uuid.uuid4()) + '.tmp')
    try:
        with temporary.open('xb') as stream:
            stream.write(data)
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temporary, file)
    finally:
        temporary.unlink(missing_ok=True)


def activate(plan, closed=closed_windows, publish=False):
    require(plan.get('format') == 1, 'Unknown private relocation plan.')
    instance = plan.get('runtimeInstanceId', '')
    require(isinstance(instance, str) and re.fullmatch(r'[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}', instance), 'Invalid private runtime identity.')
    home = plan['windowsHome']
    require(isinstance(home, str) and re.fullmatch(r'[a-zA-Z]:\\[^\x00-\x1f]+', home), 'Invalid Windows home.')
    source = ntpath.join(home, '.agentopia', 'desktop', 'profile')
    target = plan['target']
    require(canonical(plan['source']) == canonical(source), 'The source must be the current fixed private profile.')
    require(isinstance(target, str) and re.fullmatch(r'[a-zA-Z]:\\Agentopia-Data\\profiles\\' + re.escape(instance) + r'\\profile', target), 'Invalid private relocation destination.')
    require(canonical(source) != canonical(target), 'Source and destination must differ.')
    installation = ntpath.join(home, 'AppData', 'Local', 'AgentopiaDesktop')
    require(re.fullmatch(r'\d+\.\d+\.\d+', plan['targetVersion']), 'Invalid application version.')
    installed = ntpath.join(installation, 'app-' + plan['targetVersion'], 'resources', 'app.asar')
    require(canonical(plan['installedArchive']) == canonical(installed), 'The application belongs to another Windows installation.')
    closed()
    require(digest(regular(physical(installed))) == plan['installedArchiveSha256'], 'The installed application changed.')
    require(hashlib.sha256(archive_member(physical(installed), 'build/desktop-profile-location.js')).hexdigest() == plan['selectorSha256'], 'The installed profile reader is not qualified.')
    compatibility = migration_compatibility(plan)
    require(compatibility.get('verifiedRelocatedProfile') is True and compatibility.get('fullBackendReady') is True,
            'A complete packaged relocated-profile workflow is required before activation.')
    source_dir, target_dir = folder(source), folder(target)
    directory = folder(ntpath.dirname(source))
    location_file = directory / 'profile-location.json'
    lock = directory / 'migration.lock'
    require(not lock.exists() and not lock.is_symlink(), 'Another private profile migration is active or unfinished.')
    old_location = checked_json(location_file, plan['sourceLocationSha256'])
    require(set(old_location) == {'format', 'kind', 'installationRoot', 'profile', 'runtimeInstanceId', 'migrationSha256'}
            and old_location.get('format') == 1 and old_location.get('kind') == 'verified-profile-migration'
            and isinstance(old_location.get('installationRoot'), str) and canonical(old_location['installationRoot']) == canonical(installation)
            and old_location.get('profile') == 'profile' and old_location.get('runtimeInstanceId') == instance
            and old_location.get('migrationSha256') == plan['priorMigrationSha256'],
            'The original profile location changed or belongs to another runtime.')
    require(digest(regular(source_dir / 'profile-migration.json')) == plan['priorMigrationSha256'], 'The original migration receipt changed.')
    original = json.loads((source_dir / 'profile-migration.json').read_text())
    require(original.get('format') == 1 and original.get('status') == 'complete'
            and original.get('encryptedStorageVerified') is True and original.get('nativeHistoryVerified') is True
            and type(original.get('files')) is int and original['files'] > 0
            and isinstance(original.get('copyManifestSha256'), str)
            and re.fullmatch(r'[a-f0-9]{64}', original['copyManifestSha256']), 'The original private profile migration is incomplete.')
    binding = {'format': 1, 'distribution': 'AgentopiaRuntime-' + instance, 'instanceId': instance}
    for directory_path in (source_dir, target_dir):
        require(json.loads(regular(directory_path / 'runtime-binding.json').read_text()) == binding, 'A private runtime binding changed.')
    seals = {}
    for label, directory_path in (('source', source_dir), ('target', target_dir)):
        seals[label] = checked_json(physical(plan[label + 'Seal']), plan[label + 'SealSha256'])
        require(inventory(directory_path) == seals[label], 'The ' + label + ' profile changed after verification.')
    recovery = checked_json(physical(plan['backupEvidence']), plan['backupEvidenceSha256'])
    require(recovery.get('success') is True and recovery.get('sourceUnchanged') is True
            and recovery.get('fullRawProfileVerified') is True
            and canonical(recovery.get('sourceProfile', '')) == canonical(source)
            and recovery.get('runtimeInstanceId') == instance
            and recovery.get('sourceSealSha256') == plan['sourceSealSha256'],
            'Fresh verified recovery for this closed profile is required.')
    require(digest(regular(physical(recovery['rawProfileArchive']))) == recovery['rawProfileArchiveSha256'],
            'The private profile recovery archive changed.')
    independent = checked_json(physical(recovery['independentVerification']), recovery['independentVerificationSha256'])
    require(independent.get('success') is True and independent.get('portableDatabaseAndAllResourcesVerified') is True
            and independent.get('sourceProfileUnchanged') is True and independent.get('portableCapability') == 10,
            'Independent database, key and private profile recovery verification is required.')
    copy = checked_json(physical(plan['copyEvidence']), plan['copyEvidenceSha256'])
    require(copy.get('success') is True and copy.get('sourceComparedAgain') is True
            and canonical(copy.get('source', '')) == canonical(source)
            and canonical(copy.get('destination', '')) == canonical(target)
            and type(copy.get('fileCount')) is int and copy['fileCount'] > 0,
            'The stopped private profile copy is not verified.')
    for label in ('encryptedEvidence', 'nativeEvidence'):
        receipt = checked_json(physical(plan[label]), plan[label + 'Sha256'])
        require(receipt.get('success') is True and canonical(receipt.get('profile', '')) == canonical(target)
                and receipt.get('imageSha256') == plan['installedArchiveSha256']
                and type(receipt.get('realProviderRequests')) is int and receipt['realProviderRequests'] == 0,
                'A copied-profile verification receipt is missing or belongs to another image/profile.')
        if label == 'encryptedEvidence':
            require(receipt.get('credentialsDecrypted') is True and receipt.get('actualPackagedVersionObserved') is True,
                    'Packaged Windows encryption verification is required.')
        else:
            require(receipt.get('savedRolloutsUnchanged') is True and type(receipt.get('expectedThreads')) is int
                    and receipt['expectedThreads'] >= 0 and receipt.get('threadReads') == receipt['expectedThreads']
                    and receipt.get('turnsStarted') == 0, 'Complete copied native history verification is required.')
    completion = {'format': 2, 'kind': 'verified-profile-relocation', 'status': 'complete', 'source': source,
                  'destination': target, 'runtimeInstanceId': instance, 'priorMigrationSha256': plan['priorMigrationSha256'],
                  'files': copy['fileCount'], 'copyManifestSha256': plan['copyEvidenceSha256'],
                  'encryptedStorageVerified': True, 'nativeHistoryVerified': True,
                  'sourceSealSha256': plan['sourceSealSha256'], 'targetSealSha256': plan['targetSealSha256'],
                  'encryptedEvidenceSha256': plan['encryptedEvidenceSha256'], 'nativeEvidenceSha256': plan['nativeEvidenceSha256'],
                  'compatibilityEvidenceSha256': plan['compatibilityEvidenceSha256']}
    receipt_bytes = json.dumps(completion, sort_keys=True).encode()
    location = {'format': 2, 'kind': 'verified-profile-migration', 'installationRoot': installation, 'profile': target,
                'runtimeInstanceId': instance, 'migrationSha256': hashlib.sha256(receipt_bytes).hexdigest()}
    if publish:
        ownership = {'kind': 'verified-profile-relocation', 'runtimeInstanceId': instance, 'token': str(uuid.uuid4())}
        with lock.open('x', encoding='utf-8') as stream:
            json.dump(ownership, stream)
            stream.flush()
            os.fsync(stream.fileno())
        try:
            closed()
            require(digest(regular(location_file)) == plan['sourceLocationSha256'], 'The profile selector changed during activation.')
            for label, directory_path in (('source', source_dir), ('target', target_dir)):
                require(inventory(directory_path) == seals[label], 'Profile data changed during activation.')
            write_atomic(target_dir / 'profile-migration.json', receipt_bytes)
            write_atomic(location_file, json.dumps(location, sort_keys=True).encode())
        finally:
            require(json.loads(regular(lock).read_text()) == ownership,
                    'Private migration lock ownership changed; the replacement lock was retained.')
            lock.unlink()
    return {'success': True, 'published': publish, 'profile': target, 'location': location,
            'sourceRetained': True, 'sourceDataDeleted': False, 'cDriveCleanupPending': True}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('plan', type=Path)
    parser.add_argument('--publish', action='store_true')
    args = parser.parse_args()
    try:
        print(json.dumps(activate(json.loads(regular(args.plan).read_text()), publish=args.publish)))
    except (ValueError, OSError, KeyError, TypeError) as error:
        parser.exit(1, 'Private relocation refused: ' + str(error) + '\n')
