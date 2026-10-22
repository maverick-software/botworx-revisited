import hashlib,json,unittest,uuid,importlib.util
from pathlib import Path
spec=importlib.util.spec_from_file_location('external_fixture',Path(__file__).with_name('external-preparation.test.py'));external=importlib.util.module_from_spec(spec);spec.loader.exec_module(external)
base=external.base;recovery=external.recovery
class LayoutPreparation(unittest.TestCase):
    save_clip=external.ExternalPreparation.save_clip
    save_settings=external.ExternalPreparation.save_settings
    save_external=external.ExternalPreparation.save_external
    tearDown=external.ExternalPreparation.tearDown
    def setUp(self):
        external.ExternalPreparation.setUp(self);c=self.case;tab=str(uuid.uuid4());self.layouts={'format':1,'kind':'agentopia-portable-layouts','databaseManifestSha256':recovery.digest(c.bundle/'database/manifest.json'),'window':{'bounds':{'x':-1200,'y':40,'width':1100,'height':800},'maximized':True},'accounts':[{'owner':c.owner,'display':{'context':'closed','modes':{'defaultMode':'codex','projects':{},'chats':{}}},'references':[{'id':c.reference,'kind':'file'},{'id':self.external_id,'kind':'folder'}],'panes':{'home':{'open':True,'width':620,'treeWidth':220,'tree':True,'tabs':[{'id':tab,'kind':'file','name':'Report 東京.md','referenceId':c.reference,'path':''}],'active':tab,'referenceId':self.external_id}}},{'owner':c.other,'display':{},'references':[],'panes':{}}]};c.descriptor['requiresDesktopRecoveryFormat']=6;self.save_layouts()
    def save_layouts(self):
        self.layouts['indexSha256']=hashlib.sha256(json.dumps({key:self.layouts[key] for key in ('format','kind','databaseManifestSha256','window','accounts')},ensure_ascii=False,separators=(',',':')).encode()).hexdigest();base.write_json(self.case.bundle/'layouts.json',self.layouts);self.case.descriptor['layoutsManifest']={'file':'layouts.json','sha256':recovery.digest(self.case.bundle/'layouts.json')};self.case.seal()
    def test_layouts_and_window_are_staged_before_database_start_and_resume_same_operation(self):
        c=self.case;result=c.prepare();profile=c.appdata/'Agentopia';self.assertFalse(result['databaseImported']);self.assertEqual(result['layoutsIndexSha256'],self.layouts['indexSha256']);self.assertEqual(recovery.load(profile/'restored-layouts.json'),self.layouts);self.assertEqual(recovery.load(profile/'window.json'),self.layouts['window']);self.assertEqual(c.prepare()['operationId'],result['operationId'])
    def test_capability_seven_stages_notification_choices_with_layouts_before_database_start(self):
        c=self.case;self.settings['accounts'][0]['settings']['notification-preferences']={'responses':False,'tasks':True};c.descriptor['requiresDesktopRecoveryFormat']=7;self.save_settings()
        result=c.prepare();self.assertFalse(result['databaseImported']);record=recovery.load(c.appdata/'Agentopia/restored-settings.json');self.assertEqual(record['accounts'][0]['settings']['notification-preferences'],{'responses':False,'tasks':True});self.assertEqual(c.prepare()['operationId'],result['operationId'])
    def test_capability_eight_restores_modes_and_separate_attention_choices(self):
        c=self.case;value={'completion':'always','permissions':False,'questions':True,'tasks':False};self.settings['accounts'][0]['settings']['notification-preferences']=value;c.descriptor['requiresDesktopRecoveryFormat']=8;self.save_settings()
        result=c.prepare();self.assertFalse(result['databaseImported']);record=recovery.load(c.appdata/'Agentopia/restored-settings.json');self.assertEqual(record['accounts'][0]['settings']['notification-preferences'],value);self.assertEqual(c.prepare()['operationId'],result['operationId'])
    def test_advanced_notification_metadata_cannot_be_downgraded_to_seven(self):
        c=self.case;self.settings['accounts'][0]['settings']['notification-preferences']={'completion':'always','permissions':False,'questions':True,'tasks':False};c.descriptor['requiresDesktopRecoveryFormat']=7;self.save_settings()
        with self.assertRaisesRegex(ValueError,'Notification modes and attention alerts require a newer recovery capability'):c.prepare()
        self.assertFalse((c.home/'.agentopia').exists())
    def test_missing_or_downgraded_layout_resource_is_refused(self):
        c=self.case;c.descriptor['requiresDesktopRecoveryFormat']=5;c.seal()
        with self.assertRaisesRegex(ValueError,'newer recovery capability'):c.prepare()
        c.descriptor['requiresDesktopRecoveryFormat']=6;del c.descriptor['layoutsManifest'];c.seal()
        with self.assertRaisesRegex(ValueError,'layout resource is required'):c.prepare()
        self.assertFalse((c.home/'.agentopia').exists())
    def test_corrupted_layout_metadata_is_refused_before_claiming_a_destination(self):
        c=self.case;(c.bundle/'layouts.json').write_bytes(b'CHANGED')
        with self.assertRaises(ValueError):c.prepare()
        self.assertFalse((c.home/'.agentopia').exists())
    def test_foreign_file_reference_cannot_be_bound_to_another_account_layout(self):
        self.layouts['accounts'][0]['references'][0]['id']=str(uuid.uuid4());self.save_layouts()
        with self.assertRaisesRegex(ValueError,'owned attachments'):self.case.prepare()
        self.assertFalse((self.case.home/'.agentopia').exists())
    def test_unsafe_tab_paths_and_live_browser_tabs_are_refused(self):
        tab=self.layouts['accounts'][0]['panes']['home']['tabs'][0];tab['path']='../outside';self.save_layouts()
        with self.assertRaisesRegex(ValueError,'file tab'):self.case.prepare()
        tab.update(kind='browser',url='https://example.invalid/?token=GENERATED-SECRET');self.save_layouts()
        with self.assertRaisesRegex(ValueError,'workspace tab'):self.case.prepare()
        self.assertFalse((self.case.home/'.agentopia').exists())
    def test_interrupted_layout_staging_resumes_without_changing_operation(self):
        c=self.case
        def stop(phase):
            if phase=='staging-layouts':raise RuntimeError('Generated layout stop')
        with self.assertRaises(RuntimeError):c.prepare(phase_hook=stop)
        before=recovery.load(c.home/'.agentopia/recovery-state.json');after=c.prepare();self.assertEqual(before['operationId'],after['operationId']);self.assertEqual(recovery.load(c.appdata/'Agentopia/window.json'),self.layouts['window'])
    def test_modified_published_window_is_preserved_and_completion_is_refused(self):
        c=self.case
        def stop(phase):
            if phase=='verifying-published-files':raise RuntimeError('Generated layout stop')
        with self.assertRaises(RuntimeError):c.prepare(phase_hook=stop)
        file=c.appdata/'Agentopia/window.json';changed={'bounds':{'x':0,'y':0,'width':1000,'height':700},'maximized':False};base.write_json(file,changed)
        with self.assertRaisesRegex(ValueError,'Published window geometry changed'):c.prepare()
        self.assertEqual(recovery.load(file),changed)
    def test_edited_prepared_layout_metadata_prevents_resume(self):
        c=self.case;c.prepare();file=c.appdata/'Agentopia/restored-layouts.json';changed=recovery.load(file);changed['accounts'][0]['display']['context']='open';base.write_json(file,changed)
        with self.assertRaisesRegex(ValueError,'Prepared workspace layout recovery changed'):c.prepare()
        self.assertEqual(recovery.load(file),changed)
if __name__=='__main__':unittest.main()
