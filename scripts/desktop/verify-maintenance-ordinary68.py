"""Verify capability12 ordinary-profile recovery, including an empty schedule graph."""
from pathlib import Path
import hashlib, importlib.util, json, sys, tarfile

intent=Path(sys.argv[1]).resolve(strict=True);cfg=json.loads(intent.read_text(encoding='utf-8-sig'))
out=Path(cfg['out']).resolve(strict=True);assert out.is_relative_to(Path('F:/Agentopia/.supabase'))
receipt=json.loads((out/'maintenance-backup.json').read_text());raw=json.loads(Path(receipt['rawProfileRecovery']).read_text());expected=raw['manifest'];files={};directories=[];seen=set()
with tarfile.open(raw['destination'],'r|gz') as archive:
    for entry in archive:
        name=entry.name.rstrip('/');assert name not in seen and not name.startswith('/') and '..' not in name.split('/') and '\\' not in name;seen.add(name)
        if entry.isdir():assert name in expected['directories'];directories.append(name)
        else:
            assert entry.isfile() and name in expected['files'];stream=archive.extractfile(entry);digest=hashlib.file_digest(stream,'sha256').hexdigest();record=expected['files'][name];assert entry.size==record['bytes'] and digest==record['sha256'];files[name]=digest
assert set(files)==set(expected['files']) and sorted(directories)==sorted(expected['directories'])
with Path(raw['destination']).open('rb') as stream:assert hashlib.file_digest(stream,'sha256').hexdigest()==raw['archiveSha256']
spec=importlib.util.spec_from_file_location('ordinary_recovery',Path(cfg['assets'])/'runtime/prepare-desktop-recovery.py');module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
bundle=module.validate_bundle(Path(receipt['destination']));descriptor=bundle['descriptor'];assert descriptor['requiresDesktopRecoveryFormat']==12
workspace=bundle['workspace'];assert workspace and workspace['kind']=='agentopia-portable-workspaces';owners=set(bundle['database']['accountIds'])
assert {row['owner'] for row in workspace['records']['accounts']}==owners
assert all(row['owner'] in owners for row in workspace['nodes']+workspace['captures']+workspace.get('references',[]))
assert cfg['scope']=='application-update' and descriptor['backupScope']=='application-update'
entry=descriptor['applicationUpdateScope'];assert entry['file']=='application-update-scope.json';location=Path(receipt['destination'])/entry['file'];assert hashlib.sha256(location.read_bytes()).hexdigest()==entry['sha256']
declared=json.loads(location.read_text());assert declared['scope']=='application-update' and declared['sourceProfile']==cfg['sourceProfile'] and declared['publicRoot']==cfg['sourcePublicRoot']
assert declared['externalContentsCaptured'] is False and declared['externalPathsModified'] is False and declared['fullWorkspaceExport'] is False
external=json.loads((Path(receipt['destination'])/'external-files.json').read_text());assert all(not row['references'] for row in external['accounts']) and not external['manifest']['files']
assert len(declared['externalReferences'])==receipt['externalReferencesPreservedInPlace']
assert all(row['owner'] in owners and Path(row['reference']['path']).is_absolute() for row in declared['externalReferences'])
report={'success':True,'rawProfileFiles':len(files),'portableCapability':12,'portableDatabaseAndAllResourcesVerified':True,'workspaceNodes':len(workspace['nodes']),'workspaceReferences':len(workspace.get('references',[])),'scope':'application-update','externalReferencesRetainedInPlace':len(declared['externalReferences']),'sourceProfileUnchanged':receipt['sourceUnchanged'],'providerRequests':0}
(out/'ordinary-independent-verification.json').write_text(json.dumps(report,indent=2));print(json.dumps(report),flush=True)
