"""Publish a validated closed-profile migration last; never copy or delete data.

Run the CLI from WSL to inspect physical Windows files without AppData redirection.
The ordinary app must be stopped. The installed archive must contain the exact
qualified selector before any profile can be activated. --check never publishes.
"""
import argparse
import hashlib
import json
import ntpath
import os
from pathlib import Path
import re
import stat
import struct
import subprocess
import uuid
import importlib.util

_copy_spec = importlib.util.spec_from_file_location('profile_copy_policy', Path(__file__).resolve().parents[2] / 'desktop/runtime/copy-desktop-profile.py')
_copy_policy = importlib.util.module_from_spec(_copy_spec)
_copy_spec.loader.exec_module(_copy_policy)


def digest(file):
    with Path(file).open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()


def canonical(value):
    return ntpath.normcase(ntpath.normpath(str(value)))


def physical(value):
    if os.name == 'nt':
        return Path(value)
    if not re.fullmatch(r'[A-Za-z]:\\[^\r\n]*', str(value)):
        raise ValueError('A migration Windows path is invalid.')
    return Path('/mnt/' + value[0].lower() + value[2:].replace('\\', '/'))


def regular(file):
    file = Path(file)
    for item in (file, *file.parents):
        st = item.lstat()
        if stat.S_ISLNK(st.st_mode) or getattr(st, 'st_file_attributes', 0) & 0x400:
            raise ValueError('Migration storage contains a link or redirection.')
    st = file.stat()
    if not stat.S_ISREG(st.st_mode) or st.st_nlink != 1:
        raise ValueError('A migration receipt or profile file is not a private regular file.')
    return file


def checked_json(file, expected):
    file = regular(file)
    if digest(file) != expected:
        raise ValueError('A migration receipt changed after verification.')
    return json.loads(file.read_text(encoding='utf-8-sig'))


def migration_compatibility(plan):
    """Bind app-level copied-output/restart acceptance to the installed image.

    This is separate from validating this user's copied encryption and history.
    An older selector alone cannot establish that saved output links still work.
    """
    if not isinstance(plan.get('compatibilityEvidence'), str) or not isinstance(plan.get('compatibilityEvidenceSha256'), str):
        raise ValueError('Packaged migration compatibility verification is required before staging or activation.')
    evidence = checked_json(physical(plan['compatibilityEvidence']), plan['compatibilityEvidenceSha256'])
    if (evidence.get('success') is not True
            or evidence.get('version') != plan['targetVersion']
            or evidence.get('imageSha256') != plan['installedArchiveSha256']
            or any(evidence.get(name) is not True for name in ('legacyAbsoluteLinksCompatible', 'closedPaneFailureVisible', 'coldRecovery'))
            or evidence.get('productionProfileChanged') is not False
            or type(evidence.get('realProviderRequests')) is not int
            or evidence['realProviderRequests'] != 0):
        raise ValueError('Packaged migration compatibility is incomplete or belongs to another application image.')
    return evidence


def inventory(directory, retain_backups=False):
    directory = Path(directory)
    result = {}
    for folder, dirs, files in os.walk(directory, followlinks=False):
        dirs[:] = [name for name in dirs if not _copy_policy.excluded((Path(folder) / name).relative_to(directory), True) and not (retain_backups and Path(folder) == directory and name == 'backups')]
        for name in dirs:
            entry = Path(folder) / name
            st = entry.lstat()
            if stat.S_ISLNK(st.st_mode) or getattr(st, 'st_file_attributes', 0) & 0x400:
                raise ValueError('A profile directory changed into a link.')
        for name in files:
            if _copy_policy.excluded((Path(folder) / name).relative_to(directory), False):
                continue
            entry = regular(Path(folder) / name)
            result[entry.relative_to(directory).as_posix()] = digest(entry)
    return result


def archive_member(archive, member):
    with regular(archive).open('rb') as stream:
        first = stream.read(16)
        if len(first) != 16:
            raise ValueError('The installed application archive is incomplete.')
        tag, header_size, _, json_size = struct.unpack('<IIII', first)
        if tag != 4 or json_size > 32 * 1024 * 1024 or header_size < json_size + 8:
            raise ValueError('The installed application archive header is invalid.')
        node = json.loads(stream.read(json_size))
        try:
            for part in member.split('/'):
                node = node['files'][part]
        except KeyError:
            raise ValueError('The installed application does not support durable profile selection.') from None
        if node.get('unpacked') or node.get('link'):
            raise ValueError('The installed selector must be inside the qualified archive.')
        offset, size = int(node['offset']), int(node['size'])
        if offset < 0 or size < 1 or size > 1024 * 1024:
            raise ValueError('The installed selector entry is invalid.')
        stream.seek(8 + header_size + offset)
        data = stream.read(size)
        if len(data) != size:
            raise ValueError('The installed selector is incomplete.')
        return data


def _activate_checked(plan, closed, publish=False):
    home = ntpath.normpath(plan['windowsHome'])
    source = ntpath.join(home, 'AppData', 'Roaming', 'Agentopia')
    installation = ntpath.join(home, 'AppData', 'Local', 'AgentopiaDesktop')
    directory = ntpath.join(home, '.agentopia', 'desktop')
    target = ntpath.join(directory, 'profile')
    if plan.get('format') != 1 or canonical(plan['source']) != canonical(source) or canonical(plan['target']) != canonical(target):
        raise ValueError('The migration must bind the same Windows user and fixed private profile.')
    archive = ntpath.normpath(plan['installedArchive'])
    expected_archive = ntpath.join(installation, 'app-' + plan['targetVersion'], 'resources', 'app.asar')
    if canonical(archive) != canonical(expected_archive):
        raise ValueError('The qualified installed archive belongs to another installation.')
    selector = archive_member(physical(archive), 'build/desktop-profile-location.js')
    if hashlib.sha256(selector).hexdigest() != plan['selectorSha256'] or digest(physical(archive)) != plan['installedArchiveSha256']:
        raise ValueError('The installed application differs from its qualified selector/image.')
    migration_compatibility(plan)
    closed()
    record = physical(ntpath.join(directory, 'profile-location.json'))
    if record.exists():
        raise ValueError('A profile location already exists; preserve it instead of overwriting it.')
    backup = checked_json(physical(plan['backupEvidence']), plan['backupEvidenceSha256'])
    if not backup.get('success'):
        raise ValueError('A verified recovery checkpoint is required.')
    copy = checked_json(physical(plan['copyEvidence']), plan['copyEvidenceSha256'])
    if not copy.get('success') or copy.get('phase') != 'completed':
        raise ValueError('The physical profile copy is incomplete.')
    encrypted = checked_json(physical(plan['encryptedEvidence']), plan['encryptedEvidenceSha256'])
    native = checked_json(physical(plan['nativeEvidence']), plan['nativeEvidenceSha256'])
    if not encrypted.get('success') or canonical(encrypted['profile']) != canonical(target) or encrypted.get('credentialsDecrypted') is not True or encrypted.get('providerRequests') != 0:
        raise ValueError('Copied Windows encryption has not been verified for this profile.')
    if not native.get('success') or canonical(native['profile']) != canonical(target) or native.get('savedRolloutsUnchanged') is not True or native.get('threadReads') != native.get('expectedThreads') or native.get('turnsStarted') != 0 or native.get('realProviderRequests') != 0:
        raise ValueError('Actual copied native history validation is incomplete.')
    source_seal = checked_json(physical(plan['sourceSeal']), plan['sourceSealSha256'])
    target_seal = checked_json(physical(plan['targetSeal']), plan['targetSealSha256'])
    retained = plan.get('retainedSourceBackups')
    if retained is not None:
        expected = physical(ntpath.join(source, 'backups'))
        if canonical(retained.get('path', '')) != canonical(ntpath.join(source, 'backups')):
            raise ValueError('Retained recovery history points outside the source profile.')
        if retained.get('present'):
            st = expected.lstat()
            if not stat.S_ISDIR(st.st_mode) or stat.S_ISLNK(st.st_mode) or (st.st_dev, st.st_ino) != (retained['device'], retained['inode']):
                raise ValueError('Retained historical recovery storage changed identity.')
    if not source_seal or not target_seal or inventory(physical(source), retain_backups=retained is not None) != source_seal:
        raise ValueError('The source changed after staging; preserve new work before migration.')
    if inventory(physical(target)) != target_seal:
        raise ValueError('The validated target changed before activation.')
    instance = plan['runtimeInstanceId']
    if not re.fullmatch(r'[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}', instance):
        raise ValueError('Invalid private runtime instance.')
    if backup.get('distribution') != 'AgentopiaRuntime-' + instance:
        raise ValueError('The recovery belongs to another private runtime.')
    for folder in (source, target):
        binding = json.loads(regular(physical(ntpath.join(folder, 'runtime-binding.json'))).read_text())
        if binding != {'format': 1, 'distribution': 'AgentopiaRuntime-' + instance, 'instanceId': instance}:
            raise ValueError('The copied/source private runtime bindings differ.')
    closed()
    receipt = {'format': 1, 'status': 'complete', 'files': len(target_seal), 'copyManifestSha256': plan['copyEvidenceSha256'], 'encryptedStorageVerified': True, 'nativeHistoryVerified': True, 'sourceSealSha256': plan['sourceSealSha256'], 'targetSealSha256': plan['targetSealSha256'], 'compatibilityEvidenceSha256': plan['compatibilityEvidenceSha256']}
    receipt_bytes = json.dumps(receipt, sort_keys=True).encode('utf-8')
    location = {'format': 1, 'kind': 'verified-profile-migration', 'installationRoot': installation, 'profile': 'profile', 'runtimeInstanceId': instance, 'migrationSha256': hashlib.sha256(receipt_bytes).hexdigest()}
    if publish:
        receipt_file = physical(ntpath.join(target, 'profile-migration.json'))
        with receipt_file.open('xb') as stream:
            stream.write(receipt_bytes)
            stream.flush()
            os.fsync(stream.fileno())
        # Publish last with exclusive creation. Existing location records are
        # never replaced. A concurrent partial read fails closed at startup.
        try:
            closed()
            with record.open('x', encoding='utf-8') as stream:
                json.dump(location, stream)
                stream.flush()
                os.fsync(stream.fileno())
        except Exception:
            if not record.exists() and receipt_file.exists() and digest(receipt_file) == hashlib.sha256(receipt_bytes).hexdigest():
                receipt_file.unlink()
            raise
    return {'success': True, 'published': publish, 'files': len(target_seal), 'providerRequests': 0, 'sourceRetained': True}


def activate(plan, closed, publish=False):
    directory = physical(ntpath.join(plan['windowsHome'], '.agentopia', 'desktop'))
    lock = directory / 'migration.lock'
    if not publish:
        if lock.exists():
            raise ValueError('Another profile migration is active.')
        return _activate_checked(plan, closed, False)
    # Reject an old installed image before creating any private-profile state.
    selector = archive_member(physical(plan['installedArchive']), 'build/desktop-profile-location.js')
    if hashlib.sha256(selector).hexdigest() != plan['selectorSha256']:
        raise ValueError('The installed selector is not qualified for activation.')
    migration_compatibility(plan)
    closed()
    token = str(uuid.uuid4()).encode('ascii')
    with lock.open('xb') as stream:
        stream.write(token)
        stream.flush()
        os.fsync(stream.fileno())
    try:
        return _activate_checked(plan, closed, True)
    finally:
        if lock.exists() and lock.read_bytes() == token:
            lock.unlink()


def closed_windows():
    command = "@(Get-Process Agentopia,AgentopiaSetup -ErrorAction SilentlyContinue).Count"
    output = subprocess.check_output(['/mnt/c/Windows/System32/WindowsPowerShell/v1.0/powershell.exe', '-NoProfile', '-NonInteractive', '-Command', command], text=True, timeout=15)
    if output.strip() != '0':
        raise ValueError('Close Agentopia normally before profile activation.')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('plan', type=Path)
    parser.add_argument('--publish', action='store_true')
    args = parser.parse_args()
    if os.name == 'nt':
        parser.exit(1, 'Run this activation check through the bound WSL runtime for physical profile access.\n')
    try:
        plan = json.loads(regular(args.plan).read_text(encoding='utf-8-sig'))
        home = subprocess.check_output(['/mnt/c/Windows/System32/WindowsPowerShell/v1.0/powershell.exe', '-NoProfile', '-NonInteractive', '-Command', "[Environment]::GetFolderPath('UserProfile')"], text=True, timeout=15).strip()
        if canonical(home) != canonical(plan['windowsHome']):
            raise ValueError('The migration belongs to another Windows user.')
        print(json.dumps(activate(plan, closed_windows, args.publish)))
    except (OSError, ValueError, KeyError, subprocess.SubprocessError) as error:
        parser.exit(1, 'Profile activation stopped: ' + str(error) + '\n')
