"""Content-verified archives for a closed profile or an immutable recovery tree."""
import hashlib
import io
import json
import os
from pathlib import Path, PurePosixPath
import stat
import sys
import tarfile
import tempfile


def sha(file):
    digest = hashlib.sha256()
    with Path(file).open('rb') as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b''):
            digest.update(chunk)
    return digest.hexdigest()


def snapshot(root, exclude=(), archive=None, progress=None, only=None, allow=None):
    """Walk pinned directory handles; optionally stream every regular file to tar."""
    root = Path(root)
    assert root.is_absolute() and not root.is_symlink() and root.resolve() == root
    exclude = frozenset(exclude)
    assert all(name and not name.startswith('/') and '..' not in PurePosixPath(name).parts for name in exclude)
    only = None if only is None else frozenset(only)
    assert only is None or all(name and name not in ('.', '..') and '/' not in name and '\\' not in name for name in only)
    files, directories, selected = {}, {}, set()
    flags = os.O_RDONLY | os.O_NOFOLLOW

    def walk(fd, parts):
        with os.scandir(fd) as entries:
            for entry in entries:
                if not parts and only is not None and entry.name not in only:
                    continue
                relative = '/'.join((*parts, entry.name))
                if any(relative == skip or relative.startswith(skip + '/') for skip in exclude):
                    continue
                if allow is not None and not allow(relative):
                    continue
                info = entry.stat(follow_symlinks=False)
                if not parts and only is not None:
                    assert stat.S_ISREG(info.st_mode), 'A selected immutable file changed type.'
                    selected.add(entry.name)
                assert not stat.S_ISLNK(info.st_mode), 'A linked profile entry needs inspection.'
                if stat.S_ISDIR(info.st_mode):
                    directories[relative] = {'mode': stat.S_IMODE(info.st_mode), 'mtimeNs': info.st_mtime_ns}
                    if archive is not None:
                        member = tarfile.TarInfo(relative + '/')
                        member.type = tarfile.DIRTYPE
                        member.mode, member.mtime = stat.S_IMODE(info.st_mode), info.st_mtime
                        archive.addfile(member)
                    child = os.open(entry.name, flags | os.O_DIRECTORY, dir_fd=fd)
                    try:
                        walk(child, (*parts, entry.name))
                    finally:
                        os.close(child)
                else:
                    assert stat.S_ISREG(info.st_mode), 'A nonregular profile entry needs inspection.'
                    with os.fdopen(os.open(entry.name, flags, dir_fd=fd), 'rb', buffering=1024 * 1024) as source:
                        before = os.fstat(source.fileno())
                        assert (before.st_dev, before.st_ino) == (info.st_dev, info.st_ino)
                        digest = hashlib.sha256()

                        class HashedReader:
                            def read(self, size):
                                data = source.read(size)
                                digest.update(data)
                                return data

                        if archive is not None:
                            member = tarfile.TarInfo(relative)
                            member.size, member.mode, member.mtime = before.st_size, stat.S_IMODE(before.st_mode), before.st_mtime
                            archive.addfile(member, HashedReader())
                        else:
                            for chunk in iter(lambda: source.read(1024 * 1024), b''):
                                digest.update(chunk)
                        after = os.fstat(source.fileno())
                        fields = ('st_dev', 'st_ino', 'st_size', 'st_mtime_ns', 'st_ctime_ns')
                        assert all(getattr(before, key) == getattr(after, key) for key in fields), 'A source changed during capture.'
                    files[relative] = {'bytes': before.st_size, 'sha256': digest.hexdigest(),
                        'mode': stat.S_IMODE(before.st_mode), 'mtimeNs': before.st_mtime_ns}
                    if progress is not None and len(files) % 100 == 0:
                        progress(len(files))

    fd = os.open(root, flags | os.O_DIRECTORY)
    try:
        walk(fd, ())
    finally:
        os.close(fd)
    assert only is None or selected == only, 'A selected immutable file disappeared before capture.'
    return {'files': dict(sorted(files.items())), 'directories': dict(sorted(directories.items()))}


def verify_tar(file, expected):
    observed, directories = {}, set()
    with Path(file).open('rb', buffering=1024 * 1024) as stream, tarfile.open(fileobj=stream, mode='r|', bufsize=1024 * 1024) as archive:
        for member in archive:
            name = member.name.rstrip('/')
            parts = PurePosixPath(name)
            assert name and not parts.is_absolute() and str(parts) == name and '..' not in parts.parts and '\\' not in name, 'Unsafe archive path.'
            assert name not in observed and name not in directories, 'Duplicate archive entry.'
            if member.isdir():
                assert name in expected['directories']
                assert member.mode == expected['directories'][name]['mode']
                directories.add(name)
            else:
                assert member.isfile() and name in expected['files'], 'Unexpected archive entry.'
                digest = hashlib.sha256()
                extracted = archive.extractfile(member)
                assert extracted is not None
                with extracted:
                    for data in iter(lambda: extracted.read(1024 * 1024), b''):
                        digest.update(data)
                observed[name] = (member.size, digest.hexdigest(), member.mode)
    assert directories == set(expected['directories'])
    assert observed == {name: (value['bytes'], value['sha256'], value['mode']) for name, value in expected['files'].items()}
    return {'files': len(observed), 'directories': len(directories)}


def capture(root, destination, exclude=(), progress=None, only=None, allow=None):
    """Exclusive creation, independent archive read, then full source re-read."""
    destination = Path(destination)
    assert destination.parent.is_dir() and not destination.parent.is_symlink()
    with destination.open('xb', buffering=1024 * 1024) as stream, tarfile.open(fileobj=stream, mode='w|', bufsize=1024 * 1024) as archive:
        expected = snapshot(root, exclude, archive, progress, only, allow)
    verified = verify_tar(destination, expected)
    assert snapshot(root, exclude, progress=progress, only=only, allow=allow) == expected, 'The source changed after capture.'
    return {'success': True, 'archiveSha256': sha(destination), 'archiveBytes': destination.stat().st_size,
        'counts': verified, 'manifest': expected}


def self_test():
    checks = []
    with tempfile.TemporaryDirectory(prefix='agentopia-profile-archive-') as folder:
        base = Path(folder)
        source = base / 'source'
        source.mkdir()
        (source / 'empty').mkdir()
        (source / 'nested').mkdir()
        (source / 'nested/Unicode café 🟢.txt').write_text('Exact original bytes 🟢.')
        (source / 'zero').write_bytes(b'')
        (source / 'large.bin').write_bytes(bytes(range(256)) * 12000)
        (source / 'backups').mkdir()
        (source / 'backups/older.txt').write_text('Retained for its separate archive.')
        (source / 'wsl').mkdir()
        (source / 'wsl/ext4.vhdx').write_bytes(b'Exported separately while cold.')
        exclusions = ('backups', 'wsl/ext4.vhdx')
        result = capture(source, base / 'current.tar', exclusions)
        assert result['counts']['files'] == 3 and result['counts']['directories'] == 3
        checks.append('Unicode names, empty directories, empty files and multi-block bytes survive independent streaming verification.')
        assert 'backups/older.txt' not in result['manifest']['files']
        assert capture(source / 'backups', base / 'older.tar')['counts']['files'] == 1
        checks.append('Excluded old recovery data remains included in a separately verified archive.')
        try:
            capture(source, base / 'current.tar', exclusions)
        except FileExistsError:
            checks.append('An existing recovery archive cannot be overwritten.')
        else:
            raise AssertionError('An existing archive was overwritten.')
        (source / 'nested/Unicode café 🟢.txt').write_text('Changed later.')
        assert snapshot(source, exclusions) != result['manifest']
        checks.append('A later source change differs from the sealed manifest.')
        (source / 'escape').symlink_to('/etc')
        try:
            capture(source, base / 'linked.tar', exclusions)
        except AssertionError:
            checks.append('Escaping source links are refused without producing successful evidence.')
        else:
            raise AssertionError('A linked source was accepted.')
        (source / 'escape').unlink()
        with tarfile.open(base / 'unsafe.tar', 'w') as archive:
            member = tarfile.TarInfo('../outside')
            member.size = 1
            archive.addfile(member, io.BytesIO(b'x'))
        try:
            verify_tar(base / 'unsafe.tar', result['manifest'])
        except AssertionError:
            checks.append('An archive with an escaping path is refused without extraction.')
        else:
            raise AssertionError('An escaping archive was accepted.')
        with tarfile.open(base / 'wrong.tar', 'w') as archive:
            member = tarfile.TarInfo('zero')
            member.size = 1
            archive.addfile(member, io.BytesIO(b'x'))
        try:
            verify_tar(base / 'wrong.tar', result['manifest'])
        except AssertionError:
            checks.append('Missing entries and changed archive content fail verification.')
        else:
            raise AssertionError('A changed archive was accepted.')
        changing = base / 'changing'
        changing.mkdir()
        first = changing / 'first.txt'
        first.write_text('OLD')
        for index in range(110):
            (changing / (str(index) + '.txt')).write_text('OLD')
        try:
            capture(changing, base / 'changing.tar', progress=lambda count: first.write_text('NEW'))
        except AssertionError:
            checks.append('A source mutation during a real capture prevents successful sealing.')
        else:
            raise AssertionError('A source changed during capture without being detected.')
        with tarfile.open(base / 'duplicate.tar', 'w') as archive:
            for index in range(2):
                member = tarfile.TarInfo('zero')
                archive.addfile(member, io.BytesIO(b''))
        try:
            verify_tar(base / 'duplicate.tar', result['manifest'])
        except AssertionError:
            checks.append('Duplicate archive paths are rejected.')
        else:
            raise AssertionError('A duplicate archive entry was accepted.')
    return {'success': True, 'checks': checks, 'providerRequests': 0, 'productionChanges': 0}


if __name__ == '__main__':
    assert sys.argv[1:] == ['--self-test'], 'Use the supervised phased backup driver for production data.'
    print(json.dumps(self_test(), indent=2))
