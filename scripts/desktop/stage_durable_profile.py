"""Stage a closed physical profile; retain older backups and never activate it.

The CLI runs in WSL. Validation and final activation are separate steps.
"""
import argparse
import hashlib
import importlib.util
import json
import ntpath
import os
from pathlib import Path
import stat
import subprocess
import sys

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
from profile_location_activation import physical, canonical, regular, digest, checked_json, inventory, closed_windows, archive_member, migration_compatibility

spec = importlib.util.spec_from_file_location('profile_copier', HERE.parents[1] / 'desktop/runtime/copy-desktop-profile.py')
copier = importlib.util.module_from_spec(spec)
spec.loader.exec_module(copier)


def write_new(file, value):
    data = json.dumps(value, sort_keys=True).encode('utf-8')
    with Path(file).open('xb') as stream:
        stream.write(data)
        stream.flush()
        os.fsync(stream.fileno())
    return hashlib.sha256(data).hexdigest()


def stage(plan, closed, repair):
    home = plan['windowsHome']
    source_windows = ntpath.join(home, 'AppData', 'Roaming', 'Agentopia')
    target_windows = ntpath.join(home, '.agentopia', 'desktop', 'profile')
    if plan.get('format') != 1 or canonical(plan['source']) != canonical(source_windows) or canonical(plan['target']) != canonical(target_windows):
        raise ValueError('Stage paths must bind the fixed source and target for one Windows home.')
    archive = ntpath.join(home, 'AppData', 'Local', 'AgentopiaDesktop', 'app-' + plan['targetVersion'], 'resources', 'app.asar')
    if canonical(plan['installedArchive']) != canonical(archive):
        raise ValueError('The new installed application belongs to another profile.')
    selector = archive_member(physical(archive), 'build/desktop-profile-location.js')
    if hashlib.sha256(selector).hexdigest() != plan['selectorSha256'] or digest(physical(archive)) != plan['installedArchiveSha256']:
        raise ValueError('Install the qualified profile-aware application before staging private data.')
    migration_compatibility(plan)
    source, target, out = physical(source_windows), physical(target_windows), physical(plan['out'])
    if source in out.parents or target in out.parents or out in source.parents or out in target.parents:
        raise ValueError('Stage evidence must be outside both profiles.')
    closed()
    if target.exists() or (target.parent / 'profile-location.json').exists() or (target.parent / 'migration.lock').exists():
        raise ValueError('A prior stage, activation or migration exists; preserve it for inspection.')
    backup = checked_json(physical(plan['backupEvidence']), plan['backupEvidenceSha256'])
    manifest = checked_json(physical(plan['backupProfileManifest']), plan['backupProfileManifestSha256'])
    instance = plan['runtimeInstanceId']
    if not backup.get('success') or backup.get('distribution') != 'AgentopiaRuntime-' + instance or not manifest.get('success'):
        raise ValueError('A verified recovery for the current private runtime is required.')
    # These files bind session, encrypted state and runtime. A newer session or
    # draft requires a fresh closed backup rather than silently using old data.
    for name in ('credentials.bin', 'Local State', 'runtime-binding.json'):
        if digest(regular(source / name)) != manifest['manifest']['files'][name]['sha256']:
            raise ValueError('The current critical profile files differ from the recovery checkpoint.')
    binding = json.loads((source / 'runtime-binding.json').read_text())
    if binding != {'format': 1, 'distribution': 'AgentopiaRuntime-' + instance, 'instanceId': instance}:
        raise ValueError('The source runtime binding differs from the intended private runtime.')
    source_seal = inventory(source, retain_backups=True)
    historical = source / 'backups'
    retained = {'path': ntpath.join(source_windows, 'backups'), 'present': historical.exists()}
    if retained['present']:
        st = historical.lstat()
        if not stat.S_ISDIR(st.st_mode) or stat.S_ISLNK(st.st_mode) or getattr(st, 'st_file_attributes', 0) & 0x400:
            raise ValueError('Historical backup storage must remain an ordinary source directory.')
        retained.update(device=st.st_dev, inode=st.st_ino)
    out.mkdir(parents=True, exist_ok=True)
    source_seal_file = out / 'source-seal.json'
    source_sha = write_new(source_seal_file, source_seal)
    original_excluded = copier.excluded
    copier.excluded = lambda relative, directory: original_excluded(relative, directory) or bool(relative.parts and relative.parts[0].casefold() == 'backups')
    try:
        copied = copier.copy_profile(source, target, out / 'copy-evidence.json')
    finally:
        copier.excluded = original_excluded
    closed()
    if inventory(source, retain_backups=True) != source_seal:
        raise ValueError('The source changed during staging; preserve the staged copy and newer source.')
    old = target / '.agentopia-native-relocation.json'
    if old.exists():
        write_new(out / 'prior-native-relocation.json', json.loads(old.read_text()))
    old.write_text(json.dumps({'format': 1, 'codex': '0.163.0', 'sourceProfile': source_windows, 'destinationProfile': target_windows, 'state': 'copied'}))
    native = repair(target_windows)
    if not native.get('success'):
        raise ValueError('Copied native history rebasing did not complete.')
    closed()
    if inventory(source, retain_backups=True) != source_seal:
        raise ValueError('New work appeared in the source; do not activate this stage.')
    result = {'success': True, 'format': 1, 'phase': 'staged-awaiting-encryption-and-native-read-validation', 'windowsHome': home, 'source': source_windows, 'target': target_windows, 'runtimeInstanceId': instance, 'filesCopied': copied['files'], 'bytesCopied': copied['bytes'], 'copyEvidence': ntpath.join(plan['out'], 'copy-evidence.json'), 'copyEvidenceSha256': digest(out / 'copy-evidence.json'), 'sourceSeal': ntpath.join(plan['out'], 'source-seal.json'), 'sourceSealSha256': source_sha, 'retainedSourceBackups': retained, 'nativeRebase': native, 'backupEvidence': plan['backupEvidence'], 'backupEvidenceSha256': plan['backupEvidenceSha256'], 'compatibilityEvidence': plan['compatibilityEvidence'], 'compatibilityEvidenceSha256': plan['compatibilityEvidenceSha256'], 'providerRequests': 0, 'activated': False, 'sourceRetained': True}
    write_new(out / 'stage-evidence.json', result)
    return result


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('plan', type=Path)
    args = parser.parse_args()
    if os.name == 'nt':
        parser.exit(1, 'Run profile staging through the bound WSL runtime for physical access.\n')
    try:
        plan = json.loads(regular(args.plan).read_text(encoding='utf-8-sig'))
        home = subprocess.check_output(['/mnt/c/Windows/System32/WindowsPowerShell/v1.0/powershell.exe', '-NoProfile', '-NonInteractive', '-Command', "[Environment]::GetFolderPath('UserProfile')"], text=True, timeout=15).strip()
        if canonical(home) != canonical(plan['windowsHome']):
            raise ValueError('This stage belongs to another Windows user.')
        def repair(target):
            resources = ntpath.join(ntpath.dirname(plan['installedArchive']), 'resources')
            python = ntpath.join(resources, 'script-runtimes', 'python-3.14.8', 'python.exe')
            script = ntpath.join(resources, 'runtime', 'relocate-native-profile.py')
            result = subprocess.run([str(physical(python)), '-B', script, target], text=True, capture_output=True, timeout=120)
            if result.returncode != 0:
                raise ValueError('Native rebase failed; its original source remains unchanged.')
            return json.loads(result.stdout)
        result = stage(plan, closed_windows, repair)
        print(json.dumps({key: result[key] for key in ('success', 'phase', 'filesCopied', 'bytesCopied', 'activated', 'providerRequests')}))
    except (OSError, ValueError, KeyError, subprocess.SubprocessError) as error:
        parser.exit(1, 'Profile staging stopped: ' + str(error) + '\n')
