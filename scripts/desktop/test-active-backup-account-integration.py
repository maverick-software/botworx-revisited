"""Exercise the backup capture entry point with generated offline archives."""
from pathlib import Path
from contextlib import redirect_stdout
from unittest.mock import patch
import hashlib,io,json,shutil,sys,tempfile,unittest,uuid
sys.path.insert(0,str(Path(__file__).resolve().parent))
import capture_active_recovery as active
from archived_account_owners import capture_owners

class IntegrationTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory(prefix='agentopia-active-capture-test-');self.root=Path(self.temp.name);self.out=self.root/'backup';self.out.mkdir();self.profile=self.root/'home/.agentopia/desktop/profile';self.profile.mkdir(parents=True);self.installed=self.root/'resources';(self.installed/'resources/ui').mkdir(parents=True);(self.installed/'resources/ui/index.html').write_text('GENERATED UI');(self.installed/'resources/version.json').write_text('{}');(self.installed/'app.asar').write_bytes(b'GENERATED ARCHIVE');self.ids=[str(uuid.uuid4()),str(uuid.uuid4())];self.instance=str(uuid.uuid4())
        (self.profile.parent/'profile-location.json').write_text('GENERATED SELECTOR');(self.profile/'profile-migration.json').write_text('GENERATED MIGRATION')
        digest=lambda p:hashlib.sha256(p.read_bytes()).hexdigest();self.scope={'distribution':'AgentopiaRuntime-'+self.instance,'instanceId':self.instance,'locationSha256':digest(self.profile.parent/'profile-location.json'),'migrationReceiptSha256':digest(self.profile/'profile-migration.json'),'installedArchiveSha256':digest(self.installed/'app.asar')}
        self.config={'format':3,'distribution':self.scope['distribution'],'instanceId':self.instance,'scope':self.scope,'roots':{'ordinary':{'linux':str(self.profile)}},'profileLinux':str(self.profile),'installedResourcesLinux':str(self.installed)};(self.out/'intent.json').write_text(json.dumps(self.config));self.stops=0
    def tearDown(self):self.temp.cleanup()
    def runtime(self,out,config):
        directory=out/'current-database-backup';directory.mkdir();files=[]
        for name in ['auth.dump','application.dump','vault.dump','database.dump','pgsodium_root.key']:
            data=('GENERATED '+name).encode();(directory/name).write_bytes(data);files.append({'name':name,'sha256':hashlib.sha256(data).hexdigest()})
        (directory/'manifest.json').write_text(json.dumps({'format':1,'accounts':2,'files':files}));return {'success':True,'logicalBackupRoot':'ordinary'}
    def stop(self):self.stops+=1
    def execute(self,corrupt=False):
        original_read=Path.read_text
        def read(file,*args,**kwargs):
            if file.as_posix().endswith('/opt/agentopia/runtime-instance'):return self.instance
            if file.as_posix().endswith('/opt/agentopia/runtime-identity'):return 'local.agentopia.desktop-runtime.v1'
            return original_read(file,*args,**kwargs)
        def owners(database,output):
            if corrupt:(database/'auth.dump').write_bytes(b'CHANGED')
            sql='COPY auth.users (id) FROM stdin;\n'+'\n'.join(self.ids)+'\n\\.\n';return capture_owners(database,output,reader=lambda _:sql)
        with patch.object(active,'stopped',self.stop),patch.object(active,'runtime_capture',self.runtime),patch.object(active,'capture_owners',owners),patch.object(Path,'read_text',read),redirect_stdout(io.StringIO()):active.main(str(self.out))
    def test_capture_entry_point_writes_owners_from_the_copied_archives_before_success(self):
        self.execute();owners=json.loads((self.out/'public-recovery-owners.json').read_text());receipt=json.loads((self.out/'profile-capture.json').read_text());self.assertEqual(owners['accounts'],self.ids);self.assertEqual(receipt['archivedAccounts'],2);self.assertTrue(receipt['success']);self.assertGreaterEqual(self.stops,2);self.assertEqual(receipt['databaseServicesStarted'],0)
    def test_invalid_copied_archive_prevents_completion(self):
        with self.assertRaisesRegex(AssertionError,'Changed database archive'):self.execute(True)
        self.assertFalse((self.out/'profile-capture.json').exists());self.assertFalse((self.out/'public-recovery-owners.json').exists())
if __name__=='__main__':unittest.main()
