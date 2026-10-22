from pathlib import Path
from concurrent.futures import ThreadPoolExecutor,as_completed
import hashlib,json,shutil,datetime,os,signal,time
ROOT=Path('/mnt/d/Users/charl/software/Agentopia');candidate=ROOT/'.supabase/desktop-platform-release/candidate-04443';intent=json.loads((candidate/'ordinary41-program-recovery-intent.json').read_text());source=Path(intent['source']);target=Path(intent['target']);assert source.parent.parent==Path('/mnt/c/Users/charl/AgentopiaQA/chat-draft-release');assert target==Path('/mnt/c/Users/charl/AppData/Local/AgentopiaDesktop/app-0.44.41') and target.resolve()==target
expected=['python3','/mnt/d/Users/charl/software/Agentopia/scripts/desktop/restore-ordinary41-program.py'];found=[]
for directory in Path('/proc').glob('[0-9]*'):
 try:args=(directory/'cmdline').read_bytes().split(bytes([0]));args=[value.decode() for value in args if value]
 except (FileNotFoundError,PermissionError):continue
 if args==expected:found.append(int(directory.name))
assert len(found)<=1
for pid in found:
 os.kill(pid,signal.SIGINT)
 for attempt in range(100):
  if not Path('/proc',str(pid)).exists():break
  time.sleep(.1)
 assert not Path('/proc',str(pid)).exists()
files=[];directories=[]
for entry in source.rglob('*'):
 assert not entry.is_symlink()
 if entry.is_file():files.append(entry)
 else:directories.append(entry)
for entry in target.rglob('*'):
 assert not entry.is_symlink();relative=entry.relative_to(target);assert (source/relative).exists()
def mkdir(entry):(target/entry.relative_to(source)).mkdir(parents=True,exist_ok=True)
with ThreadPoolExecutor(max_workers=12) as pool:list(pool.map(mkdir,directories))
def sha(file):
 with file.open('rb') as stream:return hashlib.file_digest(stream,'sha256').hexdigest()
def copy(file):
 destination=target/file.relative_to(source);digest=sha(file)
 if destination.exists():
  assert destination.is_file() and not destination.is_symlink() and destination.stat().st_nlink==1
  if destination.stat().st_size==file.stat().st_size and sha(destination)==digest:return False
 shutil.copy2(file,destination);assert sha(destination)==digest;return True
copied=0;count=0
with ThreadPoolExecutor(max_workers=12) as pool:
 futures=[pool.submit(copy,file) for file in files]
 for future in as_completed(futures):
  copied+=future.result();count+=1
  if count%500==0:print(json.dumps({'checkedFiles':count,'filesCopiedThisPass':copied}),flush=True)
assert sha(target/'resources/app.asar')=='1d86280e08e52b7f789ca9ed388256057ed322991ca4c75110f533ed7ca6e146'
result=dict(intent,success=True,filesCompared=count,imageSha256=sha(target/'resources/app.asar'),directDesktopShortcutRequired=True,continuedAfterOwnedSlowCopy=True,oldCopyPid=found)
with (candidate/'ordinary41-program-recovery.json').open('x') as stream:json.dump(result,stream,indent=2)
print(json.dumps({'success':True,'version':'0.44.41','filesCompared':count,'profileChanged':False}),flush=True)
