"""Use the qualified controllers from a verified physical Windows context.

Production closure remains global. No generated-profile exemptions are used.
The caller separately checks physical Windows visibility before every phase.
"""
from pathlib import Path
import json, ntpath, os, re, subprocess, sys
assert os.name == 'nt'
sys.path.insert(0, str(Path(__file__).resolve().parent))
import stage_relocated_profile as staging
import activate_relocated_profile as activation

job = Path(sys.argv[1]).resolve(strict=True)
assert job.parent == Path(r'F:\Agentopia\.supabase\desktop-normal-maintenance') and re.fullmatch(r'\d{13}', job.name)
record = json.loads((job/'relocation.json').read_text())
assert record['instance'] == 'a91a4800-e08f-4440-a4ec-588762d01bfd'
assert record['source'] == r'C:\Users\charl\.agentopia\desktop\profile'
assert record['target'] == r'F:\Agentopia-Data\profiles\a91a4800-e08f-4440-a4ec-588762d01bfd\profile'
assert record['imageSha256'] == 'c929ba18422fb63d41c77d721bb005d1d1678941754717e5bb7da87067b02c3e'

def closed():
    result = subprocess.run(['powershell.exe','-NoProfile','-NonInteractive','-Command',
        "@(Get-Process Agentopia,AgentopiaSetup -ErrorAction SilentlyContinue).Count"], capture_output=True,text=True,timeout=20,check=True)
    assert result.stdout.strip() == '0', 'An Agentopia application is still running'

mode = sys.argv[2]
closed()
if mode == 'inventory':
    directory = sys.argv[3]
    assert directory in (record['source'], record['target'])
    values = activation.inventory(activation.folder(directory))
    file = job/('inventory-source.json' if directory == record['source'] else 'inventory-target.json')
    activation.write_atomic(file, json.dumps(values,sort_keys=True).encode())
    print(json.dumps({'success':True,'inventory':str(file),'files':len(values)}),flush=True)
else:
    plan = json.loads((job/'plan.json').read_text())
    assert plan['source'] == record['source'] and plan['target'] == record['target']
    assert plan['installedArchiveSha256'] == record['imageSha256'] and plan['targetVersion'] == '0.44.54'
    home = subprocess.check_output(['powershell.exe','-NoProfile','-NonInteractive','-Command',"[Environment]::GetFolderPath('UserProfile')"],text=True,timeout=15).strip()
    assert activation.canonical(home) == activation.canonical(plan['windowsHome'])
    def repair(target):
        resources = Path(ntpath.dirname(plan['installedArchive']))/'resources'
        python = resources/'script-runtimes/python-3.14.8/python.exe'
        script = resources/'runtime/relocate-native-profile.py'
        assert activation.digest(activation.regular(python)) == plan['nativeRepairPythonSha256']
        assert activation.digest(activation.regular(script)) == plan['nativeRepairScriptSha256']
        result = subprocess.run([str(python),'-I','-B',str(script),target],capture_output=True,text=True,timeout=120,check=True)
        return json.loads(result.stdout)
    if mode == 'stage':
        result = staging.stage(plan,closed,repair,protect=staging.protect_windows)
    elif mode in ('check','publish'):
        result = activation.activate(plan,closed,publish=mode=='publish')
    else:
        raise ValueError('Unsupported production relocation phase')
    print(json.dumps(result),flush=True)
