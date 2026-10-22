"""Retain an inactive Store-cache profile, reusing verified identical archive bytes."""
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
import hashlib,importlib.util,json,os,re,shutil,sys
assert os.name=='nt'
sys.path.insert(0,str(Path(__file__).resolve().parent))
from activate_relocated_profile import folder
spec=importlib.util.spec_from_file_location('closed_inventory55',Path(__file__).with_name('closed-profile-inventory55.py'))
parallel=importlib.util.module_from_spec(spec);spec.loader.exec_module(parallel);inventory=parallel.inventory
job=Path(sys.argv[1]).resolve(strict=True)
assert job.parent==Path(r'F:\Agentopia\.supabase\desktop-store-cleanup55') and re.fullmatch(r'\d{13}',job.name)
root=Path(r'F:\Agentopia');source=Path(r'C:\Users\charl\AppData\Local\Packages\OpenAI.Codex_2p2nqsd0c76g0\LocalCache\Roaming\Agentopia')
common=Path(r'F:\Agentopia-Data\profiles\retained-roaming-20261021\profile')
extra=Path(r'F:\Agentopia-Data\profiles\retained-store-20261021\profile')
def read(p):return json.loads(Path(p).read_text(encoding='utf-8-sig'))
def digest(p):
 with Path(p).open('rb') as f:return hashlib.file_digest(f,'sha256').hexdigest()
prior=read(root/'.supabase/desktop-cleanup55/current.json');assert read(prior['evidence'])['success']
priorcopy=read(Path(prior['job'])/'legacy-copy.json');assert priorcopy['success']
archive_receipt=read(Path(prior['job'])/'eligible.json')
assert archive_receipt['everyDestinationByteVerifiedDuringCopy'] and archive_receipt['destinationPathsSizesTimesLinksComparedIndependently']
assert digest(priorcopy['manifest'])==archive_receipt['copyManifestSha256']
assert digest(Path(prior['job'])/'archive-metadata-seal.json')==archive_receipt['archiveMetadataSealSha256']
common_metadata=read(Path(prior['job'])/'archive-metadata-seal.json')
priorseals={}
for line in Path(priorcopy['manifest']).read_text().splitlines():
 row=json.loads(line);priorseals[Path(row['path']).as_posix()]=row['sha256']
source=folder(source);common=folder(common);extra=folder(extra)
print('Reading the inactive Store profile without following cache/runtime redirects.',flush=True)
prescan=read(read(root/'.supabase/desktop-store-prescan55/current.json')['evidence'])
assert prescan['success'] and prescan['sourceReadOnly'] and Path(prescan['source'])==source
assert digest(prescan['sourceSeal'])==prescan['sourceSealSha256']
seal=read(prescan['sourceSeal'])
(job/'source-seal.json').write_text(json.dumps(seal,sort_keys=True))
print(json.dumps({'sourceFiles':len(seal),'candidateIdenticalFiles':sum(priorseals.get(k)==v for k,v in seal.items())}),flush=True)
def retain(item):
 name,value=item;original=source/name;reused=priorseals.get(name)==value
 target=(common if reused else extra)/name
 if not original.exists():
  if not(name.startswith('attachments/') and reused):raise ValueError('An unexpected original source file is missing')
  info=target.lstat()
  if getattr(info,'st_file_attributes',0)&0x400 or info.st_nlink!=1 or [info.st_size,info.st_mtime_ns]!=common_metadata[name]:raise ValueError('The retained removed attachment changed')
  return {'path':name,'sha256':value,'archive':str(target),'bytes':info.st_size,'mtimeNs':info.st_mtime_ns,'reused':True,'sourceAlreadyRemovedByOwnedCleanup':True}
 before=original.stat()
 if reused:
  info=target.lstat()
  if getattr(info,'st_file_attributes',0)&0x400 or info.st_nlink!=1 or [info.st_size,info.st_mtime_ns]!=common_metadata[name]:raise ValueError('The existing byte-verified F archive changed')
 else:
  target.parent.mkdir(parents=True,exist_ok=True)
  with original.open('rb') as incoming,target.open('xb') as outgoing:shutil.copyfileobj(incoming,outgoing,1024*1024)
  if digest(target)!=value:raise ValueError('New archived bytes differ')
  os.utime(target,ns=(before.st_atime_ns,before.st_mtime_ns))
 after=original.stat()
 if (before.st_ino,before.st_mtime_ns,before.st_size)!=(after.st_ino,after.st_mtime_ns,after.st_size):raise ValueError('Source changed during retention')
 return {'path':name,'sha256':value,'archive':str(target),'bytes':before.st_size,'mtimeNs':before.st_mtime_ns,'atimeNs':before.st_atime_ns,'reused':reused}
copied=reused=retained_bytes=0
with (job/'retained-files.jsonl').open('x') as out,ThreadPoolExecutor(max_workers=8) as pool:
 for row in pool.map(retain,seal.items(),buffersize=64):
  out.write(json.dumps(row)+'\n');retained_bytes+=row['bytes']
  if row['reused']:reused+=1
  else:copied+=1
  if (copied+reused)%5000==0:print(json.dumps({'verified':copied+reused,'reused':reused,'copied':copied}),flush=True)
remaining=inventory(source)
assert all(seal.get(k)==v for k,v in remaining.items()),'The Store source changed after retention'
missing=set(seal)-set(remaining)
assert all(k.startswith('attachments/') for k in missing),'An unrecorded source path disappeared'
selector=Path(r'C:\Users\charl\.agentopia\desktop\profile-location.json');selected=read(selector)
assert selected['format']==2 and selected['profile']==r'F:\Agentopia-Data\profiles\a91a4800-e08f-4440-a4ec-588762d01bfd\profile'
result={'success':True,'source':str(source),'sourceFiles':len(seal),'remainingSourceFiles':len(remaining),'alreadyRemovedOwnedAttachments':len(missing),'commonArchive':str(common),'additionalArchive':str(extra),'reusedVerifiedFiles':reused,'copiedAdditionalFiles':copied,'retainedBytes':retained_bytes,'selectorSha256':digest(selector),'programRollbackVerified':True,'sourceUnchanged':True}
(job/'eligible.json').write_text(json.dumps(result,indent=2))
(extra.parent/'RETENTION.txt').write_text('Inactive Windows Store profile retained on 2026-10-21. The complete source-file map is '+str(job/'retained-files.jsonl')+'. Identical bytes are retained at '+str(common)+'. Additional files are under '+str(extra)+'. Each map entry records the original relative path, SHA-256 and exact F archive path. Keep both private roots and this protected map together. Runtime disks remain registered separately; this archive is not an active application profile.')
print(json.dumps(result),flush=True)
