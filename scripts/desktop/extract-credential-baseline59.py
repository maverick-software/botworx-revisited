import hashlib, json, pathlib, sys, tarfile
root = pathlib.Path('F:/Agentopia/.supabase/desktop-normal-maintenance/1792617933896/recovery')
out = pathlib.Path(sys.argv[1]).resolve()
expected_parent = pathlib.Path('F:/Agentopia/.supabase/desktop-image-readiness59/live-1792618573942').resolve()
assert out.parent == expected_parent and out.name == 'encrypted-primary-baseline'
manifest = json.loads((root / 'private-profile-recovery.json').read_text())
archive = root / 'current-private-profile.tar.gz'
assert hashlib.file_digest(archive.open('rb'), 'sha256').hexdigest() == manifest['archiveSha256']
out.mkdir()
names = {'credentials.bin', 'Local State'}
with tarfile.open(archive, 'r|gz') as handle:
    for item in handle:
        name = item.name.removeprefix('./')
        if name not in names:
            continue
        assert item.isfile() and item.size < 2 * 1024 * 1024
        data = handle.extractfile(item).read()
        assert hashlib.sha256(data).hexdigest() == manifest['manifest']['files'][name]['sha256']
        with (out / name).open('xb') as target:
            target.write(data)
        names.remove(name)
        if not names:
            break
assert not names
print(json.dumps({'success': True, 'out': str(out), 'encryptedFiles': 2, 'plaintextCredentialsWritten': False}))
