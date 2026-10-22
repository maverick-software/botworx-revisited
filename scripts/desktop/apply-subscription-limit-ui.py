"""Physically verify the recovery, then publish only qualified renderer assets."""
from pathlib import Path, PurePosixPath
import datetime, hashlib, json, shutil, subprocess, tarfile
root = Path('/mnt/d/Users/charl/software/Agentopia')
def load(p): return json.loads(Path(p).read_text(encoding='utf-8-sig'))
def mounted(p):
    assert len(p) > 3 and p[1] == ':'
    return Path('/mnt/' + p[0].lower() + p[2:].replace('\\', '/'))
def sha(p):
    with Path(p).open('rb') as f: return hashlib.file_digest(f, 'sha256').hexdigest()
def closed():
    p = subprocess.run(['/mnt/c/Windows/System32/WindowsPowerShell/v1.0/powershell.exe', '-NoProfile', '-NonInteractive', '-Command', '@(Get-Process Agentopia,AgentopiaSetup -ErrorAction SilentlyContinue).Count'], text=True, capture_output=True, check=True)
    assert p.stdout.strip() == '0', 'Agentopia must remain normally closed'

pointer = load(root / '.supabase/desktop-office-edit-live/subscription-ui-current.json')
work = mounted(pointer['work']); assert work.parent == Path('/mnt/c/Users/charl/AgentopiaQA/subscription-limit-ui') and work.resolve() == work
proof, qualified, recovery = [load(work / n) for n in ['proof.json', 'qualification.json', 'recovery.json']]
assert proof['success'] and qualified['success'] and qualified['totalChecks'] == 52 and not proof['installed']
for item in [*qualified['checks'], qualified['unit']]: assert sha(mounted(item['file'])) == item['sha256']
before = mounted(recovery['out']); assert before.parent == Path('/mnt/c/Users/charl/AgentopiaRecovery/private-profile-current') and before.resolve() == before
assert recovery['success'] and recovery['logicalBackupVerified'] and not recovery['currentColdImageCaptured']
manifest = load(before / 'private-profile.json'); archive = before / 'active-profile.tar.gz'
assert manifest['success'] and manifest['storage'] == 'verified-compressed-tar' and sha(archive) == recovery['profileArchiveSha256'] == manifest['archiveSha256']
expected = manifest['manifest']; files, directories, seen = {}, set(), set()
with tarfile.open(archive, mode='r|gz') as tar:
    for member in tar:
        name = member.name.rstrip('/'); parsed = PurePosixPath(name)
        assert name and not parsed.is_absolute() and str(parsed) == name and '..' not in parsed.parts and '\\' not in name and ':' not in name
        assert name.lower() not in seen; seen.add(name.lower())
        if member.isdir():
            assert name in expected['directories']; directories.add(name)
        else:
            assert member.isfile() and name in expected['files']
            with tar.extractfile(member) as f: digest = hashlib.file_digest(f, 'sha256').hexdigest()
            files[name] = {'bytes': member.size, 'sha256': digest}
assert files == {n: {'bytes': f['bytes'], 'sha256': f['sha256']} for n, f in expected['files'].items()} and directories == set(expected['directories'])
assert len(files) == recovery['profileFiles'] == 3960
assert {'Local State', 'credentials.bin', 'runtime-binding.json', 'profile-migration.json'} <= set(files)
logical = load(before / 'current-database-backup/manifest.json')
assert len(logical['files']) == 5
for f in logical['files']: assert sha(before / 'current-database-backup' / f['name']) == f['sha256']
comparisons = sorted(before.glob('data-after-ui-*.json')); data = load(comparisons[-1]); assert data['success'] and data['tableCount'] == 126 and not data['mismatches']
assert datetime.datetime.now(datetime.timezone.utc) - datetime.datetime.fromisoformat(data['at']) < datetime.timedelta(minutes=15)
base = load(root / '.supabase/desktop-presentation-delivery/reopened.json'); assert base['success'] and base['revision'] == 'presentation-4'
assert proof['baseImageSha256'] == base['imageSha256'] == recovery['scope']['installedArchiveSha256']
oldproof = load(root / '.supabase/desktop-presentation-delivery/current.json'); oldsource = mounted(load(mounted(oldproof['proof']))['source'])
source = mounted(proof['source']); changed = []
for name, digest in proof['sourceHashes'].items():
    assert sha(source / name) == digest
    if sha(oldsource / name) != digest: changed.append(name)
assert changed == ['ui/connection-failure.ts']
installed = Path('/mnt/c/Users/charl/AppData/Local/AgentopiaDesktop/app-0.44.47/resources'); assert installed.resolve() == installed
assert sha(installed / 'app.asar') == base['imageSha256']
resources = installed / 'resources'
for name, digest in base['resourceFiles'].items():
    if name.startswith('ui/') or name == 'runtime/Restore-Agentopia.ps1': assert sha(resources / name) == digest
assert sha(mounted(recovery['scope']['locationFile'])) == recovery['scope']['locationSha256']
ui = mounted(proof['ui']); assert ui.resolve() == ui
for name, digest in proof['uiHashes'].items(): assert sha(ui / name) == digest
closed()
current, pending, rollback, failed = [resources / name for name in ['ui', 'ui-subscription-limit5-pending', 'ui-before-subscription-limit5', 'ui-subscription-limit5-failed']]
assert all(p.parent == resources and not p.exists() for p in [pending, rollback, failed])
shutil.copytree(ui, pending)
for name, digest in proof['uiHashes'].items(): assert sha(pending / name) == digest
assert shutil.disk_usage(resources).free > 1024**3
closed(); current.rename(rollback)
try:
    pending.rename(current)
    for name, digest in proof['uiHashes'].items(): assert sha(current / name) == digest
    assert sha(installed / 'app.asar') == base['imageSha256']
except BaseException:
    if current.exists(): current.rename(failed)
    rollback.rename(current)
    raise
resource_files = {n: h for n, h in base['resourceFiles'].items() if not n.startswith('ui/')}
resource_files.update({'ui/' + n: h for n, h in proof['uiHashes'].items()})
receipt = {'success': True, 'at': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'version': '0.44.47', 'revision': 'subscription-limit-5', 'work': str(work), 'imageSha256': base['imageSha256'], 'resourceFiles': resource_files, 'resourceManifestSha256': hashlib.sha256(json.dumps(resource_files, separators=(',', ':'), ensure_ascii=False).encode()).hexdigest(), 'uiFilesVerified': len(proof['uiHashes']), 'recovery': str(before), 'independentPythonProfileVerificationFiles': len(files), 'rollbackUi': str(rollback), 'nativeReopeningPending': True, 'currentColdImageCaptured': False, 'backendRuntimeSchemaAndAgentModulesUnchanged': True, 'providerRequests': 0, 'fullGoalComplete': False}
with (work / 'installed.json').open('x') as f: json.dump(receipt, f, indent=2)
print(json.dumps({k: v for k, v in receipt.items() if k != 'resourceFiles'}))
