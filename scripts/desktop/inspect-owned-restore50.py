from pathlib import Path
import json, re, subprocess, sys
assert sys.argv[1] == 'c8614862-e038-4d37-ad42-15306be60134'
assert Path('/opt/agentopia/runtime-instance').read_text().strip() == sys.argv[1]
assert Path('/opt/agentopia/runtime-identity').read_text().strip() == 'local.agentopia.desktop-runtime.v1'
report = {'instance': sys.argv[1], 'readOnly': True, 'states': []}
for file in Path('/home/agentopia/.supabase/stacks').glob('*/state.json'):
    state = json.loads(file.read_text())
    record = {'state': str(file), 'keys': list(state), 'logs': []}
    for log in file.parent.rglob('*.log'):
        if any(part in ('data', 'node_modules') for part in log.relative_to(file.parent).parts):
            continue
        lines = log.read_text(errors='replace').splitlines()[-16:]
        text = '\n'.join(lines)
        for value in state.get('credentials', {}).values():
            if isinstance(value, str) and len(value) > 5:
                text = text.replace(value, '[private]')
        text = re.sub(r'eyJ[A-Za-z0-9_.-]+', '[private-token]', text)
        text = re.sub(r'(?i)(password|secret|authorization)(["\s:=]+)[^\s,}]+', r'\1\2[private]', text)
        record['logs'].append({'file': str(log), 'tail': text[-5000:]})
    report['states'].append(record)
print(json.dumps(report))
