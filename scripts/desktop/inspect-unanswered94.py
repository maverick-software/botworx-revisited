"""Read-only evidence for the explicitly named installed unanswered-question test."""
from pathlib import Path
from urllib.parse import urlparse, unquote
import datetime, glob, json, os, re, subprocess, sys

out=Path(sys.argv[1]);marker=sys.argv[2]
assert out.parent==Path('/mnt/f/Agentopia/.supabase/question-flow94') and re.fullmatch(r'\d{13}',out.name)
assert out.is_dir() and out.resolve()==out and marker=='UQ94-'+out.name
assert Path('/opt/agentopia/runtime-instance').read_text().strip()=='a91a4800-e08f-4440-a4ec-588762d01bfd'
os.umask(0o077);os.chdir('/home/agentopia/app')
stack=json.loads(subprocess.check_output(['supabase','stack','status','--output-format','json'],text=True));db=urlparse(stack['env']['DB_URL']);assert db.port==57322
binary=glob.glob('/home/agentopia/.supabase/cache/stack/slim-services/postgres/*/linux-amd64/*/bin/psql')[0]
env=dict(os.environ,PGPASSWORD=unquote(db.password or ''),PGOPTIONS='-c default_transaction_read_only=on',PGAPPNAME='agentopia_unanswered94_readonly')
query="""SELECT coalesce(jsonb_agg(jsonb_build_object(
 'requestId',r.id,'conversationId',r.conversation_id,'status',r.status,'responseUpdatedAt',r.updated_at,
 'assistantMessageId',r.assistant_message_id,'state',t.state,
 'relatedRequests',(SELECT coalesce(jsonb_agg(jsonb_build_object('requestId',r2.id,'status',r2.status,'createdAt',r2.created_at,'provider',t2.context->>'provider','model',t2.context->>'model','tools',(SELECT coalesce(jsonb_agg(jsonb_build_object('name',x2.name,'status',x2.status)),'[]') FROM public.desktop_tool_calls x2 WHERE x2.request_id=r2.id),'userText',m3.content->>'text','state',t2.state) ORDER BY r2.created_at),'[]') FROM public.desktop_requests r2 JOIN public.chat_messages_v2 m3 ON m3.id=r2.user_message_id LEFT JOIN public.desktop_codex_turns t2 ON t2.request_id=r2.id WHERE r2.conversation_id=r.conversation_id AND r2.user_id=r.user_id),
 'userMessages',(SELECT count(*) FROM public.chat_messages_v2 m2 WHERE m2.conversation_id=r.conversation_id AND m2.role='user'),
 'tools',(SELECT coalesce(jsonb_agg(jsonb_build_object('name',x.name,'status',x.status)),'[]') FROM public.desktop_tool_calls x WHERE x.request_id=r.id)
 )),'[]') FROM public.desktop_requests r
 JOIN public.chat_messages_v2 m ON m.id=r.user_message_id
 LEFT JOIN public.desktop_codex_turns t ON t.request_id=r.id AND t.user_id=r.user_id
 WHERE m.content->>'text' LIKE '"""+marker+"%';"
result=subprocess.run([binary,'-XqAt','-v','ON_ERROR_STOP=1','-h','127.0.0.1','-p',str(db.port),'-U','supabase_admin','-d','postgres'],input='BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;\n'+query+'\nCOMMIT;\n',env=env,text=True,capture_output=True)
if result.returncode:
 (out/'private-inspection-error.txt').write_text(result.stderr)
 raise RuntimeError('Read-only test inspection failed; private diagnostic retained')
rows=json.loads(result.stdout);assert len(rows)<=1,'Inspect existing attempts; never repeat this test prompt'
evidence={'at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'marker':marker,'requestCount':len(rows),'readOnly':True,'modelRequestsStartedByInspector':0}
if rows:
 row=rows[0];state=row.pop('state') or {};root=state.get('threadId');items=[item for item in state.get('items',[]) if item.get('threadId')==root and item.get('item',{}).get('type')=='agentMessage']
 questions=[];messages=[];last_question_index=-1
 for index,entry in enumerate(items):
  item=entry['item'];messages.append({'text':item.get('text',''),'phase':item.get('phase'),'delivery':item.get('delivery'),'questionCount':len(item.get('questions') or []),'completed':entry.get('completed',False)})
  if item.get('questions'):
   last_question_index=index
   for qi,question in enumerate(item['questions']):questions.append({'title':question['title'],'options':question.get('options'),'answer':(entry.get('questionAnswer') or {}).get('answers',[None]*len(item['questions']))[qi],'answerReceipt':entry.get('questionAnswer')})
 related=row.pop('relatedRequests',[])
 for request in related:
  context=request.pop('state') or {};request['nativeActionTypes']=[i['item']['type'] for i in context.get('items',[]) if i.get('item',{}).get('type') in ['commandExecution','fileChange','mcpToolCall','dynamicToolCall']];request['publicMessages']=[i['item'].get('text','') for i in context.get('items',[]) if i.get('threadId')==context.get('threadId') and i.get('item',{}).get('type')=='agentMessage'];request['pendingQuestions']=[q['title'] for i in context.get('items',[]) if i.get('threadId')==context.get('threadId') and i.get('item',{}).get('type')=='agentMessage' and not i.get('questionAnswer') for q in i['item'].get('questions') or []]
 evidence.update(**row,relatedRequests=related,questions=questions,publicMessages=messages,publicMessagesAfterQuestion=len(messages)-last_question_index-1 if last_question_index>=0 else 0,steeringCount=len(state.get('steering',[])),nativeGoalStatus=(state.get('goal') or {}).get('status'),unansweredQuestionCount=sum(q['answer'] is None for q in questions))
stamp=str(int(datetime.datetime.now(datetime.timezone.utc).timestamp()*1000));file=out/('snapshot-'+stamp+'.json');file.write_text(json.dumps(evidence,indent=2));(out/'snapshot-current.json').write_text(json.dumps({'evidence':str(file)},indent=2))
print(json.dumps({k:v for k,v in evidence.items() if k not in ['publicMessages','questions','relatedRequests']}))
