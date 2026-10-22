"""Retire only a verified stopped PostgreSQL process record in the private runtime."""
from pathlib import Path
import glob,json,re,subprocess

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

if __name__=='__main__':retire_runtime_pidfiles()
