"""Exercise both version directions against the real current ordinary process."""
from pathlib import Path
import datetime
import json
from audit_ordinary_process import ordinary_processes

before = ordinary_processes('0.44.31')
try:
    ordinary_processes('0.44.40')
except AssertionError as error:
    assert 'does not match' in str(error)
else:
    raise AssertionError('The31 process was accepted as40')
result = {'success': True, 'at': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'before': before, 'oldRunningProcessRejectedFor40': True, 'readOnly': True, 'providerRequests': 0}
out = Path('/mnt/d/Users/charl/software/Agentopia/.supabase/desktop-platform-release/candidate-04440/ordinary-upgrade-audit/running-version-guards.json')
with out.open('x') as stream:
    json.dump(result, stream, indent=2)
print(json.dumps(result))
