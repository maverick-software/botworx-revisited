"""Compare cold-image files in a disposable WSL import; never start services."""
import glob
import hashlib
import json
from pathlib import Path
import sys
import uuid

source = Path(sys.argv[1]).resolve()
assert source.parent == Path('/mnt/d/Users/charl/software/Agentopia/.supabase/desktop-installed-0448')
assert source.name.startswith('physical-backup-')
instance = str(uuid.UUID(sys.argv[2]))
assert Path('/opt/agentopia/runtime-instance').read_text().strip() == instance

def stopped():
    assert not any(Path(file).read_text().strip() == 'postgres' for file in glob.glob('/proc/[0-9]*/comm'))

stopped()
expected = json.loads((source / 'private-runtime-files.json').read_text())
assert len(expected) >= 6
for name, checksum in expected.items():
    file = Path(name)
    assert file.is_absolute() and '..' not in file.parts
    assert name.startswith(('/opt/agentopia/', '/home/agentopia/.config/agentopia/', '/home/agentopia/.supabase/stacks/'))
    assert file.is_file() and not file.is_symlink()
    assert len(checksum) == 64 and all(char in '0123456789abcdef' for char in checksum)
    digest = hashlib.sha256()
    with file.open('rb') as stream:
        for data in iter(lambda: stream.read(1024 * 1024), b''):
            digest.update(data)
    assert digest.hexdigest() == checksum, 'A recorded critical file differs in the imported disk.'
stopped()
print(json.dumps({'success': True, 'criticalFiles': len(expected), 'instanceIdValidated': True, 'databaseServicesStarted': 0, 'providerRequests': 0}))
