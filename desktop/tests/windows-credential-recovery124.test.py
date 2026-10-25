from pathlib import Path
import importlib.util,json,os,shutil,tempfile,unittest
ROOT=Path(__file__).resolve().parents[2]
spec=importlib.util.spec_from_file_location('recovery124',ROOT/'desktop/runtime/prepare-desktop-recovery.py');recovery=importlib.util.module_from_spec(spec);spec.loader.exec_module(recovery)
class WindowsCheckpointTests(unittest.TestCase):
    def setUp(self):
        source=Path(json.loads(Path(os.environ['AGENTOPIA_WINDOWS_BACKUP_PROOF']).read_text())['destination'])
        parent=ROOT/'.supabase/desktop-full-recovery-tests';parent.mkdir(exist_ok=True)
        self.root=Path(tempfile.mkdtemp(prefix='windows124-',dir=parent));self.bundle=self.root/'bundle';shutil.copytree(source,self.bundle);self.home=self.root/'home';self.home.mkdir();self.appdata=self.home/'AppData/Roaming';self.profile=self.appdata/'Agentopia';self.manifest=json.loads((self.bundle/'windows-profile.json').read_text());self.sid=self.manifest['windowsSid']
    def prepare(self,**options):return recovery.prepare(self.bundle,self.home,self.appdata,[],headroom=0,windows_sid=self.sid,**options)
    def test_same_account_stages_exact_encrypted_bytes_and_key_binding(self):
        result=self.prepare();self.assertTrue(result['windowsCredentialsImported']);self.assertTrue(result['providerCredentialsImported']);self.assertFalse(result['providerReauthorizationRequired']);self.assertEqual((self.profile/'credentials.bin').read_bytes(),(self.bundle/'windows-profile/credentials.bin').read_bytes());self.assertEqual(self.prepare()['operationId'],result['operationId'])
    def test_another_account_retains_bundle_but_does_not_import_protected_files(self):
        result=recovery.prepare(self.bundle,self.home,self.appdata,[],headroom=0,windows_sid='S-1-5-21-123-456-789-1001');self.assertFalse(result['windowsCredentialsImported']);self.assertTrue(result['providerReauthorizationRequired']);self.assertFalse((self.profile/'credentials.bin').exists());self.assertFalse((self.profile/'Local State').exists());self.assertTrue((self.profile/'restored-settings.json').exists());self.assertTrue((self.bundle/'windows-profile/credentials.bin').exists())
    def test_changed_ciphertext_is_refused_before_claiming_the_destination(self):
        with (self.bundle/'windows-profile/credentials.bin').open('ab') as out:out.write(b'CHANGED')
        with self.assertRaises(ValueError):self.prepare()
        self.assertFalse((self.home/'.agentopia').exists())
    def test_resealed_foreign_database_owner_set_is_refused(self):
        self.manifest['accountIds']=['99999999-9999-4999-8999-999999999999'];file=self.bundle/'windows-profile.json';recovery.save(file,self.manifest);descriptor=json.loads((self.bundle/'desktop-recovery.json').read_text());descriptor['windowsProfileManifest']['sha256']=recovery.digest(file);recovery.save(self.bundle/'desktop-recovery.json',descriptor)
        with self.assertRaisesRegex(ValueError,'owners differ'):self.prepare()
        self.assertFalse((self.home/'.agentopia').exists())
    def test_interrupted_encrypted_staging_resumes_the_same_owned_operation(self):
        def stop(phase):
            if phase=='publishing-files':raise RuntimeError('Controlled encrypted recovery interruption124')
        with self.assertRaises(RuntimeError):self.prepare(phase_hook=stop)
        before=recovery.load(self.home/'.agentopia/recovery-state.json');result=self.prepare();self.assertEqual(result['operationId'],before['operationId']);self.assertTrue(result['windowsCredentialsImported'])
    def test_changed_interrupted_ciphertext_is_retained_and_refused(self):
        def stop(phase):
            if phase=='publishing-files':raise RuntimeError('Controlled encrypted recovery interruption124')
        with self.assertRaises(RuntimeError):self.prepare(phase_hook=stop)
        state=recovery.load(self.home/'.agentopia/recovery-state.json');file=Path(state['stage'])/'profile/credentials.bin';file.write_bytes(b'RETAIN THIS CHANGED COPY')
        with self.assertRaises(ValueError):self.prepare()
        self.assertEqual(file.read_bytes(),b'RETAIN THIS CHANGED COPY');self.assertFalse(self.profile.exists())
if __name__=='__main__':unittest.main()
