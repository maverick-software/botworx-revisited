"""Compare every pre-existing saved row, permitting additions from the bounded QA workflow."""
from pathlib import Path
from collections import Counter
import datetime,hashlib,json,os,re,subprocess,glob
from urllib.parse import urlparse,unquote
root=Path('/mnt/d/Users/charl/software/Agentopia');pointer=json.loads((root/'.supabase/desktop-request-edits-live/current.json').read_text());value=pointer['out'];out=Path('/mnt/'+value[0].lower()+value[2:].replace('\\','/'));assert out.parent==Path('/mnt/d/Users/charl/AgentopiaQA/request-edits-live')
os.umask(0o077);os.chdir('/home/agentopia/app');stack=json.loads(subprocess.check_output(['supabase','stack','status','--output-format','json'],text=True));db=urlparse(stack['env']['DB_URL']);binary=Path(glob.glob('/home/agentopia/.supabase/cache/stack/slim-services/postgres/*/linux-amd64/*/bin/psql')[0]).parent
env=dict(os.environ,PGPASSWORD=unquote(db.password or ''),PGOPTIONS='-c default_transaction_read_only=on')
recovery = Path('/mnt/c/Users/charl/AgentopiaRecovery/document-refresh-12/1792471594097')
binary = binary
before = {}
for schema, archive in [('public', 'application.dump'), ('auth', 'auth.dump'), ('vault', 'vault.dump')]:
    text = subprocess.check_output([str(binary / 'pg_restore'), '--data-only', '--file=-', str(recovery / 'current-database-backup' / archive)], text=True)
    for match in re.finditer(r'^COPY ([a-z_]+)\."?([a-z_0-9]+)"? \(([^\n]+)\) FROM stdin;\n(.*?)^\\\.\n', text, re.M | re.S):
        found, name = match.group(1, 2)
        if found != schema or (schema == 'auth' and name != 'users') or (schema == 'vault' and name != 'secrets'):
            continue
        columns = [c.strip().strip('"') for c in match[3].split(',')]
        assert all(re.fullmatch('[a-z_0-9]+', c) for c in columns)
        keep = [i for i, c in enumerate(columns) if schema != 'auth' or c not in ('last_sign_in_at', 'updated_at')]
        normalize = lambda rows, keep=keep: Counter('\t'.join(row.split('\t')[i] for i in keep) for row in rows)
        before[schema + '.' + name] = (columns, normalize(match[4].splitlines()), normalize)
assert len(before) == 126
args = [str(binary / 'psql'), '-XqAt', '-v', 'ON_ERROR_STOP=1', '-h', '127.0.0.1', '-p', str(db.port), '-U', 'supabase_admin', '-d', 'postgres']
tables, changed = {}, []
for key, (columns, old, normalize) in before.items():
    schema, name = key.split('.')
    query = 'COPY (SELECT ' + ','.join('"' + c + '"' for c in columns) + ' FROM ' + schema + '."' + name + '") TO STDOUT;'
    current = subprocess.run(args, input=query, text=True, env=dict(env, PGTZ='UTC'), capture_output=True, check=True).stdout
    current = normalize(current.splitlines())
    missing, added = old - current, current - old
    if missing:
        changed.append(key)
    tables[key] = {'priorRows': sum(old.values()), 'currentRows': sum(current.values()), 'missingOrChangedPriorRows': sum(missing.values()), 'additionalRows': sum(added.values())}
record={'success':not changed,'at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'allPriorRowsPreserved':not changed,'tablesCompared':len(tables),'changedPriorTables':changed,'tables':tables,'providerRequests':0,'databaseReadOnly':True}
file=out/('saved-data-'+str(__import__('time').time_ns()//1000000)+'.json')
with file.open('x') as f:json.dump(record,f,indent=2)
print(json.dumps({k:v for k,v in record.items() if k!='tables'}|{'file':str(file)}))
assert not changed,('Pre-existing rows changed',changed)
