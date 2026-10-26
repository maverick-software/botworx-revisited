import importlib.util,json,tempfile,unittest
from pathlib import Path
from types import SimpleNamespace
source=Path(__file__).parents[1]/'runtime/database_state.py'
spec=importlib.util.spec_from_file_location('database_state',source);module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
INSTANCE='11111111-1111-4111-8111-111111111111'
class ExistingRecovery(unittest.TestCase):
 def fixture(self,base):
  home=base/'home';root=base/'root';data=home/'.supabase/stacks'/('a'*64)/'data/service/data';data.mkdir(parents=True);root.mkdir()
  (data/'global').mkdir();(data/'PG_VERSION').write_text('17');(data/'global/pg_control').write_bytes(b'existing')
  key='a'*64;(data.parent/'pgsodium_root.key').write_text(key)
  state={'identity':{'projectRoot':'/home/agentopia/app','stackName':'default','branchContext':'ordinary-workspace'},'credentials':{'postgresRootKey':key}}
  (data.parents[2]/'state.json').write_text(json.dumps(state));(root/'runtime-identity').write_text('local.agentopia.desktop-runtime.v1');(root/'runtime-instance').write_text(INSTANCE);(root/'manage.py').write_text('existing maintenance')
  (home/'.config/agentopia').mkdir(parents=True);(home/'.config/agentopia/runtime-secrets.json').write_text(json.dumps({'root_key':key}));(home/'app/supabase').mkdir(parents=True);(home/'app/supabase/config.toml').write_text('[db]\nport = 57322\nroot_key = "'+key+'"\n')
  return root,home
 def state(self,healthy=True,port=57322):return {'runtime':'native','env':{'DB_URL':'postgres://private@127.0.0.1:'+str(port)+'/postgres'},'services':[{'service':name,'state':'running' if healthy else 'stopped','health':'healthy' if healthy else None} for name in module.CORE_SERVICES]}
 def test_healthy_existing_runtime_requires_no_start_or_pid_write(self):
  with tempfile.TemporaryDirectory() as directory:
   root,home=self.fixture(Path(directory));report=module.resume_existing_services(INSTANCE,root,home,run=lambda *a,**k:self.fail('must not start'),read_status=lambda *a,**k:json.dumps(self.state()),retire=lambda:self.fail('must not retire'))
   self.assertTrue(report['success']);self.assertFalse(report['existingServicesStarted']);self.assertEqual(report['sqlWrites'],0)
 def test_stopped_runtime_resumes_existing_services_and_keeps_every_original_byte(self):
  with tempfile.TemporaryDirectory() as directory:
   base=Path(directory);root,home=self.fixture(base);before={str(p.relative_to(base)):p.read_bytes() for p in base.rglob('*') if p.is_file()};calls=[];states=iter([self.state(False),self.state()])
   def run(args,**options):calls.append(args);return SimpleNamespace(returncode=0)
   report=module.resume_existing_services(INSTANCE,root,home,run=run,read_status=lambda *a,**k:json.dumps(next(states)),retire=lambda:calls.append(['verified stale PID']))
   self.assertTrue(report['success']);self.assertEqual(report['encryptionRootBindingsVerified'],4);self.assertEqual(calls[1],['supabase','start','--runtime','native','--eager','--exclude','analytics,pooler,studio']);self.assertEqual(before,{str(p.relative_to(base)):p.read_bytes() for p in base.rglob('*') if p.is_file()})
 def test_mismatched_root_binding_rejects_before_any_service_action(self):
  with tempfile.TemporaryDirectory() as directory:
   root,home=self.fixture(Path(directory));(home/'.config/agentopia/runtime-secrets.json').write_text(json.dumps({'root_key':'b'*64}))
   with self.assertRaises(AssertionError):module.resume_existing_services(INSTANCE,root,home,run=lambda *a,**k:self.fail('must not start'),read_status=lambda *a,**k:self.fail('must not query'),retire=lambda:self.fail('must not retire'))
 def test_missing_database_and_wrong_instance_never_provision(self):
  with tempfile.TemporaryDirectory() as directory:
   root,home=self.fixture(Path(directory));(root/'runtime-instance').write_text('22222222-2222-4222-8222-222222222222')
   with self.assertRaises(AssertionError):module.verified_existing_runtime(INSTANCE,root,home)
   (root/'runtime-instance').write_text(INSTANCE);next((home/'.supabase/stacks').glob('*/data/*/data/PG_VERSION')).unlink()
   with self.assertRaises(AssertionError):module.resume_existing_services(INSTANCE,root,home,run=lambda *a,**k:self.fail('must not start'))
 def test_changed_database_port_is_not_followed(self):
  with tempfile.TemporaryDirectory() as directory:
   root,home=self.fixture(Path(directory))
   with self.assertRaises(AssertionError):module.resume_existing_services(INSTANCE,root,home,read_status=lambda *a,**k:json.dumps(self.state(False,54322)),run=lambda *a,**k:self.fail('must not start'))
if __name__=='__main__':unittest.main()
