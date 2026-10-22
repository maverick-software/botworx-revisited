"""Read the complete profile archive independently before update publication."""
from pathlib import Path, PurePosixPath
import hashlib,json,tarfile
root=Path('D:/Users/charl/software/Agentopia')
def load(file):return json.loads(Path(file).read_text(encoding='utf-8-sig'))
def digest(file):
    with Path(file).open('rb') as stream:return hashlib.file_digest(stream,'sha256').hexdigest()
pointer=load(root/'.supabase/desktop-recovery-bootstrap/candidate-current.json');proof=load(pointer['proof']);recovery=load(Path(proof['work'])/'recovery.json');out=Path(recovery['out'])
assert out.parent==Path('D:/Users/charl/AgentopiaRecovery/recovery-bootstrap-15') and out.resolve()==out
manifest=load(out/'private-profile.json');archive=out/'active-profile.tar.gz';expected=manifest['manifest'];files={};directories=set();seen=set()
assert recovery['success'] and manifest['success'] and digest(archive)==manifest['archiveSha256']==recovery['profileArchiveSha256']
with tarfile.open(archive,'r|gz') as tar:
    for member in tar:
        name=member.name.rstrip('/');parsed=PurePosixPath(name)
        assert name and str(parsed)==name and not parsed.is_absolute() and '..' not in parsed.parts and '\\' not in name and ':' not in name and name.lower() not in seen
        seen.add(name.lower())
        if member.isdir():assert name in expected['directories'];directories.add(name)
        else:
            assert member.isfile() and name in expected['files']
            with tar.extractfile(member) as stream:files[name]={'bytes':member.size,'sha256':hashlib.file_digest(stream,'sha256').hexdigest()}
assert files=={name:{'bytes':record['bytes'],'sha256':record['sha256']} for name,record in expected['files'].items()} and directories==set(expected['directories'])
assert len(files)==recovery['profileFiles'] and {'Local State','credentials.bin','runtime-binding.json','profile-migration.json'}<=set(files)
profile=Path(recovery['scope']['profile'])
for name,record in files.items():assert (profile/name).stat().st_size==record['bytes'] and digest(profile/name)==record['sha256']
logical=load(out/'current-database-backup/manifest.json');assert len(logical['files'])==5
for record in logical['files']:assert digest(out/'current-database-backup'/record['name'])==record['sha256']
data=load(recovery['dataComparison']);assert data['success'] and data['tableCount']==126 and not data['mismatches']
evidence={'success':True,'profileArchiveSha256':digest(archive),'files':len(files),'allArchiveMembersRead':True,'allSourceFilesCompared':True,'databaseArchives':5,'tablesCompared':126,'providerRequests':0}
with (out/'independent-profile-verification.json').open('x',encoding='utf-8') as stream:json.dump(evidence,stream,indent=2)
print(json.dumps(evidence))
