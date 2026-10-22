"""Generated recovery bundles only; never starts WSL, a provider or the app."""
from pathlib import Path
import hashlib,importlib.util,io,json,sqlite3,tarfile,tempfile,unittest,uuid
from unittest.mock import patch
ROOT=Path(__file__).resolve().parents[2]
spec=importlib.util.spec_from_file_location('prepare_recovery',ROOT/'desktop/runtime/prepare-desktop-recovery.py');recovery=importlib.util.module_from_spec(spec);spec.loader.exec_module(recovery)
QA=ROOT/'.supabase/desktop-full-recovery-tests';QA.mkdir(exist_ok=True)
def sha(data):return hashlib.sha256(data).hexdigest()
def write_json(file,data):file.write_text(json.dumps(data,ensure_ascii=False,indent=2),encoding='utf-8')
def archive(file,payload):
    directories=set()
    for name in payload:
        parts=name.split('/')
        for i in range(1,len(parts)):directories.add('/'.join(parts[:i]))
    manifest={'files':{n:{'bytes':len(data),'sha256':sha(data),'mtimeMs':1} for n,data in payload.items()},'directories':sorted(directories)}
    with tarfile.open(file,'w:gz') as tar:
        for name in sorted(directories):item=tarfile.TarInfo(name+'/');item.type=tarfile.DIRTYPE;tar.addfile(item)
        for name,data in payload.items():item=tarfile.TarInfo(name);item.size=len(data);tar.addfile(item,io.BytesIO(data))
    return manifest
class RecoveryTests(unittest.TestCase):
    def setUp(self):
        self.root=Path(tempfile.mkdtemp(prefix='case-',dir=QA));self.bundle=self.root/'bundle';self.bundle.mkdir();self.home=self.root/'fresh-home';self.home.mkdir();self.appdata=self.home/'AppData/Roaming';self.owner=str(uuid.uuid4());self.other=str(uuid.uuid4());self.thread=str(uuid.uuid4());self.reference=str(uuid.uuid4());self.old=self.root/'old-home/.agentopia/desktop/profile'
        native='codex/'+self.owner+'/openai-oauth/'+'a'*32;self.rollout=native+'/sessions/2026/10/19/rollout-2026-10-19T00-00-00-'+self.thread+'.jsonl';self.workspace='workspaces/'+self.owner+'/scope/report.md'
        db=self.root/'state.sqlite';c=sqlite3.connect(db);c.execute('CREATE TABLE threads(id TEXT PRIMARY KEY,rollout_path TEXT,cwd TEXT,agent_path TEXT,note TEXT)');c.execute('INSERT INTO threads VALUES(?,?,?,?,?)',(self.thread,str(self.old/self.rollout),str((self.old/self.workspace).parent),'','Preserve this saved thread'));c.execute('CREATE TABLE extra(value BLOB)');c.execute('INSERT INTO extra VALUES(?)',(b'\x00\xff\x17',));c.commit();c.close()
        self.payload={self.workspace:b'original workspace',self.rollout:(json.dumps({'type':'session_meta','payload':{'id':self.thread}})+'\n').encode(),native+'/state_5.sqlite':db.read_bytes(),native+'/auth.json':b'GENERATED AUTH MUST BE REAUTHORIZED',native+'/config.toml':b'GENERATED HOST-SPECIFIC CONFIG', 'credentials.bin':b'GENERATED ENCRYPTED STORE','Network/Cookies':b'GENERATED COOKIES','attachments/'+self.owner+'/image.png':b'GENERATED IMAGE'}
        pm=archive(self.bundle/'profile.tar.gz',self.payload);self.pm={'success':True,'archiveSha256':recovery.digest(self.bundle/'profile.tar.gz'),'manifest':pm};write_json(self.bundle/'profile.json',self.pm)
        folder=self.bundle/'database';folder.mkdir();files=[]
        for name in ['auth.dump','application.dump','vault.dump','database.dump','pgsodium_root.key']:
            data=('GENERATED-'+name).encode();(folder/name).write_bytes(data);files.append({'name':name,'sha256':sha(data)})
        write_json(folder/'manifest.json',{'format':1,'accounts':2,'files':files})
        self.public_name='123456789abc/'+self.owner+'/export-'+'b'*32+'/Report 東京.md';public=archive(self.bundle/'public.tar.gz',{self.public_name:b'EDITED PUBLIC OUTPUT'});self.pub={'success':True,'archiveSha256':recovery.digest(self.bundle/'public.tar.gz'),'manifest':public,'privateProfileArchiveSha256':self.pm['archiveSha256'],'logicalManifestSha256':recovery.digest(folder/'manifest.json')};write_json(self.bundle/'public.json',self.pub)
        index={'format':1,'sourceRoot':str(self.old.parents[2]/'Agentopia Files'),'sourceProfile':str(self.old),'accounts':[{'owner':self.owner,'references':[{'id':self.reference,'name':'Report 東京.md','kind':'file','relativePath':self.public_name}]},{'owner':self.other,'references':[]}]}
        self.refs={'format':1,'kind':'agentopia-restored-public-files','index':index,'inventory':public,'indexSha256':sha(json.dumps(index,ensure_ascii=False,separators=(',',':')).encode()),'archiveSha256':self.pub['archiveSha256']};write_json(self.bundle/'references.json',self.refs)
        self.descriptor={'format':2,'kind':'agentopia-desktop-recovery','codex':'0.163.0'}
        for field,name in [('databaseManifest','database/manifest.json'),('profileArchive','profile.tar.gz'),('profileManifest','profile.json'),('publicArchive','public.tar.gz'),('publicManifest','public.json'),('references','references.json')]:self.descriptor[field]={'file':name,'sha256':recovery.digest(self.bundle/name)}
        self.seal()
    def seal(self):write_json(self.bundle/'desktop-recovery.json',self.descriptor)
    def prepare(self,**options):return recovery.prepare(self.bundle,self.home,self.appdata,[],headroom=0,**options)
    def test_complete_staging_preserves_records_and_reauthorizes_host_credentials(self):
        result=self.prepare();profile=self.appdata/'Agentopia';self.assertEqual(result['status'],'prepared');self.assertFalse(result['databaseImported']);self.assertTrue(result['providerReauthorizationRequired']);self.assertEqual(result['native']['threads'],1)
        self.assertEqual((profile/self.workspace).read_bytes(),self.payload[self.workspace]);self.assertEqual((profile/self.rollout).read_bytes(),self.payload[self.rollout]);self.assertEqual((self.home/'Agentopia Files'/self.public_name).read_bytes(),b'EDITED PUBLIC OUTPUT');self.assertFalse((profile/'credentials.bin').exists());self.assertFalse((profile/'Network').exists());self.assertFalse(list((profile/'codex').glob('*/*/*/auth.json')));self.assertFalse(list((profile/'codex').glob('*/*/*/config.toml')))
        database=next((profile/'codex').glob('*/*/*/state_5.sqlite'));c=sqlite3.connect(database);row=c.execute('SELECT rollout_path,cwd,note FROM threads').fetchone();self.assertEqual(row,(str(profile/self.rollout),str((profile/self.workspace).parent),'Preserve this saved thread'));self.assertEqual(c.execute('SELECT value FROM extra').fetchone()[0],b'\x00\xff\x17');c.close();self.assertEqual(self.prepare()['operationId'],result['operationId'])
    def test_existing_runtime_or_app_is_refused_before_any_state_is_staged(self):
        for names,running in [(['AgentopiaRuntime'],False),([' AgentopiaRuntime-'+str(uuid.uuid4())+' '],False),([],True)]:
            with self.assertRaises(ValueError):recovery.prepare(self.bundle,self.home,self.appdata,names,running,headroom=0)
        self.assertFalse((self.home/'.agentopia').exists())
    def test_existing_private_profile_and_public_files_are_preserved(self):
        profile=self.appdata/'Agentopia';profile.mkdir(parents=True);(profile/'keep').write_bytes(b'existing')
        with self.assertRaises(ValueError):self.prepare()
        self.assertEqual((profile/'keep').read_bytes(),b'existing');self.assertFalse((self.home/'Agentopia Files').exists())
    def test_corruption_is_detected_before_a_destination_is_claimed(self):
        (self.bundle/'public.tar.gz').write_bytes(b'changed')
        with self.assertRaises(ValueError):self.prepare()
        self.assertFalse((self.home/'.agentopia').exists())
    def test_unsafe_descriptor_paths_and_account_mismatches_fail_before_writes(self):
        self.descriptor['profileArchive']['file']='../outside';self.seal()
        with self.assertRaises(ValueError):self.prepare()
        self.assertFalse((self.home/'.agentopia').exists())
    def test_semantically_foreign_references_fail_even_when_the_record_hash_is_resealed(self):
        self.refs['index']['accounts'][0]['owner']=self.other;self.refs['indexSha256']=sha(json.dumps(self.refs['index'],ensure_ascii=False,separators=(',',':')).encode());write_json(self.bundle/'references.json',self.refs);self.descriptor['references']['sha256']=recovery.digest(self.bundle/'references.json');self.seal()
        with self.assertRaises(ValueError):self.prepare()
        self.assertFalse((self.home/'.agentopia').exists())
    def test_linked_archive_members_and_mixed_checkpoints_fail_before_staging(self):
        self.pub['privateProfileArchiveSha256']='0'*64;write_json(self.bundle/'public.json',self.pub);self.descriptor['publicManifest']['sha256']=recovery.digest(self.bundle/'public.json');self.seal()
        with self.assertRaisesRegex(ValueError,'different checkpoints'):self.prepare()
        self.pub['privateProfileArchiveSha256']=self.pm['archiveSha256'];write_json(self.bundle/'public.json',self.pub);self.descriptor['publicManifest']['sha256']=recovery.digest(self.bundle/'public.json')
        bad=self.bundle/'profile.tar.gz'
        with tarfile.open(bad,'w:gz') as tar:
            item=tarfile.TarInfo(self.workspace);item.type=tarfile.SYMTYPE;item.linkname='../../outside';tar.addfile(item)
        self.pm['archiveSha256']=recovery.digest(bad);write_json(self.bundle/'profile.json',self.pm);self.pub['privateProfileArchiveSha256']=self.pm['archiveSha256'];write_json(self.bundle/'public.json',self.pub)
        for key,name in [('profileArchive','profile.tar.gz'),('profileManifest','profile.json'),('publicManifest','public.json')]:self.descriptor[key]['sha256']=recovery.digest(self.bundle/name)
        self.seal()
        with self.assertRaisesRegex(ValueError,'linked'):self.prepare()
        self.assertFalse((self.home/'.agentopia').exists())
    def test_interrupted_staging_resumes_without_overwriting_modified_files(self):
        def stop(phase):
            if phase=='staging-public':raise RuntimeError('generated interruption')
        with self.assertRaises(RuntimeError):self.prepare(phase_hook=stop)
        state=recovery.load(self.home/'.agentopia/recovery-state.json');self.assertEqual(state['status'],'interrupted');target=Path(state['stage'])/'profile'/self.workspace;target.write_bytes(b'user inspection edit')
        with self.assertRaises(ValueError):self.prepare()
        self.assertEqual(target.read_bytes(),b'user inspection edit');self.assertFalse((self.appdata/'Agentopia').exists())
    def test_resume_after_publishing_repairs_only_native_paths_and_completes(self):
        def stop(phase):
            if phase=='rebasing-native-histories':raise RuntimeError('generated interruption')
        with self.assertRaises(RuntimeError):self.prepare(phase_hook=stop)
        self.assertTrue((self.appdata/'Agentopia').exists());self.assertEqual(recovery.load(self.home/'.agentopia/recovery-state.json')['status'],'interrupted');result=self.prepare();self.assertEqual(result['status'],'prepared');self.assertEqual(result['native']['threads'],1)
    def test_partial_file_resumes_only_if_its_saved_prefix_matches_the_archive(self):
        destination=self.root/'copy';destination.mkdir();target=destination/'large';data=b'x'*200000;row={'bytes':len(data),'sha256':sha(data)};calls=0;original=recovery.reserve
        def stop(*args):
            nonlocal calls
            calls+=1
            if calls==3:raise RuntimeError('generated write interruption')
        with patch.object(recovery,'reserve',stop):
            with self.assertRaises(RuntimeError):recovery.copy_verified(io.BytesIO(data),target,row,destination,0)
        self.assertFalse(target.exists());self.assertTrue(list((destination/'.agentopia-recovery-parts').glob('*.part')));recovery.copy_verified(io.BytesIO(data),target,row,destination,0);self.assertEqual(target.read_bytes(),data)
    def test_linked_destinations_and_concurrent_preparers_are_refused(self):
        outside=self.root/'outside';outside.mkdir();(self.home/'Agentopia Files').symlink_to(outside,target_is_directory=True)
        with self.assertRaises(ValueError):self.prepare()
        self.assertEqual(list(outside.iterdir()),[])
        separate=self.root/'lock-home';separate.mkdir()
        with recovery.recovery_lock(separate):
            with self.assertRaises(OSError):
                with recovery.recovery_lock(separate):pass
    def test_bootstrap_exempts_only_the_verified_parent_application_and_its_own_children(self):
        executable=str(self.root/'app-0.44.48/Agentopia.exe');processes=[{'ProcessId':10,'ParentProcessId':1,'Name':'Agentopia.exe','ExecutablePath':executable},{'ProcessId':11,'ParentProcessId':10,'Name':'Agentopia.exe','ExecutablePath':executable},{'ProcessId':12,'ParentProcessId':11,'Name':'Agentopia.exe','ExecutablePath':executable},{'ProcessId':20,'ParentProcessId':1,'Name':'Agentopia.exe','ExecutablePath':executable}]
        self.assertEqual(recovery.bootstrap_family(processes,10,10,executable),{10,11,12});self.assertEqual(recovery.bootstrap_family(processes,None,10,executable),set());self.assertNotIn(20,recovery.bootstrap_family(processes,10,10,executable))
        with self.assertRaises(ValueError):recovery.bootstrap_family(processes,10,20,executable)
        with self.assertRaises(ValueError):recovery.bootstrap_family(processes,10,10,str(self.root/'other/Agentopia.exe'))
if __name__=='__main__':unittest.main()
