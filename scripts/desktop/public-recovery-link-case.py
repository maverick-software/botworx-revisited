"""Select the original sample Word link and its ownership from the saved archive."""
from pathlib import Path
import glob,json,re,subprocess,sys
root=Path(sys.argv[1]);assert root.parent==Path('/mnt/d/Users/charl/AgentopiaRecovery/export-relocation-14')
binary=Path(glob.glob('/home/agentopia/.supabase/cache/stack/slim-services/postgres/*/linux-amd64/*/bin/pg_restore')[0])
text=subprocess.check_output([str(binary),'--data-only','--file=-',str(root/'current-database-backup/application.dump')],text=True)
escapes={'b':'\b','t':'\t','n':'\n','r':'\r','f':'\f','v':'\v','\\':'\\'}
def decode(value):return re.sub(r'\\([btnrfv\\])',lambda m:escapes[m[1]],value)
def rows(table):
 match=re.search(r'^COPY public\.'+table+r' \(([^\n]+)\) FROM stdin;\n(.*?)^\\\.\n',text,re.M|re.S);assert match
 columns=[x.strip().strip('"') for x in match[1].split(',')]
 return [dict(zip(columns,[decode(x) for x in row.split('\t')])) for row in match[2].splitlines()]
chat='595de5c1-2ce8-4f37-a29b-2a80b695a814'
session=next(row for row in rows('conversation_sessions') if row['conversation_id']==chat)
found=[]
for row in rows('chat_messages_v2'):
 if row['conversation_id']==chat and row['role']=='assistant':
  content=json.loads(row['content']);body=content if isinstance(content,str) else content.get('text','')
  match=re.search(r'\[Download Sample_Document\.docx\]\(([^)]+)\)',body)
  if match:found.append(match[1])
assert len(found)==1
scopes=[row['scope'] for row in rows('desktop_codex_threads') if row['conversation_id']==chat and row['user_id']==session['user_id']]
assert scopes and all(re.fullmatch('[a-f0-9]{16,64}',s) for s in scopes)
result={'owner':session['user_id'],'conversationId':chat,'href':found[0],'scopes':scopes,'fromArchivedDatabase':True}
with (root/'public-original-link-case.json').open('x') as f:json.dump(result,f,indent=2)
print(json.dumps({'success':True,'savedLinks':1,'ownedScopes':len(scopes),'providerRequests':0}))
