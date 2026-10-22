"""Restore selected-file cloud-operation identities before any service can run."""
import importlib.util,unittest,uuid,copy
from pathlib import Path
spec=importlib.util.spec_from_file_location('composio_fixture',Path(__file__).with_name('composio-preparation.test.py'));base=importlib.util.module_from_spec(spec);spec.loader.exec_module(base)
recovery=base.recovery

class GoogleDocumentPreparation(base.ComposioPreparation):
    def setUp(self):
        super().setUp();self.operation={'id':str(uuid.uuid4()),'binding':'a'*64,'connectionId':self.state['connections'][0]['id'],'referenceId':self.case.reference,'relative':'','name':'Report.docx','sha256':'b'*64,'bytes':120,'extension':'.docx','phase':'held','createdAt':'2026-10-22T03:45:00.000Z','updatedAt':'2026-10-22T03:45:02.000Z'};self.journal={'format':1,'operations':[self.operation]};self.settings['accounts'][0]['settings']['google-documents']=self.journal;self.case.descriptor['requiresDesktopRecoveryFormat']=11;self.save_settings()
    def test_operations_are_restored_with_original_ids_and_held_state(self):
        result=self.case.prepare();self.assertFalse(result['databaseImported']);saved=recovery.load(self.case.appdata/'Agentopia/restored-settings.json');self.assertEqual(saved['accounts'][0]['settings']['google-documents'],self.journal);self.assertEqual(self.case.prepare()['operationId'],result['operationId'])
    def test_completed_cloud_identity_remains_intact(self):
        self.operation['phase']='completed';self.operation['cloudId']='cloud_123';self.save_settings();self.case.prepare();saved=recovery.load(self.case.appdata/'Agentopia/restored-settings.json');self.assertEqual(saved['accounts'][0]['settings']['google-documents']['operations'][0]['cloudId'],'cloud_123')
    def test_old_capability_cannot_discard_pending_uploads(self):
        self.case.descriptor['requiresDesktopRecoveryFormat']=10;self.refused('Google document operations require')
    def test_boolean_format_cannot_pass_as_a_format_number(self):
        self.journal['format']=True;self.refused('Google document operations')
    def test_secrets_urls_and_arbitrary_fields_cannot_enter_operation_metadata(self):
        for target in [self.journal,self.operation]:
            target['access_token']='GENERATED-SECRET';self.refused('Google document');del target['access_token']
        self.operation['signedUrl']='https://storage.example/signed';self.refused('Google document')
    def test_invalid_identity_paths_mime_extension_and_status_are_refused(self):
        for field,value in [('id','invalid'),('referenceId','invalid'),('relative','C:/private.docx'),('relative','../private.docx'),('extension','.exe'),('phase','unknown'),('bytes',True),('updatedAt','invalid'),('cloudId','../other')]:
            existed=field in self.operation;original=self.operation.get(field);self.operation[field]=value;self.refused('Google document');self.operation[field]=original
            if not existed:del self.operation[field]
    def test_duplicate_operation_or_binding_cannot_create_a_second_record(self):
        self.journal['operations'].append(copy.deepcopy(self.operation));self.refused('Google document');self.journal['operations'][1]['id']=str(uuid.uuid4());self.refused('Google document')
    # Parent legacy fixtures intentionally lack Google operations.
    def test_old_capability_nine_bundle_without_composio_remains_readable(self):
        del self.settings['accounts'][0]['settings']['google-documents'];super().test_old_capability_nine_bundle_without_composio_remains_readable()

if __name__=='__main__':unittest.main()
