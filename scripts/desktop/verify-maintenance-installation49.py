"""Check ordinary physical installed bytes independently of Windows redirection."""
from pathlib import Path, PurePosixPath
from concurrent.futures import ThreadPoolExecutor
import hashlib, json, re, sys

def digest(file):
    assert file.is_file() and not file.is_symlink(), str(file)
    with file.open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()

def mapped(value):
    assert re.match(r'^[CF]:[\\/]', value, re.I)
    return Path('/mnt/'+value[0].lower()+'/'+value[3:].replace('\\', '/'))

def verify_tree(root, expected):
    assert root.resolve() == root and not root.is_symlink()
    def verify(row):
        name, sha = row
        assert str(PurePosixPath(name)) == name and not name.startswith('/') and '..' not in PurePosixPath(name).parts and '\\' not in name
        assert digest(root/name) == sha, name
    with ThreadPoolExecutor(max_workers=8) as workers:
        list(workers.map(verify, expected.items()))

assert len(sys.argv) == 3 and sys.argv[1] in ('rollback', 'installed')
mode, job = sys.argv[1], Path(sys.argv[2])
assert job.parent == Path('/mnt/f/Agentopia/.supabase/desktop-normal-maintenance') and re.fullmatch(r'\d{13}', job.name)
assert job.resolve() == job
intent = json.loads((job/'intent.json').read_text())
if mode == 'rollback':
    saved = json.loads((job/'program-rollback.json').read_text())
    expected = saved['files']
    verify_tree(Path('/mnt/c/Users/charl/AppData/Local/AgentopiaDesktop/app-0.44.48'), expected)
    verify_tree(job/'rollback/program', expected)
    for name in ('profile-location.json', 'runtime-binding.json'):
        source = Path('/mnt/c/Users/charl/.agentopia/desktop')/('profile/runtime-binding.json' if name == 'runtime-binding.json' else name)
        assert digest(source) == saved['identityFiles'][name] == digest(job/'rollback'/name)
else:
    proof = json.loads(mapped(intent['packageProof']).read_text())
    expected = dict(proof['programFiles'])
    verified_installer = json.loads(mapped(str(PurePosixPath(intent['packageProof'].replace('\\','/')).parent/'installer-verification/evidence.json')).read_text())
    assert verified_installer['success']
    expected.update({'resources/resources/'+k: v for k, v in proof['resourceFiles'].items()})
    root = Path('/mnt/c/Users/charl/AppData/Local/AgentopiaDesktop/app-0.44.49')
    verify_tree(root, expected)
    # Squirrel routes *_ExecutionStub.exe to the installation root as App.exe.
    assert digest(root.parent/'Agentopia.exe') == verified_installer['generatedLauncher']['launcherSha256']
    assert digest(Path('/mnt/c/Users/charl/AppData/Local/AgentopiaDesktop/Update.exe')) == '76359cd4b0349a83337b941332ad042c90351c2bb0a4628307740324c97984cc'
report = {'success': True, 'mode': mode, 'physicalFilesVerified': len(expected)+(2 if mode=='installed' else 0), 'physicalOrdinaryInstallation': True}
(job/('physical-'+mode+'.json')).write_text(json.dumps(report, indent=2))
print(json.dumps(report), flush=True)
