from pathlib import Path
import json,re,sys
assert sys.argv[1]=='c8614862-e038-4d37-ad42-15306be60134'
assert Path('/opt/agentopia/runtime-instance').read_text().strip()==sys.argv[1]
report=[]
for statefile in Path('/home/agentopia/.supabase/stacks').glob('*/state.json'):
    state=json.loads(statefile.read_text());secrets=[v for v in state.get('credentials',{}).values() if isinstance(v,str) and len(v)>5]
    for file in (statefile.parent/'logs/database').glob('*/*.log'):
        lines=[]
        for line in file.read_text(errors='replace').splitlines():
            if not re.search(r'ERROR:|FATAL:|PANIC:|WARNING:|ready to accept|checkpoint complete',line):continue
            for secret in secrets:line=line.replace(secret,'[private]')
            line=re.sub(r'eyJ[A-Za-z0-9_.-]+','[private-token]',line)
            line=re.sub(r'[a-fA-F0-9]{64}','[private-value]',line)
            lines.append(line)
        report.append({'file':str(file.relative_to(statefile.parent)),'errors':lines[-40:]})
print(json.dumps(report))
