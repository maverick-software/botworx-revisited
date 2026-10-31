"""The real preparer with generated native history and portable image payloads."""
from pathlib import Path
import base64,importlib.util,json,shutil,unittest,uuid
spec=importlib.util.spec_from_file_location('base_recovery',Path(__file__).with_name('full-recovery-preparation.test.py'));base=importlib.util.module_from_spec(spec);spec.loader.exec_module(base)
recovery=base.recovery
class ClipboardPreparationTests(unittest.TestCase):
    def setUp(self):
        self.case=base.RecoveryTests('test_complete_staging_preserves_records_and_reauthorizes_host_credentials');self.case.setUp();c=self.case
        c.payload={name:data for name,data in c.payload.items() if not name.startswith('attachments/')};c.pm['manifest']=base.archive(c.bundle/'profile.tar.gz',c.payload);c.pm['archiveSha256']=recovery.digest(c.bundle/'profile.tar.gz');base.write_json(c.bundle/'profile.json',c.pm)
        database=recovery.load(c.bundle/'database/manifest.json');database['accountIds']=[c.owner,c.other];base.write_json(c.bundle/'database/manifest.json',database);c.pub['privateProfileArchiveSha256']=c.pm['archiveSha256'];c.pub['logicalManifestSha256']=recovery.digest(c.bundle/'database/manifest.json');base.write_json(c.bundle/'public.json',c.pub)
        self.id=str(uuid.uuid4());self.name=c.owner+'/'+self.id+'.image';self.png=base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=');manifest=base.archive(c.bundle/'clipboard.tar.gz',{self.name:self.png});self.clip={'format':1,'kind':'sylvana-portable-clipboard','accounts':[{'owner':c.owner,'references':[{'id':self.id,'name':'Pasted image 😀','bytes':len(self.png),'relativePath':self.name}]},{'owner':c.other,'references':[]}],'manifest':manifest,'archiveSha256':recovery.digest(c.bundle/'clipboard.tar.gz')};self.save_clip()
        for field in ['profileArchive','profileManifest','databaseManifest','publicManifest']:c.descriptor[field]['sha256']=recovery.digest(c.bundle/c.descriptor[field]['file'])
        c.descriptor['requiresDesktopRecoveryFormat']=3;c.descriptor['clipboardArchive']={'file':'clipboard.tar.gz','sha256':recovery.digest(c.bundle/'clipboard.tar.gz')};c.descriptor['clipboardManifest']={'file':'clipboard.json','sha256':recovery.digest(c.bundle/'clipboard.json')};c.seal()
    def tearDown(self):
        c=self.case;self.assertEqual(c.root.resolve().parent,base.QA.resolve());self.assertTrue(c.root.name.startswith('case-'));shutil.rmtree(c.root)
    def save_clip(self):
        self.clip['indexSha256']=base.sha(json.dumps({key:value for key,value in self.clip.items() if key!='indexSha256'},ensure_ascii=False,separators=(',',':')).encode());base.write_json(self.case.bundle/'clipboard.json',self.clip)
        if 'clipboardManifest' in self.case.descriptor:self.case.descriptor['clipboardManifest']['sha256']=recovery.digest(self.case.bundle/'clipboard.json');self.case.seal()
    def test_clipboard_payload_and_ids_are_prepared_before_database_import(self):
        c=self.case;result=c.prepare();profile=c.appdata/'Sylvana';self.assertEqual(result['status'],'prepared');self.assertFalse(result['databaseImported']);self.assertEqual(result['clipboardIndexSha256'],self.clip['indexSha256']);self.assertEqual((profile/'restored-clipboard'/self.name).read_bytes(),self.png);self.assertEqual(recovery.load(profile/'restored-clipboard-images.json'),self.clip);self.assertFalse((profile/'attachments').exists());self.assertEqual(c.prepare()['operationId'],result['operationId'])
    def test_twenty_mb_clipboard_payload_prepares_and_over_limit_metadata_is_rejected(self):
        c=self.case;self.png=self.png+bytes(20*1024**2-len(self.png));self.clip['manifest']=base.archive(c.bundle/'clipboard.tar.gz',{self.name:self.png});self.clip['archiveSha256']=recovery.digest(c.bundle/'clipboard.tar.gz');self.clip['accounts'][0]['references'][0]['bytes']=len(self.png);self.save_clip();c.descriptor['clipboardArchive']['sha256']=recovery.digest(c.bundle/'clipboard.tar.gz');c.seal()
        result=c.prepare();self.assertEqual(result['status'],'prepared');self.assertEqual((c.appdata/'Sylvana'/'restored-clipboard'/self.name).read_bytes(),self.png)
        self.clip['accounts'][0]['references'][0]['bytes']+=1
        self.clip['manifest']['files'][self.name]['bytes']+=1
        self.save_clip()
        with self.assertRaises(Exception):recovery.validate_clipboard(self.clip,{c.owner,c.other},{'accountIds':[c.owner,c.other]})
    def test_interruption_before_clipboard_copy_resumes_the_same_operation(self):
        c=self.case
        def stop(phase):
            if phase=='staging-clipboard':raise RuntimeError('Generated image interruption')
        with self.assertRaises(RuntimeError):c.prepare(phase_hook=stop)
        old=recovery.load(c.home/'.sylvana/recovery-state.json');self.assertEqual(old['status'],'interrupted');self.assertFalse((c.appdata/'Sylvana').exists());result=c.prepare();self.assertEqual(result['operationId'],old['operationId']);self.assertEqual((c.appdata/'Sylvana/restored-clipboard'/self.name).read_bytes(),self.png)
    def test_changed_clipboard_archive_is_refused_before_destination_claim(self):
        c=self.case;(c.bundle/'clipboard.tar.gz').write_bytes(b'CHANGED')
        with self.assertRaises(ValueError):c.prepare()
        self.assertFalse((c.home/'.sylvana').exists())
    def test_foreign_clipboard_paths_are_refused_before_destination_claim(self):
        c=self.case;self.clip['accounts'][0]['references'][0]['relativePath']=c.other+'/'+self.id+'.image';self.save_clip()
        with self.assertRaisesRegex(ValueError,'foreign clipboard'):c.prepare()
        self.assertFalse((c.home/'.sylvana').exists())
    def test_old_or_unknown_capabilities_cannot_silently_skip_images(self):
        c=self.case
        for capability in [2,4]:
            c.descriptor['requiresDesktopRecoveryFormat']=capability;c.seal()
            with self.assertRaises(ValueError):c.prepare()
        self.assertFalse((c.home/'.sylvana').exists())
    def test_extra_unowned_clipboard_files_are_refused(self):
        c=self.case;extra=c.owner+'/'+str(uuid.uuid4())+'.image';self.clip['manifest']=base.archive(c.bundle/'clipboard.tar.gz',{self.name:self.png,extra:self.png});self.clip['archiveSha256']=recovery.digest(c.bundle/'clipboard.tar.gz');c.descriptor['clipboardArchive']['sha256']=self.clip['archiveSha256'];self.save_clip()
        with self.assertRaisesRegex(ValueError,'unowned entries'):c.prepare()
        self.assertFalse((c.home/'.sylvana').exists())
    def test_metadata_changed_after_publication_remains_unmodified_and_prevents_completion(self):
        c=self.case
        def stop(phase):
            if phase=='rebasing-native-histories':raise RuntimeError('Generated publication interruption')
        with self.assertRaises(RuntimeError):c.prepare(phase_hook=stop)
        file=c.appdata/'Sylvana/restored-clipboard-images.json';data=recovery.load(file);data['accounts'][0]['references'][0]['name']='User inspection change';base.write_json(file,data)
        with self.assertRaisesRegex(ValueError,'clipboard recovery metadata changed'):c.prepare()
        self.assertEqual(recovery.load(file)['accounts'][0]['references'][0]['name'],'User inspection change');self.assertEqual(recovery.load(c.home/'.sylvana/recovery-state.json')['status'],'interrupted')
    def test_omitting_a_required_clipboard_resource_cannot_claim_a_destination(self):
        c=self.case;del c.descriptor['clipboardManifest'];c.seal()
        with self.assertRaises((KeyError,ValueError)):c.prepare()
        self.assertFalse((c.home/'.sylvana').exists())
if __name__=='__main__':unittest.main()
