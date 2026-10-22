"""Accept installed bytes and saved-data preservation after native reopening."""
from pathlib import Path
import datetime, hashlib, json
root = Path('/mnt/d/Users/charl/software/Agentopia')
def load(p): return json.loads(Path(p).read_text(encoding='utf-8-sig'))
def mounted(p): return Path('/mnt/' + p[0].lower() + p[2:].replace('\\', '/'))
def sha(p):
    with Path(p).open('rb') as f: return hashlib.file_digest(f, 'sha256').hexdigest()
pointer = load(root / '.supabase/desktop-office-edit-live/subscription-ui-current.json'); work = mounted(pointer['work'])
proof, applied, native, recovery = [load(work / n) for n in ['proof.json', 'installed.json', 'native-acceptance.json', 'recovery.json']]
assert applied['success'] and native['success'] and native['normalReopeningPassed'] and native['nativeQuotaNoticeVerified'] and native['technicalDetailsExpandable'] and native['noRequestSentOrReplayed'] and native['originalChatReturned']
installed = Path('/mnt/c/Users/charl/AppData/Local/AgentopiaDesktop/app-0.44.47/resources')
assert sha(installed / 'app.asar') == applied['imageSha256'] == proof['baseImageSha256']
for name, digest in applied['resourceFiles'].items():
    if name.startswith('ui/') or name == 'runtime/Restore-Agentopia.ps1': assert sha(installed / 'resources' / name) == digest
old = load(root / '.supabase/desktop-presentation-delivery/reopened.json')
for name, digest in old['resourceFiles'].items():
    if name.startswith('ui/'): assert sha(Path(applied['rollbackUi']) / name[3:]) == digest
before = mounted(recovery['out']); assert sha(before / 'active-profile.tar.gz') == recovery['profileArchiveSha256']
comparisons = sorted(before.glob('data-after-ui-*.json')); current = load(comparisons[-1])
assert current['success'] and current['tableCount'] == 126 and not current['mismatches']
assert datetime.datetime.now(datetime.timezone.utc) - datetime.datetime.fromisoformat(current['at']) < datetime.timedelta(minutes=10)
record = {**applied, 'at': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'nativeReopeningPending': False, 'normalReopeningPassed': True, 'nativeAcceptance': str(work / 'native-acceptance.json'), 'dataComparison': str(comparisons[-1]), 'tablesCompared': 126, 'allSavedDataPreserved': True, 'profileRecoveryFiles': recovery['profileFiles'], 'profileRecoveryVerifiedByIndependentPython': True, 'fullInstallerCreated': False, 'cleanMachineRestorationTested': False}
with (work / 'reopened.json').open('x') as f: json.dump(record, f, indent=2)
with (root / '.supabase/desktop-office-edit-live/subscription-ui-reopened.json').open('x') as f: json.dump(record, f, indent=2)
print(json.dumps({k: v for k, v in record.items() if k != 'resourceFiles'}))
