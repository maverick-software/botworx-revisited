"""Use the delivered recovery preparer in a generated fresh home on F:."""
import importlib.util,json,sys
from pathlib import Path

intent=Path(sys.argv[1]).resolve(strict=True)
cfg=json.loads(intent.read_text(encoding='utf-8-sig'))
home=Path(cfg['home']);roaming=Path(cfg['roaming']);bundle=Path(cfg['sourceBundle'])
assert home.is_relative_to(Path('F:/Agentopia-Acceptance')) and not (roaming/'Agentopia').exists()
assert cfg['environmentObservationsInjectedForQA'] is True
spec=importlib.util.spec_from_file_location('delivered_recovery',Path(cfg['assets'])/'runtime/prepare-desktop-recovery.py')
module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
def phase(name):
    print(json.dumps({'phase':name}),flush=True)
# This library rehearsal supplies an empty registration inventory for its fake
# home. It makes no claim about a separate Windows user's CLI environment.
result=module.prepare(bundle,home,roaming,[],False,compress=True,phase_hook=phase)
(intent.parent/'prepared.json').write_text(json.dumps({'success':True,'result':result,'sameWindowsUser':True,'freshWindowsUserAcceptancePending':True},indent=2))
print(json.dumps({'success':True,'status':result['status'],'native':result['native']}),flush=True)
