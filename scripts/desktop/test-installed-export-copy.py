"""Temporarily edit only the newly exported sample, then restore its exact bytes."""
from pathlib import Path
import datetime,hashlib,html,io,json,sys,zipfile,xml.etree.ElementTree as ET
root=Path('D:/Users/charl/software/Agentopia')
pointer=json.loads((root/'.supabase/desktop-chat-output-edits/current.json').read_text(encoding='utf-8'))
work=Path(pointer['work']);record_file=work/'native-word-test.json';r=json.loads(record_file.read_text(encoding='utf-8'))
def sha(p):return hashlib.sha256(Path(p).read_bytes()).hexdigest()
target=Path(r['target']);allowed=Path('C:/Users/charl/Agentopia Files/979bdcd5ba36/9bf808b8-96a9-441d-b63c-eb835eb784c4')
assert target.resolve().is_relative_to(allowed.resolve()) and not target.is_symlink() and target.stat().st_nlink==1
assert sha(r['source'])==r['sourceSha256'] and sha(r['download'])==r['downloadSha256']
if r['legacyExists']:assert sha(r['legacy'])==r['legacySha256']
backup=Path(r['out'])/'export-copy-before-test.docx';assert backup.parent.parent==Path('C:/Users/charl/AgentopiaRecovery/chat-output-edits-13')
if sys.argv[1]=='modify':
 assert not backup.exists();original=target.read_bytes()
 with backup.open('xb') as stream:stream.write(original)
 with zipfile.ZipFile(io.BytesIO(original)) as src:
  xml=src.read('word/document.xml');first=next(ET.fromstring(xml).iter('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}t'));old=html.escape(first.text or '',quote=False).encode();assert old and xml.count(old)==1
  with zipfile.ZipFile(target,'w',zipfile.ZIP_DEFLATED) as dst:
   for part in src.infolist():dst.writestr(part,src.read(part.filename).replace(old,r['marker'].encode(),1) if part.filename=='word/document.xml' else src.read(part.filename))
 with zipfile.ZipFile(io.BytesIO(original)) as src,zipfile.ZipFile(target) as dst:
  assert src.namelist()==dst.namelist();changed=[name for name in src.namelist() if src.read(name)!=dst.read(name)];assert changed==['word/document.xml']
  r.update({'partsCompared':len(src.namelist()),'changedParts':changed,'copyBeforeSha256':hashlib.sha256(original).hexdigest(),'temporaryCopySha256':sha(target),'copyBackup':str(backup),'temporaryModificationVerified':True})
elif sys.argv[1]=='restore':
 assert r['temporaryModificationVerified'] and sha(target)==r['temporaryCopySha256'] and sha(backup)==r['copyBeforeSha256']
 target.write_bytes(backup.read_bytes());assert sha(target)==r['copyBeforeSha256']
 r.update({'copyRestored':True,'sourceAndDownloadsUnchanged':sha(r['source'])==r['sourceSha256'] and sha(r['download'])==r['downloadSha256'],'restoredCopySha256':sha(target)})
else:raise AssertionError('Use modify or restore')
r['updatedAt']=datetime.datetime.now(datetime.timezone.utc).isoformat();record_file.write_text(json.dumps(r,indent=2),encoding='utf-8')
print(json.dumps({k:r[k] for k in ['marker','partsCompared','changedParts','temporaryModificationVerified','copyRestored','sourceAndDownloadsUnchanged','restoredCopySha256'] if k in r}))
