import hashlib,json,unittest,importlib.util
from pathlib import Path
spec=importlib.util.spec_from_file_location('clipboard_fixture',Path(__file__).with_name('clipboard-preparation.test.py'));clipboard=importlib.util.module_from_spec(spec);spec.loader.exec_module(clipboard)
base=clipboard.base;recovery=clipboard.recovery

class SettingsPreparation(unittest.TestCase):
    save_clip=clipboard.ClipboardPreparationTests.save_clip
    tearDown=clipboard.ClipboardPreparationTests.tearDown
    def setUp(self):
        clipboard.ClipboardPreparationTests.setUp(self);c=self.case
        self.settings={'format':1,'kind':'agentopia-portable-settings','databaseManifestSha256':recovery.digest(c.bundle/'database/manifest.json'),'accounts':[{'owner':c.owner,'settings':{'preferences':{'theme':'dark','textSize':'large','sendWith':'enter','sidebarCollapsed':False},'prefer-chatgpt':False}},{'owner':c.other,'settings':{}}]}
        c.descriptor['requiresDesktopRecoveryFormat']=4;self.save_settings()
    def save_settings(self):
        self.settings['indexSha256']=hashlib.sha256(json.dumps({key:self.settings[key] for key in ('format','kind','databaseManifestSha256','accounts')},ensure_ascii=False,separators=(',',':')).encode()).hexdigest();base.write_json(self.case.bundle/'settings.json',self.settings)
        self.case.descriptor['settingsManifest']={'file':'settings.json','sha256':recovery.digest(self.case.bundle/'settings.json')};self.case.seal()
    def test_settings_prepare_before_database_and_resume_with_same_operation(self):
        c=self.case;result=c.prepare();profile=c.appdata/'Agentopia';self.assertEqual(result['settingsIndexSha256'],self.settings['indexSha256']);self.assertFalse(result['databaseImported']);self.assertEqual(recovery.load(profile/'restored-settings.json'),self.settings);self.assertEqual(c.prepare()['operationId'],result['operationId'])
    def test_changed_settings_resource_is_refused_before_claiming_destination(self):
        c=self.case;(c.bundle/'settings.json').write_text('CHANGED')
        with self.assertRaises(ValueError):c.prepare()
        self.assertFalse((c.home/'.agentopia').exists())
    def test_foreign_settings_owner_cannot_enter_matching_snapshot(self):
        self.settings['accounts'][0]['owner']='99999999-9999-4999-8999-999999999999';self.save_settings()
        with self.assertRaisesRegex(ValueError,'settings account'):self.case.prepare()
        self.assertFalse((self.case.home/'.agentopia').exists())
    def test_settings_downgrade_and_missing_required_resource_are_refused(self):
        c=self.case;c.descriptor['requiresDesktopRecoveryFormat']=3;c.seal()
        with self.assertRaisesRegex(ValueError,'newer recovery capability'):c.prepare()
        c.descriptor['requiresDesktopRecoveryFormat']=4;del c.descriptor['settingsManifest'];c.seal()
        with self.assertRaisesRegex(ValueError,'settings resource is required'):c.prepare()
        self.assertFalse((c.home/'.agentopia').exists())
    def test_changed_published_settings_are_preserved_and_completion_is_refused(self):
        c=self.case
        def stop(phase):
            if phase=='verifying-published-files':raise RuntimeError('Generated settings stop')
        with self.assertRaises(RuntimeError):c.prepare(phase_hook=stop)
        file=c.appdata/'Agentopia/restored-settings.json';changed=recovery.load(file);changed['accounts'][0]['settings']['prefer-chatgpt']=True;base.write_json(file,changed)
        with self.assertRaisesRegex(ValueError,'settings recovery metadata changed'):c.prepare()
        self.assertEqual(recovery.load(file),changed)
    def test_interrupted_settings_staging_resumes_same_operation(self):
        c=self.case
        def stop(phase):
            if phase=='staging-settings':raise RuntimeError('Generated settings stop')
        with self.assertRaises(RuntimeError):c.prepare(phase_hook=stop)
        before=recovery.load(c.home/'.agentopia/recovery-state.json');self.assertEqual(before['status'],'interrupted');after=c.prepare();self.assertEqual(before['operationId'],after['operationId']);self.assertEqual(recovery.load(c.appdata/'Agentopia/restored-settings.json'),self.settings)
    def test_unknown_setting_categories_are_refused_without_database_start(self):
        self.settings['accounts'][0]['settings']['chatgpt']={'access_token':'GENERATED-SECRET'};self.save_settings()
        with self.assertRaisesRegex(ValueError,'settings account or fields'):self.case.prepare()
        self.assertFalse((self.case.home/'.agentopia').exists())

class NotificationSettingsValidation(unittest.TestCase):
    def record(self,value):
        record={'format':1,'kind':'agentopia-portable-settings','databaseManifestSha256':'a'*64,'accounts':[{'owner':'generated-owner','settings':{'notification-preferences':value}}]}
        record['indexSha256']=hashlib.sha256(json.dumps(record,ensure_ascii=False,separators=(',',':')).encode()).hexdigest()
        return record
    def test_notification_fields_are_boolean_and_complete(self):
        recovery.validate_settings(self.record({'responses':False,'tasks':True}),{'generated-owner'},'a'*64)
        recovery.validate_settings(self.record({'completion':'always','permissions':False,'questions':True,'tasks':False}),{'generated-owner'},'a'*64)
        for value in ({'responses':True},{'responses':True,'tasks':1},{'responses':False,'tasks':True,'email':True},None,[]):
            with self.assertRaisesRegex(ValueError,'notification settings'):recovery.validate_settings(self.record(value),{'generated-owner'},'a'*64)
        for value in ({'completion':'sometimes','permissions':False,'questions':True,'tasks':False},{'completion':'always','permissions':1,'questions':True,'tasks':False},{'completion':'always','permissions':True,'questions':True},{'completion':'always','permissions':True,'questions':True,'tasks':False,'email':True}):
            with self.assertRaisesRegex(ValueError,'notification settings'):recovery.validate_settings(self.record(value),{'generated-owner'},'a'*64)

if __name__=='__main__':unittest.main()
