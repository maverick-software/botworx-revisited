"""Stage a stopped fixed profile on the reserved local drive; never select it.

The source, selector and historical backups are retained. Every applicable
profile file, including historical recovery, is copied and byte-verified.
Publication still requires separate packaged encryption/history receipts.
"""
import argparse
import base64
import hashlib
import importlib.util
import json
import ntpath
import os
from pathlib import Path
import re
import subprocess
import sys
import uuid

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import activate_relocated_profile as activation

_spec = importlib.util.spec_from_file_location('relocated_profile_copier', HERE.parents[1]/'desktop/runtime/copy-desktop-profile.py')
copier = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(copier)


def require(value, message):
    if not value:
        raise ValueError(message)


def write_new(file, value):
    with Path(file).open('x', encoding='utf-8') as stream:
        json.dump(value, stream, sort_keys=True)
        stream.flush()
        os.fsync(stream.fileno())
    return activation.digest(file)


def protect_windows(directory):
    """Create a private ACL with only the current Windows owner and SYSTEM."""
    literal=str(directory).replace("'","''")
    script="""$ErrorActionPreference='Stop'
$taskFolder='"""+literal+"""'
$taskSid=[Security.Principal.WindowsIdentity]::GetCurrent().User
$taskSystem=[Security.Principal.SecurityIdentifier]::new('S-1-5-18')
$taskAcl=[Security.AccessControl.DirectorySecurity]::new()
$taskAcl.SetOwner($taskSid)
$taskAcl.SetAccessRuleProtection($true,$false)
foreach($taskPrincipal in @($taskSid,$taskSystem)){
 $taskRule=[Security.AccessControl.FileSystemAccessRule]::new($taskPrincipal,'FullControl','ContainerInherit,ObjectInherit','None','Allow')
 $taskAcl.AddAccessRule($taskRule)
}
Set-Acl -LiteralPath $taskFolder -AclObject $taskAcl
$taskRead=Get-Acl -LiteralPath $taskFolder
if(-not $taskRead.AreAccessRulesProtected){throw 'Private ACL is still inherited'}
$taskRules=@($taskRead.GetAccessRules($true,$true,[Security.Principal.SecurityIdentifier]))
if($taskRules.Count -ne 2){throw 'Unexpected private ACL entries'}
foreach($taskRule in $taskRules){
 if($taskRule.IdentityReference.Value -notin @($taskSid.Value,'S-1-5-18') -or $taskRule.AccessControlType -ne 'Allow' -or $taskRule.FileSystemRights -ne 'FullControl' -or $taskRule.IsInherited){throw 'Private ACL differs'}
}
if($taskRead.GetOwner([Security.Principal.SecurityIdentifier]).Value -ne $taskSid.Value){throw 'Private directory owner differs'}
Write-Output 'PRIVATE-STORAGE-VERIFIED'
"""
    executable='powershell.exe' if os.name=='nt' else '/mnt/c/Windows/System32/WindowsPowerShell/v1.0/powershell.exe'
    script="try {\n"+script+"\n} catch { [Console]::Error.WriteLine($_.Exception.Message); exit 1 }"
    environment={key:value for key,value in os.environ.items() if key.upper()!='PSMODULEPATH'}
    result=subprocess.run([executable,'-NoProfile','-NonInteractive','-EncodedCommand',base64.b64encode(script.encode('utf-16le')).decode()],text=True,capture_output=True,timeout=30,env=environment)
    require(result.returncode==0 and result.stdout.strip()=='PRIVATE-STORAGE-VERIFIED','Private destination permissions could not be verified: '+result.stderr.strip()[:1000])


def stage(plan, closed, repair, resume=False, protect=None):
    require(callable(protect), 'A verified private-directory protector is required.')
    require(plan.get('format') == 1, 'Unknown private relocation plan.')
    home, instance = plan['windowsHome'], plan['runtimeInstanceId']
    require(isinstance(home, str) and re.fullmatch(r'[a-zA-Z]:\\[^\x00-\x1f]+', home), 'Invalid Windows home.')
    require(isinstance(instance, str) and re.fullmatch(r'[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}', instance), 'Invalid private runtime identity.')
    source_windows = ntpath.join(home, '.agentopia', 'desktop', 'profile')
    require(activation.canonical(plan['source']) == activation.canonical(source_windows), 'The source must be this Windows home’s fixed private profile.')
    target_windows = plan['target']
    require(isinstance(target_windows, str) and re.fullmatch(r'F:\\Agentopia-Data\\profiles\\'+re.escape(instance)+r'\\profile', target_windows, re.I), 'The destination must be the reserved F-drive profile for this runtime.')
    installation = ntpath.join(home, 'AppData', 'Local', 'AgentopiaDesktop')
    require(re.fullmatch(r'\d+\.\d+\.\d+', plan['targetVersion']), 'Invalid application version.')
    installed = ntpath.join(installation, 'app-'+plan['targetVersion'], 'resources', 'app.asar')
    require(activation.canonical(installed) == activation.canonical(plan['installedArchive']), 'The installed application belongs to another Windows home.')
    archive = activation.regular(activation.physical(installed))
    require(activation.digest(archive) == plan['installedArchiveSha256'], 'The installed archive changed.')
    require(hashlib.sha256(activation.archive_member(archive, 'build/desktop-profile-location.js')).hexdigest() == plan['selectorSha256'], 'The installed profile reader is not qualified.')
    compatibility = activation.migration_compatibility(plan)
    require(compatibility.get('verifiedRelocatedProfile') is True and compatibility.get('fullBackendReady') is True, 'A complete packaged relocation workflow is required before staging.')
    source = activation.folder(source_windows)
    target = activation.physical(target_windows)
    out_windows = plan['out']
    require(isinstance(out_windows, str) and re.fullmatch(r'F:\\[^\x00-\x1f]+', out_windows, re.I), 'Staging evidence must remain on F:.')
    out = activation.physical(out_windows)
    for a, b in ((source, target), (source, out), (target, out)):
        require(a != b and a not in b.parents and b not in a.parents, 'Profiles and staging evidence must be separate.')
    # Reject redirected parents before creating any destination directory.
    for directory in (out, target):
        for parent in (directory, *directory.parents):
            if parent.exists() or parent.is_symlink():
                activation.folder(str(parent))
    closed()
    selector = source.parent/'profile-location.json'
    record = activation.checked_json(selector, plan['sourceLocationSha256'])
    require(set(record) == {'format','kind','installationRoot','profile','runtimeInstanceId','migrationSha256'}
            and record.get('format') == 1 and record.get('kind') == 'verified-profile-migration'
            and activation.canonical(record.get('installationRoot', '')) == activation.canonical(installation)
            and record.get('profile') == 'profile' and record.get('runtimeInstanceId') == instance
            and record.get('migrationSha256') == plan['priorMigrationSha256'], 'The original selector changed or belongs to another runtime.')
    require(activation.digest(activation.regular(source/'profile-migration.json')) == plan['priorMigrationSha256'], 'The original migration receipt changed.')
    binding = {'format':1, 'distribution':'AgentopiaRuntime-'+instance, 'instanceId':instance}
    require(json.loads(activation.regular(source/'runtime-binding.json').read_text()) == binding, 'The source runtime binding changed.')
    source_seal = activation.checked_json(activation.physical(plan['sourceSeal']), plan['sourceSealSha256'])
    require(activation.inventory(source) == source_seal, 'The stopped source changed after its recovery capture.')
    recovery = activation.checked_json(activation.physical(plan['backupEvidence']), plan['backupEvidenceSha256'])
    require(recovery.get('success') is True and recovery.get('sourceUnchanged') is True
            and recovery.get('fullRawProfileVerified') is True
            and activation.canonical(recovery.get('sourceProfile','')) == activation.canonical(source_windows)
            and recovery.get('runtimeInstanceId') == instance
            and recovery.get('sourceSealSha256') == plan['sourceSealSha256'], 'Fresh verified recovery for this stopped source is required.')
    require(activation.digest(activation.regular(activation.physical(recovery['rawProfileArchive']))) == recovery['rawProfileArchiveSha256'], 'The raw profile recovery archive changed.')
    independent = activation.checked_json(activation.physical(recovery['independentVerification']), recovery['independentVerificationSha256'])
    require(independent.get('success') is True and independent.get('portableDatabaseAndAllResourcesVerified') is True
            and independent.get('sourceProfileUnchanged') is True and independent.get('portableCapability') == 10,
            'Independent database, resource and profile verification is required.')
    lock = source.parent/'migration.lock'
    require(not lock.exists() and not lock.is_symlink(), 'Another profile migration is active or unfinished.')
    intent = {'format':1, 'plan':plan, 'sourceSealSha256':plan['sourceSealSha256']}
    intent_file = out/'staging-intent.json'
    if resume:
        require(target.is_dir() and intent_file.is_file(), 'There is no owned interrupted stage to resume.')
        require(json.loads(activation.regular(intent_file).read_text()) == intent, 'The interrupted stage belongs to a different plan or recovery.')
        require(not (out/'stage-evidence.json').exists(), 'Staging already completed; continue copied-profile validation.')
        require(not (out/'native-rebase-started.json').exists(), 'Native repair already started; inspect this stage instead of recopying it.')
    else:
        require(not target.exists() and not target.is_symlink() and not intent_file.exists(), 'A prior stage exists; preserve it before deciding whether to resume.')
        require(not target.parent.exists() or not any(target.parent.iterdir()), 'The destination parent already contains unrelated files.')
        require(not out.exists() or not any(out.iterdir()), 'Staging evidence needs its own empty directory.')
    out.mkdir(parents=True, exist_ok=True)
    target.parent.mkdir(parents=True, exist_ok=True)
    protect(out_windows)
    protect(ntpath.dirname(target_windows))
    if not resume:
        write_new(intent_file, intent)
    ownership = {'kind':'stage-private-profile-relocation', 'runtimeInstanceId':instance, 'token':str(uuid.uuid4())}
    with lock.open('x', encoding='utf-8') as stream:
        json.dump(ownership, stream)
        stream.flush()
        os.fsync(stream.fileno())
    try:
        closed()
        require(activation.digest(activation.regular(selector)) == plan['sourceLocationSha256'], 'The selector changed before copying.')
        require(activation.inventory(source) == source_seal, 'The source changed before copying.')
        copied = copier.copy_profile(source, target, out/'copy-state.json', resume=resume)
        closed()
        require(activation.inventory(source) == source_seal, 'The source changed during copying; retain both folders.')
        require(activation.inventory(target) == source_seal, 'The copied profile differs before native-history rebasing.')
        write_new(out/'native-rebase-started.json',{'source':source_windows,'target':target_windows,'copyStateSha256':activation.digest(out/'copy-state.json')})
        marker = target/'.agentopia-native-relocation.json'
        if marker.exists():
            write_new(out/'previous-native-relocation.json', json.loads(activation.regular(marker).read_text()))
        marker.write_text(json.dumps({'format':1,'codex':'0.163.0','sourceProfile':source_windows,'destinationProfile':target_windows,'state':'copied'}))
        native = repair(target_windows)
        require(native.get('success') is True, 'Copied native history rebasing failed; retain both profiles.')
        closed()
        require(activation.inventory(source) == source_seal, 'The original profile changed during native-history repair.')
        require(activation.digest(activation.regular(selector)) == plan['sourceLocationSha256'], 'The selector changed during staging.')
        copy_evidence = {'success':True,'source':source_windows,'destination':target_windows,'fileCount':copied['files'],
                         'bytes':copied['bytes'],'sourceComparedAgain':True,'historicalBackupsCopied':True,
                         'copyStateSha256':activation.digest(out/'copy-state.json'),'sourceSealSha256':plan['sourceSealSha256']}
        copy_sha = write_new(out/'copy-evidence.json', copy_evidence)
        target_seal_sha = write_new(out/'target-after-rebase-seal.json', activation.inventory(target))
        result = {'success':True,'phase':'staged-awaiting-packaged-encryption-and-native-read-verification','source':source_windows,
                  'target':target_windows,'runtimeInstanceId':instance,'filesCopied':copied['files'],'bytesCopied':copied['bytes'],
                  'historicalBackupsCopied':True,'privateStorageVerified':True,'sourceSeal':plan['sourceSeal'],'sourceSealSha256':plan['sourceSealSha256'],
                  'copyEvidence':ntpath.join(out_windows,'copy-evidence.json'),'copyEvidenceSha256':copy_sha,
                  'targetAfterRebaseSeal':ntpath.join(out_windows,'target-after-rebase-seal.json'),'targetAfterRebaseSealSha256':target_seal_sha,
                  'nativeRebase':native,'activated':False,'sourceRetained':True,'originalSelectorUnchanged':True,'providerRequests':0}
        write_new(out/'stage-evidence.json', result)
        return result
    finally:
        require(json.loads(activation.regular(lock).read_text()) == ownership, 'Migration lock ownership changed; the replacement was retained.')
        lock.unlink()


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('plan', type=Path)
    parser.add_argument('--resume', action='store_true')
    args = parser.parse_args()
    if os.name == 'nt':
        parser.exit(1, 'Run staging through the bound running WSL runtime for physical Windows paths.\n')
    try:
        plan = json.loads(activation.regular(args.plan).read_text(encoding='utf-8-sig'))
        home = subprocess.check_output(['/mnt/c/Windows/System32/WindowsPowerShell/v1.0/powershell.exe','-NoProfile','-NonInteractive','-Command',"[Environment]::GetFolderPath('UserProfile')"],text=True,timeout=15).strip()
        require(activation.canonical(home) == activation.canonical(plan['windowsHome']), 'The stage belongs to another Windows user.')
        def repair(target):
            resources = ntpath.join(ntpath.dirname(plan['installedArchive']),'resources')
            python = ntpath.join(resources,'script-runtimes/python-3.14.8/python.exe')
            script = ntpath.join(resources,'runtime/relocate-native-profile.py')
            require(activation.digest(activation.regular(activation.physical(python)))==plan['nativeRepairPythonSha256']
                    and activation.digest(activation.regular(activation.physical(script)))==plan['nativeRepairScriptSha256'],
                    'The installed native-history repair resources changed.')
            result = subprocess.run([str(activation.physical(python)),'-I','-B',script,target],text=True,capture_output=True,timeout=120)
            require(result.returncode == 0, 'Native rebase failed; the source remains unchanged.')
            return json.loads(result.stdout)
        result = stage(plan,activation.closed_windows,repair,resume=args.resume,protect=protect_windows)
        print(json.dumps({key:result[key] for key in ('success','phase','filesCopied','bytesCopied','historicalBackupsCopied','activated','sourceRetained')}))
    except (ValueError,OSError,KeyError,subprocess.SubprocessError) as error:
        parser.exit(1,'Private relocation staging stopped: '+str(error)+'\n')
