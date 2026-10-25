"""Reuse the complete saved-row audit, permitting only the reviewed imports."""
import json, sys
from pathlib import Path
import audit_logical_snapshot71 as audit
from logical_row_fingerprints71 import Fingerprints
receipt=json.loads(Path(sys.argv[3]).read_text())
assert receipt['success'] and receipt['skills']==receipt['nativeSkillsDiscovered']==228
owner=receipt['owner']; names={p['name'] for p in receipt['packages']}
assert names=={f'codex-skills-{i:02}' for i in range(1,17)}
class ScopedFingerprints(Fingerprints):
 def row(self,scope,name,line):
  if name in ('public.desktop_plugins','public.desktop_agent_plugins'):
   record=self.tables[(scope,name)];fields=line[:-1].split(b'\t');values=dict(zip(record['columns'],fields))
   if values['user_id'].decode()==owner and values['name' if name.endswith('.desktop_plugins') else 'plugin_name'].decode() in names:return
  super().row(scope,name,line)
audit.Fingerprints=ScopedFingerprints
result=audit.audit(sys.argv[1],sys.argv[2],'a91a4800-e08f-4440-a4ec-588762d01bfd',57322)
result.update(reviewedImportedPackages=16,reviewedImportedSkills=228,reviewedAssignments=receipt['assignments'],permittedChanges='Reviewed Codex packages and their assignments for the current owner only')
Path(sys.argv[2],'evidence.json').write_text(json.dumps(result,indent=2))
print(json.dumps(result))
