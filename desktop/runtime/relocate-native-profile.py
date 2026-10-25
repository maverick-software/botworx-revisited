"""Repair path indexes in an explicitly staged copy of Codex 0.163.0 homes.

Run only after the profile copier has finished and the source application has
stopped. This does not relocate WSL, credentials, browser data or PostgreSQL.
Rollout contents and paginated-history offsets must remain byte-for-byte intact.
"""
import argparse
import hashlib
import json
import ntpath
import os
from pathlib import Path
import sqlite3
import uuid

PINNED_CODEX = '0.163.0'
MARKER = '.agentopia-native-relocation.json'


def normalized(value):
    return ntpath.normcase(ntpath.normpath(str(value).removeprefix('\\\\?\\')))


def within(value, root):
    value, root = normalized(value), normalized(root)
    return value == root or value.startswith(root + '\\')


def mapped(value, source, destination):
    if not value or not within(value, source):
        return value
    # Compare case-insensitively, but retain the filename's exact spelling:
    # Codex's canonical rollout parser requires the timestamp's uppercase T.
    relative = ntpath.relpath(ntpath.normpath(str(value).removeprefix('\\\\?\\')), ntpath.normpath(str(source).removeprefix('\\\\?\\')))
    return str(destination.joinpath(*relative.split('\\')))


def no_links(root):
    # Windows junctions and symlinks must never lead a staged repair elsewhere.
    for entry in [root, *root.parents]:
        if entry.is_symlink() or getattr(entry, 'is_junction', lambda: False)():
            raise ValueError('A staged profile may not use links or junctions.')


def save_manifest(marker, manifest):
    temporary = marker.with_name(marker.name + '.' + str(uuid.uuid4()) + '.tmp')
    with temporary.open('x', encoding='utf-8') as stream:
        json.dump(manifest, stream, indent=2)
        stream.flush()
        os.fsync(stream.fileno())
    os.replace(temporary, marker)


def uninitialized_home(home, owner, provider):
    """A reserved home may exist before Codex has initialized its index."""
    if owner.name == '_':
        marker = home / '.agentopia-scope.json'
        no_links(marker)
        binding = json.loads(marker.read_text(encoding='utf-8'))
        if (set(binding) != {'format', 'owner', 'provider', 'scope'} or
                binding.get('format') != 1 or binding.get('provider') != provider.name or
                not isinstance(binding.get('owner'), str) or
                not isinstance(binding.get('scope'), str)):
            raise ValueError('A compact native home has an invalid scope binding.')
        # Use the exact property order used by Agentopia's native-home binding.
        canonical = {key: binding[key] for key in ['format', 'owner', 'provider', 'scope']}
        encoded = json.dumps(canonical, separators=(',', ':'), ensure_ascii=False)
        if hashlib.sha256(encoded.encode('utf-8')).hexdigest()[:32] != home.name:
            raise ValueError('A compact native home has a different scope binding.')
    if (home / 'state_5.sqlite').is_file():
        return False
    for entry in home.rglob('*'):
        no_links(entry)
        relative = entry.relative_to(home)
        if entry.is_file() and (relative.parts[0] in ['sessions', 'archived_sessions'] or
                entry.name.startswith(('state_', 'thread_history_', 'session_index.'))):
            raise ValueError('A copied native home contains history without its index.')
    return True


def repair(destination):
    destination = Path(destination).absolute()
    no_links(destination)
    marker = destination / MARKER
    no_links(marker)
    manifest = json.loads(marker.read_text(encoding='utf-8'))
    if manifest.get('format') != 1 or manifest.get('codex') != PINNED_CODEX:
        raise ValueError('This repair requires the pinned Codex relocation format.')
    source = Path(manifest['sourceProfile']).absolute()
    if normalized(manifest['destinationProfile']) != normalized(destination):
        raise ValueError('The staged destination does not match its manifest.')
    if within(destination, source) or within(source, destination):
        raise ValueError('The original and staged profiles must be separate.')
    if manifest.get('state') not in ['copied', 'rebasing', 'rebased']:
        raise ValueError('The staged copy is incomplete.')
    work = []
    for native in [destination / 'codex', destination / 'draft-previews' / 'codex']:
        no_links(native)
        if native.exists():
            # Only Agentopia's exact owner/provider/scope home depth is eligible.
            for owner in native.iterdir():
                no_links(owner)
                if not owner.is_dir():
                    raise ValueError('Unexpected native owner entry.')
                for provider in owner.iterdir():
                    no_links(provider)
                    if not provider.is_dir():
                        raise ValueError('Unexpected native provider entry.')
                    for home in provider.iterdir():
                        no_links(home)
                        database = home / 'state_5.sqlite'
                        for file in [database, Path(str(database) + '-wal'), Path(str(database) + '-shm')]:
                            no_links(file)
                        if not home.is_dir():
                            raise ValueError('A copied native home is incomplete.')
                        if uninitialized_home(home, owner, provider):
                            continue
                        old_home = source / home.relative_to(destination)
                        changes = []
                        connection = sqlite3.connect(database)
                        try:
                            if connection.execute('PRAGMA integrity_check').fetchone() != ('ok',):
                                raise ValueError('A copied native index failed its integrity check.')
                            columns = {row[1] for row in connection.execute('PRAGMA table_info(threads)')}
                            if not {'id', 'rollout_path', 'cwd', 'agent_path'} <= columns:
                                raise ValueError('The native index has an unsupported schema.')
                            for identifier, rollout, cwd, agent_path in connection.execute('SELECT id,rollout_path,cwd,agent_path FROM threads'):
                                # Already repaired indexes may be verified again after interruption.
                                if not within(rollout, old_home) and not within(rollout, home):
                                    raise ValueError('A native rollout points outside its own copied home.')
                                new_rollout = Path(mapped(rollout, source, destination))
                                no_links(new_rollout)
                                if not within(new_rollout, home) or not new_rollout.is_file():
                                    raise ValueError('A copied native rollout is missing.')
                                with new_rollout.open(encoding='utf-8') as stream:
                                    first = json.loads(stream.readline())
                                if first.get('type') != 'session_meta' or first.get('payload', {}).get('id') != identifier:
                                    raise ValueError('A copied rollout does not match its indexed thread.')
                                new_cwd = mapped(cwd, source / 'workspaces', destination / 'workspaces')
                                new_cwd = mapped(new_cwd, source / 'draft-previews' / 'workspaces', destination / 'draft-previews' / 'workspaces')
                                if new_cwd != cwd:
                                    no_links(Path(new_cwd))
                                    if not Path(new_cwd).is_dir():
                                        raise ValueError('A managed native workspace is missing from the copy.')
                                new_agent = mapped(agent_path, source, destination)
                                if new_agent != agent_path:
                                    no_links(Path(new_agent))
                                    if not Path(new_agent).exists():
                                        raise ValueError('A managed agent configuration is missing from the copy.')
                                changes.append((str(new_rollout), new_cwd, new_agent, identifier))
                        finally:
                            connection.close()
                        work.append((database, changes))
    # Validate every copied home before changing any index. A failure leaves the
    # original untouched, and a partially repaired stage can be safely resumed.
    manifest['state'] = 'rebasing'
    save_manifest(marker, manifest)
    for database, changes in work:
        connection = sqlite3.connect(database)
        try:
            with connection:
                connection.executemany('UPDATE threads SET rollout_path=?,cwd=?,agent_path=? WHERE id=?', changes)
            if connection.execute('PRAGMA integrity_check').fetchone() != ('ok',):
                raise ValueError('A repaired native index failed its integrity check.')
        finally:
            connection.close()
    manifest.update(state='rebased', homes=len(work), threads=sum(len(rows) for _, rows in work))
    save_manifest(marker, manifest)
    return {'success': True, 'codex': PINNED_CODEX, 'homes': manifest['homes'], 'threads': manifest['threads']}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('staged_profile', type=Path)
    args = parser.parse_args()
    try:
        print(json.dumps(repair(args.staged_profile)))
    except (ValueError, OSError, KeyError, sqlite3.Error) as error:
        # Do not include SQL data, prompts or credential values in diagnostics.
        parser.exit(1, 'Native relocation repair stopped: ' + str(error) + '\n')
