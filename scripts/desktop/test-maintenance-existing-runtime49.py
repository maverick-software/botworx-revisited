"""Exercise identity and encryption-key gates without touching a real runtime."""
from pathlib import Path
import importlib.util, json, tempfile, unittest

spec=importlib.util.spec_from_file_location('existing',Path(__file__).with_name('maintenance-existing-runtime49.py'))
existing=importlib.util.module_from_spec(spec);spec.loader.exec_module(existing)

class ExistingRuntimeTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory(prefix='runtime-guards-',dir='F:/Agentopia-Acceptance')
        self.root=Path(self.tmp.name)/'opt';self.home=Path(self.tmp.name)/'home';self.key='a'*64
        files={self.root/'runtime-instance':existing.INSTANCE,self.root/'runtime-identity':'local.agentopia.desktop-runtime.v1',self.root/'manage.py':'unchanged',
               self.home/'.supabase/stacks/abc/state.json':json.dumps({'identity':{'projectRoot':'/home/agentopia/app','stackName':'default','branchContext':'ordinary-workspace'},'credentials':{'postgresRootKey':self.key}}),
               self.home/'.supabase/stacks/abc/data/postgres/data/PG_VERSION':'17',self.home/'.supabase/stacks/abc/data/postgres/data/global/pg_control':'fixture',
               self.home/'.supabase/stacks/abc/data/postgres/pgsodium_root.key':self.key,
               self.home/'.config/agentopia/runtime-secrets.json':json.dumps({'root_key':self.key}),self.home/'app/supabase/config.toml':'[db]\nroot_key="'+self.key+'"\n',
               self.home/'.supabase/cache/stack/slim-services/postgres/17/linux-amd64/build/bin/pg_ctl':'fixture'}
        for file,text in files.items():file.parent.mkdir(parents=True,exist_ok=True);file.write_text(text)
    def tearDown(self):self.tmp.cleanup()
    def check(self):return existing.validated_existing(self.root,self.home)
    def test_existing_complete_identity(self):self.assertEqual(self.check()['encryptionRootBindingsVerified'],4)
    def test_wrong_runtime(self):
        (self.root/'runtime-instance').write_text('other')
        with self.assertRaises(AssertionError):self.check()
    def test_missing_database_control(self):
        (self.home/'.supabase/stacks/abc/data/postgres/data/global/pg_control').unlink()
        with self.assertRaises(AssertionError):self.check()
    def test_wrong_database_version(self):
        (self.home/'.supabase/stacks/abc/data/postgres/data/PG_VERSION').write_text('16')
        with self.assertRaises(AssertionError):self.check()
    def test_changed_encryption_binding(self):
        (self.home/'.config/agentopia/runtime-secrets.json').write_text(json.dumps({'root_key':'b'*64}))
        with self.assertRaises(AssertionError):self.check()
    def test_ambiguous_runtime(self):
        other=self.home/'.supabase/stacks/other/state.json';other.parent.mkdir();other.write_text('{}')
        with self.assertRaises(AssertionError):self.check()
    def test_all_core_services_required(self):
        state={'services':[{'service':s,'state':'running','health':'healthy'} for s in existing.REQUIRED]}
        self.assertTrue(existing.healthy(state));state['services'][0]['health']='unhealthy';self.assertFalse(existing.healthy(state))

if __name__=='__main__':unittest.main()
