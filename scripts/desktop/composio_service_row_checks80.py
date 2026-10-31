"""Release80: fingerprint every original row; verify only additive service migration rows."""
import hashlib,json,re,uuid,datetime
from logical_row_fingerprints71 import Fingerprints
from consolidation_row_checks79 import canonical,decode,truth
KEYS={'public.desktop_plugins':('user_id','name'),'public.desktop_agent_plugins':('user_id','plugin_name','agent_id'),'public.agents':('id',),'public.desktop_host_plugin_migrations':('user_id','plugin_name')}
RESERVED={'composio','tool_router','composio_tool_router','meta_tools','managed_auth','manage_auth'}
def package(slug,title):
 assert re.fullmatch(r'_?[a-z0-9][a-z0-9_]{0,99}',slug) and slug not in RESERVED
 assert isinstance(title,str) and title==title.strip() and 0<len(title)<=80 and not re.search(r'[\x00-\x1f\x7f]',title)
 name='composio-service-'+hashlib.sha256(slug.encode()).hexdigest()[:32]
 return {'manifest':{'$schema':'https://agent-plugins.org/schemas/1.0.0/plugin.schema.json','name':name,'version':'1.0.0','description':'Use '+title+' through this account\u2019s Composio connection.','author':{'name':'Agentopia'},'extensions':{'com.agentopia':{'composioToolkit':slug},'com.openai':{'interface':{'displayName':title,'shortDescription':'Connected through Composio'}}}},'mcp':{'$schema':'https://agent-plugins.org/schemas/1.0.0/mcp.schema.json','mcpServers':{'service':{'type':'streamable-http','url':'https://connect.composio.dev/mcp','extensions':{'com.openai':{'auth':{'type':'oauth','client':{'mode':'dcr'},'baseScopes':['offline_access']}}}}}}}
class ComposioServiceFingerprints(Fingerprints):
 def __init__(self,file,policy):
  assert set(policy)=={'version','owner','catalogRevision','complete','services'} and policy['version']==80 and isinstance(policy['complete'],bool)
  self.policy=policy;self.new_tables=();self.extra=[];self.originals={};self.services={}
  if policy['owner'] is not None:assert str(uuid.UUID(policy['owner']))==policy['owner']
  if policy['complete']:assert policy['owner'] and re.fullmatch('[a-f0-9]{64}',policy['catalogRevision'] or '')
  else:assert not policy['services'],'Service additions require an actual complete inventory'
  for item in policy['services']:
   assert set(item)=={'slug','title'};pkg=package(item['slug'],item['title']);name=pkg['manifest']['name'];assert name not in self.services;self.services[name]=pkg
  super().__init__(file)
 def key(self,name,row):return canonical([row[k] for k in KEYS[name]])
 def row(self,scope,name,line):
  if name in KEYS:
   row=decode(self.tables[(scope,name)]['columns'],line);key=(name,self.key(name,row))
   if scope=='archive':assert key not in self.originals;self.originals[key]=row
   elif key not in self.originals and name in ('public.desktop_plugins','public.desktop_agent_plugins','public.desktop_host_plugin_migrations'):
    self.extra.append((name,row));return
  super().row(scope,name,line)
 def original(self,name,values):return self.originals.get((name,canonical(values)))
 def verify_migration(self):
  owner=self.policy['owner'];assert not self.extra or self.policy['complete'];plugins={};grants=[];receipts=[]
  for name,row in self.extra:
   assert row['user_id']==owner
   if name=='public.desktop_plugins':
    assert set(row)=={'user_id','name','package','digest','source','enabled','created_at'};pkg=self.services[row['name']];assert json.loads(row['package'])==pkg and row['digest']==hashlib.sha256(canonical(pkg).encode()).hexdigest() and row['source']=='bundled' and truth(row['enabled']);datetime.datetime.fromisoformat(row['created_at']);assert row['name'] not in plugins;plugins[row['name']]=row
   elif name=='public.desktop_agent_plugins':
    assert set(row)=={'user_id','plugin_name','agent_id','enabled'} and row['plugin_name'] in self.services and truth(row['enabled']);agent=self.original('public.agents',[row['agent_id']]);assert agent and agent['user_id']==owner
    legacy=self.original('public.desktop_agent_plugins',[owner,'composio-connect',row['agent_id']]);assert legacy and truth(legacy['enabled']);grants.append(row)
   else:
    assert set(row)=={'user_id','plugin_name','completed_at'} and row['plugin_name']=='composio-services-v1' and row['completed_at'];datetime.datetime.fromisoformat(row['completed_at']);receipts.append(row)
  prior=self.original('public.desktop_host_plugin_migrations',[owner,'composio-services-v1']) if owner else None
  assert len(receipts)<=1 and (not grants or len(receipts)==1 and not prior)
  for row in grants:assert row['plugin_name'] in plugins or self.original('public.desktop_plugins',[owner,row['plugin_name']])
  if receipts:
   for name in self.services:
    assert name in plugins or self.original('public.desktop_plugins',[owner,name]),'Complete migration omitted a connected service package'
    for (table,_),legacy in self.originals.items():
     if table=='public.desktop_agent_plugins' and legacy['user_id']==owner and legacy['plugin_name']=='composio-connect' and truth(legacy['enabled']):
      old=self.original('public.desktop_agent_plugins',[owner,name,legacy['agent_id']]);assert old or any(g['plugin_name']==name and g['agent_id']==legacy['agent_id'] for g in grants),'Complete migration omitted an inherited capability'
  return {'originalRowsStrictlyPreserved':True,'canonicalServicePlugins':len(plugins),'inheritedServiceGrants':len(grants),'completeInventoryReceipt':len(receipts),'catalogRevisionVerified':self.policy['catalogRevision'] if receipts else None}
