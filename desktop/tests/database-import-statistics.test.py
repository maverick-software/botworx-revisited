"""Exercise the actual import branch without a database or external services."""
from pathlib import Path
import ast,hashlib,json,os,tempfile,types,unittest
SOURCE=Path(__file__).resolve().parents[1]/'runtime/manage.py'
tree=ast.parse(SOURCE.read_text(encoding='utf-8'))
branch=next(node for node in ast.walk(tree) if isinstance(node,ast.If) and isinstance(node.test,ast.Compare) and isinstance(node.test.left,ast.Name) and node.test.left.id=='command' and any(isinstance(c,ast.Constant) and c.value=='import' for c in node.test.comparators))
CODE=compile(ast.fix_missing_locations(ast.Module(body=branch.body,type_ignores=[])),str(SOURCE),'exec')
class ImportStatisticsTests(unittest.TestCase):
 def setUp(self):
  self.temp=tempfile.TemporaryDirectory(prefix='sylvana-import-statistics-');self.root=Path(self.temp.name);self.source=self.root/'backup';self.source.mkdir();self.events=[];self.resumed=False;self.fail_import=False;self.fail_analyze=False
  self.key=self.root/'database-key';self.key.write_text('ORIGINAL GENERATED KEY');self.database=self.root/'opt/database';self.database.mkdir(parents=True);(self.database/'0001-baseline.sql').write_text('GENERATED BASELINE')
  files=[]
  for name in ['auth.dump','application.dump','vault.dump','pgsodium_root.key']:
   content=('GENERATED '+name).encode();(self.source/name).write_bytes(content);files.append({'name':name,'sha256':hashlib.sha256(content).hexdigest()})
  (self.source/'manifest.json').write_text(json.dumps({'format':1,'postgres':17,'files':files}))
 def tearDown(self):self.temp.cleanup()
 def run_import(self):
  def sql(query):
   if query.startswith("SELECT to_regclass"):return 't' if self.resumed else 'f'
   if query.startswith('SELECT count(*) FROM sylvana_desktop.imports'):return '1'
   if query=='SELECT count(*) FROM auth.users':return '2' if self.resumed else '0'
   if query.startswith('SELECT count(*) FROM pg_tables'):return '0'
   if query=='ANALYZE':
    self.events.append('analyze')
    if self.fail_analyze:raise RuntimeError('Generated statistics failure')
   return ''
  def imported(file):
   self.events.append('import')
   if self.fail_import:raise RuntimeError('Generated import failure')
  def run(args,**kwargs):self.events.append('stop' if args[1]=='stop' else 'start')
  def paths(value):return self.root/'missing-runtime-secrets.json' if str(value)=='/home/sylvana/.config/sylvana/runtime-secrets.json' else Path(value)
  def append(source,destination):destination.write(b'GENERATED RESTORE SQL\n')
  scope={'Path':paths,'sys':types.SimpleNamespace(argv=['manage.py','import',str(self.source)]),'json':json,'hashlib':hashlib,'sql':sql,'sql_file':imported,'ROOT':self.root/'opt','tempfile':tempfile,'append_restore':append,'glob':types.SimpleNamespace(glob=lambda pattern:[str(self.key)]),'subprocess':types.SimpleNamespace(run=run,DEVNULL=object()),'wait_database_shutdown':lambda directory,**kwargs:self.events.append('shutdown-verified'),'os':os}
  exec(CODE,scope)
 def test_new_import_refreshes_statistics_before_restart(self):
  self.run_import();self.assertEqual(self.events,['import','analyze','stop','shutdown-verified','start']);self.assertEqual(self.key.read_bytes(),(self.source/'pgsodium_root.key').read_bytes())
 def test_resume_refreshes_statistics_without_replaying_committed_import(self):
  self.resumed=True;self.run_import();self.assertEqual(self.events,['analyze','stop','shutdown-verified','start'])
 def test_statistics_failure_leaves_root_and_services_untouched(self):
  self.fail_analyze=True
  with self.assertRaisesRegex(RuntimeError,'statistics failure'):self.run_import()
  self.assertEqual(self.events,['import','analyze']);self.assertEqual(self.key.read_text(),'ORIGINAL GENERATED KEY')
 def test_failed_import_does_not_analyze_or_restart(self):
  self.fail_import=True
  with self.assertRaisesRegex(RuntimeError,'import failure'):self.run_import()
  self.assertEqual(self.events,['import']);self.assertEqual(self.key.read_text(),'ORIGINAL GENERATED KEY')
if __name__=='__main__':unittest.main()
