"""Real generated file copies on F:, with generated acceptance/recovery receipts.

No production account, runtime, selector or installation is accessed.
"""
import copy
import importlib.util
import json
from pathlib import Path
import shutil
import sys
import unittest
from unittest.mock import patch

HERE=Path(__file__).resolve().parent
sys.path.insert(0,str(HERE))
import stage_relocated_profile as staging

_spec=importlib.util.spec_from_file_location('activation_fixtures54',HERE/'test-activate-relocated-profile54.py')
fixtures=importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(fixtures)


class StagingTests(unittest.TestCase):
    def setUp(self):
        self.fixture=fixtures.ActivationTests()
        self.fixture.setUp()
        self.activation=fixtures.activation
        self.saved_activation=staging.activation
        staging.activation=self.activation
        self.root=self.fixture.root
        self.source=self.fixture.actual_source
        old_target=self.fixture.actual_target
        assert old_target.resolve().parent==self.root.resolve()
        shutil.rmtree(old_target)
        self.fixture.actual_target=self.root/'destination/profile'
        self.target=self.fixture.actual_target
        (self.source/'Local State').write_bytes(b'generated-encryption-context')
        (self.source/'backups'/'older').mkdir(parents=True)
        (self.source/'backups'/'older'/'database.dump').write_bytes(b'generated-recovery-to-preserve')
        (self.source/'empty').mkdir()
        (self.source/'Cache').mkdir()
        (self.source/'Cache'/'obsolete').write_bytes(b'rebuildable-cache')
        self.plan=copy.deepcopy(self.fixture.plan)
        self.plan['out']=str(self.root/'evidence')
        self.reseal_source()
        self.original_selector=self.fixture.location.read_bytes()
        self.repair_calls=0

    def tearDown(self):
        staging.activation=self.saved_activation
        self.fixture.tearDown()

    def reseal_source(self):
        self.fixture.save(Path(self.plan['sourceSeal']),self.activation.inventory(self.source))
        self.plan['sourceSealSha256']=self.activation.digest(self.plan['sourceSeal'])
        backup=Path(self.plan['backupEvidence'])
        record=json.loads(backup.read_text())
        record['sourceSealSha256']=self.plan['sourceSealSha256']
        self.fixture.save(backup,record)
        self.plan['backupEvidenceSha256']=self.activation.digest(backup)

    def repair(self,target):
        self.assertEqual(target,self.plan['target'])
        marker=json.loads((self.target/'.agentopia-native-relocation.json').read_text())
        self.assertEqual(self.activation.canonical(marker['sourceProfile']),self.activation.canonical(self.plan['source']))
        self.assertEqual(marker['destinationProfile'],target)
        self.repair_calls+=1
        return {'success':True,'generatedOnly':True,'homes':1,'threads':1}

    def protect(self,directory):
        import ntpath
        actual=self.target.parent if self.activation.canonical(directory)==self.activation.canonical(ntpath.dirname(self.plan['target'])) else self.activation.physical(directory)
        self.assertTrue(actual.is_dir() and actual.is_relative_to(self.root))

    def run_stage(self,**kwargs):
        return staging.stage(self.plan,self.fixture.closed,self.repair,protect=self.protect,**kwargs)

    def unchanged(self):
        self.assertEqual(self.activation.inventory(self.source),json.loads(Path(self.plan['sourceSeal']).read_text()))
        self.assertEqual(self.fixture.location.read_bytes(),self.original_selector)

    def test_full_copy_preserves_historical_recovery_and_empty_directories(self):
        result=self.run_stage()
        self.assertTrue(result['success'] and result['historicalBackupsCopied'] and result['sourceRetained'])
        self.assertFalse(result['activated'])
        self.assertEqual((self.target/'backups/older/database.dump').read_bytes(),b'generated-recovery-to-preserve')
        self.assertTrue((self.target/'empty').is_dir())
        self.assertFalse((self.target/'Cache').exists())
        self.assertFalse((self.fixture.location.parent/'migration.lock').exists())
        self.assertEqual(self.repair_calls,1)
        self.unchanged()

    def test_stage_then_separate_activation_accepts_the_sealed_copy(self):
        result=self.run_stage()
        for label,field in [('copyEvidence','copyEvidence'),('targetSeal','targetAfterRebaseSeal')]:
            self.plan[label]=result[field]
            self.plan[label+'Sha256']=result[field+'Sha256']
        activated=self.activation.activate(self.plan,self.fixture.closed,True)
        self.assertTrue(activated['published'] and activated['sourceRetained'])
        self.assertEqual(self.activation.inventory(self.source),json.loads(Path(self.plan['sourceSeal']).read_text()))
        self.assertEqual((self.target/'backups/older/database.dump').read_bytes(),b'generated-recovery-to-preserve')

    def test_changed_source_or_recovery_stops_before_copy(self):
        (self.source/'credentials.bin').write_bytes(b'newer-generated-session')
        with self.assertRaisesRegex(ValueError,'source changed'):self.run_stage()
        self.assertFalse(self.target.exists())
        self.assertEqual(self.fixture.location.read_bytes(),self.original_selector)

    def test_corrupted_raw_recovery_is_refused(self):
        record=json.loads(Path(self.plan['backupEvidence']).read_text())
        Path(record['rawProfileArchive']).write_bytes(b'changed')
        with self.assertRaisesRegex(ValueError,'archive changed'):self.run_stage()
        self.assertFalse(self.target.exists())
        self.unchanged()

    def test_foreign_target_home_or_image_never_creates_a_copy(self):
        for change in [{'target':r'F:\Public\profile'},{'source':self.plan['source'].replace('Generated','Another')},{'installedArchiveSha256':'0'*64}]:
            saved=self.plan
            self.plan={**saved,**change}
            with self.assertRaises((ValueError,OSError)):self.run_stage()
            self.plan=saved
        self.assertFalse(self.target.exists())
        self.unchanged()

    def test_incomplete_packaged_acceptance_is_refused(self):
        file=Path(self.plan['compatibilityEvidence'])
        record=json.loads(file.read_text());record['fullBackendReady']=False
        self.fixture.save(file,record);self.plan['compatibilityEvidenceSha256']=self.activation.digest(file)
        with self.assertRaisesRegex(ValueError,'complete packaged'):self.run_stage()
        self.assertFalse(self.target.exists())
        self.unchanged()

    def test_running_application_and_foreign_lock_are_refused(self):
        def busy():raise ValueError('application is still running')
        with self.assertRaisesRegex(ValueError,'still running'):staging.stage(self.plan,busy,self.repair,protect=self.protect)
        lock=self.fixture.location.parent/'migration.lock';lock.write_text('foreign operation')
        with self.assertRaisesRegex(ValueError,'migration'):self.run_stage()
        self.assertEqual(lock.read_text(),'foreign operation')
        self.assertFalse(self.target.exists())
        self.unchanged()

    def test_interrupted_copy_resumes_only_its_original_unchanged_plan(self):
        original=staging.copier.copy_one
        def fail(original_file,*args):
            if original_file.name=='Local State':raise OSError('generated interruption')
            return original(original_file,*args)
        with patch.object(staging.copier,'copy_one',fail):
            with self.assertRaisesRegex(OSError,'generated interruption'):self.run_stage()
        self.assertFalse((self.fixture.location.parent/'migration.lock').exists())
        self.unchanged()
        result=self.run_stage(resume=True)
        self.assertTrue(result['success'])
        self.assertEqual((self.target/'Local State').read_bytes(),b'generated-encryption-context')
        self.unchanged()

    def test_different_existing_destination_is_retained_for_inspection(self):
        self.target.mkdir(parents=True);(self.target/'credentials.bin').write_bytes(b'foreign-data')
        with self.assertRaisesRegex(ValueError,'prior stage'):self.run_stage()
        self.assertEqual((self.target/'credentials.bin').read_bytes(),b'foreign-data')
        self.unchanged()

    def test_native_repair_failure_never_selects_or_deletes_the_source(self):
        with self.assertRaisesRegex(ValueError,'rebasing failed'):
            staging.stage(self.plan,self.fixture.closed,lambda target:{'success':False},protect=self.protect)
        self.assertTrue(self.target.exists())
        self.assertFalse((Path(self.plan['out'])/'stage-evidence.json').exists())
        self.assertFalse((self.fixture.location.parent/'migration.lock').exists())
        self.unchanged()

    def test_source_change_during_copy_is_retained_and_reported(self):
        original=staging.copier.copy_profile
        def changed(*args,**kwargs):
            result=original(*args,**kwargs)
            (self.source/'credentials.bin').write_bytes(b'newer-work-during-copy')
            return result
        with patch.object(staging.copier,'copy_profile',changed):
            with self.assertRaisesRegex(ValueError,'source changed during copying'):self.run_stage()
        self.assertEqual((self.source/'credentials.bin').read_bytes(),b'newer-work-during-copy')
        self.assertEqual(self.fixture.location.read_bytes(),self.original_selector)
        self.assertTrue(self.target.exists())

    def test_replaced_migration_lock_is_never_removed(self):
        def repair(target):
            (self.fixture.location.parent/'migration.lock').write_text(json.dumps({'different':'owner'}))
            return {'success':True}
        with self.assertRaisesRegex(ValueError,'ownership changed'):
            staging.stage(self.plan,self.fixture.closed,repair,protect=self.protect)
        self.assertEqual(json.loads((self.fixture.location.parent/'migration.lock').read_text()),{'different':'owner'})
        self.unchanged()

    def test_actual_windows_acl_protects_generated_private_storage(self):
        folder=self.root/'actual-private-permissions'
        folder.mkdir()
        staging.protect_windows(str(folder))
        (folder/'retained.txt').write_text('generated only')
        self.assertEqual((folder/'retained.txt').read_text(),'generated only')

    def test_copy_uses_real_windows_private_permissions(self):
        import ntpath
        def real_protect(directory):
            actual=self.target.parent if self.activation.canonical(directory)==self.activation.canonical(ntpath.dirname(self.plan['target'])) else self.activation.physical(directory)
            self.assertTrue(actual.is_relative_to(self.root))
            staging.protect_windows(str(actual))
        result=staging.stage(self.plan,self.fixture.closed,self.repair,protect=real_protect)
        self.assertTrue(result['privateStorageVerified'])
        self.assertEqual((self.target/'credentials.bin').read_bytes(),b'generated-private-ciphertext')
        self.unchanged()

    def test_failed_permission_protection_stops_before_private_data_copy(self):
        def refused(directory):raise ValueError('generated ACL failure')
        with self.assertRaisesRegex(ValueError,'ACL failure'):
            staging.stage(self.plan,self.fixture.closed,self.repair,protect=refused)
        self.assertFalse(self.target.exists())
        self.assertFalse((Path(self.plan['out'])/'staging-intent.json').exists())
        self.unchanged()

    def test_unrelated_destination_parent_is_not_repermissioned(self):
        self.target.parent.mkdir(parents=True)
        (self.target.parent/'unrelated.txt').write_text('retain this')
        with self.assertRaisesRegex(ValueError,'unrelated files'):self.run_stage()
        self.assertEqual((self.target.parent/'unrelated.txt').read_text(),'retain this')
        self.assertFalse(self.target.exists())
        self.unchanged()

    def test_completed_or_repair_started_stage_cannot_be_recopied(self):
        with self.assertRaisesRegex(ValueError,'rebasing failed'):
            staging.stage(self.plan,self.fixture.closed,lambda target:{'success':False},protect=self.protect)
        with self.assertRaisesRegex(ValueError,'Native repair already started'):self.run_stage(resume=True)
        self.unchanged()

    def test_resume_refuses_a_changed_plan(self):
        def interrupted(*args,**kwargs):raise OSError('generated interruption')
        with patch.object(staging.copier,'copy_one',interrupted):
            with self.assertRaisesRegex(OSError,'generated interruption'):self.run_stage()
        self.plan['anotherOperation']='unrelated'
        with self.assertRaisesRegex(ValueError,'different plan'):self.run_stage(resume=True)
        self.unchanged()

    def test_unrelated_evidence_folder_is_not_repermissioned(self):
        folder=Path(self.plan['out']);folder.mkdir()
        (folder/'unrelated.txt').write_text('retain this too')
        with self.assertRaisesRegex(ValueError,'own empty directory'):self.run_stage()
        self.assertEqual((folder/'unrelated.txt').read_text(),'retain this too')
        self.assertFalse(self.target.exists())
        self.unchanged()


if __name__=='__main__':
    unittest.main()
