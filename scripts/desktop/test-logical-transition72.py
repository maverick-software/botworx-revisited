"""Check the exact authorized table addition and reject broader schema/access drift."""
import copy
import json
import sys
from pathlib import Path
from audit_logical_transition72 import REVISION_COLUMNS, validate_transition

expected = {'public.table_' + str(n): {} for n in range(125)}
expected.update({'auth.users': {}, 'vault.secrets': {}})
metadata = {'publicTables': [name.split('.')[1] for name in expected if name.startswith('public.')] + ['desktop_media_revisions'],
            'migrations': 72, 'newTable': {'rows': 0, 'columns': REVISION_COLUMNS,
            **{key: True for key in ['rls', 'anonDenied', 'authenticatedDenied', 'serviceReadWrite', 'primaryKey', 'brokerOnlyFunctions', 'privateFallbackDenied']}}}
validate_transition(expected, metadata)
cases = 1
for key in ['rls', 'anonDenied', 'authenticatedDenied', 'serviceReadWrite', 'primaryKey', 'brokerOnlyFunctions', 'privateFallbackDenied', 'rows', 'columns', 'migrations', 'missing', 'unexpected', 'duplicate']:
    changed = copy.deepcopy(metadata)
    if key == 'rows':
        changed['newTable']['rows'] = 1
    elif key == 'columns':
        changed['newTable']['columns'] = REVISION_COLUMNS[:-1]
    elif key == 'migrations':
        changed['migrations'] = 73
    elif key == 'missing':
        changed['publicTables'].pop(0)
    elif key == 'unexpected':
        changed['publicTables'].append('unapproved_table')
    elif key == 'duplicate':
        changed['publicTables'].append(changed['publicTables'][0])
    else:
        changed['newTable'][key] = False
    try:
        validate_transition(expected, changed)
    except AssertionError:
        cases += 1
    else:
        raise AssertionError('Unsafe transition accepted: ' + key)
result = {'success': True, 'cases': cases, 'providerRequests': 0}
Path(sys.argv[1]).write_text(json.dumps(result, indent=2))
print(json.dumps(result))
