"""Read a frozen native SQLite index, including WAL, without writing to the backup."""
from contextlib import contextmanager
from pathlib import Path
import hashlib,shutil,sqlite3,tempfile

def digest(file):
    with file.open('rb') as stream:return hashlib.file_digest(stream,'sha256').hexdigest()

@contextmanager
def frozen_native_index(file):
    file=Path(file);assert file.is_file() and not file.is_symlink()
    siblings=[p for p in (file,file.with_name(file.name+'-wal'),file.with_name(file.name+'-shm')) if p.exists()]
    assert all(p.is_file() and not p.is_symlink() for p in siblings)
    before={p:digest(p) for p in siblings}
    with tempfile.TemporaryDirectory(prefix='agentopia-index-read-') as folder:
        copied=Path(folder)/file.name
        shutil.copyfile(file,copied)
        wal=file.with_name(file.name+'-wal')
        if wal in before:shutil.copyfile(wal,copied.with_name(copied.name+'-wal'))
        # SQLite may regenerate shared memory only in this disposable copy.
        connection=sqlite3.connect(copied.as_uri()+'?mode=ro',uri=True)
        try:yield connection
        finally:connection.close()
    assert {p:digest(p) for p in siblings}==before,'A frozen backup index changed while being read'
