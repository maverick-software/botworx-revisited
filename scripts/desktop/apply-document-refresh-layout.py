"""Finish the pending refresh update with its verified toolbar-placement correction."""
from pathlib import Path
import datetime,hashlib,json,shutil,subprocess
root=Path('/mnt/d/Users/charl/software/Agentopia')
def load(p):return json.loads(Path(p).read_text(encoding='utf-8-sig'))
def mounted(p):return Path('/mnt/'+p[0].lower()+p[2:].replace('\\','/'))
def sha(p):
 with Path(p).open('rb') as f:return hashlib.file_digest(f,'sha256').hexdigest()
def closed():
 r=subprocess.run(['/mnt/c/Windows/System32/WindowsPowerShell/v1.0/powershell.exe','-NoProfile','-NonInteractive','-Command','@(Get-Process Agentopia,AgentopiaSetup -ErrorAction SilentlyContinue).Count'],text=True,capture_output=True,check=True)
 assert r.stdout.strip()=='0','Agentopia must remain normally closed'
p=load(root/'.supabase/desktop-document-refresh/current.json');work=mounted(p['work']);assert work.parent==Path('/mnt/c/Users/charl/AgentopiaQA/document-refresh') and work.resolve()==work
proof=load(mounted(p['proof']));layout=load(mounted(p['layoutProof']));base=load(work/'installed.json');recovery=load(work/'recovery.json')
assert layout['success'] and layout['checks']==12 and layout['backendUnchanged'] and layout['changedSourceFiles']==['ui/style.css']
assert sha(mounted(layout['parentProof']))==layout['parentProofSha256'] and sha(mounted(layout['parentInstalled']))==layout['parentInstalledSha256']
q=load(mounted(layout['receipt']));assert q['success'] and len(q['checks'])==12 and not q['console'] and sha(mounted(layout['receipt']))==layout['receiptSha256']
assert base['success'] and base['independentArchiveVerification'] and base['nativeAcceptancePending'] and recovery['success'] and recovery['logicalDatabaseEqualityVerified']
before=mounted(recovery['out']);assert before.parent==Path('/mnt/c/Users/charl/AgentopiaRecovery/document-refresh-12') and sha(before/'active-profile.tar.gz')==recovery['profileArchiveSha256']
for f in load(before/'current-database-backup/manifest.json')['files']:assert sha(before/'current-database-backup'/f['name'])==f['sha256']
data_file=sorted(before.glob('data-after-ui-*.json'))[-1];data=load(data_file);assert data['success'] and data['tableCount']==126 and not data['mismatches']
assert datetime.datetime.now(datetime.timezone.utc)-datetime.datetime.fromisoformat(data['at'])<datetime.timedelta(minutes=15)
for name,digest in layout['sourceHashes'].items():assert sha(mounted(layout['source'])/name)==digest
resources=Path('/mnt/c/Users/charl/AppData/Local/AgentopiaDesktop/app-0.44.47/resources');assert resources.resolve()==resources
assert sha(resources/'app.asar')==proof['imageSha256']==layout['imageSha256']==base['imageSha256']
for name,digest in base['resourceFiles'].items():
 if name.startswith('ui/'):assert sha(resources/'resources'/name)==digest
ui=mounted(layout['ui']);current=resources/'resources/ui';pending=current.with_name('ui-refresh12-layout-pending');rollback=current.with_name('ui-before-refresh12-layout');failed=current.with_name('ui-refresh12-layout-failed')
for f in [pending,rollback,failed]:assert not f.exists()
closed();assert shutil.disk_usage(resources).free>sum(f.stat().st_size for f in ui.rglob('*') if f.is_file())+1024**3
shutil.copytree(ui,pending)
for name,digest in layout['uiHashes'].items():assert sha(pending/name)==digest
closed();current.rename(rollback)
try:
 pending.rename(current)
 for name,digest in layout['uiHashes'].items():assert sha(current/name)==digest
except BaseException:
 if current.exists():current.rename(failed)
 rollback.rename(current);raise
resource_files={n:h for n,h in base['resourceFiles'].items() if not n.startswith('ui/')};resource_files.update({'ui/'+n:h for n,h in layout['uiHashes'].items()})
record={**base,'at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'resourceFiles':resource_files,'resourceManifestSha256':hashlib.sha256(json.dumps(resource_files,sort_keys=True,separators=(',',':')).encode()).hexdigest(),'layoutCorrection':p['layoutProof'],'layoutRollbackUi':str(rollback),'nativeAcceptancePending':True,'providerRequests':0}
with (work/'layout-installed.json').open('x') as f:json.dump(record,f,indent=2)
print(json.dumps({k:v for k,v in record.items() if k!='resourceFiles'}))
