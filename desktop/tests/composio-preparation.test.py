"""Capability-10 connection recovery before a database or model process starts."""
import importlib.util,unittest,uuid,copy
from pathlib import Path
spec=importlib.util.spec_from_file_location('layout_fixture',Path(__file__).with_name('layout-preparation.test.py'));layout=importlib.util.module_from_spec(spec);spec.loader.exec_module(layout)
recovery=layout.recovery

class ComposioPreparation(unittest.TestCase):
    save_clip=layout.LayoutPreparation.save_clip
    save_settings=layout.LayoutPreparation.save_settings
    save_external=layout.LayoutPreparation.save_external
    save_layouts=layout.LayoutPreparation.save_layouts
    tearDown=layout.LayoutPreparation.tearDown
    def setUp(self):
        layout.LayoutPreparation.setUp(self);self.state={'namespace':str(uuid.uuid4()),'connections':[{'id':str(uuid.uuid4()),'toolkit':'github','name':'Work GitHub 😀','scheme':'OAUTH2','authConfigId':'ac_generated','accountId':'ca_generated','status':'NEEDS_VERIFICATION','enabled':False,'agents':[str(uuid.uuid4())],'expiresAt':'2026-10-20T12:00:00.000Z'}],'configurations':{'github:OAUTH2':'ac_generated'}};self.settings['accounts'][0]['settings']['composio-state']=self.state;self.case.descriptor['requiresDesktopRecoveryFormat']=10;self.save_settings()
    def refused(self,pattern='Composio'):
        self.save_settings()
        with self.assertRaisesRegex(ValueError,pattern):self.case.prepare()
        self.assertFalse((self.case.home/'.agentopia').exists())
    def test_identity_grants_and_disabled_bindings_are_staged_intact_and_resume_same_operation(self):
        c=self.case;original=(c.bundle/'settings.json').read_bytes();result=c.prepare();self.assertFalse(result['databaseImported']);saved=recovery.load(c.appdata/'Agentopia/restored-settings.json');self.assertEqual(saved['accounts'][0]['settings']['composio-state'],self.state);self.assertNotIn('composio-state',saved['accounts'][1]['settings']);self.assertEqual(c.prepare()['operationId'],result['operationId']);self.assertEqual((c.bundle/'settings.json').read_bytes(),original)
    def test_capability_nine_cannot_silently_discard_composio(self):
        self.case.descriptor['requiresDesktopRecoveryFormat']=9;self.refused('Composio connections require')
    def test_credentials_cannot_enter_nested_metadata_even_with_recomputed_seals(self):
        original=copy.deepcopy(self.state)
        for target in [self.state,self.state['connections'][0]]:
            target['access_token']='GENERATED-SECRET';self.refused();del target['access_token']
        self.assertEqual(self.state,original)
    def test_active_or_enabled_portable_connections_are_refused(self):
        row=self.state['connections'][0];row['enabled']=True;self.refused('must require verification');row['enabled']=False;row['status']='ACTIVE';self.refused('must require verification')
    def test_terminal_connections_remain_terminal(self):
        for status in ['CANCELLED','DISCONNECTED','DISCONNECTING']:
            state=copy.deepcopy(self.state);state['connections'][0]['status']=status;recovery.validate_composio(state)
    def test_duplicate_local_remote_or_agent_identity_is_refused(self):
        row=self.state['connections'][0];self.state['connections'].append(copy.deepcopy(row));self.refused();self.state['connections'][1]['id']=str(uuid.uuid4());self.refused();self.state['connections'].pop();row['agents'].append(row['agents'][0].upper());self.refused('agent assignments')
    def test_invalid_namespace_scheme_instant_account_and_oversized_names_are_refused(self):
        for field,value in [('namespace','invalid'),('scheme','oauth2'),('accountId','instant_account'),('name','😀'*51),('expiresAt','invalid')]:
            target=self.state if field=='namespace' else self.state['connections'][0];original=target[field];target[field]=value;self.refused();target[field]=original
    def test_old_capability_nine_bundle_without_composio_remains_readable(self):
        del self.settings['accounts'][0]['settings']['composio-state'];self.case.descriptor['requiresDesktopRecoveryFormat']=9;self.save_settings();self.assertFalse(self.case.prepare()['databaseImported'])

if __name__=='__main__':unittest.main()
