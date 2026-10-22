"""Prepare47 maintenance from the retained46 workflow without altering46 receipts."""
from pathlib import Path
root=Path(__file__).resolve().parents[2];scripts=root/'scripts/desktop'
s=(scripts/'backup-menu-viewer-upgrade.mjs').read_text(encoding='utf-8').replace('04446','04447').replace('0.44.46','0.44.47')
s=s.replace("'C:/Users/charl/AgentopiaRecovery/before-04447'","'D:/Users/charl/AgentopiaRecovery/before-04447'")
old='const space=await statfs(recoveryBase);assert(space.bavail*space.bsize>15*1024**3);'
new="""const capacity=await json(path.join(candidate,'recovery-capacity.json'));assert(capacity.success&&capacity.recoveryBase===recoveryBase);assert(Date.now()-Date.parse(capacity.at)<15*60000,'Recheck measured capacity after a long delay');const space=await statfs(recoveryBase);assert(space.bavail*space.bsize>capacity.requiredFreeBytes);assert((await stat(path.join(ordinary,'wsl/ext4.vhdx'))).size<=capacity.sourceVhdxBytes+64*1024**2);const registrationFound=await registration(distribution);assert.equal(registrationFound.name,distribution);assert.equal(registrationFound.version,2);assert.equal(path.win32.normalize(registrationFound.path.replace(/^\\\\\\\\\\?\\\\/,'' )).toLowerCase(),path.join(ordinary,'wsl').toLowerCase());"""
assert s.count(old)==1;s=s.replace(old,new)
s=s.replace('app-0.44.45/resources','app-0.44.46/resources').replace('15083cac1ea64b853f78108a2ba2f99d07531dde51406bdbd88b4a6bb97300a0','7aa5f96384e7d8e13145ea4478065327a09b02ae88114c51454e80f6df32ea99').replace('baseline-0.44.45.asar','baseline-0.44.46.asar')
old="const image=path.join(out,'runtime.vhdx');await run(['--export'"
new="const remaining=await statfs(out);assert(remaining.bavail*remaining.bsize>capacity.sourceVhdxBytes+2560*1024**2,'Keep export growth and remaining disk headroom');const image=path.join(out,'runtime.vhdx');await run(['--export'"
assert s.count(old)==1;s=s.replace(old,new)
with (scripts/'backup-navigation-rollup-upgrade.mjs').open('x',encoding='utf-8') as f:f.write(s)
s=(scripts/'verify-menu-viewer-recovery.py').read_text(encoding='utf-8').replace('04446','04447')
s=s.replace("pointer['out'].replace('C:\\\\','/mnt/c/')","pointer['out'].replace('D:\\\\','/mnt/d/')")
s=s.replace('/mnt/c/Users/charl/AgentopiaRecovery/before-04447','/mnt/d/Users/charl/AgentopiaRecovery/before-04447')
with (scripts/'verify-navigation-rollup-recovery.py').open('x',encoding='utf-8') as f:f.write(s)
s=(scripts/'audit-menu-viewer-ordinary-upgrade.py').read_text(encoding='utf-8').replace('04446','04447').replace("'0.44.45' if mode == 'before' else '0.44.46'","'0.44.46' if mode == 'before' else '0.44.47'").replace("promotion['version'] == '0.44.46'","promotion['version'] == '0.44.47'")
s=s.replace("pointer['out'].replace('C:\\\\', '/mnt/c/')","pointer['out'].replace('D:\\\\', '/mnt/d/')").replace('/mnt/c/Users/charl/AgentopiaRecovery/before-04447','/mnt/d/Users/charl/AgentopiaRecovery/before-04447')
s=s.replace('15083cac1ea64b853f78108a2ba2f99d07531dde51406bdbd88b4a6bb97300a0','7aa5f96384e7d8e13145ea4478065327a09b02ae88114c51454e80f6df32ea99').replace('from audit_menu_viewer_process import ordinary_processes','from audit_navigation_rollup_process import ordinary_processes')
with (scripts/'audit-navigation-rollup-ordinary-upgrade.py').open('x',encoding='utf-8') as f:f.write(s)
s=(scripts/'audit_menu_viewer_process.py').read_text(encoding='utf-8').replace("('0.44.45', '0.44.46')","('0.44.46', '0.44.47')")
with (scripts/'audit_navigation_rollup_process.py').open('x',encoding='utf-8') as f:f.write(s)
print('Prepared47 backup, recovery and post-install comparison scripts.')
