"""Run actual relocation controllers against the retained, generated restore fixture."""
from pathlib import Path
import json,ntpath,subprocess,sys
sys.path.insert(0,str(Path(__file__).resolve().parent))
import stage_relocated_profile as staging
import activate_relocated_profile as activation

intent=Path(sys.argv[1]).resolve(strict=True);cfg=json.loads(intent.read_text())
assert cfg['generatedOnly'] is True and cfg['instance']=='c0e548ce-f913-4746-9e2e-9a466362c900'
assert cfg['home']==r'F:\Agentopia-Acceptance\restored-relocation54-1792579111761\home'
assert Path(cfg['out']).parent==Path(r'F:\Agentopia\.supabase\desktop-profile-release54\1792578806223')
assert Path(cfg['out']).name.startswith('integrated-migration-')
assert cfg['source']==ntpath.join(cfg['home'],'.agentopia','desktop','profile')
assert cfg['target']==ntpath.join('F:\\Agentopia-Data','profiles',cfg['instance'],'profile')

def closed():
    # Production remains open. Only these two disposable fixture programs belong
    # to this operation; the production controller retains its global close guard.
    script="@(Get-CimInstance Win32_Process -Filter \"Name='Agentopia.exe'\" | Where-Object { $_.ExecutablePath -eq '"+cfg['exe']+"' -or $_.ExecutablePath -eq '"+cfg['preflightExe']+"' }).Count"
    result=subprocess.run(['powershell.exe','-NoProfile','-NonInteractive','-Command',script],capture_output=True,text=True,timeout=20,check=True)
    assert result.stdout.strip()=='0','A generated fixture app is still running'

mode=sys.argv[2]
if mode=='inventory':
    directory=sys.argv[3];assert directory in (cfg['source'],cfg['target'])
    closed();print(json.dumps(activation.inventory(Path(directory))))
else:
    plan=json.loads((Path(cfg['out'])/'plan.json').read_text())
    assert plan['source']==cfg['source'] and plan['target']==cfg['target']
    def repair(target):
        python=Path(cfg['assets'])/'script-runtimes/python-3.14.8/python.exe'
        script=Path(cfg['assets'])/'runtime/relocate-native-profile.py'
        assert activation.digest(python)==plan['nativeRepairPythonSha256']
        assert activation.digest(script)==plan['nativeRepairScriptSha256']
        result=subprocess.run([str(python),'-I','-B',str(script),target],capture_output=True,text=True,timeout=120,check=True)
        return json.loads(result.stdout)
    if mode=='stage':result=staging.stage(plan,closed,repair,protect=staging.protect_windows)
    elif mode=='check':result=activation.activate(plan,closed,publish=False)
    elif mode=='publish':result=activation.activate(plan,closed,publish=True)
    else:raise ValueError('Unsupported generated relocation phase')
    print(json.dumps(result),flush=True)
