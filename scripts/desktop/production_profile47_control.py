"""Drive the qualified controller against the fixed ordinary47 profile."""
from pathlib import Path
import hashlib,json,ntpath,os,subprocess,sys
sys.path.insert(0,str(Path(__file__).parent))
from profile_location_activation import physical,regular,digest,checked_json,inventory,closed_windows,activate
from stage_durable_profile import stage,write_new
root=Path('/mnt/d/Users/charl/software/Agentopia');records=root/'.supabase/desktop-profile-location'
pointer=json.loads((records/'production47-current.json').read_text());intent=physical(pointer['intent']);cfg=checked_json(intent,pointer['intentSha256']);out=physical(cfg['out'])
assert out.parent==Path('/mnt/c/Users/charl/AgentopiaQA/production-profile47') and out.name.isdigit()
assert cfg['target']==r'C:\Users\charl\.agentopia\desktop\profile' and cfg['source']==r'C:\Users\charl\AppData\Roaming\Agentopia'
mode=sys.argv[1];assert mode in ('prepare-plan','stage','seal','check','publish','verify-source')
os.umask(0o077);closed_windows();plan_file=out/'plan.json'
def save(value):
 temporary=out/'plan.next.json'
 with temporary.open('x') as f:json.dump(value,f,indent=2);f.flush();os.fsync(f.fileno())
 temporary.replace(plan_file)
def repair(target):
 resources=ntpath.join(cfg['storageProgram'],'resources','resources');python=physical(ntpath.join(resources,'script-runtimes','python-3.14.8','python.exe'));script=ntpath.join(resources,'runtime','relocate-native-profile.py')
 result=subprocess.run([str(python),'-B',script,target],text=True,capture_output=True,timeout=120,check=True);return json.loads(result.stdout)
if mode=='prepare-plan':
 backup_pointer=json.loads((root/'.supabase/desktop-platform-release/candidate-04447/profile-migration-backup.json').read_text());assert backup_pointer['success']
 backup=physical(backup_pointer['out']);evidence=json.loads((backup/'evidence.json').read_text());accepted=json.loads((backup/'ordinary-recovery-acceptance.json').read_text())
 assert evidence['success'] and evidence['phase']=='complete' and accepted['success'] and accepted['passwordsPreserved'] and evidence['distribution']==cfg['distribution']
 assert backup.parent==Path('/mnt/c/Users/charl/AgentopiaRecovery/before-private-profile-04447')
 manifest=backup/'private-profile-ordinary.json';assert json.loads(manifest.read_text())['success']
 plan={'format':1,'windowsHome':cfg['windowsHome'],'source':cfg['source'],'target':cfg['target'],'out':ntpath.join(cfg['out'],'stage'),'runtimeInstanceId':cfg['runtimeInstanceId'],'targetVersion':cfg['version'],'installedArchive':cfg['installedArchive'],'installedArchiveSha256':cfg['installedArchiveSha256'],'selectorSha256':cfg['selectorSha256'],'compatibilityEvidence':cfg['compatibilityEvidence'],'compatibilityEvidenceSha256':cfg['compatibilityEvidenceSha256'],'backupEvidence':ntpath.join(backup_pointer['out'],'evidence.json'),'backupEvidenceSha256':digest(backup/'evidence.json'),'backupProfileManifest':ntpath.join(backup_pointer['out'],'private-profile-ordinary.json'),'backupProfileManifestSha256':digest(manifest)}
 write_new(plan_file,plan);print(json.dumps({'success':True,'phase':'plan-prepared','backup':backup_pointer['out']}))
elif mode=='stage':
 plan=json.loads(regular(plan_file).read_text());result=stage(plan,closed_windows,repair);plan.update(result);plan['stageEvidence']=ntpath.join(plan['out'],'stage-evidence.json');plan['stageEvidenceSha256']=digest(physical(plan['stageEvidence']));save(plan)
 print(json.dumps({'success':True,'phase':result['phase'],'filesCopied':result['filesCopied'],'bytesCopied':result['bytesCopied'],'nativeHomes':result['nativeRebase']['homes'],'nativeThreads':result['nativeRebase']['threads'],'activated':False}))
elif mode=='seal':
 plan=json.loads(regular(plan_file).read_text())
 for key in ['encryptedEvidence','nativeEvidence']:
  file=out/(key+'.json');assert json.loads(regular(file).read_text())['success'];plan[key]=ntpath.join(cfg['out'],key+'.json');plan[key+'Sha256']=digest(file)
 seal=out/'target-seal.json';write_new(seal,inventory(physical(cfg['target'])));plan.update(targetSeal=ntpath.join(cfg['out'],'target-seal.json'),targetSealSha256=digest(seal));save(plan);print(json.dumps({'success':True,'phase':'target-sealed'}))
elif mode in ('check','publish'):
 plan=json.loads(regular(plan_file).read_text());result=activate(plan,closed_windows,mode=='publish');write_new(out/('activation-'+mode+'.json'),result);print(json.dumps(result))
elif mode=='verify-source':
 plan=json.loads(regular(plan_file).read_text());assert inventory(physical(cfg['source']),retain_backups=True)==checked_json(physical(plan['sourceSeal']),plan['sourceSealSha256']);print(json.dumps({'success':True,'sourceUnchanged':True}))
