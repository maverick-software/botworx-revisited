"""Verify stale-lock retirement preserves live and ambiguous database records."""
from pathlib import Path
import ast,importlib.util,tempfile,types,unittest
SOURCE=Path(__file__).resolve().parents[1]/'runtime/database_state.py'
spec=importlib.util.spec_from_file_location('database_state',SOURCE);module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
class DatabaseStateTests(unittest.TestCase):
 def setUp(self):
  self.temp=tempfile.TemporaryDirectory(prefix='sylvana-stopped-database-');self.root=Path(self.temp.name);self.data=self.root/'data';self.data.mkdir();(self.data/'global').mkdir();(self.data/'PG_VERSION').write_text('17');(self.data/'global/pg_control').write_bytes(b'GENERATED CONTROL');self.proc=self.root/'proc';self.proc.mkdir();self.pid=self.data/'postmaster.pid';self.pid.write_text('83\n'+str(self.data.resolve())+'\n1700000000\n');self.calls=[]
 def tearDown(self):self.temp.cleanup()
 def retire(self,code=3,change=False):
  def run(args,**kwargs):
   self.calls.append(args)
   if change:self.pid.write_text('100000\n'+str(self.data.resolve())+'\n1700000001\n')
   return types.SimpleNamespace(returncode=code)
  return module.retire_stopped_pidfile(self.data,Path('generated-pg_ctl'),proc=self.proc,runner=run)
 def test_dead_pid_and_stopped_controller_retire_only_the_lock(self):
  self.assertTrue(self.retire());self.assertFalse(self.pid.exists());self.assertEqual((self.data/'global/pg_control').read_bytes(),b'GENERATED CONTROL')
 def test_live_process_preserves_the_lock_without_controller_calls(self):
  (self.proc/'83').mkdir();self.assertFalse(self.retire());self.assertTrue(self.pid.exists());self.assertEqual(self.calls,[])
 def test_running_controller_preserves_the_lock(self):
  self.assertFalse(self.retire(code=0));self.assertTrue(self.pid.exists())
 def test_unknown_controller_state_is_refused(self):
  with self.assertRaisesRegex(RuntimeError,'verify'):self.retire(code=1)
  self.assertTrue(self.pid.exists())
 def test_mismatched_directory_is_refused(self):
  self.pid.write_text('83\n'+str(self.root/'other')+'\n1700000000\n')
  with self.assertRaisesRegex(RuntimeError,'directory'):self.retire()
  self.assertTrue(self.pid.exists());self.assertEqual(self.calls,[])
 def test_changed_lock_is_preserved(self):
  with self.assertRaisesRegex(RuntimeError,'changed'):self.retire(change=True)
  self.assertTrue(self.pid.exists());self.assertTrue(self.pid.read_text().startswith('100000'))
 def test_attached_database_workers_preserve_the_lock(self):
  self.pid.write_text(self.pid.read_text()+'59000\n/tmp\nlocalhost\n65090 5\nready\n');(self.proc/'sysvipc').mkdir();(self.proc/'sysvipc/shm').write_text('key shmid nattch\n65090 5 2\n')
  with self.assertRaises(module.DatabaseStillStopping):self.retire()
  self.assertTrue(self.pid.exists())
 def test_detached_database_workers_allow_retirement(self):
  self.pid.write_text(self.pid.read_text()+'59000\n/tmp\nlocalhost\n65090 5\nready\n');(self.proc/'sysvipc').mkdir();(self.proc/'sysvipc/shm').write_text('key shmid nattch\n65090 5 0\n')
  self.assertTrue(self.retire());self.assertFalse(self.pid.exists())
 def barrier(self,attached,timeout=1):
  source=ast.parse(SOURCE.with_name('manage.py').read_text());function=next(node for node in source.body if isinstance(node,ast.FunctionDef) and node.name=='wait_database_shutdown');calls=[]
  def memory(lines,proc):calls.append('memory');return attached.pop(0) if len(attached)>1 else attached[0]
  scope={'Path':Path,'binary':self.root,'subprocess':types.SimpleNamespace(run=lambda *args,**kwargs:types.SimpleNamespace(returncode=3),DEVNULL=object()),'retire_stopped_pidfile':lambda *args:calls.append('retire'),'shared_memory_attached':memory,'DatabaseStillStopping':module.DatabaseStillStopping}
  exec(compile(ast.fix_missing_locations(ast.Module(body=[function],type_ignores=[])),str(SOURCE),'exec'),scope)
  scope['wait_database_shutdown'](self.data,timeout=timeout,shared_record=self.pid.read_text());return calls
 def test_shutdown_barrier_waits_for_workers_after_parent_exit(self):
  self.assertEqual(self.barrier([True,False]),['memory','memory','retire'])
 def test_shutdown_barrier_refuses_workers_that_do_not_detach(self):
  with self.assertRaisesRegex(TimeoutError,'workers'):self.barrier([True],timeout=0)
  self.assertTrue(self.pid.exists())
if __name__=='__main__':unittest.main()
