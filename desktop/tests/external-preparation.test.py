import hashlib,json,unittest,uuid,importlib.util
from pathlib import Path
spec=importlib.util.spec_from_file_location('settings_fixture',Path(__file__).with_name('settings-preparation.test.py'));settings=importlib.util.module_from_spec(spec);spec.loader.exec_module(settings)
base=settings.base;recovery=settings.recovery
class ExternalPreparation(unittest.TestCase):
    save_clip=settings.SettingsPreparation.save_clip
    save_settings=settings.SettingsPreparation.save_settings
    tearDown=settings.SettingsPreparation.tearDown
    def setUp(self):
        settings.SettingsPreparation.setUp(self);c=self.case;self.external_id=str(uuid.uuid4());self.prefix='abcdef123456/'+c.owner+'/external-'+self.external_id+'/Project'
        self.payload={self.prefix+'/README.md':b'ORIGINAL EXTERNAL PROJECT',self.prefix+'/.git/HEAD':b'ref: refs/heads/main\n'};manifest=base.archive(c.bundle/'external.tar.gz',self.payload)
        self.external={'format':1,'kind':'agentopia-portable-external','sourceRoot':c.refs['index']['sourceRoot'],'sourceProfile':str(c.old),'databaseManifestSha256':recovery.digest(c.bundle/'database/manifest.json'),'accounts':[{'owner':c.owner,'references':[{'id':self.external_id,'name':'Project','kind':'folder','formerPath':str(c.root/'original-project'),'relativePath':self.prefix}]},{'owner':c.other,'references':[]}],'manifest':manifest,'archiveSha256':recovery.digest(c.bundle/'external.tar.gz')}
        c.descriptor['requiresDesktopRecoveryFormat']=5;self.save_external()
    def save_external(self):
        self.external['indexSha256']=hashlib.sha256(json.dumps({key:self.external[key] for key in ('format','kind','sourceRoot','sourceProfile','databaseManifestSha256','accounts','manifest','archiveSha256')},ensure_ascii=False,separators=(',',':')).encode()).hexdigest();base.write_json(self.case.bundle/'external.json',self.external)
        self.case.descriptor['externalArchive']={'file':'external.tar.gz','sha256':recovery.digest(self.case.bundle/'external.tar.gz')};self.case.descriptor['externalManifest']={'file':'external.json','sha256':recovery.digest(self.case.bundle/'external.json')};self.case.seal()
    def test_selected_folder_bytes_and_metadata_are_staged_without_original_path_or_database_access(self):
        c=self.case;result=c.prepare();self.assertFalse(result['databaseImported']);self.assertEqual(result['externalIndexSha256'],self.external['indexSha256']);self.assertFalse((c.root/'original-project').exists())
        for name,value in self.payload.items():self.assertEqual((c.home/'Agentopia Files'/name).read_bytes(),value)
        self.assertEqual(recovery.load(c.appdata/'Agentopia/restored-external.json'),self.external);self.assertEqual(c.prepare()['operationId'],result['operationId'])
    def test_interrupted_external_copy_resumes_same_owned_operation(self):
        c=self.case
        def stop(phase):
            if phase=='staging-external':raise RuntimeError('Generated external stop')
        with self.assertRaises(RuntimeError):c.prepare(phase_hook=stop)
        before=recovery.load(c.home/'.agentopia/recovery-state.json');after=c.prepare();self.assertEqual(before['operationId'],after['operationId']);self.assertEqual((c.home/'Agentopia Files'/next(iter(self.payload))).read_bytes(),next(iter(self.payload.values())))
    def test_corrupt_external_archive_is_refused_before_claiming_a_destination(self):
        c=self.case;(c.bundle/'external.tar.gz').write_bytes(b'CHANGED')
        with self.assertRaises(ValueError):c.prepare()
        self.assertFalse((c.home/'.agentopia').exists())
    def test_foreign_external_account_is_refused(self):
        self.external['accounts'][0]['references'][0]['relativePath']=self.prefix.replace(self.case.owner,self.case.other);self.save_external()
        with self.assertRaisesRegex(ValueError,'external attachment ownership'):self.case.prepare()
        self.assertFalse((self.case.home/'.agentopia').exists())
    def test_downgraded_or_missing_external_resources_cannot_be_silently_omitted(self):
        c=self.case;c.descriptor['requiresDesktopRecoveryFormat']=4;c.seal()
        with self.assertRaisesRegex(ValueError,'newer recovery capability'):c.prepare()
        c.descriptor['requiresDesktopRecoveryFormat']=5;del c.descriptor['externalManifest'];c.seal()
        with self.assertRaisesRegex(ValueError,'resources are required'):c.prepare()
        self.assertFalse((c.home/'.agentopia').exists())
    def test_unowned_archive_members_and_path_traversal_are_refused(self):
        self.payload['abcdef123456/'+self.case.other+'/unowned.txt']=b'UNOWNED';self.external['manifest']=base.archive(self.case.bundle/'external.tar.gz',self.payload);self.external['archiveSha256']=recovery.digest(self.case.bundle/'external.tar.gz');self.save_external()
        with self.assertRaisesRegex(ValueError,'Unowned external'):self.case.prepare()
        self.assertFalse((self.case.home/'.agentopia').exists())
    def test_modified_published_external_bytes_are_preserved_and_completion_is_refused(self):
        c=self.case
        def stop(phase):
            if phase=='verifying-published-files':raise RuntimeError('Generated external stop')
        with self.assertRaises(RuntimeError):c.prepare(phase_hook=stop)
        file=c.home/'Agentopia Files'/next(iter(self.payload));file.write_bytes(b'USER EDIT')
        with self.assertRaisesRegex(ValueError,'Published external bytes changed'):c.prepare()
        self.assertEqual(file.read_bytes(),b'USER EDIT')
    def test_edited_external_metadata_prevents_prepared_resume(self):
        c=self.case;c.prepare();file=c.appdata/'Agentopia/restored-external.json';changed=recovery.load(file);changed['accounts'][0]['references'][0]['formerPath']=str(c.root/'another-folder');base.write_json(file,changed)
        with self.assertRaisesRegex(ValueError,'Prepared external recovery changed'):c.prepare()
        self.assertEqual(recovery.load(file),changed)
if __name__=='__main__':unittest.main()
