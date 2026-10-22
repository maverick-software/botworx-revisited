"""Prepare generated capability-9 bundles; no database service or provider starts."""
import importlib.util,unittest,uuid
from pathlib import Path
spec=importlib.util.spec_from_file_location('layout_fixture',Path(__file__).with_name('layout-preparation.test.py'));layout=importlib.util.module_from_spec(spec);spec.loader.exec_module(layout)
recovery=layout.recovery

class SelectedSourcePreparation(unittest.TestCase):
    save_clip=layout.LayoutPreparation.save_clip
    save_settings=layout.LayoutPreparation.save_settings
    save_external=layout.LayoutPreparation.save_external
    save_layouts=layout.LayoutPreparation.save_layouts
    tearDown=layout.LayoutPreparation.tearDown
    def setUp(self):
        layout.LayoutPreparation.setUp(self);c=self.case;source_id=str(uuid.uuid4())
        self.source={'kind':'chat','id':source_id,'owner':c.owner,'title':'Generated saved conversation','url':'agentopia-chat://'+source_id,'text':'user: Preserve this source snapshot.','notice':'Generated reference material','capturedAt':'2026-10-20T12:00:00.000Z'}
        self.draft={'text':'Keep the typed question separate.','options':{'thinking':'high','permission':'full','mode':'chat','files':[],'sources':[self.source]},'updatedAt':'2026-10-20T12:01:00.000Z'}
        self.scope='conversation:'+source_id;self.settings['accounts'][0]['settings']['chat-drafts']={self.scope:self.draft};c.descriptor['requiresDesktopRecoveryFormat']=9;self.save_settings()
    def test_source_snapshot_and_question_are_staged_intact_and_resume_same_operation(self):
        c=self.case;original=(c.bundle/'settings.json').read_bytes();result=c.prepare();self.assertFalse(result['databaseImported']);saved=recovery.load(c.appdata/'Agentopia/restored-settings.json');self.assertEqual(saved['accounts'][0]['settings']['chat-drafts'][self.scope],self.draft);self.assertEqual(c.prepare()['operationId'],result['operationId']);self.assertEqual((c.bundle/'settings.json').read_bytes(),original)
    def test_foreign_source_owner_is_refused_before_preparation(self):
        self.source['owner']=self.case.other;self.save_settings()
        with self.assertRaisesRegex(ValueError,'selected source owner'):self.case.prepare()
        self.assertFalse((self.case.home/'.agentopia').exists())
    def test_downgraded_capability_cannot_drop_source_metadata(self):
        self.case.descriptor['requiresDesktopRecoveryFormat']=8;self.case.seal()
        with self.assertRaisesRegex(ValueError,'Selected source snapshots require'):self.case.prepare()
        self.assertFalse((self.case.home/'.agentopia').exists())
    def test_oversized_source_and_duplicate_selection_are_refused(self):
        self.source['text']='x'*16001;self.save_settings()
        with self.assertRaisesRegex(ValueError,'selected source text'):self.case.prepare()
        self.source['text']='Bounded text';self.draft['options']['sources'].append(dict(self.source));self.save_settings()
        with self.assertRaisesRegex(ValueError,'Duplicate selected source'):self.case.prepare()
        self.assertFalse((self.case.home/'.agentopia').exists())

if __name__=='__main__':unittest.main()
