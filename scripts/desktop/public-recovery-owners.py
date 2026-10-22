"""Read only UUIDs from the accounts archive paired with the accepted checkpoint."""
from pathlib import Path
import glob,json,re,subprocess,sys
root=Path(sys.argv[1]);assert root.parent==Path('/mnt/d/Users/charl/AgentopiaRecovery/export-relocation-14')
assert re.fullmatch(r'\d{13}',root.name)
binary=Path(glob.glob('/home/agentopia/.supabase/cache/stack/slim-services/postgres/*/linux-amd64/*/bin/pg_restore')[0])
text=subprocess.check_output([str(binary),'--data-only','--file=-',str(root/'current-database-backup/auth.dump')],text=True)
match=re.search(r'^COPY auth\.users \(([^\n]+)\) FROM stdin;\n(.*?)^\\\.\n',text,re.M|re.S);assert match
columns=[x.strip().strip('"') for x in match[1].split(',')];pos=columns.index('id')
owners=[row.split('\t')[pos] for row in match[2].splitlines()]
assert owners and len(owners)==len(set(owners)) and all(re.fullmatch('[a-f0-9-]{36}',x) for x in owners)
assert len(owners)==json.loads((root/'current-database-backup/manifest.json').read_text())['accounts']
with (root/'public-recovery-owners.json').open('x') as f:json.dump(owners,f)
print(json.dumps({'success':True,'accounts':len(owners),'providerRequests':0}))
