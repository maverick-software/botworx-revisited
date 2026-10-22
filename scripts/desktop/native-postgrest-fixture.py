"""Local PostgREST against a disposable database, with a fresh fixture-only JWT."""
import base64,glob,hashlib,hmac,json,os,socket,subprocess,time,urllib.request,urllib.error
from urllib.parse import urlparse,urlunparse,quote

class NativePostgrest:
 def __init__(self,database_url,database,log,sql):
  assert database.startswith('agentopia_delivery_')
  self.sql=sql;self.signatures={};self.log=log.open('wb')
  binary=glob.glob('/home/agentopia/.supabase/cache/stack/slim-services/postgrest/*/linux-amd64/*/bin/postgrest');assert len(binary)==1
  with socket.socket() as reservation:
   reservation.bind(('127.0.0.1',0));port=reservation.getsockname()[1]
  source=urlparse(database_url);uri=urlunparse((source.scheme,'supabase_admin:'+quote(source.password or '',safe='')+'@127.0.0.1:'+str(source.port),'/'+database,'','',''))
  secret=os.urandom(32).hex()
  encode=lambda value:base64.urlsafe_b64encode(json.dumps(value,separators=(',',':')).encode()).rstrip(b'=')
  header,payload=encode({'alg':'HS256','typ':'JWT'}),encode({'role':'service_role','iat':int(time.time()),'exp':int(time.time())+1800})
  signing=header+b'.'+payload;self.token=(signing+b'.'+base64.urlsafe_b64encode(hmac.new(secret.encode(),signing,hashlib.sha256).digest()).rstrip(b'=')).decode()
  env=dict(os.environ,PGRST_DB_URI=uri,PGRST_DB_SCHEMAS='public',PGRST_DB_ANON_ROLE='anon',PGRST_JWT_SECRET=secret,PGRST_SERVER_HOST='127.0.0.1',PGRST_SERVER_PORT=str(port),PGRST_DB_POOL='3',PGRST_DB_CONFIG='false')
  self.base='http://127.0.0.1:'+str(port)
  self.process=subprocess.Popen([binary[0]],env=env,stdout=self.log,stderr=self.log)
  deadline=time.monotonic()+15
  while True:
   try:
    with urllib.request.urlopen(self.base,timeout=1):break
   except (urllib.error.URLError,TimeoutError):
    assert self.process.poll() is None,'PostgREST exited; inspect its private log'
    if time.monotonic()>=deadline:raise RuntimeError('Local PostgREST did not become ready')
    time.sleep(.1)
 def call(self,name,args,fail=False):
  key=(name,len(args))
  if key not in self.signatures:
   candidates=json.loads(self.sql("SELECT json_agg(json_build_object('names',proargnames,'types',oidvectortypes(proargtypes))) FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname='"+name+"' AND pronargs>="+str(len(args))+" AND pronargs-pronargdefaults<="+str(len(args))))
   assert candidates and len(candidates)==1,(name,len(args));self.signatures[key]=candidates[0]
  signature=self.signatures[key];types=signature['types'].split(', ');body={}
  for field,kind,value in zip(signature['names'],types,args):
   if kind in ('jsonb','json') and isinstance(value,str):value=json.loads(value)
   if kind=='boolean' and isinstance(value,str):value=value.lower() in ('true','t','1')
   body[field]=value
  request=urllib.request.Request(self.base+'/rpc/'+name,data=json.dumps(body).encode(),headers={'Authorization':'Bearer '+self.token,'Content-Type':'application/json'},method='POST')
  try:
   with urllib.request.urlopen(request,timeout=30) as response:status=response.status;result=response.read().decode()
  except urllib.error.HTTPError as e:status=e.code;result=e.read().decode()
  if fail:
   assert status>=400,'A forbidden RPC succeeded';return result
  if status>=400:
   self.log.write(result.encode()+b'\n');self.log.flush();raise RuntimeError(name+' HTTP '+str(status)+'; inspect the private PostgREST log')
  if not result:return ''
  decoded=json.loads(result)
  return decoded if isinstance(decoded,str) else json.dumps(decoded,separators=(',',':'))
 def close(self):
  if self.process.poll() is None:
   self.process.terminate()
   try:self.process.wait(timeout=10)
   except subprocess.TimeoutExpired:self.process.kill();self.process.wait(timeout=10)
  self.log.close()
