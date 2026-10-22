"""Rehearse the full preparer against a sealed checkpoint in a protected QA home."""
from pathlib import Path
import datetime,hashlib,importlib.util,json,os,subprocess,sys,time
ROOT=Path(__file__).resolve().parents[2];BUNDLE=Path('D:/Users/charl/AgentopiaRecovery/export-relocation-14/1792474234936');BASE=Path('D:/Users/charl/AgentopiaQA/full-recovery')
spec=importlib.util.spec_from_file_location('full_recovery',ROOT/'desktop/runtime/prepare-desktop-recovery.py');module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
BASE.mkdir(parents=True,exist_ok=True)
if len(sys.argv)==2:
    job=Path(sys.argv[1]);assert job.resolve(strict=True).parent==BASE.resolve() and job.name.isdigit()
    prior=job/'evidence.json';assert json.loads(prior.read_text())['success'] is False
    (job/('evidence-before-resume-'+str(time.time_ns()//1000000)+'.json')).write_bytes(prior.read_bytes())
else:job=BASE/str(time.time_ns()//1000000);job.mkdir()
assert job.resolve().parent==BASE.resolve()
sid=subprocess.check_output(['powershell.exe','-NoProfile','-NonInteractive','-Command','[Security.Principal.WindowsIdentity]::GetCurrent().User.Value'],text=True).strip();assert sid.startswith('S-1-5-')
subprocess.run(['icacls.exe',str(job),'/inheritance:r','/grant:r','*'+sid+':(OI)(CI)F','*S-1-5-18:(OI)(CI)F','/Q'],check=True,capture_output=True)
home=job/'home';home.mkdir(exist_ok=True);appdata=home/'AppData/Roaming';receipt=job/'evidence.json';record={'success':False,'at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'job':str(job),'bundle':str(BUNDLE),'home':str(home),'profile':str(appdata/'Agentopia'),'isolatedDestination':True,'environmentObservationsInjectedForQA':True,'productionChanged':False,'providerRequests':0,'databaseImported':False,'fullApplicationRestoreProven':False,'resumedExistingOperation':len(sys.argv)==2}
def save():module.save(receipt,record)
def phase(value):record['phase']=value;save();print(json.dumps({'phase':value,'job':str(job)}),flush=True)
save()
try:
    # The public CLI checks the real user's WSL registrations. Only this isolated
    # library rehearsal supplies an empty registration list for the generated home.
    result=module.prepare(BUNDLE,home,appdata,[],headroom=512*1024**2,compress=True,phase_hook=phase)
    record.update(success=True,status=result['status'],native=result['native'],privateFileCount=sum(1 for x in (appdata/'Agentopia').rglob('*') if x.is_file()),publicFileCount=sum(1 for x in (home/'Agentopia Files').rglob('*') if x.is_file()),providerReauthorizationRequired=True)
except BaseException as error:record.update(error=type(error).__name__+': '+str(error));raise
finally:save();print(json.dumps(record),flush=True)
