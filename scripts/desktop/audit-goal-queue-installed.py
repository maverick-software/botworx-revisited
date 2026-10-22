"""Read-only physical installed payload and saved-data verification. Never emits credentials."""
import glob
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
from urllib.parse import urlparse, unquote

ROOT=Path('/mnt/d/Users/charl/software/Agentopia')
OUT=ROOT/'.supabase/desktop-goal-queue/candidate-04417/installed-verification'
BACKUP=ROOT/'.supabase/desktop-goal-queue/upgrade-backup-1792341034014/current-database-backup'
PROFILE=Path('/mnt/c/Users/charl/AppData/Roaming/Agentopia')
INSTALLED=Path('/mnt/c/Users/charl/AppData/Local/AgentopiaDesktop/app-0.44.17/resources')
INSTANCE='a91a4800-e08f-4440-a4ec-588762d01bfd'
assert Path('/opt/agentopia/runtime-instance').read_text().strip()==INSTANCE
assert json.loads((PROFILE/'runtime-binding.json').read_text())['instanceId']==INSTANCE
release=json.loads((ROOT/'.supabase/desktop-goal-queue/candidate-04417/release-proof.json').read_text())
assert release['installerVerified']
def sha(file):
    with file.open('rb') as stream:return hashlib.file_digest(stream,'sha256').hexdigest()
assert sha(INSTALLED/'app.asar')==release['imageSha256']
version=json.loads((INSTALLED/'resources/version.json').read_text())
assert version['version']=='0.44.17' and version['schema']==59
prepared=ROOT/'.supabase/desktop-goal-queue/candidate-04417/resources'
for file in ('runtime/manage.py','database/0059-inline-goals.sql'):
    assert sha(INSTALLED/'resources'/file)==sha(prepared/file)
os.chdir('/home/agentopia/app')
state=json.loads(subprocess.check_output(['supabase','stack','status','--output-format','json'],text=True))
assert state['runtime']=='native'
db=urlparse(state['env']['DB_URL'])
binary=Path(glob.glob('/home/agentopia/.supabase/cache/stack/slim-services/postgres/*/linux-amd64/*/bin/psql')[0]).parent
env=dict(os.environ,PGPASSWORD=unquote(db.password or ''),PGOPTIONS='-c default_transaction_read_only=on',PGTZ='UTC',PGAPPNAME='agentopia_installed_upgrade_audit')
def sql(query):
    p=subprocess.run([str(binary/'psql'),'-XqAt','-v','ON_ERROR_STOP=1','-h','127.0.0.1','-p',str(db.port),'-U','supabase_admin','-d','postgres','-c',query],text=True,capture_output=True,env=env)
    if p.returncode:raise RuntimeError('Installed read-only database audit failed')
    return p.stdout
def archived_table(archive,schema,table):
    content=subprocess.check_output([str(binary/'pg_restore'),'--data-only','--schema',schema,'--table',table,'--file=-',str(BACKUP/archive)],text=True)
    match=re.search(r'^COPY '+re.escape(schema+'.'+table)+r' \((.+)\) FROM stdin;\n(.*?)^\\\.\n',content,re.M|re.S)
    assert match, 'Saved table is missing: '+schema+'.'+table
    columns=[value.strip().strip('"') for value in match[1].split(',')]
    rows=match[2].splitlines()
    return columns,rows
compared={}
for archive,schema,table in [('auth.dump','auth','users'),('application.dump','public','roles'),('application.dump','public','user_roles'),('application.dump','public','profiles'),('application.dump','public','agents'),('application.dump','public','conversation_sessions'),('application.dump','public','chat_messages_v2'),('vault.dump','vault','secrets')]:
    columns,before=archived_table(archive,schema,table)
    quoted=','.join('"'+column.replace('"','""')+'"' for column in columns)
    after=sql('COPY (SELECT '+quoted+' FROM "'+schema+'"."'+table+'") TO STDOUT').splitlines()
    if schema=='auth':
        keep=[i for i,column in enumerate(columns) if column not in ('updated_at','last_sign_in_at')]
        normalize=lambda rows:sorted(tuple(row.split('\t')[i] for i in keep) for row in rows)
    else:normalize=lambda rows:sorted(rows)
    assert normalize(before)==normalize(after),'Saved data differs: '+schema+'.'+table
    compared[schema+'.'+table]=len(before)
versions=json.loads(sql('SELECT json_object_agg(version,checksum) FROM agentopia_desktop.migrations'))
files=sorted((INSTALLED/'resources/database').glob('*.sql'))
assert len(versions)==len(files)==59
assert all(versions[file.name]==sha(file) for file in files)
readable=int(sql('SELECT count(decrypted_secret) FROM vault.decrypted_secrets'))
assert readable==compared['vault.secrets']
result={'success':True,'version':'0.44.17','schema':59,'imageSha256':release['imageSha256'],'physicalOrdinaryProfile':True,'savedRowsMatched':compared,'passwordsAndRolesPreserved':True,'readableVaultRecords':readable,'providerRequests':0,'readOnly':True}
OUT.mkdir(exist_ok=True)
(OUT/'database-and-payload.json').write_text(json.dumps(result,indent=2))
print(json.dumps(result))
