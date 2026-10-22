"""Bounded parallel inventory with unchanged file/link checks and directory seals."""
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor,wait,FIRST_COMPLETED
import importlib.util,os,stat
spec=importlib.util.spec_from_file_location('cleanup_copy_policy',Path(__file__).resolve().parents[2]/'desktop/runtime/copy-desktop-profile.py')
policy=importlib.util.module_from_spec(spec);spec.loader.exec_module(policy)
def inventory(directory,*,metadata=False,details=False):
 root=policy.checked_root(directory,True);values={};directories={};pending=set()
 def identity(info):return info.st_dev,info.st_ino,info.st_mtime_ns
 def check_dir(file):
  info=policy.checked_entry(file,True)
  if not stat.S_ISDIR(info.st_mode):raise ValueError('A profile directory changed type')
  return 'directory',file,identity(info)
 def check_file(file):
  before=policy.checked_entry(file,True)
  if not stat.S_ISREG(before.st_mode) or before.st_nlink!=1:raise ValueError('A profile file is linked or nonregular')
  digest=None if metadata else policy.digest(file);after=policy.checked_entry(file,True)
  if (identity(before),before.st_size)!=(identity(after),after.st_size):raise ValueError('A profile file changed while hashing')
  value=(before.st_size,before.st_mtime_ns) if metadata else {'sha256':digest,'bytes':before.st_size,'mtime':before.st_mtime_ns} if details else digest
  return 'file',file.relative_to(root).as_posix(),value
 with ThreadPoolExecutor(max_workers=12) as pool:
  def collect(all=False):
   nonlocal pending
   while pending:
    finished,pending=wait(pending,return_when=FIRST_COMPLETED)
    for future in finished:
     kind,name,value=future.result()
     if kind=='file':values[name]=value
     else:directories[name]=value
    if not all:break
  todo=[root]
  while todo:
   folder=todo.pop();pending.add(pool.submit(check_dir,folder))
   with os.scandir(folder) as entries:
    for entry in entries:
     file=Path(entry.path);relative=file.relative_to(root);junction=getattr(entry,'is_junction',lambda:False)();is_dir=entry.is_dir(follow_symlinks=False) or junction
     if policy.excluded(relative,is_dir):continue
     if entry.is_symlink() or junction:raise ValueError('A profile entry is redirected')
     if is_dir:todo.append(file)
     else:pending.add(pool.submit(check_file,file))
     if len(pending)>=96:collect()
  collect(True)
  def unchanged(item):
   file,before=item
   if check_dir(file)[2]!=before:raise ValueError('A profile directory changed during inventory')
  for result in pool.map(unchanged,directories.items(),buffersize=96):pass
 return values
