"""Losslessly retain completed, controlled UI fixture profiles before reclaiming caches."""
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import stat
import subprocess
import tarfile
import time

REPO = Path(__file__).resolve().parents[2]
ROOTS = [
    REPO / '.supabase/desktop-workspace-navigation',
    Path('C:/Users/charl/AgentopiaQA/document-refresh/1792471037784'),
]

def digest(stream):
    h = hashlib.sha256()
    for part in iter(lambda: stream.read(1024 * 1024), b''):
        h.update(part)
    return h.hexdigest()

def inventory(root, targets):
    rows = {}
    for target in targets:
        assert target.resolve().is_relative_to(root) and target.resolve() != root
        assert re.fullmatch(r'profile(?:-\d{13})?', target.name)
        for current, dirs, files in os.walk(target, followlinks=False):
            for name in [*dirs, *files]:
                item = Path(current) / name
                s = item.lstat()
                assert not s.st_file_attributes & stat.FILE_ATTRIBUTE_REPARSE_POINT, item
                assert item.resolve().is_relative_to(root), item
                if name in files:
                    assert stat.S_ISREG(s.st_mode) and s.st_nlink == 1, item
                    with item.open('rb') as f:
                        rows[item.relative_to(root).as_posix()] = {'size': s.st_size, 'sha256': digest(f)}
    return rows

def processes():
    result = subprocess.run(['powershell', '-NoProfile', '-Command',
        "Get-CimInstance Win32_Process | Where-Object { $_.Name -in @('electron.exe','Agentopia.exe') } | Select-Object -ExpandProperty CommandLine | ConvertTo-Json -Compress"],
        check=True, capture_output=True, text=True)
    return result.stdout.lower().replace('\\\\', '/')

for root in ROOTS:
    root = root.resolve(strict=True)
    if root == ROOTS[0].resolve():
        targets = [Path(x) for x in json.loads((REPO / '.supabase/desktop-export-relocation/cache-targets.json').read_text())]
    else:
        targets = [root / x for x in ['agents/profile-1792471545671', 'navigation/profile', 'ui/profile',
            'ui-1792471164833/profile', 'ui-1792471253442/profile', 'ui-1792471307691/profile',
            'ui-1792471319801/profile', 'ui-1792471338141/profile', 'ui-1792471839457/profile']]
    targets = [x for x in targets if x.exists()]
    if not targets:
        continue
    active = processes()
    assert root.as_posix().lower() not in active, 'A fixture process is still running'
    for target in targets:
        evidence = json.loads((target.parent / 'evidence.json').read_text(encoding='utf-8-sig'))
        if root == ROOTS[0].resolve():
            assert evidence.get('success') is True and evidence.get('controlledBridge') is True
            assert evidence.get('productionAccess') is False and evidence.get('inferenceRequests') == 0
        elif target.parent.name == 'agents':
            assert evidence.get('controlledBridge') is True and evidence.get('backendAccess') is False
            assert evidence.get('inference') is False
        elif target.parent.name == 'navigation':
            assert evidence.get('controlledBridge') is True and evidence.get('productionAccess') is False
            assert evidence.get('inferenceRequests') == 0
        else:
            assert evidence.get('productionAccess') is False and evidence.get('providerRequests') == 0
    before = inventory(root, targets)
    stem = root / ('completed-fixture-caches-' + str(time.time_ns() // 1000000))
    archive = Path(str(stem) + '.tar.gz')
    with tarfile.open(archive, 'w:gz', compresslevel=9) as tar:
        for target in targets:
            tar.add(target, arcname=target.relative_to(root).as_posix(), recursive=True)
    archived = {}
    with tarfile.open(archive, 'r:gz') as tar:
        for member in tar:
            assert not member.name.startswith('/') and '..' not in Path(member.name).parts
            assert member.isfile() or member.isdir()
            if member.isfile():
                with tar.extractfile(member) as f:
                    archived[member.name] = {'size': member.size, 'sha256': digest(f)}
    assert archived == before, 'Archive verification failed'
    assert inventory(root, targets) == before, 'Source changed during archival'
    assert root.as_posix().lower() not in processes(), 'A fixture started during archival'
    receipt = {'root': str(root), 'targets': [str(x) for x in targets], 'files': before,
        'archive': str(archive), 'archiveBytes': archive.stat().st_size,
        'sourceBytes': sum(x['size'] for x in before.values()), 'deleted': False}
    receipt_path = Path(str(stem) + '.json')
    receipt_path.write_text(json.dumps(receipt, indent=2), encoding='utf-8')
    for target in targets:
        assert target.resolve(strict=True).is_relative_to(root) and target.resolve() != root
        assert not target.lstat().st_file_attributes & stat.FILE_ATTRIBUTE_REPARSE_POINT
        shutil.rmtree(target)
    receipt['deleted'] = True
    receipt_path.write_text(json.dumps(receipt, indent=2), encoding='utf-8')
    print(json.dumps({k: receipt[k] for k in ['root', 'archive', 'sourceBytes', 'archiveBytes', 'deleted']}), flush=True)
