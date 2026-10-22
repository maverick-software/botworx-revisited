"""Read-only size estimate using the migration copier's exact exclusion policy."""
import importlib.util
import json
import os
from pathlib import Path
import stat
import sys

spec = importlib.util.spec_from_file_location('copy_policy', Path(__file__).resolve().parents[2] / 'desktop/runtime/copy-desktop-profile.py')
policy = importlib.util.module_from_spec(spec)
spec.loader.exec_module(policy)
root = policy.checked_root(Path(sys.argv[1]), True)
count = size = backup = 0
for folder, dirs, files in os.walk(root, followlinks=False):
    base = Path(folder)
    dirs[:] = [name for name in dirs if not policy.excluded((base / name).relative_to(root), True)]
    for name in dirs:
        policy.checked_entry(base / name, True)
    for name in files:
        file = base / name
        if policy.excluded(file.relative_to(root), False):
            continue
        st = policy.checked_entry(file, True)
        if not stat.S_ISREG(st.st_mode):
            raise ValueError('A profile entry needs inspection before migration.')
        count += 1
        size += st.st_size
        if file.is_relative_to(root / 'backups'):
            backup += st.st_size
print(json.dumps({'readOnly': True, 'estimateOnly': True, 'selectedFiles': count, 'selectedBytes': size, 'historicalBackupBytes': backup}))
