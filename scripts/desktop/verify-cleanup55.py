"""Read-only eligibility checks for the explicitly authorized obsolete C copies."""
from pathlib import Path
import hashlib,importlib.util,json,os,re,sys
assert os.name=='nt'
sys.path.insert(0,str(Path(__file__).resolve().parent))
from activate_relocated_profile import folder
spec=importlib.util.spec_from_file_location('closed_inventory55',Path(__file__).with_name('closed-profile-inventory55.py'))
parallel=importlib.util.module_from_spec(spec);spec.loader.exec_module(parallel);inventory=parallel.inventory
job=Path(sys.argv[1]).resolve(strict=True)
assert job.parent==Path(r'F:\Agentopia\.supabase\desktop-cleanup55') and re.fullmatch(r'\d{13}',job.name)
root=Path(r'F:\Agentopia')
def read(p):return json.loads(Path(p).read_text(encoding='utf-8-sig'))
def digest(p):
 with Path(p).open('rb') as f:return hashlib.file_digest(f,'sha256').hexdigest()
update=read(root/'.supabase/desktop-normal-maintenance/current-update55.json')
installed=read(Path(update['job'])/'evidence.json')
assert installed['success'] and installed['installed'] and not installed['ordinaryReopeningPending']
acceptance=read(Path(update['job'])/'installed-data-accepted.json')
assert acceptance['success'] and acceptance['database']['success'] and acceptance['agentAudit']['success']
selector=read(r'C:\Users\charl\.agentopia\desktop\profile-location.json')
target=Path(r'F:\Agentopia-Data\profiles\a91a4800-e08f-4440-a4ec-588762d01bfd\profile')
assert selector['format']==2 and Path(selector['profile'])==target
assert digest(target/'profile-migration.json')==selector['migrationSha256']
oldjob=root/'.supabase/desktop-normal-maintenance/1792596971671'
plan=read(oldjob/'plan.json');source=Path(r'C:\Users\charl\.agentopia\desktop\profile')
seal=read(oldjob/'source-seal.json')
assert digest(oldjob/'source-seal.json')==plan['sourceSealSha256']
assert inventory(folder(source))==seal,'The original C profile changed since relocation'
for f in ['backup-evidence.json','encrypted-evidence.json','native-audit/evidence.json']:
 assert read(oldjob/f)['success']
recovery=read(oldjob/'backup-evidence.json')
assert digest(recovery['rawProfileArchive'])==recovery['rawProfileArchiveSha256']
assert digest(recovery['independentVerification'])==recovery['independentVerificationSha256']
assert read(recovery['independentVerification'])['success']
copy=read(job/'legacy-copy.json')
legacy=Path(r'C:\Users\charl\AppData\Roaming\Agentopia')
archive=Path(r'F:\Agentopia-Data\profiles\retained-roaming-20261021\profile')
assert copy['success'] and copy['phase']=='completed' and Path(copy['source'])==legacy and Path(copy['destination'])==archive
expected={}
for line in Path(copy['manifest']).read_text().splitlines():
 row=json.loads(line);expected[Path(row['path']).as_posix()]=row['sha256']
source_details=inventory(folder(legacy),details=True)
assert {k:v['sha256'] for k,v in source_details.items()}==expected,'The old Roaming profile changed during archival'
expected_metadata={k:(v['bytes'],v['mtime']) for k,v in source_details.items()}
archive_metadata=inventory(folder(archive),metadata=True)
assert archive_metadata==expected_metadata,'Retained legacy paths, lengths, times or private links differ from the byte-verified copy'
(job/'archive-metadata-seal.json').write_text(json.dumps(archive_metadata,sort_keys=True))
rollback=read(Path(update['job'])/'program-rollback.json')
for name,value in rollback['files'].items():assert digest(Path(rollback['destination'])/name)==value
receipt={'success':True,'source':str(source),'sourceFiles':len(seal),'legacy':str(legacy),'legacyFiles':len(expected),'archive':str(archive),'copyManifestSha256':digest(copy['manifest']),'archiveMetadataSealSha256':digest(job/'archive-metadata-seal.json'),'everyDestinationByteVerifiedDuringCopy':True,'legacySourceRehashedIndependently':True,'destinationPathsSizesTimesLinksComparedIndependently':True,'destinationFullColdReread':False,'selectorSha256':digest(r'C:\Users\charl\.agentopia\desktop\profile-location.json'),'profileBindingSha256':digest(target/'runtime-binding.json'),'updateJob':update['job'],'programRollbackVerified':True,'allowedOldVersions':['0.44.52','0.44.53','0.44.54'],'providerRequests':0}
(job/'eligible.json').write_text(json.dumps(receipt,indent=2))
print(json.dumps({'success':True,'sourceFiles':len(seal),'legacyFiles':len(expected),'programRollbackVerified':True}),flush=True)
