"""Read-only preservation audit, including original rows after test fixtures are added."""
import glob,hashlib,json,os,re,subprocess,sys
from collections import Counter
from pathlib import Path
from urllib.parse import urlparse,unquote
out=Path(sys.argv[1]).resolve();assert out.parent==Path('/mnt/d/Users/charl/software/Agentopia/.supabase/desktop-packaged-coordination') and re.fullmatch(r'\d{13}',out.name)
config=json.loads((out/'intent.json').read_text());assert config['schema']==68
assert Path('/opt/agentopia/runtime-instance').read_text().strip()==config['instanceId']
os.chdir('/home/agentopia/app');state=json.loads(subprocess.check_output(['supabase','stack','status','--output-format','json'],text=True));assert state['runtime']=='native'
url=urlparse(state['env']['DB_URL']);assert url.port==config['ports']['database'];binary=glob.glob('/home/agentopia/.supabase/cache/stack/slim-services/postgres/*/linux-amd64/*/bin/psql')[0]
env=dict(os.environ,PGPASSWORD=unquote(url.password or ''),PGOPTIONS='-c default_transaction_read_only=on',PGAPPNAME='agentopia_coordination_preservation_audit')
def sql(statement):
    result=subprocess.run([binary,'-XqAt','-v','ON_ERROR_STOP=1','-h','127.0.0.1','-p',str(url.port),'-U','supabase_admin','-d','postgres'],input=statement+'\n',env=env,text=True,capture_output=True)
    if result.returncode:(out/'private-preservation-error.log').write_text(result.stderr);raise RuntimeError('Preservation audit failed; inspect private-preservation-error.log')
    return result.stdout.strip()
def quote(value):return '"'+value.replace('"','""')+'"'
baseline=json.loads((out/'private-original-row-hashes.json').read_text());compared=0
for table in baseline['tables']:
    name=quote(table['schema'])+'.'+quote(table['table']);rows=json.loads(sql("SELECT coalesce(json_agg(md5(to_jsonb(q)::text)),'[]') FROM (SELECT "+','.join(map(quote,table['columns']))+' FROM '+name+') q'))
    assert not Counter(table['rows'])-Counter(rows),'Original row changed or removed: '+name
    compared+=len(table['rows'])
versions=json.loads(sql('SELECT json_object_agg(version,checksum) FROM agentopia_desktop.migrations'));files=sorted(Path('/opt/agentopia/database').glob('*.sql'));assert len(versions)==len(files)==68
for file in files:assert versions[file.name]==hashlib.sha256(file.read_bytes()).hexdigest()
root=(Path(config['profileLinux'])/'migration-input/pgsodium_root.key').read_text().strip();assert hashlib.sha256(root.encode()).hexdigest()==config['rootKeySha256']
roots=list(Path('/home/agentopia/.supabase/stacks').glob('*/data/*/pgsodium_root.key'));assert len(roots)==1 and roots[0].read_text().strip()==root
readable=int(sql('SELECT count(decrypted_secret) FROM vault.decrypted_secrets'));original_vault=len(next(table['rows'] for table in baseline['tables'] if table['schema']=='vault' and table['table']=='secrets'));assert readable>=original_vault
print(json.dumps({'success':True,'schema':68,'existingTablesCompared':len(baseline['tables']),'existingRowsCompared':compared,'readableVaultRows':readable,'encryptionRootPreserved':True,'services':[{key:service[key] for key in ('service','state','health')} for service in state['services']]}))
