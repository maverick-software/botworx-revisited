"""Compare all saved public/auth/vault table rows around a resource-only update."""
from pathlib import Path
import datetime,glob,hashlib,json,os,re,subprocess,sys
from urllib.parse import urlparse,unquote
assert len(sys.argv)==3 and sys.argv[1] in ('archive','current')
mode=sys.argv[1];out=Path(sys.argv[2]);assert out.parent==Path('/mnt/c/Users/charl/AgentopiaRecovery/document-refresh-12') and re.fullmatch(r'\d{13}',out.name)
recovery=out/'ui-recovery.json' if (out/'ui-recovery.json').exists() else out/'evidence.json'
assert json.loads(recovery.read_text())['success']
binary=Path(glob.glob('/home/agentopia/.supabase/cache/stack/slim-services/postgres/*/linux-amd64/*/bin/pg_restore')[0]).parent
def fingerprint(columns,rows,schema):
    keep=[i for i,name in enumerate(columns) if schema!='auth' or name not in ('last_sign_in_at','updated_at')]
    lines=sorted('\t'.join(row.split('\t')[i] for i in keep) for row in rows)
    return {'columns':columns,'rows':len(lines),'sha256':hashlib.sha256(('\n'.join(lines)+('\n' if lines else '')).encode()).hexdigest()}
if mode=='archive':
    tables={}
    for schema,archive in [('public','application.dump'),('auth','auth.dump'),('vault','vault.dump')]:
        text=subprocess.check_output([str(binary/'pg_restore'),'--data-only','--file=-',str(out/'current-database-backup'/archive)],text=True)
        for match in re.finditer(r'^COPY ([a-z_]+)\."?([a-z_0-9]+)"? \(([^\n]+)\) FROM stdin;\n(.*?)^\\\.\n',text,re.M|re.S):
            found,name=match.group(1,2)
            if found!=schema or (schema=='auth' and name!='users') or (schema=='vault' and name!='secrets'):continue
            columns=[c.strip().strip('"') for c in match[3].split(',')];assert all(re.fullmatch('[a-z_0-9]+',c) for c in columns)
            tables[schema+'.'+name]=fingerprint(columns,match[4].splitlines(),schema)
    assert len(tables)==126,('The expected current application table scope changed',len(tables))
    receipt={'success':True,'at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'source':'fresh logical archives captured in the full current-profile recovery','tables':tables,'tableCount':len(tables),'providerRequests':0,'databaseServicesStarted':0}
    with (out/'data-before-ui.json').open('x') as stream:json.dump(receipt,stream,indent=2)
else:
    before=json.loads((out/'data-before-ui.json').read_text());tables={};os.chdir('/home/agentopia/app');stack=json.loads(subprocess.check_output(['supabase','stack','status','--output-format','json'],text=True));db=urlparse(stack['env']['DB_URL']);env=dict(os.environ,PGPASSWORD=unquote(db.password or ''),PGOPTIONS='-c default_transaction_read_only=on',PGTZ='UTC')
    args=[str(binary/'psql'),'-XqAt','-v','ON_ERROR_STOP=1','-h','127.0.0.1','-p',str(db.port),'-U','supabase_admin','-d','postgres']
    for key,record in before['tables'].items():
        schema,name=key.split('.');assert re.fullmatch('[a-z_0-9]+',name);columns=','.join('"'+c+'"' for c in record['columns'])
        text=subprocess.run(args,input='COPY (SELECT '+columns+' FROM '+schema+'."'+name+'") TO STDOUT;',text=True,env=env,capture_output=True,check=True).stdout
        tables[key]=fingerprint(record['columns'],text.splitlines(),schema)
    mismatches=[name for name in tables if tables[name]!=before['tables'][name]]
    receipt={'success':not mismatches,'at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'source':'current read-only SQL versus the fresh full-recovery archives','tables':tables,'tableCount':len(tables),'mismatches':mismatches,'providerRequests':0,'databaseReadOnly':True}
    with (out/('data-after-ui-'+str(__import__('time').time_ns()//1000000)+'.json')).open('x') as stream:json.dump(receipt,stream,indent=2)
    assert not mismatches,('Saved table rows differ',mismatches)
print(json.dumps({k:v for k,v in receipt.items() if k!='tables'}))
