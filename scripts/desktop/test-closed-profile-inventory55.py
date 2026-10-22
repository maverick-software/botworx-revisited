from pathlib import Path
import importlib.util,json,os,time
base=Path(__file__).resolve().parent
def module(name,file):
 s=importlib.util.spec_from_file_location(name,base/file);m=importlib.util.module_from_spec(s);s.loader.exec_module(m);return m
fast=module('fast_inventory','closed-profile-inventory55.py');slow=module('prior_inventory','profile_location_activation.py')
out=Path(r'F:\Agentopia\.supabase\desktop-inventory55-tests')/str(int(time.time()*1000));out.mkdir(parents=True)
root=out/'profile';root.mkdir()
names=['one.txt','nested/two.txt','Cache/ignored','test-profiles/ignored','upload-probe-1/ignored','codex/u/p/s/tmp/ignored','codex/u/p/s/skills/.system/ignored','codex/u/p/s/saved.json']
for name in names:
 p=root/name;p.parent.mkdir(parents=True,exist_ok=True);p.write_text(name)
expected=slow.inventory(root);observed=fast.inventory(root);assert observed==expected and len(observed)==3
metadata=fast.inventory(root,metadata=True)
assert metadata=={name:((root/name).stat().st_size,(root/name).stat().st_mtime_ns) for name in expected}
(root/'one.txt').touch();assert fast.inventory(root,metadata=True)!=metadata
(root/'nested/third.txt').write_text('additional');assert fast.inventory(root)==slow.inventory(root) and len(fast.inventory(root))==4
linked=root/'linked.txt';os.link(root/'one.txt',linked)
for scan in [fast.inventory,slow.inventory,lambda p:fast.inventory(p,metadata=True)]:
 try:scan(root)
 except ValueError:pass
 else:raise AssertionError('A private hardlink was accepted')
assert linked.parent==root and root.parent==out;linked.unlink()
assert fast.inventory(root)==slow.inventory(root)
(out/'evidence.json').write_text(json.dumps({'success':True,'checks':['same hashes and exclusions as qualified inventory','metadata contains exact original sizes/times','changed modification time detected','new file detected','private hardlinks rejected by hash and metadata readers','ordinary source restored and matches'],'providerRequests':0},indent=2))
print(json.dumps({'success':True,'out':str(out),'checks':6}))
