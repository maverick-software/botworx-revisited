"""Copy a stopped Agentopia profile into a new location with byte verification.

WSL disks are transferred separately. Nothing is deleted from the source.
Copy state and manifests live outside both profiles. Interrupted copies can be
verified and resumed; existing destination bytes are never silently replaced.
"""
import argparse
import hashlib
import json
import ntpath
import os
from pathlib import Path
import shutil
import stat
import sys
import time
import uuid
from concurrent.futures import ThreadPoolExecutor, wait, FIRST_COMPLETED

ROOT_CACHES = {'cache', 'code cache', 'gpucache', 'dawngraphitecache', 'dawnwebgpucache', 'gpupersistentcache', 'grshadercache', 'shadercache'}
ROOT_TRANSIENT = {'devtoolsactiveport', 'lockfile', 'singletonlock', 'singletoncookie', 'singletonsocket'}


def within(value, root):
    value, root = ntpath.normcase(str(value)), ntpath.normcase(str(root))
    return value == root or value.startswith(root + '\\')


def checked_root(value, existing=False):
    root = Path(value).absolute()
    for entry in [root, *root.parents]:
        if entry.is_symlink() or getattr(entry, 'is_junction', lambda: False)():
            raise ValueError('Profile roots may not use links or junctions.')
    if existing and not root.is_dir():
        raise ValueError('The source profile is missing.')
    return root


def excluded(relative, directory):
    parts = [part.casefold() for part in relative.parts]
    if parts and parts[0] == 'draft-previews':
        parts = parts[1:]
    if len(parts) == 1:
        if directory and (parts[0] in ROOT_CACHES | {'wsl', 'test-profiles'} or parts[0].startswith('upload-probe-')):
            return True
        if not directory and parts[0] in ROOT_TRANSIENT:
            return True
    if parts and parts[0] == 'codex':
        if len(parts) == 5 and parts[4] in {'tmp', '.tmp'}:
            return True
        if len(parts) == 6 and parts[4:] == ['skills', '.system']:
            return True
    return False


def digest(file):
    with file.open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()


def checked_entry(file, required=False):
    try:
        info = file.lstat()
    except FileNotFoundError:
        if required:
            raise
        return None
    if stat.S_ISLNK(info.st_mode) or getattr(info, 'st_file_attributes', 0) & getattr(stat, 'FILE_ATTRIBUTE_REPARSE_POINT', 0):
        raise ValueError('A linked or redirected profile entry was found.')
    return info


def save_state(file, state):
    temporary = file.with_name(file.name + '.' + str(uuid.uuid4()) + '.tmp')
    with temporary.open('x', encoding='utf-8') as stream:
        json.dump(state, stream, indent=2)
        stream.flush()
        os.fsync(stream.fileno())
    os.replace(temporary, file)


def copy_one(original, target, relative, evidence_root, attempt):
    before = checked_entry(original, True)
    if original.name.startswith('.agentopia-copy-') or not stat.S_ISREG(before.st_mode):
        raise ValueError('An unexpected linked, temporary or nonregular source file was found.')
    existing = checked_entry(target)
    if existing:
        original_hash = digest(original)
        if not stat.S_ISREG(existing.st_mode) or existing.st_nlink != 1 or digest(target) != original_hash:
            raise ValueError('Existing destination bytes differ from the source. Preserve the copy for inspection.')
    else:
        temporary = target.parent / ('.agentopia-copy-' + hashlib.sha256(str(relative).encode()).hexdigest() + '.tmp')
        if temporary.exists():
            checked_entry(temporary.parent, True)
            evidence = evidence_root / ('partial-' + attempt)
            evidence.mkdir(exist_ok=True)
            os.replace(temporary, evidence / temporary.name)
        copied_hash = hashlib.sha256()
        with original.open('rb') as incoming, temporary.open('xb') as outgoing:
            while block := incoming.read(1024 * 1024):
                copied_hash.update(block)
                outgoing.write(block)
        original_hash = copied_hash.hexdigest()
        if digest(temporary) != original_hash:
            raise ValueError('The copied bytes did not match their source.')
        os.replace(temporary, target)
        os.utime(target, ns=(before.st_atime_ns, before.st_mtime_ns))
    after = original.stat()
    if (before.st_ino, before.st_size, before.st_mtime_ns) != (after.st_ino, after.st_size, after.st_mtime_ns):
        raise ValueError('The source changed during the copy. Stop the application before retrying.')
    return dict(path=str(relative), bytes=before.st_size, sha256=original_hash)


def copy_profile(source, destination, state_file, resume=False):
    source, destination = checked_root(source, True), checked_root(destination)
    state_file = Path(state_file).absolute()
    if within(source, destination) or within(destination, source):
        raise ValueError('The original and copied profiles must be separate.')
    if within(state_file, source) or within(state_file, destination):
        raise ValueError('Copy records must be outside both profiles.')
    if destination.exists():
        if not resume:
            raise ValueError('The destination already exists. Inspect the copy record before resuming.')
        previous = json.loads(state_file.read_text(encoding='utf-8'))
        if previous.get('source') != str(source) or previous.get('destination') != str(destination) or previous.get('format') != 1:
            raise ValueError('The existing copy belongs to a different operation.')
    elif resume:
        raise ValueError('There is no copied profile to resume.')
    state_file.parent.mkdir(parents=True, exist_ok=True)
    destination.mkdir(parents=True, exist_ok=resume)
    attempt = str(uuid.uuid4())
    manifest = state_file.with_name(state_file.stem + '-' + attempt + '.jsonl')
    state = dict(format=1, source=str(source), destination=str(destination), phase='copying', manifest=str(manifest), files=0, directories=0, bytes=0, skipped=[], resumed=resume)
    save_state(state_file, state)
    started = last_progress = time.monotonic()
    expected_files = set()
    try:
        with manifest.open('x', encoding='utf-8') as records, ThreadPoolExecutor(max_workers=8) as pool:
            pending = set()
            def collect():
                nonlocal last_progress, pending
                finished, pending = wait(pending, return_when=FIRST_COMPLETED)
                for future in finished:
                    entry = future.result()
                    records.write(json.dumps(entry, ensure_ascii=True) + '\n')
                    expected_files.add(entry['path'])
                    state['files'] += 1
                    state['bytes'] += entry['bytes']
                if time.monotonic() - last_progress >= 3:
                    records.flush()
                    save_state(state_file, state)
                    print(json.dumps({key: state[key] for key in ['phase', 'files', 'directories', 'bytes']}), flush=True)
                    last_progress = time.monotonic()
            for directory, directories, files in os.walk(source, followlinks=False):
                folder = Path(directory)
                relative_folder = folder.relative_to(source)
                target_folder = destination / relative_folder
                # Roots were checked once. Each direct child is checked before
                # traversal, so already-verified ancestors need no repeated IO.
                checked_entry(target_folder)
                target_folder.mkdir(exist_ok=True)
                state['directories'] += 1
                kept = []
                for name in directories:
                    entry = folder / name
                    relative = entry.relative_to(source)
                    if excluded(relative, True):
                        state['skipped'].append(str(relative))
                        continue
                    checked_entry(entry, True)
                    kept.append(name)
                directories[:] = kept
                for name in files:
                    original = folder / name
                    relative = original.relative_to(source)
                    if excluded(relative, False):
                        state['skipped'].append(str(relative))
                        continue
                    pending.add(pool.submit(copy_one, original, target_folder / name, relative, state_file.parent, attempt))
                    if len(pending) >= 64:
                        collect()
            while pending:
                collect()
        for directory, directories, files in os.walk(destination, followlinks=False):
            checked_entry(Path(directory), True)
            for name in directories:
                checked_entry(Path(directory) / name, True)
            for name in files:
                if str((Path(directory) / name).relative_to(destination)) not in expected_files:
                    raise ValueError('An unexpected destination file was found. Preserve the copy for inspection.')
        state.update(phase='completed', success=True, seconds=time.monotonic() - started)
        save_state(state_file, state)
        return state
    except Exception as error:
        state.update(success=False, error=str(error))
        save_state(state_file, state)
        raise


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source', type=Path)
    parser.add_argument('destination', type=Path)
    parser.add_argument('state_file', type=Path)
    parser.add_argument('--resume', action='store_true')
    args = parser.parse_args()
    try:
        result = copy_profile(args.source, args.destination, args.state_file, args.resume)
        print(json.dumps({key: result[key] for key in ['success', 'phase', 'files', 'directories', 'bytes', 'seconds']}))
    except (OSError, ValueError) as error:
        parser.exit(1, 'Profile copy stopped: ' + str(error) + '\n')
