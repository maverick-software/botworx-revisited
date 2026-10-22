import sys,json,hashlib,shutil
from pathlib import Path
out=Path(sys.argv[1]).resolve()
assert out.parent==Path('/mnt/d/Users/charl/software/Agentopia/.supabase/desktop-composer-appearance') and out.name.startswith('repair-')
assert Path('/opt/agentopia/runtime-instance').read_text().strip()=='a91a4800-e08f-4440-a4ec-588762d01bfd'
evidence={'canonicalWrites':0,'providerRequests':0,'snapshots':{}}
for label,source in {'ordinary':Path('/mnt/c/Users/charl/AppData/Roaming/Agentopia'),'overlay':Path('/mnt/c/Users/charl/AppData/Local/Packages/OpenAI.Codex_2p2nqsd0c76g0/LocalCache/Roaming/Agentopia')}.items():
 destination=out/('private-live-'+label+'-state');destination.mkdir()
 manifest={}
 files=[source/name for name in ['credentials.bin','Local State','window.json','runtime-binding.json','Preferences'] if (source/name).is_file()]
 files+=list((source/'attachments').rglob('*.bin'))
 for file in files:
  assert not file.is_symlink()
  digest=hashlib.sha256(file.read_bytes()).hexdigest();relative=file.relative_to(source);target=destination/relative;target.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(file,target)
  assert hashlib.sha256(target.read_bytes()).hexdigest()==digest==hashlib.sha256(file.read_bytes()).hexdigest()
  manifest[str(relative)]=digest
 evidence['snapshots'][label]={'files':manifest}
evidence['success']=True
(out/'live-state-preserved.json').write_text(json.dumps(evidence,indent=2))
print(json.dumps({'success':True,'canonicalWrites':0,'profiles':{k:len(v['files']) for k,v in evidence['snapshots'].items()}}))
