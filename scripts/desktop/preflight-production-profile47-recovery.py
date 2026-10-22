"""Measure the physical backup scope and refuse active work or insufficient space."""
from pathlib import Path
import datetime,glob,json,os,shutil,stat,subprocess,sys
from urllib.parse import urlparse,unquote
sys.path.insert(0,str(Path(__file__).parent))
from phased_backup import profile_data_entry
root=Path('/mnt/d/Users/charl/software/Agentopia')
assert Path('/opt/agentopia/runtime-instance').read_text().strip()=='a91a4800-e08f-4440-a4ec-588762d01bfd'
os.chdir('/home/agentopia/app')
state=json.loads(subprocess.check_output(['supabase','stack','status','--output-format','json'],text=True));db=urlparse(state['env']['DB_URL'])
binary=glob.glob('/home/agentopia/.supabase/cache/stack/slim-services/postgres/*/linux-amd64/*/bin/psql')[0]
env=dict(os.environ,PGPASSWORD=unquote(db.password or ''),PGOPTIONS='-c default_transaction_read_only=on')
sql="SELECT json_build_object('requests',(SELECT count(*) FROM public.desktop_requests WHERE status='running'),'goals',(SELECT count(*) FROM public.desktop_goals WHERE status='running'))"
p=subprocess.run([binary,'-XqAt','-v','ON_ERROR_STOP=1','-h','127.0.0.1','-p',str(db.port),'-U','supabase_admin','-d','postgres'],input=sql,env=env,text=True,capture_output=True,check=True)
active=json.loads(p.stdout);assert active=={'requests':0,'goals':0},'Work is active; maintenance must wait for its saved outcome'
def size(source,profile=False):
 assert source.is_dir() and not source.is_symlink() and source.resolve()==source
 count=total=0
 for directory,dirs,names in os.walk(source,followlinks=False):
  parent=Path(directory)
  def allowed(name):
   relative=str((parent/name).relative_to(source))
   return not profile or (relative not in ('backups','test-profiles','wsl/ext4.vhdx') and profile_data_entry(relative))
  dirs[:]=[name for name in dirs if allowed(name)]
  for name in dirs+names:
   if not allowed(name):continue
   file=parent/name;info=file.lstat();assert not stat.S_ISLNK(info.st_mode)
   if stat.S_ISREG(info.st_mode):count+=1;total+=info.st_size
 return {'files':count,'bytes':total}
ordinary=Path('/mnt/c/Users/charl/AppData/Roaming/Agentopia')
overlay=Path('/mnt/c/Users/charl/AppData/Local/Packages/OpenAI.Codex_2p2nqsd0c76g0/LocalCache/Roaming/Agentopia')
profiles={key:size(value,True) for key,value in [('ordinary',ordinary),('overlay',overlay)]}
installed=Path('/mnt/c/Users/charl/AppData/Local/AgentopiaDesktop/app-0.44.47/resources')
baseline=size(installed/'resources/ui');baseline['bytes']+=(installed/'app.asar').stat().st_size
vhdx=(ordinary/'wsl/ext4.vhdx').stat().st_size
private=Path('/mnt/c/Users/charl/.agentopia/desktop/profile');assert not private.exists() and not (private.parent/'profile-location.json').exists() and not (private.parent/'migration.lock').exists()
target=Path('/mnt/c/Users/charl/AgentopiaRecovery/before-private-profile-04447');target.mkdir(parents=True,exist_ok=True)
assert target.resolve()==target and not target.is_symlink()
# Budget the whole current VHDX, 1 GiB export growth, full profile data with
# generous tar overhead, rollback application/UI and 1.5 GiB remaining space.
assert len(sys.argv)==2 and __import__('re').fullmatch(r'\d{4}-\d{2}-\d{2}T[\d-]+\.\d{3}Z-manual',sys.argv[1]);logical=ordinary/'backups'/sys.argv[1]
manifest=json.loads((logical/'manifest.json').read_text())
logical_bytes=sum((logical/item['name']).stat().st_size for item in manifest['files'])+(logical/'manifest.json').stat().st_size
# Runtime capture copies the manifest-listed database files. Native histories
# are already fully included in the measured current-profile scope above.
required=vhdx+1024**3+sum(row['bytes']+row['files']*4096 for row in profiles.values())+baseline['bytes']+logical_bytes+64*1024**2+1536*1024**2+profiles['ordinary']['bytes']+profiles['ordinary']['files']*4096
free=shutil.disk_usage(target).free
result={'success':free>required,'at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'activeWork':active,'profiles':profiles,'baseline':baseline,'logicalBackupBytes':logical_bytes,'sourceVhdxBytes':vhdx,'requiredFreeBytes':required,'freeBytes':free,'includesSeparateTargetCopyBudget':True,'recoveryBase':'C:\\Users\\charl\\AgentopiaRecovery\\before-private-profile-04447','scope':'Physical measured capacity; capture must recheck free space and unchanged VHDX size after normal closure.'}
file=root/'.supabase/desktop-profile-location'/('production47-capacity-'+str(__import__('time').time_ns()//1000000)+'.json')
with file.open('x') as f:json.dump(result,f,indent=2)
print(json.dumps({**result,'capacityFile':str(file)}));assert result['success'],'Measured recovery capacity is insufficient'
