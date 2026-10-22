"""Extract only verified desktop storage from the immutable44 recovery.

Never export credential, cookie, browser-domain or account values in receipts.
Separate Chrome tool profiles and native-agent auth/config files are excluded.
"""
from pathlib import Path, PurePosixPath
import hashlib
import json
import re
import sqlite3
import sys
import tarfile
import time


def digest(file):
    with file.open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()


def selected(name):
    if name in ('credentials.bin', 'Local State', 'Preferences'):
        return True
    return bool(re.fullmatch(r'(?:Partitions/[a-zA-Z0-9_.-]{1,200}/)?Network/Cookies(?:-journal|-wal|-shm)?', name))


def counts(profile):
    result = []
    now = int((time.time() + 11644473600) * 1_000_000)
    for file in sorted(profile.rglob('Cookies')):
        relative = file.relative_to(profile).as_posix()
        assert selected(relative) and file.is_file() and not file.is_symlink()
        connection = sqlite3.connect(file.as_uri() + '?mode=ro', uri=True)
        try:
            assert connection.execute('PRAGMA integrity_check').fetchone()[0] == 'ok'
            rows = connection.execute('SELECT expires_utc,length(value),length(encrypted_value) FROM cookies').fetchall()
        finally:
            connection.close()
        partition = relative.split('/')[1] if relative.startswith('Partitions/') else 'default'
        result.append({'partition': hashlib.sha256(partition.encode()).hexdigest() if partition != 'default' else 'default',
                       'persistedRows': len(rows),
                       'unexpiredRows': sum(expiry == 0 or expiry > now for expiry, _, _ in rows),
                       'rowsWithPlainValue': sum(plain > 0 for _, plain, _ in rows),
                       'rowsWithEncryptedValue': sum(encrypted > 0 for _, _, encrypted in rows)})
    return result


def main():
    mode, folder = sys.argv[1:]
    out = Path(folder).resolve()
    qa = Path('C:/Users/charl/AgentopiaQA/storage-preflight').resolve()
    assert out.is_relative_to(qa) and out != qa
    if mode == 'counts':
        assert out.parent.name == 'profiles'
        print(json.dumps({'success': True, 'cookieDatabases': counts(out)}))
        return
    assert mode == 'extract'
    recovery = Path('C:/Users/charl/AgentopiaRecovery/before-04444/1792437815493')
    archive = recovery / 'ordinary-current.tar'
    manifest = json.loads((recovery / 'private-profile-ordinary.json').read_text(encoding='utf-8'))
    expected = 'd760eec24974f051710ac6e4b05fe8665fe04c74fd201f13432c7ee3c7d84719'
    assert manifest['success'] and manifest['archiveSha256'] == expected and digest(archive) == expected
    files = {name: record for name, record in manifest['manifest']['files'].items() if selected(name)}
    assert all(name in files for name in ('credentials.bin', 'Local State', 'Preferences'))
    target = out / 'profiles' / 'recovery-source'
    assert not target.exists()
    target.mkdir(parents=True)
    found = set()
    with tarfile.open(archive) as tar:
        for member in tar:
            if member.name not in files:
                continue
            name = PurePosixPath(member.name)
            assert member.isfile() and not member.issym() and not member.islnk()
            assert not name.is_absolute() and all(part not in ('', '.', '..') for part in name.parts)
            assert member.name not in found
            found.add(member.name)
            data = tar.extractfile(member).read()
            assert len(data) == member.size == files[member.name]['bytes']
            assert hashlib.sha256(data).hexdigest() == files[member.name]['sha256']
            destination = target.joinpath(*name.parts)
            assert destination.resolve().is_relative_to(target.resolve())
            destination.parent.mkdir(parents=True, exist_ok=True)
            with destination.open('xb') as stream:
                stream.write(data)
    assert found == set(files)
    receipt = {'success': True, 'recovery': str(recovery), 'archiveSha256': expected,
               'profile': str(target), 'files': len(files), 'cookieDatabases': counts(target),
               'nativeAuthConfigExcluded': True, 'separateChromeToolProfilesExcluded': True,
               'filesVerified': [{'pathSha256': hashlib.sha256(name.encode()).hexdigest(), **record}
                                 for name, record in sorted(files.items())]}
    (out / 'extraction.json').write_text(json.dumps(receipt, indent=2), encoding='utf-8')
    print(json.dumps({'success': True, 'files': len(files), 'cookieDatabases': len(receipt['cookieDatabases'])}))


if __name__ == '__main__':
    main()
