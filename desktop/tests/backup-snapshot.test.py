"""Exercise the real backup function with generated processes and files."""
from pathlib import Path
import ast,hashlib,json,tempfile,types,unittest,uuid

SOURCE=Path(__file__).resolve().parents[1]/'runtime/manage.py'
BACKUP=next(node for node in ast.parse(SOURCE.read_text(encoding='utf-8')).body if isinstance(node,ast.FunctionDef) and node.name=='backup')
class SnapshotTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory(prefix='sylvana-backup-snapshot-');self.root=Path(self.temp.name);self.destination=self.root/'backup';self.key=self.root/'source-key';self.key.write_bytes(b'GENERATED DATABASE KEY');self.owners=[str(uuid.uuid4()),str(uuid.uuid4())];self.events=[];self.dumps=[];self.lines=['00000001-00000001-1\n',json.dumps(self.owners)+'\n'];self.dump_failure=False
        parent=self
        class Input:
            def write(self,value):parent.events.append(('sql',value))
            def flush(self):pass
            def close(self):parent.events.append(('closed',True))
        class Output:
            def readline(self):return parent.lines.pop(0)
        self.keeper=types.SimpleNamespace(stdin=Input(),stdout=Output(),poll=lambda:None,wait=lambda timeout:parent.events.append(('wait',timeout)))
        def run(command,check):
            self.events.append(('dump',command));self.dumps.append(command)
            if self.dump_failure:raise RuntimeError('Generated dump failure')
            Path(command[command.index('-f')+1]).write_bytes(('GENERATED '+str(command)).encode())
        context={'Path':Path,'subprocess':types.SimpleNamespace(Popen=lambda *args,**kwargs:self.keeper,PIPE=object(),run=run),'binary':self.root,'connection':['GENERATED CONNECTION'],'glob':types.SimpleNamespace(glob=lambda pattern:[str(self.key)]),'hashlib':hashlib,'json':json,'sql':lambda query:self.fail('Account identities must not be read outside the exported snapshot')}
        exec(compile(ast.Module(body=[BACKUP],type_ignores=[]),str(SOURCE),'exec'),context);self.backup=context['backup']
    def tearDown(self):self.temp.cleanup()
    def test_account_ids_and_all_archives_use_the_same_kept_snapshot(self):
        self.backup(self.destination);manifest=json.loads((self.destination/'manifest.json').read_text());self.assertEqual(manifest['accountIds'],self.owners);self.assertEqual(manifest['accounts'],2);self.assertEqual(len(self.dumps),4)
        for command in self.dumps:self.assertEqual(command[command.index('--snapshot')+1],'00000001-00000001-1')
        owner_query=next(i for i,event in enumerate(self.events) if event[0]=='sql' and 'json_agg' in event[1]);first_dump=next(i for i,event in enumerate(self.events) if event[0]=='dump');self.assertLess(owner_query,first_dump);self.assertTrue(any(event[0]=='sql' and 'ROLLBACK' in event[1] for event in self.events))
        for record in manifest['files']:self.assertEqual(hashlib.sha256((self.destination/record['name']).read_bytes()).hexdigest(),record['sha256'])
    def test_no_accounts_is_a_valid_snapshot(self):
        self.lines[1]='[]\n';self.backup(self.destination);manifest=json.loads((self.destination/'manifest.json').read_text());self.assertEqual(manifest['accountIds'],[]);self.assertEqual(manifest['accounts'],0)
    def test_duplicate_ids_abort_before_dumping_and_close_the_transaction(self):
        self.lines[1]=json.dumps([self.owners[0]]*2)+'\n'
        with self.assertRaises(AssertionError):self.backup(self.destination)
        self.assertEqual(self.dumps,[]);self.assertFalse((self.destination/'manifest.json').exists());self.assertTrue(any(event[0]=='wait' for event in self.events))
    def test_failed_dump_closes_the_snapshot_without_a_completion_manifest(self):
        self.dump_failure=True
        with self.assertRaisesRegex(RuntimeError,'Generated dump failure'):self.backup(self.destination)
        self.assertFalse((self.destination/'manifest.json').exists());self.assertTrue(any(event[0]=='sql' and 'ROLLBACK' in event[1] for event in self.events))
if __name__=='__main__':unittest.main()
