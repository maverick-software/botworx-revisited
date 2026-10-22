#!/usr/bin/env python3
"""Local Whisper execution. Audio is temporary and never sent to an API."""
import hashlib,json,os,pathlib,re,subprocess,sys,tarfile,time
os.umask(0o077)
root=pathlib.Path('/home/agentopia/.agentopia-voice');root.mkdir(exist_ok=True)
operation=sys.argv[1]
if operation=='recover':
 temporary=root/'tmp';temporary.mkdir(exist_ok=True)
 recordings=[file for file in temporary.glob('*.wav') if re.fullmatch(r'[a-f0-9-]{36}\.wav',file.name)]
 for file in recordings:file.with_suffix('.cancel').touch()
 deadline=time.monotonic()+3
 while recordings and any(file.exists() for file in recordings) and time.monotonic()<deadline:time.sleep(.1)
 for file in temporary.iterdir():
  if re.fullmatch(r'[a-f0-9-]{36}\.(wav|cancel|result\.txt)',file.name):file.unlink(missing_ok=True)
 print('{}')
elif operation=='status':
 print(json.dumps({'ready':(root/'whisper-cli').is_file() and (root/'ggml-base.en.bin').is_file() and (root/'bundle.sha256').is_file() and (root/'bundle.sha256').read_text().strip()==sys.argv[2]}))
elif operation=='install':
 expected=sys.argv[2];archive=root/'voice.tar.gz'
 with archive.open('rb') as source: actual=hashlib.file_digest(source,'sha256').hexdigest()
 assert actual==expected,'Voice archive checksum failed'
 with tarfile.open(archive) as source:
  for member in source.getmembers():
   if member.isdir(): continue
   target=(root/member.name).resolve()
   assert member.isfile() and target.is_relative_to(root) and target!=root,'Invalid voice resource'
   source.extract(member,root,filter='data')
 (root/'whisper-cli').chmod(0o700)
 (root/'bundle.sha256').write_text(expected)
 archive.unlink()
 print(json.dumps({'ready':True}))
elif operation in ('transcribe','cancel','cleanup'):
 name=sys.argv[2];assert re.fullmatch(r'[a-f0-9-]{36}',name),'Invalid recording identifier'
 audio=root/'tmp'/(name+'.wav');output=root/'tmp'/(name+'.result')
 marker=root/'tmp'/(name+'.cancel')
 if operation=='cancel':
  marker.parent.mkdir(exist_ok=True);marker.touch();print('{}');sys.exit(0)
 if operation=='cleanup':
  audio.unlink(missing_ok=True);pathlib.Path(str(output)+'.txt').unlink(missing_ok=True);marker.unlink(missing_ok=True);print('{}');sys.exit(0)
 worker=None
 try:
  if marker.exists():print(json.dumps({'text':'','cancelled':True}));sys.exit(0)
  assert audio.stat().st_size<=4000000,'Recording exceeds the local limit'
  worker=subprocess.Popen([str(root/'whisper-cli'),'-m',str(root/'ggml-base.en.bin'),'-f',str(audio),'-l','en','-nt','-np','-otxt','-of',str(output),'-t','4'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
  deadline=time.monotonic()+180
  while worker.poll() is None:
   if marker.exists():
    worker.terminate();print(json.dumps({'text':'','cancelled':True}));sys.exit(0)
   if time.monotonic()>deadline:raise TimeoutError('Local transcription timed out')
   time.sleep(.1)
  if worker.returncode:raise RuntimeError('Local Whisper could not transcribe this recording')
  text=pathlib.Path(str(output)+'.txt').read_text().strip()
  print(json.dumps({'text':text[:20000]}))
 finally:
  if worker and worker.poll() is None:
   worker.terminate()
   try:worker.wait(timeout=3)
   except subprocess.TimeoutExpired:worker.kill();worker.wait(timeout=3)
  audio.unlink(missing_ok=True);pathlib.Path(str(output)+'.txt').unlink(missing_ok=True);marker.unlink(missing_ok=True)
else: raise ValueError('Unsupported voice operation')
