"""Inspect copied native indexes without changing the indexes or their WAL files."""
from pathlib import Path
import hashlib,json,os,sys
sys.path.insert(0,str(Path(__file__).resolve().parent))
from native_index_reader import frozen_native_index

profile=Path(sys.argv[1]).resolve(strict=True)
assert profile.is_dir() and not profile.is_symlink()
homes=[];rollouts={}
for database in sorted((profile/'codex').glob('*/*/*/state_5.sqlite')):
    with frozen_native_index(database) as connection:
        assert connection.execute('PRAGMA integrity_check').fetchone()==('ok',)
        rows=connection.execute('SELECT id,rollout_path,archived FROM threads ORDER BY id').fetchall()
    threads=[]
    for identifier,location,archived in rows:
        file=Path(str(location).removeprefix(chr(92)*2+'?'+chr(92)))
        assert file.is_relative_to(database.parent) and file.is_file() and not file.is_symlink()
        assert file.resolve()==file and file.stat().st_nlink==1
        relative=file.relative_to(profile).as_posix()
        rollouts[relative]=hashlib.file_digest(file.open('rb'),'sha256').hexdigest()
        threads.append({'id':identifier,'path':str(file),'relative':relative,'archived':bool(archived)})
    homes.append({'directory':str(database.parent),'relative':database.parent.relative_to(profile).as_posix(),'threads':threads})
assert homes and rollouts,'A complete existing profile must contain native history'
print(json.dumps({'homes':homes,'rollouts':rollouts}),flush=True)
