#!/usr/bin/env python3
"""Run as root in a disposable, externally disconnected proof runtime."""
import hashlib
import hmac
import base64
import json
import os
from pathlib import Path
import subprocess
import urllib.request
import urllib.error

def command(*args):
    return subprocess.check_output(['runuser','-u','agentopia','--',*args],cwd='/home/agentopia/app',stderr=subprocess.DEVNULL,text=True)

private = Path('/home/agentopia/.config/agentopia/runtime-secrets.json')
before = json.loads(private.read_text())
subprocess.run(['python3','/opt/agentopia/secure-runtime.py'],check=True,stdout=subprocess.DEVNULL)
assert before == json.loads(private.read_text()), 'Runtime keys changed during repeated setup'
assert private.stat().st_mode & 0o777 == 0o600
assert before['root_key'] != 'd4dc5b6d4a1d6a10b2c1e76112c994d65db7cec380572cc1839624d4be3fa275'

try:
    command('supabase','start','--runtime','native','--eager','--exclude','analytics,pooler,studio')
    state = json.loads(command('supabase','stack','status','--output-format','json'))
    environment = state['env']
    assert environment['SECRET_KEY'] == before['secret_key']
    def request(key):
        try:
            with urllib.request.urlopen(urllib.request.Request(environment['API_URL']+'/auth/v1/admin/users',headers={'apikey':key,'Authorization':'Bearer '+key})) as response:
                return response.status
        except urllib.error.HTTPError as error:
            return error.code
    assert request(environment['SERVICE_ROLE_KEY']) == 200, 'Private service key failed'
    def encoded(value):
        return base64.urlsafe_b64encode(json.dumps(value,separators=(',',':')).encode()).decode().rstrip('=')
    content = encoded({'alg':'HS256','typ':'JWT'})+'.'+encoded({'iss':'supabase-demo','role':'service_role','exp':1983812996})
    signature = base64.urlsafe_b64encode(hmac.new(b'super-secret-jwt-token-with-at-least-32-characters-long',content.encode(),hashlib.sha256).digest()).decode().rstrip('=')
    assert request(content+'.'+signature) in (401,403), 'Default development JWT was accepted'
    development_secret = os.environ.get('AGENTOPIA_DEVELOPMENT_SECRET')
    assert development_secret, 'Set AGENTOPIA_DEVELOPMENT_SECRET to the public development key before this verification'
    assert request(development_secret) in (401,403), 'Default development secret was accepted'
    root = list(Path('/home/agentopia/.supabase/stacks').glob('*/data/*/pgsodium_root.key'))
    assert len(root)==1 and root[0].read_text().strip()==before['root_key']
    print('PASS: Fresh offline services use persistent private signing/API/encryption keys, and reject default development credentials.')
finally:
    command('supabase','stop')
