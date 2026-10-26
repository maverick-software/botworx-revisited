"""Retire only a verified stopped PostgreSQL process record in the private runtime."""
from pathlib import Path
import glob,hashlib,json,re,subprocess,sys,time,tomllib,uuid

class DatabaseStillStopping(RuntimeError):pass

def shared_memory_attached(lines,proc):
    if len(lines)<7 or not lines[6].strip():return False
    fields=lines[6].split()
    if len(fields)!=2 or not all(re.fullmatch('-?[0-9]+',item) for item in fields):
        raise RuntimeError('Could not verify the database shared-memory record')
    identifier=int(fields[1]);table=(Path(proc)/'sysvipc/shm').read_text().splitlines()
    if not table:raise RuntimeError('Could not verify stopped database workers')
    header=table[0].split()
    if not {'shmid','nattch'}.issubset(header):raise RuntimeError('Could not verify stopped database workers')
    for row in table[1:]:
        values=dict(zip(header,row.split()))
        if int(values['shmid'])==identifier and int(values['nattch'])>0:return True
    return False

def retire_stopped_pidfile(directory,pg_ctl,proc=Path('/proc'),runner=subprocess.run):
    directory=Path(directory);proc=Path(proc)
    if not directory.is_absolute() or directory.is_symlink() or not directory.is_dir() or directory.resolve()!=directory or not proc.is_dir():
        raise RuntimeError('Could not verify the database data directory')
    if (directory/'PG_VERSION').read_text().strip()!='17' or not (directory/'global/pg_control').is_file():
        raise RuntimeError('Could not verify the existing PostgreSQL database')
    pidfile=directory/'postmaster.pid'
    try:before=pidfile.lstat()
    except FileNotFoundError:return False
    if not pidfile.is_file() or pidfile.is_symlink() or before.st_nlink!=1 or before.st_size>4096:
        raise RuntimeError('Could not verify the database process record')
    contents=pidfile.read_bytes();lines=contents.decode().splitlines()
    if len(lines)<3 or not lines[0].isdigit() or int(lines[0])<=0 or Path(lines[1]).resolve()!=directory:
        raise RuntimeError('The database process record has a different directory')
    if (proc/lines[0]).exists():return False
    status=runner([str(pg_ctl),'-D',str(directory),'status'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL).returncode
    if status==0:return False
    if status!=3:raise RuntimeError('Could not verify that PostgreSQL is stopped')
    if shared_memory_attached(lines,proc):raise DatabaseStillStopping('Database workers are still attached to shared memory')
    after=pidfile.lstat()
    if (before.st_ino,before.st_dev,before.st_size,before.st_mtime_ns)!=(after.st_ino,after.st_dev,after.st_size,after.st_mtime_ns) or pidfile.read_bytes()!=contents or (proc/lines[0]).exists():
        raise RuntimeError('The database process record changed during shutdown verification')
    pidfile.unlink();return True

def retire_runtime_pidfiles():
    base=Path('/home/agentopia/.supabase/stacks');directories=[]
    for statefile in base.glob('*/state.json'):
        if statefile.is_symlink() or not re.fullmatch('[a-f0-9]{64}',statefile.parent.name):
            raise RuntimeError('Could not verify the private runtime state')
        state=json.loads(statefile.read_text());identity=state.get('identity',{})
        if identity.get('projectRoot')!='/home/agentopia/app' or identity.get('stackName')!='default' or identity.get('branchContext')!='ordinary-workspace':continue
        for directory in (statefile.parent/'data').glob('*/data'):
            if (directory/'PG_VERSION').exists():directories.append(directory)
    if len(directories)>1:raise RuntimeError('The private database data directory is ambiguous')
    if not directories:return 0
    controls=glob.glob('/home/agentopia/.supabase/cache/stack/slim-services/postgres/*/linux-amd64/*/bin/pg_ctl')
    if len(controls)!=1:raise RuntimeError('Could not verify the PostgreSQL controller')
    return int(retire_stopped_pidfile(directories[0],Path(controls[0])))

CORE_SERVICES={'database','rest','auth','realtime','storage','functions'}

def verified_existing_runtime(instance,root=Path('/opt/agentopia'),home=Path('/home/agentopia')):
    """Read-only gate: reconnecting must never create a database or a key."""
    if str(uuid.UUID(instance))!=instance:raise RuntimeError('Invalid runtime instance')
    assert (root/'runtime-identity').read_text().strip()=='local.agentopia.desktop-runtime.v1'
    assert (root/'runtime-instance').read_text().strip()==instance
    states=list((home/'.supabase/stacks').glob('*/state.json'))
    assert len(states)==1 and not states[0].is_symlink() and re.fullmatch('[a-f0-9]{64}',states[0].parent.name),'The existing service state is unavailable'
    saved=json.loads(states[0].read_text())
    identity=saved.get('identity',{})
    assert identity.get('projectRoot')=='/home/agentopia/app' and identity.get('stackName')=='default' and identity.get('branchContext')=='ordinary-workspace'
    versions=list((states[0].parent/'data').glob('*/data/PG_VERSION'))
    assert len(versions)==1 and versions[0].read_text().strip()=='17'
    directory=versions[0].parent
    assert directory.resolve()==directory and not directory.is_symlink() and (directory/'global/pg_control').is_file()
    key_file=directory.parent/'pgsodium_root.key'
    assert key_file.is_file() and not key_file.is_symlink()
    key=key_file.read_text().strip()
    assert re.fullmatch('[0-9a-fA-F]{64}',key)
    configuration=tomllib.loads((home/'app/supabase/config.toml').read_text())
    assert saved['credentials']['postgresRootKey']==key
    assert json.loads((home/'.config/agentopia/runtime-secrets.json').read_text())['root_key']==key
    assert configuration['db']['root_key']==key
    return {'instance':instance,'directory':str(directory),'port':configuration['db']['port'],
            'rootFingerprint':hashlib.sha256(key.encode()).hexdigest(),
            'maintenanceFingerprint':hashlib.sha256((root/'manage.py').read_bytes()).hexdigest()}

def existing_services_healthy(state):
    return state.get('runtime')=='native' and CORE_SERVICES <= {row['service'] for row in state.get('services',[]) if row.get('state')=='running' and row.get('health')=='healthy'}

def resume_existing_services(instance,root=Path('/opt/agentopia'),home=Path('/home/agentopia'),run=subprocess.run,read_status=subprocess.check_output,retire=retire_runtime_pidfiles,expected_port=None):
    before=verified_existing_runtime(instance,root,home)
    if expected_port is not None:assert 1<=expected_port<=65535 and before['port']==expected_port,'The bound database port changed'
    def status():
        from urllib.parse import urlparse
        value=json.loads(read_status(['supabase','stack','status','--output-format','json'],text=True))
        assert value.get('runtime')=='native'
        if value.get('env',{}).get('DB_URL'):
            address=urlparse(value['env']['DB_URL'])
            assert address.hostname in ('127.0.0.1','localhost','::1') and address.port==before['port']
        return value
    current=status();started=False
    if not existing_services_healthy(current):
        retire()
        result=run(['supabase','start','--runtime','native','--eager','--exclude','analytics,pooler,studio'],capture_output=True,text=True,timeout=240)
        if result.returncode:raise RuntimeError('Existing local services could not reconnect. Reopen Agentopia or export diagnostics.')
        started=True;deadline=time.monotonic()+60
        while not existing_services_healthy(current:=status()) and time.monotonic()<deadline:time.sleep(1)
    assert existing_services_healthy(current),'The existing services did not become healthy'
    assert verified_existing_runtime(instance,root,home)==before,'The existing runtime identity or key bindings changed'
    return {'success':True,'existingServicesStarted':started,'coreServicesHealthy':6,'identityVerified':True,'encryptionRootBindingsVerified':4,'provisioned':False,'sqlWrites':0}

if __name__=='__main__':
    if len(sys.argv)==1:retire_runtime_pidfiles()
    elif len(sys.argv)==4 and sys.argv[1]=='--resume-existing':
        import os
        os.chdir('/home/agentopia/app')
        print(json.dumps(resume_existing_services(sys.argv[2],expected_port=int(sys.argv[3]))))
    else:raise RuntimeError('Unsupported existing-runtime operation')
