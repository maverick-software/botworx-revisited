from pathlib import Path
import hashlib,importlib.util,json,tempfile,unittest,uuid
spec=importlib.util.spec_from_file_location('owners',Path(__file__).with_name('archived_account_owners.py'));owners=importlib.util.module_from_spec(spec);spec.loader.exec_module(owners)
class OwnersTests(unittest.TestCase):
    def setUp(self):
        self.temporary=tempfile.TemporaryDirectory(prefix='agentopia-owner-test-');self.root=Path(self.temporary.name);self.db=self.root/'current-database-backup';self.db.mkdir();self.ids=[str(uuid.uuid4()),str(uuid.uuid4())];self.entries=[]
        for name in ['auth.dump','application.dump','vault.dump','database.dump','pgsodium_root.key']:
            data=('GENERATED '+name).encode();(self.db/name).write_bytes(data);self.entries.append({'name':name,'sha256':hashlib.sha256(data).hexdigest()})
        self.manifest={'format':1,'accounts':2,'files':self.entries};self.save();self.output=self.root/'public-recovery-owners.json'
    def tearDown(self):self.temporary.cleanup()
    def save(self):(self.db/'manifest.json').write_text(json.dumps(self.manifest),encoding='utf-8')
    def sql(self,ids=None):return 'COPY auth.users (email, id) FROM stdin;\n'+''.join('GENERATED@example.invalid\t'+owner+'\n' for owner in (self.ids if ids is None else ids))+'\\.\n'
    def capture(self,reader=None):return owners.capture_owners(self.db,self.output,reader=reader or (lambda _:self.sql()))
    def test_exact_archive_owners_are_bound_without_exporting_other_account_columns(self):
        result=self.capture();self.assertEqual(result['accounts'],self.ids);self.assertEqual(result['authArchiveSha256'],owners.digest(self.db/'auth.dump'));self.assertNotIn('email',self.output.read_text())
    def test_empty_account_archive_is_supported(self):
        self.manifest['accounts']=0;self.save();self.assertEqual(self.capture(lambda _:self.sql([]))['accounts'],[])
    def test_count_duplicate_and_invalid_id_are_refused(self):
        for rows in [self.ids[:1],[self.ids[0]]*2,['not-an-account',self.ids[1]]]:
            with self.assertRaises(AssertionError):self.capture(lambda _,rows=rows:self.sql(rows))
        self.assertFalse(self.output.exists())
    def test_mixed_or_corrupt_archive_is_refused_before_reader(self):
        (self.db/'application.dump').write_bytes(b'CHANGED')
        with self.assertRaisesRegex(AssertionError,'Changed database'):self.capture(lambda _:self.fail('Archive reader must not run'))
    def test_changed_auth_archive_during_read_is_refused(self):
        def reader(_):(self.db/'auth.dump').write_bytes(b'CHANGED');return self.sql()
        with self.assertRaisesRegex(AssertionError,'changed while reading'):self.capture(reader)
        self.assertFalse(self.output.exists())
    def test_escaping_duplicate_manifest_names_and_missing_key_are_refused(self):
        original=self.entries[:]
        for files in [original+[original[0]],original[:-1],[{**original[0],'name':'../auth.dump'},*original[1:]]]:
            self.manifest['files']=files;self.save()
            with self.assertRaises(AssertionError):self.capture()
    def test_existing_receipt_and_foreign_output_are_preserved(self):
        self.output.write_text('KEEP')
        with self.assertRaises(FileExistsError):self.capture()
        self.assertEqual(self.output.read_text(),'KEEP')
        with self.assertRaisesRegex(AssertionError,'remain in its backup'):owners.capture_owners(self.db,self.root.parent/'foreign.json',reader=lambda _:self.sql())
    def test_multiple_or_missing_users_tables_are_refused(self):
        for sql in ['',self.sql()+self.sql(),'COPY public.users (id) FROM stdin;\n'+self.ids[0]+'\n\\.\n']:
            with self.assertRaises(AssertionError):owners.parse_accounts(sql,2)
if __name__=='__main__':unittest.main()
