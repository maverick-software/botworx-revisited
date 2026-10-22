"""Retain and verify exact completed fake-renderer profiles before reclaiming space."""
from pathlib import Path
import hashlib,json,os,re,shutil,stat,subprocess,tarfile,time
REPO=Path(__file__).resolve().parents[2];BASE=(REPO/'.supabase').resolve(strict=True)
plan=json.loads((BASE/'desktop-full-recovery/cache-inventory.json').read_text());assert Path(plan['base']).resolve()==BASE
targets=[Path(row['target']) for row in plan['selected']];assert len(targets)==len(set(targets)) and len(targets)<=40
def processes():
 result=subprocess.run(['powershell.exe','-NoProfile','-Command',"Get-CimInstance Win32_Process | Where-Object { $_.Name -in @('electron.exe','Agentopia.exe') } | Select-Object -ExpandProperty CommandLine | ConvertTo-Json -Compress"],capture_output=True,text=True,check=True)
 return result.stdout.casefold().replace('\\\\','/')
def no_live():
 active=processes()
 for target in targets:assert target.as_posix().casefold() not in active,'A selected fixture is running'
def sha(file):
 with file.open('rb') as stream:return hashlib.file_digest(stream,'sha256').hexdigest()
def inventory():
 files={}
 for target in targets:
  assert target.resolve(strict=True).is_relative_to(BASE) and target.resolve()!=BASE and re.fullmatch(r'profile(?:-\d{13})?',target.name)
  evidence=json.loads((target.parent/'evidence.json').read_text(encoding='utf-8-sig'));assert evidence.get('success') is True and evidence.get('controlledBridge') is True and evidence.get('productionAccess') is False
  counters=[evidence[k] for k in ['providerRequests','inferenceRequests'] if k in evidence];assert counters and all(x==0 for x in counters)
  own=0;count=0
  for current,dirs,names in os.walk(target,followlinks=False):
   for name in [*dirs,*names]:
    item=Path(current)/name;s=item.lstat();assert not s.st_file_attributes&stat.FILE_ATTRIBUTE_REPARSE_POINT and item.resolve().is_relative_to(BASE)
    assert name not in ['credentials.bin','runtime-binding.json','profile-migration.json','codex']
    if name in names:
     assert stat.S_ISREG(s.st_mode) and s.st_nlink==1;files[item.relative_to(BASE).as_posix()]={'bytes':s.st_size,'sha256':sha(item)};own+=s.st_size;count+=1
  assert not target.lstat().st_file_attributes&stat.FILE_ATTRIBUTE_REPARSE_POINT and own<30*1024**2 and count<200
 return files
no_live();before=inventory();stem=BASE/'desktop-full-recovery'/('completed-renderer-caches-'+str(time.time_ns()//1000000));archive=Path(str(stem)+'.tar.gz')
with tarfile.open(archive,'w:gz',compresslevel=9) as tar:
 for i,target in enumerate(targets):
  tar.add(target,arcname=target.relative_to(BASE).as_posix())
  if (i+1)%10==0:print(json.dumps({'archivedProfiles':i+1,'total':len(targets)}),flush=True)
copied={}
with tarfile.open(archive,'r:gz') as tar:
 for member in tar:
  assert not member.name.startswith('/') and '..' not in Path(member.name).parts and (member.isdir() or member.isfile())
  if member.isfile():
   with tar.extractfile(member) as stream:copied[member.name]={'bytes':member.size,'sha256':hashlib.file_digest(stream,'sha256').hexdigest()}
assert copied==before and inventory()==before;no_live()
receipt={'success':True,'archive':str(archive),'archiveSha256':sha(archive),'archiveBytes':archive.stat().st_size,'sourceBytes':sum(r['bytes'] for r in before.values()),'files':before,'targets':[str(p) for p in targets],'removed':False};record=Path(str(stem)+'.json');record.write_text(json.dumps(receipt,indent=2),encoding='utf-8')
for target in targets:
 assert target.resolve(strict=True).is_relative_to(BASE) and target.resolve()!=BASE and not target.lstat().st_file_attributes&stat.FILE_ATTRIBUTE_REPARSE_POINT
 shutil.rmtree(target)
receipt['removed']=True;record.write_text(json.dumps(receipt,indent=2),encoding='utf-8');print(json.dumps({k:v for k,v in receipt.items() if k not in ['files','targets']}),flush=True)
