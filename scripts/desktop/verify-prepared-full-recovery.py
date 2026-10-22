"""Independently compare prepared public files, SQL archives and saved native content."""
from pathlib import Path
import datetime,hashlib,json,sqlite3,sys
job=Path(sys.argv[1]);assert job.resolve().parent==Path('D:/Users/charl/AgentopiaQA/full-recovery').resolve()
load=lambda p:json.loads(Path(p).read_text(encoding='utf-8-sig'))
def sha(file):
 with Path(file).open('rb') as f:return hashlib.file_digest(f,'sha256').hexdigest()
e=load(job/'evidence.json');assert e['success'] and e['status']=='prepared' and not e['databaseImported'];bundle=Path(e['bundle']);descriptor=load(bundle/'desktop-recovery.json')
for row in [descriptor[k] for k in ['databaseManifest','profileArchive','profileManifest','publicArchive','publicManifest','references']]:assert sha(bundle/row['file'])==row['sha256']
profile=Path(e['profile']);home=Path(e['home']);public=home/'Agentopia Files';manifest=load(bundle/descriptor['publicManifest']['file'])['manifest']
assert {p.relative_to(public).as_posix() for p in public.rglob('*') if p.is_file()}==set(manifest['files'])
assert {p.relative_to(public).as_posix() for p in public.rglob('*') if p.is_dir()}==set(manifest['directories'])
for name,row in manifest['files'].items():assert sha(public/name)==row['sha256'] and (public/name).stat().st_size==row['bytes']
database=load(bundle/descriptor['databaseManifest']['file']);dbsource=(bundle/descriptor['databaseManifest']['file']).parent
for row in database['files']:assert sha(profile/'migration-input'/row['name'])==row['sha256']==sha(dbsource/row['name'])
assert sha(profile/'migration-input/manifest.json')==descriptor['databaseManifest']['sha256']
assert sha(profile/'restored-public-files.json')==descriptor['references']['sha256'] or load(profile/'restored-public-files.json')==load(bundle/descriptor['references']['file'])
assert not (profile/'credentials.bin').exists() and not (profile/'Local State').exists() and not list((profile/'codex').glob('*/*/*/auth.json')) and not list((profile/'codex').glob('*/*/*/config.toml'))
native=load(job/'native-read-qualification.json');index=load(job/'native-read-index.json');private=load(bundle/descriptor['profileManifest']['file'])['manifest'];assert native['success'] and native['threadReads']==154 and native['turnsStarted']==0 and not native['localRequests']
threads=0
for home_row in index['homes']:
 db=Path(home_row['directory'])/'state_5.sqlite';connection=sqlite3.connect(db.as_uri()+'?mode=ro',uri=True)
 try:
  assert connection.execute('PRAGMA integrity_check').fetchone()==('ok',)
  rows=connection.execute('SELECT id,rollout_path FROM threads ORDER BY id').fetchall();assert [r[0] for r in rows]==[r['id'] for r in home_row['threads']]
  for identifier,file in rows:
   target=Path(file);assert target.is_relative_to(db.parent);relative=target.relative_to(profile).as_posix();assert sha(target)==index['rollouts'][relative]==private['files'][relative]['sha256'];threads+=1
 finally:connection.close()
for name,row in private['files'].items():
 if name.startswith('workspaces/') or name.startswith('attachments/'):assert sha(profile/name)==row['sha256']
state=load(home/'.agentopia/recovery-state.json');assert state['status']=='prepared' and not state['databaseImported']
marker=load(profile/'.agentopia-recovery-operation.json');assert marker['operationId']==state['operationId'] and marker['descriptorSha256']==sha(bundle/'desktop-recovery.json')
receipt={'success':True,'at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'job':str(job),'databaseArchivesCompared':len(database['files']),'publicFilesCompared':len(manifest['files']),'publicDirectoriesCompared':len(manifest['directories']),'nativeHomesCompared':len(index['homes']),'nativeThreadsCompared':threads,'savedNativeRolloutsMatchOriginalArchive':True,'workspaceAndImageBytesPreserved':True,'originalWindowsCredentialsImported':False,'providerRequests':0,'productionChanged':False,'databaseImported':False,'fullApplicationRestoreProven':False}
with (job/'independent-verification.json').open('x',encoding='utf-8') as stream:json.dump(receipt,stream,indent=2)
print(json.dumps(receipt))
