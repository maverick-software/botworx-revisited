"""Inspect one saved native turn without executing historical commands or model calls."""
import glob, hashlib, json, os, re, shlex, sqlite3, subprocess, sys
from pathlib import Path
from urllib.parse import urlparse, unquote

ROOT = Path('/mnt/d/Users/charl/software/Agentopia')
out = Path(sys.argv[1]).resolve()
assert out.parent == ROOT / '.supabase/desktop-preview-investigation'
assert re.fullmatch(r'recovery-\d{13}', out.name)
assert Path('/opt/agentopia/runtime-instance').read_text().strip() == 'a91a4800-e08f-4440-a4ec-588762d01bfd'
os.umask(0o077)
out.mkdir(exist_ok=False)
os.chdir('/home/agentopia/app')
stack = json.loads(subprocess.check_output(['supabase', 'stack', 'status', '--output-format', 'json'], text=True))
db = urlparse(stack['env']['DB_URL'])
binary = glob.glob('/home/agentopia/.supabase/cache/stack/slim-services/postgres/*/linux-amd64/*/bin/psql')[0]
env = dict(os.environ, PGPASSWORD=unquote(db.password or ''), PGOPTIONS='-c default_transaction_read_only=on', PGAPPNAME='agentopia_saved_preview_recovery')
query = """SELECT json_build_object('state',n.state,'context',n.context) FROM public.desktop_codex_turns n JOIN public.desktop_requests r ON r.id=n.request_id WHERE r.id='c3bd534e-d54b-4545-b274-ebfcd062a0ad' AND r.user_id='9bf808b8-96a9-441d-b63c-eb835eb784c4' AND r.conversation_id='4d752d56-3037-4f5f-b7b6-5752add39e22'"""
p = subprocess.run([binary, '-XqAt', '-v', 'ON_ERROR_STOP=1', '-h', '127.0.0.1', '-p', str(db.port), '-U', 'supabase_admin', '-d', 'postgres'], input=query+'\n', text=True, capture_output=True, env=env)
if p.returncode:
    raise RuntimeError('Exact read-only saved-turn query failed')
record = json.loads(p.stdout)
report = {'readOnly': True, 'requestId': 'c3bd534e-d54b-4545-b274-ebfcd062a0ad', 'contextKeys': list(record['context']), 'stateKeys': list(record['state']), 'candidates': [], 'rolloutCandidates': [], 'inputFacts': []}
for entry in record['state'].get('items', []):
    item = entry.get('item', {})
    command = item.get('command', '')
    if not isinstance(command, str) or '<html' not in command:
        continue
    # Native display commands may contain POSIX-escaped PowerShell -Command text.
    # Decode quoting as data only; never invoke a shell with the saved command.
    variants = [('raw', command)]
    try:
        tokens = shlex.split(command)
        if '-Command' in tokens:
            variants.append(('shell-decoded', tokens[tokens.index('-Command')+1]))
    except ValueError:
        pass
    for kind, value in variants:
        match = re.search(r'<!doctype html>.*?</html>', value, re.I | re.S)
        if not match:
            continue
        html = match.group(0)
        name = 'candidate-'+str(len(report['candidates']))+'.html'
        (out/name).write_text(html, encoding='utf-8', newline='')
        report['candidates'].append({'file': name, 'kind': kind, 'itemId': item.get('id'), 'characters': len(html), 'bytes': len(html.encode()), 'sha256': hashlib.sha256(html.encode()).hexdigest()})
scope='4d752d56-3037-4f5f-b7b6-5752add39e22-a0300d331934b48aafd1ea62ccbb3da1'
binding={'format':1,'owner':'9bf808b8-96a9-441d-b63c-eb835eb784c4','provider':'openai-oauth','scope':scope}
key=hashlib.sha256(json.dumps(binding,separators=(',',':')).encode()).hexdigest()[:32]
profile=Path('/mnt/c/Users/charl/AppData/Roaming/Agentopia')
homes=[profile/'codex'/binding['owner']/binding['provider']/scope,profile/'codex'/'_'/binding['provider']/key]
for home in homes:
    index=home/'state_5.sqlite'
    if not index.is_file():
        continue
    connection=sqlite3.connect(index.as_uri()+'?mode=ro',uri=True)
    try:
        threads=connection.execute('SELECT id,rollout_path FROM threads').fetchall()
    finally:
        connection.close()
    for thread_id,windows_rollout in threads:
        win=windows_rollout.removeprefix('\\\\?\\')
        assert re.match(r'^[A-Za-z]:\\',win)
        rollout=Path('/mnt/'+win[0].lower()+'/'+win[3:].replace('\\','/'))
        # A stored index is untrusted; limit reads to this verified conversation home.
        assert rollout.resolve().is_relative_to(home.resolve())
        for number,line in enumerate(rollout.read_text(encoding='utf-8').splitlines(),1):
            event=json.loads(line)
            payload=event.get('payload',{})
            if payload.get('type')=='custom_tool_call' and '<!doctype html>' in str(payload.get('input','')).lower():
                code=payload['input'];name='saved-input-'+str(number)+'.txt';(out/name).write_text(code,encoding='utf-8',newline='')
                report['inputFacts'].append({'line':number,'file':name,'prefix':code[:90],'suffix':code[-350:]})
            if '49819' in line or ('write_stdin' in line and '<!doctype' not in line):
                report['inputFacts'].append({'line':number,'eventType':event.get('type'),'payloadType':payload.get('type'),'name':payload.get('name'),'keys':list(payload),'argumentsPrefix':str(payload.get('arguments',payload.get('input','')))[:1000]})
            if isinstance(payload,dict) and payload.get('type')=='function_call' and isinstance(payload.get('arguments'),str):
                try:args=json.loads(payload['arguments'])
                except ValueError:args={}
                if payload.get('name')=='write_stdin' or args.get('session_id')==49819:
                    report['inputFacts'].append({'line':number,'name':payload.get('name'),'argumentKeys':list(args),'characters':len(args.get('chars','')),'terminator':chr(30) in args.get('chars',''),'textPrefix':args.get('chars','')[:40]})
            def strings(value):
                if isinstance(value,str):
                    yield value
                    if value.startswith('{'):
                        try:
                            yield from strings(json.loads(value))
                        except (ValueError,RecursionError):
                            pass
                elif isinstance(value,dict):
                    for child in value.values():yield from strings(child)
                elif isinstance(value,list):
                    for child in value:yield from strings(child)
            for value in strings(event):
                match=re.search(r'<!doctype html>.*?</html>',value,re.I|re.S)
                if not match:continue
                html=match.group(0)
                if len(html)<30000:continue
                name='rollout-candidate-'+str(len(report['rolloutCandidates']))+'.html'
                (out/name).write_text(html,encoding='utf-8',newline='')
                report['rolloutCandidates'].append({'file':name,'threadId':thread_id,'line':number,'eventType':event.get('type'),'characters':len(html),'bytes':len(html.encode()),'sha256':hashlib.sha256(html.encode()).hexdigest()})
(out/'inspection.json').write_text(json.dumps(report, indent=2))
print(json.dumps(report))
