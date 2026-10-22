from pathlib import Path
import hashlib,json,shutil,datetime,os
ROOT=Path('/mnt/d/Users/charl/software/Agentopia');candidate=ROOT/'.supabase/desktop-platform-release/candidate-04443';proof=json.loads((ROOT/'.supabase/desktop-platform-release/candidate-04441/package-proof.json').read_text());assert proof['success'] and proof['version']=='0.44.41'
def linux(value):return Path('/mnt/'+value[0].lower()+value[2:].replace(chr(92),'/'))
def sha(file):
 with file.open('rb') as stream:return hashlib.file_digest(stream,'sha256').hexdigest()
source=linux(proof['portableDirectory']);assert source.parent.parent==Path('/mnt/c/Users/charl/AgentopiaQA/chat-draft-release');assert sha(source/'resources/app.asar')==proof['imageSha256']=='1d86280e08e52b7f789ca9ed388256057ed322991ca4c75110f533ed7ca6e146'
parent=Path('/mnt/c/Users/charl/AppData/Local');target=parent/'AgentopiaDesktop/app-0.44.41';assert parent.resolve()==parent and parent.is_dir();assert not target.parent.exists()
for entry in source.rglob('*'):assert not entry.is_symlink()
intent={'at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'version':'0.44.41','source':str(source),'target':str(target),'reason':'Restore the prior verified program files after a Store-context installer moved the application into its redirected folder. Saved profiles and database remain unchanged.','programFilesOnly':True,'providerRequests':0}
with (candidate/'ordinary41-program-recovery-intent.json').open('x') as stream:json.dump(intent,stream,indent=2)
shutil.copytree(source,target);count=0
for file in source.rglob('*'):
 if file.is_file():assert sha(file)==sha(target/file.relative_to(source));count+=1
result=dict(intent,success=True,filesCompared=count,imageSha256=sha(target/'resources/app.asar'),directDesktopShortcutRequired=True)
with (candidate/'ordinary41-program-recovery.json').open('x') as stream:json.dump(result,stream,indent=2)
print(json.dumps({'success':True,'version':'0.44.41','filesCompared':count,'profileChanged':False}))
