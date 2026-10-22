"""Capture the stopped published profile and its logical backup. No SQL startup."""
from pathlib import Path
import hashlib,json,os,shutil,sys
from phased_backup import runtime_capture,capture_profile_data,save,stopped
from archived_account_owners import capture_owners

def main(directory):
    os.umask(0o077)
    out=Path(directory);assert out.is_absolute() and out.resolve()==out and not out.is_symlink()
    config=json.loads((out/'intent.json').read_text(encoding='utf-8'));scope=config['scope']
    assert config['format']==3 and config['distribution']==scope['distribution'] and config['instanceId']==scope['instanceId']
    profile=Path(config['roots']['ordinary']['linux'])
    assert str(profile)==config['profileLinux'] and profile.name=='profile' and profile.parent.name=='desktop' and profile.parent.parent.name=='.agentopia'
    assert set(config['roots'])=={'ordinary'},'Capture the published current profile once'
    assert Path('/opt/agentopia/runtime-instance').read_text().strip()==scope['instanceId']
    assert Path('/opt/agentopia/runtime-identity').read_text().strip()=='local.agentopia.desktop-runtime.v1'
    stopped();runtime=runtime_capture(out,config);assert runtime['logicalBackupRoot']=='ordinary'
    owners=capture_owners(out/'current-database-backup',out/'public-recovery-owners.json')
    location=profile.parent/'profile-location.json';data=location.read_bytes()
    assert hashlib.sha256(data).hexdigest()==scope['locationSha256']
    assert hashlib.sha256((profile/'profile-migration.json').read_bytes()).hexdigest()==scope['migrationReceiptSha256']
    with (out/'profile-location.json').open('xb') as stream:stream.write(data)
    installed=Path(config['installedResourcesLinux']);archive=installed/'app.asar'
    assert hashlib.sha256(archive.read_bytes()).hexdigest()==scope['installedArchiveSha256']
    shutil.copyfile(archive,out/'baseline-app.asar');shutil.copytree(installed/'resources/ui',out/'baseline-ui')
    shutil.copyfile(installed/'resources/version.json',out/'baseline-version.json')
    stopped()
    receipt={'success':True,'runtime':runtime,'archivedAccounts':len(owners['accounts']),'activeProfile':str(profile),'profileCopyPending':True,'locationSha256':scope['locationSha256'],'providerRequests':0,'databaseServicesStarted':0,'historicalBackupsRetainedInPlace':True}
    save(out/'profile-capture.json',receipt);print(json.dumps(receipt))

if __name__=='__main__':
    assert len(sys.argv)==2
    main(sys.argv[1])
