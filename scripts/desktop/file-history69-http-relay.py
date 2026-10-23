"""Forward one generated fixture request to loopback PostgREST inside WSL."""
import json,sys,urllib.request,urllib.error
from urllib.parse import urlparse
request=json.load(sys.stdin);url=urlparse(request['url'])
assert url.scheme=='http' and url.hostname=='127.0.0.1' and 1024<=url.port<=65535 and not url.username and not url.password
assert request['method'] in ('GET','POST')
body=request.get('body');req=urllib.request.Request(request['url'],data=body.encode() if body is not None else None,headers=request['headers'],method=request['method'])
try:
 with urllib.request.urlopen(req,timeout=15) as response:result={'status':response.status,'headers':dict(response.headers),'body':response.read().decode()}
except urllib.error.HTTPError as error:result={'status':error.code,'headers':dict(error.headers),'body':error.read().decode()}
print(json.dumps(result))
