"""Read both physical Windows profile stores through DrvFS; never start Supabase."""
import glob, hashlib, json, os, stat, sys, tempfile, uuid
from pathlib import Path

os.umask(0o077)
out=Path(sys.argv[1]).resolve()
assert out.parent==Path('/mnt/d/Users/charl/software/Agentopia/.supabase/desktop-installed-0448')
assert out.name.startswith('physical-backup-')
cfg=json.loads((out/'intent.json').read_text())
assert Path('/opt/agentopia/runtime-instance').read_text().strip()==cfg['instanceId']
def services_stopped():
    assert not any(Path(name).read_text().strip()=='postgres' for name in glob.glob('/proc/[0-9]*/comm')), 'PostgreSQL must remain stopped.'
def digest(file):
    h=hashlib.sha256()
    with file.open('rb') as stream:
        for part in iter(lambda:stream.read(8*1024*1024),b''):h.update(part)
    return h.hexdigest()
def inventory(root,excluded,destination=None):
    result={}
    assert not root.is_symlink() and root.resolve()==root
    flags=os.O_RDONLY|os.O_NOFOLLOW
    def walk(fd,parts):
        if destination is not None:(destination/Path(*parts)).mkdir(parents=True,exist_ok=True)
        with os.scandir(fd) as entries:
            for entry in entries:
                relative='/'.join((*parts,entry.name))
                if relative==excluded:continue
                info=entry.stat(follow_symlinks=False)
                assert not stat.S_ISLNK(info.st_mode),'Linked profile entry needs inspection.'
                if stat.S_ISDIR(info.st_mode):
                    child=os.open(entry.name,flags|os.O_DIRECTORY,dir_fd=fd)
                    try:walk(child,(*parts,entry.name))
                    finally:os.close(child)
                else:
                    assert stat.S_ISREG(info.st_mode),'Unsupported profile entry needs inspection.'
                    h=hashlib.sha256()
                    with os.fdopen(os.open(entry.name,flags,dir_fd=fd),'rb') as source:
                        actual=os.fstat(source.fileno())
                        assert (actual.st_dev,actual.st_ino)==(info.st_dev,info.st_ino)
                        target_file=destination/relative if destination is not None else None
                        existing=target_file is not None and target_file.exists()
                        if existing:assert target_file.is_file() and not target_file.is_symlink()
                        staging=None
                        if target_file is not None and not existing:
                            staging_dir=destination.parent/('staging-'+destination.name)
                            staging_dir.mkdir(exist_ok=True);assert not staging_dir.is_symlink()
                            staging=staging_dir/uuid.uuid4().hex
                        target=staging.open('xb') if staging is not None else None
                        try:
                            for chunk in iter(lambda:source.read(8*1024*1024),b''):
                                h.update(chunk)
                                if target is not None:target.write(chunk)
                        finally:
                            if target is not None:target.close()
                    value=h.digest()
                    if existing:
                        if target_file.stat().st_size!=info.st_size or bytes.fromhex(digest(target_file))!=value:
                            preserved=destination.parent/('replaced-'+destination.name)
                            preserved.mkdir(exist_ok=True);assert not preserved.is_symlink()
                            kept=preserved/uuid.uuid4().hex
                            target_file.rename(kept)
                            h2=hashlib.sha256()
                            staging_dir=destination.parent/('staging-'+destination.name)
                            staging_dir.mkdir(exist_ok=True);assert not staging_dir.is_symlink()
                            staging=staging_dir/uuid.uuid4().hex
                            with os.fdopen(os.open(entry.name,flags,dir_fd=fd),'rb') as source,staging.open('xb') as target:
                                for chunk in iter(lambda:source.read(8*1024*1024),b''):
                                    h2.update(chunk);target.write(chunk)
                            assert h2.digest()==value,'Source changed during resumed copy: '+relative
                            staging.rename(target_file)
                    elif staging is not None:
                        assert not target_file.exists()
                        staging.rename(target_file)
                    result[relative]={'bytes':info.st_size,'sha256':value}
                    if len(result)%100==0:
                        (out/'copy-progress.json').write_text(json.dumps({'root':str(root),'copying':destination is not None,'files':len(result)}))
    fd=os.open(root,flags|os.O_DIRECTORY)
    try:walk(fd,())
    finally:os.close(fd)
    for item in result.values():item['sha256']=item['sha256'].hex()
    return dict(sorted(result.items()))
evidence={'success':False,'providerRequests':0,'databaseServicesStarted':0,'checks':[]}
try:
    services_stopped()
    # Exercise the same traversal against regular files and an escaping link.
    with tempfile.TemporaryDirectory(prefix='agentopia-backup-walk-') as temp:
        test=Path(temp);source=test/'source';source.mkdir();(source/'nested').mkdir()
        (source/'nested/sample.txt').write_text('Owned traversal verification.')
        copied=inventory(source,None,test/'copy');assert inventory(source,None)==copied
        assert inventory(test/'copy',None)==copied
        (test/'copy/nested/sample.txt').write_text('Partial earlier copy.')
        assert inventory(source,None,test/'copy')==copied
        assert inventory(test/'copy',None)==copied
        assert any(file.read_text()=='Partial earlier copy.' for file in (test/'replaced-copy').iterdir())
        (source/'escape').symlink_to('/etc')
        try:inventory(source,None)
        except AssertionError:pass
        else:raise AssertionError('An escaping link was accepted.')
    evidence['checks'].append('Directory-handle traversal preserves regular files, repairs a partial staging copy while retaining it, and refuses escaping links.')
    manifests={}
    for label in ('ordinary','overlay'):
        root=Path(cfg['roots'][label]['linux']).resolve()
        assert root.is_dir() and root.name=='Agentopia'
        excluded='wsl/ext4.vhdx' if label=='ordinary' else None
        destination=out/label
        if destination.exists():assert destination.is_dir() and not destination.is_symlink()
        else:destination.mkdir()
        before=inventory(root,excluded,destination)
        assert inventory(destination,None)==before
        assert inventory(root,excluded)==before
        manifests[label]=before
        evidence['checks'].append(label+' physical profile files match the source before and after copying.')
        print('PASS: '+evidence['checks'][-1],flush=True)
    for name in ('Local State','credentials.bin','runtime-binding.json'):
        assert name in manifests['ordinary']
    backup=out/'ordinary/backups'/cfg['backupName']
    manifest=json.loads((backup/'manifest.json').read_text())
    for item in manifest['files']:
        assert Path(item['name']).name==item['name'] and digest(backup/item['name'])==item['sha256']
    evidence['databaseBackupFiles']=[item['name'] for item in manifest['files']]
    assert {'auth.dump','application.dump','database.dump','vault.dump','pgsodium_root.key'}<=set(evidence['databaseBackupFiles'])
    critical={}
    for pattern in ('/opt/agentopia/runtime-identity','/opt/agentopia/runtime-instance',
        '/home/agentopia/.config/agentopia/runtime-secrets.json',
        '/home/agentopia/.supabase/stacks/*/data/*/PG_VERSION',
        '/home/agentopia/.supabase/stacks/*/data/*/global/pg_control',
        '/home/agentopia/.supabase/stacks/*/data/*/pgsodium_root.key'):
        for file in glob.glob(pattern):
            if Path(file).is_file():critical[file]=digest(Path(file))
    assert len(critical)>=6
    services_stopped()
    (out/'private-file-manifest.json').write_text(json.dumps(manifests,indent=2))
    (out/'private-runtime-files.json').write_text(json.dumps(critical,indent=2))
    evidence.update(success=True,files={key:len(value) for key,value in manifests.items()},
        bytes={key:sum(item['bytes'] for item in value.values()) for key,value in manifests.items()},
        fingerprints={key:hashlib.sha256(json.dumps(value,sort_keys=True,separators=(',',':')).encode()).hexdigest() for key,value in manifests.items()},
        nativeImageExcluded='ordinary/wsl/ext4.vhdx; exported separately through the registered WSL instance',
        nativeRuntimeFiles=len(critical))
except Exception as error:evidence['error']=str(error)
(out/'files-evidence.json').write_text(json.dumps(evidence,indent=2))
print(json.dumps(evidence,indent=2));sys.exit(0 if evidence['success'] else 1)
