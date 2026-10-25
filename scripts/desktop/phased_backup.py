"""Filesystem stages for the supervised full-profile backup. No service startup."""
from concurrent.futures import ThreadPoolExecutor, as_completed
import glob
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import shutil
import stat
import sys
import tempfile
import uuid
from profile_archive import capture, snapshot, sha, verify_tar


def save(file, value):
    file = Path(file)
    temporary = file.with_name(file.name + '.' + uuid.uuid4().hex + '.tmp')
    with temporary.open('x') as stream:
        json.dump(value, stream, indent=2)
    temporary.replace(file)


def relative(value, empty=False):
    assert isinstance(value, str) and (empty or value)
    parsed = PurePosixPath(value)
    assert not parsed.is_absolute() and '..' not in parsed.parts and '\\' not in value
    assert value == '' or str(parsed) == value
    return value


def partition(root, label, prefix='', depth=3):
    root = Path(root)
    assert root.is_dir() and not root.is_symlink() and root.resolve() == root
    relative(prefix, True)
    tasks, directories = [], {}

    def walk(directory, destination, remaining):
        info = directory.stat()
        if destination:
            directories[destination] = {'mode': stat.S_IMODE(info.st_mode), 'mtimeNs': info.st_mtime_ns}
        files, children = [], []
        for child in sorted(directory.iterdir()):
            mode = child.lstat().st_mode
            assert not stat.S_ISLNK(mode), 'A linked immutable source needs inspection.'
            relative(child.name)
            if stat.S_ISDIR(mode):
                children.append(child)
            else:
                assert stat.S_ISREG(mode)
                files.append(child.name)
        if files:
            tasks.append({'rootLabel': label, 'source': str(directory), 'prefix': destination, 'only': files})
        for child in children:
            name = '/'.join(filter(None, (destination, child.name)))
            if remaining:
                walk(child, name, remaining - 1)
            else:
                mode = child.stat()
                directories[name] = {'mode': stat.S_IMODE(mode.st_mode), 'mtimeNs': mode.st_mtime_ns}
                tasks.append({'rootLabel': label, 'source': str(child), 'prefix': name, 'only': None})

    walk(root, prefix, depth)
    return {'tasks': tasks, 'directories': directories}


def scopes(tasks):
    """Prove that independent fragments cannot own the same restoration path."""
    trees, files = [], set()
    for task in tasks:
        label, prefix = task['rootLabel'], relative(task['prefix'], True)
        assert label in ('ordinary', 'overlay')
        if task['only'] is None:
            assert prefix
            trees.append((label, prefix))
        else:
            assert task['only'] and len(set(task['only'])) == len(task['only'])
            for name in task['only']:
                relative(name)
                assert '/' not in name
                key = (label, '/'.join(filter(None, (prefix, name))))
                assert key not in files, 'Duplicate frozen file scope.'
                files.add(key)
    assert len(set(trees)) == len(trees)
    ordered = sorted(trees)
    for index, (label, prefix) in enumerate(ordered):
        for other_label, other in ordered[index + 1:]:
            assert other_label != label or not other.startswith(prefix + '/'), 'Overlapping frozen tree scopes.'
        assert not any(item_label == label and (name == prefix or name.startswith(prefix + '/')) for item_label, name in files), 'File scope overlaps an archived tree.'


def task_archive(out, task):
    out = Path(out)
    identifier = task['id']
    assert isinstance(identifier, int) and identifier >= 0
    proof = out / ('part-' + str(identifier).zfill(5) + '.json')
    if proof.exists():
        record = json.loads(proof.read_text())
        assert record['success'] and record['task'] == task
        archive = out / record['archive']
        assert archive.parent == out and sha(archive) == record['archiveSha256']
        verify_tar(archive, record['manifest'])
        assert snapshot(Path(task['source']), only=task['only']) == record['manifest'], 'An immutable source changed since its saved fragment.'
        return record
    archive = out / ('part-' + str(identifier).zfill(5) + '-' + uuid.uuid4().hex + '.tar')
    progress = out / ('progress-' + str(identifier).zfill(5) + '.json')
    try:
        result = capture(Path(task['source']), archive, only=task['only'],
            progress=lambda count: save(progress, {'task': identifier, 'filesInCurrentPass': count}))
        record = {**result, 'archive': archive.name, 'task': task}
        save(proof, record)
        return record
    except Exception as error:
        save(out / ('failure-' + str(identifier) + '-' + uuid.uuid4().hex + '.json'),
            {'success': False, 'task': task, 'archive': archive.name, 'error': str(error)})
        raise


def assemble(out, core, inventory, records):
    """Stream a complete restoration index after disjoint scope validation."""
    out = Path(out)
    tasks = inventory['tasks']
    scopes(tasks)
    assert len(records) == len(tasks)
    by_id = {task['id']: task for task in tasks}
    assert len(by_id) == len(tasks)
    def record_id(item):
        return item['task']['id'] if isinstance(item, dict) else int(Path(item).stem.removeprefix('part-'))
    assert {record_id(record) for record in records} == set(by_id)
    current = out / 'ordinary-current.tar'
    assert sha(current) == core['archiveSha256']
    verify_tar(current, core['manifest'])
    counts = {label: {'files': 0, 'directories': 0, 'bytes': 0} for label in ('ordinary', 'overlay')}
    index = out / ('private-restoration-index-' + uuid.uuid4().hex + '.ndjson')
    digest = hashlib.sha256()
    with index.open('xb', buffering=1024 * 1024) as stream:
        def entry(label, name, kind, value, archive):
            relative(name)
            data = (json.dumps({'root': label, 'path': name, 'kind': kind, **value, 'archive': archive}, sort_keys=True) + '\n').encode()
            stream.write(data)
            digest.update(data)
            counts[label]['directories' if kind == 'directory' else 'files'] += 1
            if kind == 'file':
                counts[label]['bytes'] += value['bytes']

        for kind, key in (('directory', 'directories'), ('file', 'files')):
            for name, value in core['manifest'][key].items():
                assert name != 'backups' and not name.startswith('backups/') and name != 'wsl/ext4.vhdx'
                entry('ordinary', name, kind, value, 'ordinary-current.tar')
        for label, directories in inventory['directories'].items():
            for name, value in directories.items():
                assert label != 'ordinary' or name == 'backups' or name.startswith('backups/')
                entry(label, name, 'directory', value, None)
        for reference in sorted(records, key=record_id):
            record = reference if isinstance(reference, dict) else json.loads(Path(reference).read_text())
            task = record['task']
            assert record['success'] and task == by_id[task['id']]
            archive = out / 'archives' / record['archive']
            assert archive.parent == out / 'archives' and sha(archive) == record['archiveSha256']
            verify_tar(archive, record['manifest'])
            for kind, key in (('directory', 'directories'), ('file', 'files')):
                for name, value in record['manifest'][key].items():
                    destination = '/'.join(filter(None, (task['prefix'], name)))
                    assert task['rootLabel'] != 'ordinary' or destination.startswith('backups/')
                    entry(task['rootLabel'], destination, kind, value, 'archives/' + archive.name)
    return {'success': True, 'storage': 'tar-fragments', 'counts': counts, 'restorationIndex': index.name, 'restorationIndexSha256': digest.hexdigest()}


def stopped():
    for file in glob.glob('/proc/[0-9]*/comm'):
        try:
            assert Path(file).read_text().strip() != 'postgres', 'Database services must remain stopped in this stage.'
        except FileNotFoundError:
            pass


def database_files(stacks):
    versions = list(Path(stacks).glob('*/data/*/data/PG_VERSION'))
    assert len(versions) == 1, 'Exactly one installed database data directory is required.'
    data = versions[0].parent
    files = [data / 'PG_VERSION', data / 'global/pg_control', data.parent / 'pgsodium_root.key']
    assert all(file.is_file() and not file.is_symlink() for file in files), 'A required installed database file is missing.'
    return files


def configuration(out):
    out = Path(out).resolve()
    assert out.parent == Path('/mnt/d/Users/charl/software/Agentopia/.supabase/desktop-installed-0448')
    assert out.name.startswith('physical-backup-')
    config = json.loads((out / 'intent.json').read_text())
    assert config['format'] == 2
    assert config['roots']['ordinary']['linux'] == '/mnt/c/Users/charl/AppData/Roaming/Agentopia'
    assert config['roots']['overlay']['linux'] == '/mnt/c/Users/charl/AppData/Local/Packages/OpenAI.Codex_2p2nqsd0c76g0/LocalCache/Roaming/Agentopia'
    return out, config


def runtime_capture(out, config):
    assert Path('/opt/agentopia/runtime-instance').read_text().strip() == config['instanceId']
    stopped()
    critical = {}
    names = [Path('/opt/agentopia/runtime-identity'), Path('/opt/agentopia/runtime-instance'),
        Path('/home/agentopia/.config/agentopia/runtime-secrets.json'), *database_files('/home/agentopia/.supabase/stacks')]
    assert len(names) == 6 and all(file.is_file() for file in names)
    critical = {str(file): sha(file) for file in names}
    save(out / 'private-runtime-files.json', critical)
    ordinary = Path(config['roots']['ordinary']['linux'])
    binding = json.loads((ordinary / 'runtime-binding.json').read_text())
    assert binding['distribution'] == config['distribution'] and binding['instanceId'] == config['instanceId']
    relative(config['backupName']); assert '/' not in config['backupName']
    candidates = [(label, Path(value['linux']) / 'backups' / config['backupName']) for label, value in config['roots'].items()]
    available = [(label, directory) for label, directory in candidates if (directory / 'manifest.json').is_file()]
    assert len(available) == 1, 'The latest logical backup must have one unambiguous physical source.'
    backup_label, backup = available[0]
    manifest = json.loads((backup / 'manifest.json').read_text())
    destination = out / 'current-database-backup'; destination.mkdir()
    with (destination / 'manifest.json').open('xb') as stream: stream.write((backup / 'manifest.json').read_bytes())
    names = set()
    for item in manifest['files']:
        name = relative(item['name']); assert '/' not in name and name not in names; names.add(name)
        source = backup / name
        assert not source.is_symlink() and sha(source) == item['sha256']
        with source.open('rb') as reader, (destination / name).open('xb') as writer: shutil.copyfileobj(reader, writer, 1024 * 1024)
        assert sha(source) == sha(destination / name) == item['sha256']
    assert {'application.dump', 'auth.dump', 'database.dump', 'vault.dump', 'pgsodium_root.key'} <= names
    stopped()
    save(out / 'runtime-capture.json', {'success': True, 'criticalFiles': len(critical), 'logicalBackupFiles': sorted(names), 'logicalBackupRoot': backup_label, 'databaseServicesStarted': 0})
    return {'success': True, 'criticalFiles': len(critical), 'logicalBackupFiles': len(names), 'logicalBackupRoot': backup_label}


def reader(out, config):
    assert Path('/opt/agentopia/runtime-identity').read_text().strip() == 'local.agentopia.desktop-runtime.v1'
    assert Path('/opt/agentopia/runtime-instance').read_text().strip() == config['reader']['instanceId']
    stopped()


def profile_data_entry(name):
    """Match Runtime.nativeBackupEntry for native homes; retain custom skills."""
    parts = PurePosixPath(name).parts
    if parts and parts[0] == 'draft-previews':
        parts = parts[1:]
    if parts and parts[0] == 'codex':
        inner = parts[4:]
        if inner and inner[0] in ('tmp', '.tmp'): return False
        if len(inner) >= 2 and inner[:2] == ('skills', '.system'): return False
    return True


def capture_profile_data(source, out, label):
    source, out = Path(source), Path(out)
    assert label in ('ordinary', 'overlay')
    omitted = set()
    def policy(name):
        accepted = profile_data_entry(name)
        if not accepted: omitted.add(name)
        return accepted
    exclusions = ('backups', 'test-profiles', 'wsl/ext4.vhdx')
    result = capture(source, out / (label + '-current.tar'), exclusions, allow=policy,
        progress=lambda count: save(out / 'core-progress.json', {'phase': 'capture-or-source-verification', 'root': label, 'filesInCurrentPass': count}))
    required = {'Local State', 'credentials.bin'} | ({'runtime-binding.json'} if label == 'ordinary' else set())
    assert required <= set(result['manifest']['files'])
    deferred = {'olderBackupNames': sorted(child.name for child in (source / 'backups').iterdir()) if (source / 'backups').is_dir() else [],
        'excludedTopLevel': list(exclusions), 'rebuildableNativePaths': sorted(omitted),
        'historicalCopiesRetainedInPlace': True, 'policy': 'Runtime.nativeBackupEntry; generated test profiles and previous backup sets are outside current recoverable data.'}
    return result, deferred


def core_capture(out, config):
    reader(out, config)
    profiles, deferred = {}, {}
    for label in ('ordinary', 'overlay'):
        result, deferred[label] = capture_profile_data(config['roots'][label]['linux'], out, label)
        profiles[label] = result
        save(out / ('private-core-' + label + '.json'), result)
    save(out / 'private-deferred-roots.json', deferred)
    core = {'success': True, 'scope': 'recoverable-profile-data', 'profiles': profiles,
        'historicalArchiveComplete': False, 'dataPolicy': 'runtime-native-backup-v1',
        'inventorySha256': sha(out / 'private-deferred-roots.json')}
    save(out / 'private-core-data.json', core)
    stopped()
    return {'success': True, 'scope': core['scope'], 'dataPolicy': core['dataPolicy'],
        'profileCounts': {label: value['counts'] for label, value in profiles.items()},
        'coreArchiveSha256': profiles['ordinary']['archiveSha256'], 'profileArchiveHashes': {label: value['archiveSha256'] for label, value in profiles.items()},
        'inventorySha256': core['inventorySha256'], 'inventoryFile': 'private-deferred-roots.json', 'historicalArchiveComplete': False}


def archive_capture(out, config):
    reader(out, config)
    sealed = json.loads((out / 'core-evidence.json').read_text())
    assert sealed['currentSnapshotComplete'] and not sealed['fullBackupComplete']
    core = json.loads((out / 'private-core.json').read_text())
    assert core['inventorySha256'] == sha(out / 'private-work-inventory.json') == sealed['inventorySha256']
    assert core['archiveSha256'] == sealed['coreArchiveSha256']
    inventory = json.loads((out / 'private-work-inventory.json').read_text()); scopes(inventory['tasks'])
    archives = out / 'archives'; archives.mkdir(exist_ok=True)
    assert not archives.is_symlink()
    records = []
    def one(task):
        root = Path(config['roots'][task['rootLabel']]['linux'])
        assert Path(task['source']) == root / relative(task['prefix'], True)
        assert task['rootLabel'] != 'ordinary' or task['prefix'] == 'backups' or task['prefix'].startswith('backups/')
        task_archive(archives, task)
        return str(archives / ('part-' + str(task['id']).zfill(5) + '.json'))
    with ThreadPoolExecutor(max_workers=4) as pool:
        futures = [pool.submit(one, task) for task in inventory['tasks']]
        for future in as_completed(futures):
            records.append(future.result())
            save(out / 'archive-progress.json', {'phase': 'archiving-or-source-verification', 'verifiedParts': len(records), 'totalParts': len(futures)})
            print('Verified historical part ' + str(len(records)) + '/' + str(len(futures)), flush=True)
    result = assemble(out, core, inventory, records)
    result['parts'] = len(records)
    save(out / 'archive-evidence.json', result)
    return {key: value for key, value in result.items() if key != 'manifest'}


def self_test():
    checks = []
    with tempfile.TemporaryDirectory(prefix='agentopia-phased-backup-') as folder:
        out = Path(folder)
        stacks = out / 'stacks'; data = stacks / 'stack/data/instance/data'
        (data / 'global').mkdir(parents=True)
        (data / 'PG_VERSION').write_text('17')
        (data / 'global/pg_control').write_bytes(b'Control file')
        (data.parent / 'pgsodium_root.key').write_text('Generated key marker')
        assert set(database_files(stacks)) == {data / 'PG_VERSION', data / 'global/pg_control', data.parent / 'pgsodium_root.key'}
        checks.append('Database discovery follows the actual nested native data layout and its sibling encryption key.')
        (data / 'global/pg_control').unlink()
        try:
            database_files(stacks)
        except AssertionError: checks.append('A missing database control file stops capture before export.')
        else: raise AssertionError('An incomplete database layout was accepted.')
        native = 'codex/owner/openai-oauth/scope/'
        assert not profile_data_entry(native + '.tmp/plugins/vendor/module.js')
        assert not profile_data_entry(native + 'tmp/generated')
        assert not profile_data_entry(native + 'skills/.system/tool/SKILL.md')
        assert all(profile_data_entry(native + item) for item in ('sessions/history.jsonl', 'state.sqlite', 'skills/custom/tmp/reference.md', 'skills/custom/SKILL.md', 'memory.md'))
        checks.append('The existing native backup policy skips derived caches while preserving history, databases, memory and custom skill references.')
        protected = out / 'protected'; protected.mkdir()
        for name in ('Local State', 'credentials.bin', 'runtime-binding.json'): (protected / name).write_text('Generated protected file')
        for name in (native + '.tmp/plugins/module.js', native + 'skills/.system/tool/SKILL.md', native + 'skills/custom/tmp/reference.md', native + 'sessions/history.jsonl', native + 'state.sqlite', 'attachments/example.txt', 'attachments/generated/11111111-1111-4111-8111-111111111111/22222222-2222-4222-8222-222222222222.bin', 'Partitions/site/Cookies', 'test-profiles/fixture/data', 'backups/previous/database.dump'):
            file = protected / name; file.parent.mkdir(parents=True, exist_ok=True); file.write_text('Exact generated data: ' + name)
        policy_out = out / 'policy-result'; policy_out.mkdir()
        preserved, deferred = capture_profile_data(protected, policy_out, 'ordinary')
        expected_paths = {'Local State', 'credentials.bin', 'runtime-binding.json', native + 'skills/custom/tmp/reference.md', native + 'sessions/history.jsonl', native + 'state.sqlite', 'attachments/example.txt', 'attachments/generated/11111111-1111-4111-8111-111111111111/22222222-2222-4222-8222-222222222222.bin', 'Partitions/site/Cookies'}
        assert set(preserved['manifest']['files']) == expected_paths
        assert (protected / 'backups/previous/database.dump').is_file() and (protected / (native + '.tmp/plugins/module.js')).is_file()
        checks.append('A real data archive preserves protected files, custom tmp references, native history, attachments, nested generated-image assets and browser cookies while leaving excluded source data intact.')
        ordinary, overlay = out / 'ordinary', out / 'overlay'
        ordinary.mkdir(); overlay.mkdir()
        (ordinary / 'settings').write_text('Current settings')
        (ordinary / 'backups').mkdir()
        (ordinary / 'backups/empty').mkdir()
        (ordinary / 'backups/old').mkdir()
        (ordinary / 'backups/old/history').write_text('Historical state')
        (ordinary / 'backups/root-file').write_bytes(b'Root file')
        (ordinary / 'wsl').mkdir()
        (ordinary / 'wsl/ext4.vhdx').write_bytes(b'Separately exported disk')
        (overlay / 'retained').mkdir()
        (overlay / 'retained/Unicode café.txt').write_text('Retained state')
        expected = {'ordinary': snapshot(ordinary, ('wsl/ext4.vhdx',)), 'overlay': snapshot(overlay)}
        core = capture(ordinary, out / 'ordinary-current.tar', ('backups', 'wsl/ext4.vhdx'))
        left, right = partition(ordinary / 'backups', 'ordinary', 'backups', 1), partition(overlay, 'overlay', depth=1)
        inventory = {'tasks': left['tasks'] + right['tasks'], 'directories': {'ordinary': left['directories'], 'overlay': right['directories']}}
        for index, task in enumerate(inventory['tasks']): task['id'] = index
        scopes(inventory['tasks'])
        checks.append('Partitioned scopes retain root files, nested files and empty historical directories without overlap.')
        (ordinary / 'settings').write_text('Changed after the current profile seal')
        (ordinary / 'backups/new-after-seal').mkdir()
        (ordinary / 'backups/new-after-seal/later').write_text('A later snapshot')
        archives = out / 'archives'; archives.mkdir()
        with ThreadPoolExecutor(max_workers=3) as pool:
            records = list(pool.map(lambda task: task_archive(archives, task), inventory['tasks']))
        full = assemble(out, core, inventory, records)
        observed = {'ordinary': {'files': {}, 'directories': {}}, 'overlay': {'files': {}, 'directories': {}}}
        for line in (out / full['restorationIndex']).read_text().splitlines():
            item = json.loads(line); label = item.pop('root'); name = item.pop('path'); kind = item.pop('kind'); item.pop('archive')
            key = 'files' if kind == 'file' else 'directories'
            assert name not in observed[label][key]
            observed[label][key][name] = item
        assert observed == expected
        checks.append('The full restoration union equals the sealed original data while current settings and new backups change later.')
        assert task_archive(archives, inventory['tasks'][0]) == records[0]
        checks.append('A completed immutable fragment resumes only after content, archive and source verification.')
        try:
            assemble(out, core, inventory, records[:-1])
        except AssertionError: checks.append('A missing historical fragment prevents full-backup completion.')
        else: raise AssertionError('A missing fragment was accepted.')
        selected = out / 'selected'; selected.mkdir(); (selected / 'lost').write_text('Present when frozen')
        request = partition(selected, 'overlay')['tasks'][0]; request['id'] = 999
        (selected / 'lost').unlink()
        try:
            task_archive(archives, request)
        except AssertionError: checks.append('A frozen selected file disappearing before capture cannot silently be omitted.')
        else: raise AssertionError('A missing selected file was omitted.')
        saved_archive = archives / records[0]['archive']; original = saved_archive.read_bytes()
        with saved_archive.open('r+b') as stream: stream.write(b'CHANGED')
        try:
            task_archive(archives, inventory['tasks'][0])
        except AssertionError: checks.append('A corrupt completed archive cannot be reused as a verified fragment.')
        else: raise AssertionError('A corrupt archive was reused.')
        saved_archive.write_bytes(original)
        try:
            scopes([inventory['tasks'][0], inventory['tasks'][0]])
        except AssertionError: checks.append('Duplicate restoration ownership is refused.')
        else: raise AssertionError('Overlapping scopes were accepted.')
        changed = next(task for task in inventory['tasks'] if task['rootLabel'] == 'overlay')
        (overlay / 'retained/Unicode café.txt').write_text('Changed old data')
        try:
            task_archive(archives, changed)
        except AssertionError: checks.append('A changed historical source cannot reuse a successful earlier fragment.')
        else: raise AssertionError('A changed immutable source was reused.')
    return {'success': True, 'checks': checks, 'providerRequests': 0, 'productionChanges': 0}


if __name__ == '__main__':
    os.umask(0o077)
    if sys.argv[1:] == ['--self-test']:
        print(json.dumps(self_test(), indent=2))
    else:
        assert len(sys.argv) == 3 and sys.argv[1] in ('runtime', 'core', 'archives')
        out, config = configuration(sys.argv[2])
        function = {'runtime': runtime_capture, 'core': core_capture, 'archives': archive_capture}[sys.argv[1]]
        print(json.dumps(function(out, config), indent=2))
