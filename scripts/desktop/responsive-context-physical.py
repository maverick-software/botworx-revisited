"""Verify the actual Windows installation through Linux, outside Store redirection."""
from pathlib import Path
import hashlib,json,re,sys
from concurrent.futures import ThreadPoolExecutor
assert len(sys.argv)==3 and sys.argv[1] in ('before','after')
mode=sys.argv[1];work=Path(sys.argv[2]);assert work.parent==Path('/mnt/f/Agentopia/.supabase/desktop-responsive-context') and re.fullmatch(r'\d{13}',work.name)
proof=json.loads((work/'proof.json').read_text());base_path=proof['baseReceipt'];assert base_path.lower().startswith('f:')
base=json.loads(Path('/mnt/f/'+base_path[3:].replace('\\','/')).read_text())
resources=Path('/mnt/c/Users/charl/AppData/Local/AgentopiaDesktop/app-0.44.47/resources')
def digest(file):
    with file.open('rb') as stream:return hashlib.file_digest(stream,'sha256').hexdigest()
assert digest(resources/'app.asar')==proof['imageSha256']
expected=dict(base['resourceFiles'])
if mode=='after':
    expected={key:value for key,value in expected.items() if not key.startswith('ui/')}
    expected.update({'ui/'+key:value for key,value in proof['uiHashes'].items()})
def verify(entry):
    name,sha=entry
    assert '..' not in Path(name).parts and not Path(name).is_absolute()
    file=resources/'resources'/name;assert file.is_file() and not file.is_symlink() and digest(file)==sha, name
with ThreadPoolExecutor(max_workers=12) as workers:list(workers.map(verify,expected.items()))
print(json.dumps({'success':True,'physicalInstallationVerified':True,'mode':mode,'resourceFiles':len(expected),'backendArchiveUnchanged':True}))
