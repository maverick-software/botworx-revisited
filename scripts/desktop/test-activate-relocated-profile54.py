"""Generated F-drive fixtures only; no real Windows profile or runtime changes."""
import copy
import hashlib
import importlib.util
import json
import ntpath
from pathlib import Path
import struct
import tempfile
import unittest
from unittest.mock import patch

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('relocated', HERE/'activate_relocated_profile.py')
activation = importlib.util.module_from_spec(spec)
spec.loader.exec_module(activation)


class ActivationTests(unittest.TestCase):
    def setUp(self):
        parent = Path('F:/Agentopia-Acceptance/relocated-activation54')
        parent.mkdir(parents=True, exist_ok=True)
        self.temp = tempfile.TemporaryDirectory(dir=parent)
        self.root = Path(self.temp.name)
        self.home = r'C:\Users\Generated'
        self.instance = '12345678-1234-4123-8123-123456789abc'
        self.source = ntpath.join(self.home, '.agentopia/desktop/profile')
        self.target = 'F:\\Agentopia-Data\\profiles\\'+self.instance+'\\profile'
        self.actual_home = self.root/'home'
        self.actual_source = self.actual_home/'.agentopia/desktop/profile'
        self.actual_target = self.root/'target'
        self.original_physical = activation.physical
        def physical(value):
            normalized = ntpath.normcase(ntpath.normpath(value))
            for logical, actual in [(self.home, self.actual_home), (self.target, self.actual_target)]:
                base = ntpath.normcase(logical)
                if normalized == base or normalized.startswith(base+'\\'):
                    relative = ntpath.relpath(value, logical)
                    return actual if relative == '.' else actual.joinpath(*relative.replace('/', '\\').split('\\'))
            return Path(value)
        activation.physical = physical
        for directory in (self.actual_source, self.actual_target):
            directory.mkdir(parents=True)
            (directory/'credentials.bin').write_bytes(b'generated-private-ciphertext')
            self.save(directory/'runtime-binding.json', {'format':1, 'distribution':'AgentopiaRuntime-'+self.instance, 'instanceId':self.instance})
            self.save(directory/'profile-migration.json', {'format':1, 'status':'complete', 'files':3, 'copyManifestSha256':'a'*64, 'encryptedStorageVerified':True, 'nativeHistoryVerified':True})
        installation = ntpath.join(self.home, 'AppData/Local/AgentopiaDesktop')
        self.location = self.actual_source.parent/'profile-location.json'
        prior = activation.digest(self.actual_source/'profile-migration.json')
        self.save(self.location, {'format':1,'kind':'verified-profile-migration','installationRoot':installation,'profile':'profile','runtimeInstanceId':self.instance,'migrationSha256':prior})
        installed = ntpath.join(installation,'app-0.44.54/resources/app.asar')
        archive = physical(installed)
        archive.parent.mkdir(parents=True)
        selector = b'generated-qualified-relocation-reader'
        header=json.dumps({'files':{'build':{'files':{'desktop-profile-location.js':{'size':len(selector),'offset':'0'}}}}}).encode()
        padding=b'\0'*((-len(header))%4);length=8+len(header)+len(padding)
        archive.write_bytes(struct.pack('<IIII',4,length,length-4,len(header))+header+padding+selector)
        self.plan={'format':1,'windowsHome':self.home,'source':self.source,'target':self.target,'runtimeInstanceId':self.instance,'targetVersion':'0.44.54','installedArchive':installed,'installedArchiveSha256':activation.digest(archive),'selectorSha256':hashlib.sha256(selector).hexdigest(),'priorMigrationSha256':prior,'sourceLocationSha256':activation.digest(self.location)}
        receipts={
            'compatibilityEvidence':{'success':True,'version':'0.44.54','imageSha256':self.plan['installedArchiveSha256'],'legacyAbsoluteLinksCompatible':True,'closedPaneFailureVisible':True,'coldRecovery':True,'verifiedRelocatedProfile':True,'fullBackendReady':True,'productionProfileChanged':False,'realProviderRequests':0},
            'copyEvidence':{'success':True,'sourceComparedAgain':True,'source':self.source,'destination':self.target,'fileCount':3},
            'encryptedEvidence':{'success':True,'profile':self.target,'imageSha256':self.plan['installedArchiveSha256'],'realProviderRequests':0,'credentialsDecrypted':True,'actualPackagedVersionObserved':True},
            'nativeEvidence':{'success':True,'profile':self.target,'imageSha256':self.plan['installedArchiveSha256'],'realProviderRequests':0,'savedRolloutsUnchanged':True,'expectedThreads':1,'threadReads':1,'turnsStarted':0},
            'sourceSeal':activation.inventory(self.actual_source), 'targetSeal':activation.inventory(self.actual_target)}
        for label, data in receipts.items():
            file=self.root/(label+'.json');self.save(file,data);self.plan[label]=str(file);self.plan[label+'Sha256']=activation.digest(file)
        archive_recovery=self.root/'generated-recovery.tar.gz';archive_recovery.write_bytes(b'generated archive for activation gate fixtures')
        independent=self.root/'independent-recovery.json';self.save(independent,{'success':True,'portableDatabaseAndAllResourcesVerified':True,'sourceProfileUnchanged':True,'portableCapability':10})
        backup=self.root/'backup.json';self.save(backup,{'success':True,'sourceUnchanged':True,'fullRawProfileVerified':True,'sourceProfile':self.source,'runtimeInstanceId':self.instance,'sourceSealSha256':self.plan['sourceSealSha256'],'rawProfileArchive':str(archive_recovery),'rawProfileArchiveSha256':activation.digest(archive_recovery),'independentVerification':str(independent),'independentVerificationSha256':activation.digest(independent)})
        self.plan['backupEvidence']=str(backup);self.plan['backupEvidenceSha256']=activation.digest(backup)
        self.before_source = activation.inventory(self.actual_source)
        self.before_location = self.location.read_bytes()
        self.closed_calls=0

    def tearDown(self):
        activation.physical=self.original_physical
        self.assertEqual(self.root.resolve().parent,Path('F:/Agentopia-Acceptance/relocated-activation54').resolve())
        self.temp.cleanup()

    @staticmethod
    def save(file,data):
        file.write_text(json.dumps(data,sort_keys=True))

    def closed(self):
        self.closed_calls+=1

    def run_activation(self,publish=False):
        return activation.activate(self.plan,self.closed,publish)

    def mutate(self,label,changes,reseal=True):
        file=Path(self.plan[label]);data=json.loads(file.read_text());data.update(changes);self.save(file,data)
        if reseal:self.plan[label+'Sha256']=activation.digest(file)

    def test_check_only_never_publishes(self):
        result=self.run_activation();self.assertFalse(result['published']);self.assertEqual(self.location.read_bytes(),self.before_location);self.assertEqual(activation.inventory(self.actual_source),self.before_source)

    def test_publish_preserves_source_and_binds_receipt(self):
        result=self.run_activation(True);record=json.loads(self.location.read_text());receipt=self.actual_target/'profile-migration.json'
        self.assertTrue(result['published']);self.assertTrue(result['sourceRetained']);self.assertFalse(result['sourceDataDeleted']);self.assertEqual(record['format'],2);self.assertEqual(record['profile'],self.target);self.assertEqual(record['migrationSha256'],activation.digest(receipt));self.assertEqual(activation.inventory(self.actual_source),self.before_source);self.assertFalse((self.location.parent/'migration.lock').exists());self.assertGreaterEqual(self.closed_calls,2)

    def test_foreign_destination_and_runtime_are_refused(self):
        for patch_value in [{'target':r'F:\Public\profile'},{'target':self.target.replace(self.instance,'22345678-1234-4123-8123-123456789abc')},{'source':self.source.replace('Generated','Other')},{'runtimeInstanceId':'bad'}]:
            original=copy.deepcopy(self.plan);self.plan.update(patch_value)
            with self.assertRaises((ValueError,OSError)):self.run_activation(True)
            self.plan=original
        self.assertEqual(self.location.read_bytes(),self.before_location)

    def test_running_application_stops_before_writes(self):
        def busy():raise ValueError('owned application still running')
        with self.assertRaisesRegex(ValueError,'still running'):activation.activate(self.plan,busy,True)
        self.assertEqual(self.location.read_bytes(),self.before_location)

    def test_existing_lock_is_retained(self):
        lock=self.location.parent/'migration.lock';lock.write_text('another operation')
        with self.assertRaisesRegex(ValueError,'migration'):self.run_activation(True)
        self.assertEqual(lock.read_text(),'another operation');self.assertEqual(self.location.read_bytes(),self.before_location)

    def test_a_replaced_lock_is_retained(self):
        lock=self.location.parent/'migration.lock'
        def replaced():
            self.closed_calls+=1
            if self.closed_calls==2:
                self.save(lock,{'owner':'replacement'})
                raise ValueError('generated ownership change')
        with self.assertRaisesRegex(ValueError,'ownership changed'):
            activation.activate(self.plan,replaced,True)
        self.assertEqual(json.loads(lock.read_text()),{'owner':'replacement'});self.assertEqual(self.location.read_bytes(),self.before_location)

    def test_source_or_target_mutation_is_refused(self):
        for directory in [self.actual_source,self.actual_target]:
            file=directory/'credentials.bin';old=file.read_bytes();file.write_bytes(b'changed')
            with self.assertRaisesRegex(ValueError,'changed'):self.run_activation(True)
            file.write_bytes(old)

    def test_missing_complete_packaged_workflow_is_refused(self):
        for field in ['legacyAbsoluteLinksCompatible','closedPaneFailureVisible','coldRecovery','verifiedRelocatedProfile','fullBackendReady']:
            self.mutate('compatibilityEvidence',{field:False})
            with self.assertRaises(ValueError):self.run_activation(True)
            self.mutate('compatibilityEvidence',{field:True})

    def test_source_only_encryption_proof_is_refused(self):
        self.mutate('encryptedEvidence',{'actualPackagedVersionObserved':False})
        with self.assertRaisesRegex(ValueError,'Packaged Windows encryption'):self.run_activation(True)

    def test_stale_or_incomplete_recovery_is_refused(self):
        for changes in [{'sourceUnchanged':False},{'fullRawProfileVerified':False},{'sourceSealSha256':'0'*64},{'runtimeInstanceId':'22345678-1234-4123-8123-123456789abc'}]:
            original=Path(self.plan['backupEvidence']).read_bytes();old_hash=self.plan['backupEvidenceSha256'];self.mutate('backupEvidence',changes)
            with self.assertRaisesRegex(ValueError,'Fresh verified recovery'):self.run_activation(True)
            Path(self.plan['backupEvidence']).write_bytes(original);self.plan['backupEvidenceSha256']=old_hash

    def test_foreign_profile_receipt_is_refused(self):
        self.mutate('encryptedEvidence',{'profile':self.target.replace('F:','G:')})
        with self.assertRaisesRegex(ValueError,'another image/profile'):self.run_activation(True)

    def test_incomplete_history_or_started_inference_is_refused(self):
        for changes in [{'threadReads':0},{'savedRolloutsUnchanged':False},{'turnsStarted':1},{'realProviderRequests':1}]:
            original=Path(self.plan['nativeEvidence']).read_bytes();old_hash=self.plan['nativeEvidenceSha256'];self.mutate('nativeEvidence',changes)
            with self.assertRaises(ValueError):self.run_activation(True)
            Path(self.plan['nativeEvidence']).write_bytes(original);self.plan['nativeEvidenceSha256']=old_hash

    def test_changed_receipt_without_matching_hash_is_refused(self):
        self.mutate('copyEvidence',{'fileCount':4},False)
        with self.assertRaisesRegex(ValueError,'receipt changed'):self.run_activation(True)

    def test_installed_image_or_selector_mismatch_is_refused(self):
        for field in ['installedArchiveSha256','selectorSha256','sourceLocationSha256']:
            old=self.plan[field];self.plan[field]='0'*64
            with self.assertRaises(ValueError):self.run_activation(True)
            self.plan[field]=old

    def test_selector_publication_failure_keeps_original_profile_usable(self):
        original=activation.write_atomic
        def fail_location(file,data):
            if file==self.location:raise OSError('generated publication failure')
            return original(file,data)
        with patch.object(activation,'write_atomic',fail_location):
            with self.assertRaisesRegex(OSError,'publication failure'):self.run_activation(True)
        self.assertEqual(self.location.read_bytes(),self.before_location);self.assertEqual(activation.inventory(self.actual_source),self.before_source);self.assertFalse((self.location.parent/'migration.lock').exists())


if __name__=='__main__':unittest.main()
