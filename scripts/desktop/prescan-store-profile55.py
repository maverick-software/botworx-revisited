"""Read-only source preparation independent of the production app operation."""
from pathlib import Path
import hashlib,importlib.util,json,os,re,subprocess,time
assert os.name=='nt'
base=Path(__file__).resolve().parent;spec=importlib.util.spec_from_file_location('closed_inventory55',base/'closed-profile-inventory55.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
root=Path(r'F:\Agentopia');out=root/'.supabase/desktop-store-prescan55'/str(int(time.time()*1000));out.mkdir(parents=True)
sid=subprocess.check_output(['powershell.exe','-NoProfile','-NonInteractive','-Command','[Security.Principal.WindowsIdentity]::GetCurrent().User.Value'],text=True).strip();assert re.fullmatch(r'S-1-5-[0-9-]+',sid)
subprocess.run(['icacls.exe',str(out),'/inheritance:r','/grant:r','*'+sid+':(OI)(CI)F','*S-1-5-18:(OI)(CI)F','/Q'],check=True,capture_output=True)
source=Path(r'C:\Users\charl\AppData\Local\Packages\OpenAI.Codex_2p2nqsd0c76g0\LocalCache\Roaming\Agentopia')
print('Reading the inactive Store source while the separate F archive check finishes.',flush=True)
seal=m.inventory(source);file=out/'source-seal.json';file.write_text(json.dumps(seal,sort_keys=True));digest=hashlib.file_digest(file.open('rb'),'sha256').hexdigest()
receipt={'success':True,'source':str(source),'sourceSeal':str(file),'sourceSealSha256':digest,'files':len(seal),'providerRequests':0,'sourceReadOnly':True}
(out/'evidence.json').write_text(json.dumps(receipt,indent=2));(out.parent/'current.json').write_text(json.dumps({'out':str(out),'evidence':str(out/'evidence.json')}));print(json.dumps(receipt),flush=True)
