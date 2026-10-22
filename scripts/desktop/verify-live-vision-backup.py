"""Verify the new vision result in the closed logical backup without starting SQL."""
import base64,glob,hashlib,json,re,subprocess
from pathlib import Path
ROOT=Path('/mnt/d/Users/charl/software/Agentopia')
out=ROOT/'.supabase/desktop-vision-live/1792371918104'
intent=json.loads((out/'intent.json').read_text());accepted=json.loads((out/'acceptance.json').read_text())
pointer=json.loads((ROOT/'.supabase/desktop-platform-release/candidate-04429/upgrade-backup.json').read_text());assert pointer['success']
backup=Path(pointer['out'].replace('D:\\','/mnt/d/').replace('\\','/'));assert backup.parent==ROOT/'.supabase/desktop-platform-release/candidate-04429'
assert re.fullmatch(r'upgrade-backup-\d{13}',backup.name)
evidence=json.loads((backup/'evidence.json').read_text());assert evidence['success']
assert Path('/opt/agentopia/runtime-instance').read_text().strip()=='a91a4800-e08f-4440-a4ec-588762d01bfd'
processes=subprocess.check_output(['ps','-eo','comm='],text=True).splitlines();assert 'postgres' not in processes
binary=Path(glob.glob('/home/agentopia/.supabase/cache/stack/slim-services/postgres/*/linux-amd64/*/bin/pg_restore')[0])
def table(name):
 text=subprocess.check_output([str(binary),'--data-only','--table',name,'--file=-',str(backup/'current-database-backup/application.dump')],text=True)
 match=re.search(r'^COPY public\.'+re.escape(name)+r' \(([^\n]+)\) FROM stdin;\n(.*?)^\\\.\n',text,re.M|re.S);assert match
 columns=[c.strip().strip('"') for c in match[1].split(',')]
 return columns,[line.split('\t') for line in match[2].splitlines()]
def record(name,key,value):
 columns,rows=table(name);found=[dict(zip(columns,row)) for row in rows if row[columns.index(key)]==value];assert len(found)==1;return found[0]
def decode(value):
 escape={'n':'\n','r':'\r','t':'\t','b':'\b','f':'\f','v':'\v','\\':'\\'}
 return re.sub(r'\\([0-7]{1,3}|.)',lambda m:chr(int(m[1],8)) if re.fullmatch('[0-7]{1,3}',m[1]) else escape.get(m[1],m[1]),value)
request=record('desktop_requests','id',accepted['request']['id']);assert request['status']=='completed'
user=json.loads(decode(record('chat_messages_v2','id',request['user_message_id'])['content']))
assistant=json.loads(decode(record('chat_messages_v2','id',request['assistant_message_id'])['content']))
assert user['text']==intent['prompt'] and json.loads(assistant['text'])==intent['expected']
assert len(user['files'])==1
sha=hashlib.sha256(base64.b64decode(user['files'][0]['image'].split(',',1)[1])).hexdigest();assert sha==intent['sha256']
native=record('desktop_codex_turns','request_id',request['id']);assert native['thread_id']==accepted['threadId'] and native['turn_id']==accepted['turnId']
result={'success':True,'backup':str(backup),'requestId':request['id'],'completedAnswerPreserved':True,'submittedImageSha256':sha,'nativeThreadAndTurnPreserved':True,'databaseServicesStarted':0,'readOnly':True}
with (backup/'vision-backup-acceptance.json').open('x') as stream:json.dump(result,stream,indent=2)
print(json.dumps(result))
