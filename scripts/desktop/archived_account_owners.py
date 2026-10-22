"""Derive portable-reference owners from the exact offline auth archive."""
from pathlib import Path
import glob,hashlib,json,re,subprocess,sys

UUID=re.compile(r'^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$',re.I)
ALLOWED={'auth.dump','application.dump','vault.dump','database.dump','recovery.dump','pgsodium_root.key'}
REQUIRED={'auth.dump','application.dump','vault.dump','pgsodium_root.key'}

def digest(file):
    with Path(file).open('rb') as stream:return hashlib.file_digest(stream,'sha256').hexdigest()

def regular(file):
    file=Path(file).absolute()
    for part in [file,*file.parents]:
        assert not part.is_symlink() and not getattr(part,'is_junction',lambda:False)(),'Linked backup resource'
        assert part.resolve()==part,'Redirected backup resource'
    assert file.is_file() and file.stat().st_nlink==1,'Invalid backup resource'
    return file

def parse_accounts(sql,count):
    assert isinstance(count,int) and not isinstance(count,bool) and 0<=count<=10000,'Invalid account count'
    tables=list(re.finditer(r'^COPY auth\."?users"? \(([^\n]+)\) FROM stdin;\n(.*?)^\\\.\n',sql,re.M|re.S))
    assert len(tables)==1,'The auth archive must contain one users table'
    columns=[name.strip().strip('"') for name in tables[0][1].split(',')]
    assert columns.count('id')==1,'The auth archive has no unique account ID column'
    owners=[]
    for row in tables[0][2].splitlines():
        fields=row.split('\t');assert len(fields)==len(columns),'Invalid account row'
        owner=fields[columns.index('id')];assert UUID.fullmatch(owner),'Invalid account identity';owners.append(owner)
    assert len(owners)==count and len(set(owner.lower() for owner in owners))==count,'Account count or identities differ'
    return owners

def capture_owners(database,output,pg_restore=None,reader=None):
    database=Path(database).absolute();manifest_file=regular(database/'manifest.json');before=digest(manifest_file)
    manifest=json.loads(manifest_file.read_text(encoding='utf-8-sig'));assert manifest.get('format')==1 and isinstance(manifest.get('files'),list)
    seen=set()
    for item in manifest['files']:
        name=item.get('name');assert name in ALLOWED and name not in seen and re.fullmatch('[a-f0-9]{64}',item.get('sha256','')),'Invalid backup manifest entry'
        seen.add(name);assert digest(regular(database/name))==item['sha256'],'Changed database archive'
    assert REQUIRED<=seen,'Incomplete database recovery files'
    auth_hash=digest(database/'auth.dump')
    if reader is None:
        if pg_restore is None:
            binaries=glob.glob('/home/agentopia/.supabase/cache/stack/slim-services/postgres/*/linux-amd64/*/bin/pg_restore');assert len(binaries)==1,'Select the matching offline archive reader';pg_restore=binaries[0]
        sql=subprocess.check_output([str(pg_restore),'--data-only','--schema=auth','--table=users','--file=-',str(database/'auth.dump')],text=True)
    else:sql=reader(database/'auth.dump')
    owners=parse_accounts(sql,manifest.get('accounts'))
    assert digest(manifest_file)==before and digest(database/'auth.dump')==auth_hash,'Archive changed while reading account IDs'
    output=Path(output).absolute();assert output.parent==database.parent and output.parent.resolve()==output.parent,'Account index must remain in its backup'
    receipt={'format':1,'kind':'agentopia-archived-account-owners','databaseManifestSha256':before,'authArchiveSha256':auth_hash,'accounts':owners}
    with output.open('x',encoding='utf-8') as stream:json.dump(receipt,stream,indent=2)
    return receipt

if __name__=='__main__':
    assert len(sys.argv)==3
    result=capture_owners(sys.argv[1],sys.argv[2]);print(json.dumps({'success':True,'accounts':len(result['accounts']),'databaseManifestSha256':result['databaseManifestSha256'],'providerRequests':0,'databaseServicesStarted':0}))
