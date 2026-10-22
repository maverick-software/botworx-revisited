"""Record quota refusal, fixture integrity and all pre-existing saved table rows."""
from pathlib import Path
from collections import Counter
import contextlib, datetime, hashlib, io, json, re, runpy, subprocess

root = Path('/mnt/d/Users/charl/software/Agentopia')
with contextlib.redirect_stdout(io.StringIO()):
    audit = runpy.run_path(str(root / 'scripts/desktop/inspect-office-edit-live.py'))
out, intent, parents = audit['out'], audit['intent'], audit['parents']
assert len(parents) == 1 and parents[0]['id'] == intent['requestId'] and parents[0]['status'] == 'failed'
assert 'Subscription Sharing usage limit' in parents[0]['error'] and audit['tools'] == []
assert audit['core'] == {'accounts': 2, 'chats': 113, 'messages': 392, 'requests': 196, 'runningRequests': 0}
native = parents[0]['native']
assert native['context']['provider'] == 'openai-oauth'
assert native['context']['options']['permission'] == 'full'
assert native['runtime_version'] == '0.163.0'
assert all(item['item']['type'] == 'userMessage' for item in native['state']['items']) and not native['state']['approvals']
for name, digest in intent['inputHashes'].items():
    assert hashlib.sha256((out / name).read_bytes()).hexdigest() == digest
assert not (out / 'edited_workbook.xlsx').exists() and not (out / 'edited_slides.pptx').exists()

recovery = Path('/mnt/c/Users/charl/AgentopiaRecovery/private-profile-current/1792459532573')
binary = Path(audit['binary']).parent
before = {}
for schema, archive in [('public', 'application.dump'), ('auth', 'auth.dump'), ('vault', 'vault.dump')]:
    text = subprocess.check_output([str(binary / 'pg_restore'), '--data-only', '--file=-', str(recovery / 'current-database-backup' / archive)], text=True)
    for match in re.finditer(r'^COPY ([a-z_]+)\."?([a-z_0-9]+)"? \(([^\n]+)\) FROM stdin;\n(.*?)^\\\.\n', text, re.M | re.S):
        found, name = match.group(1, 2)
        if found != schema or (schema == 'auth' and name != 'users') or (schema == 'vault' and name != 'secrets'):
            continue
        columns = [c.strip().strip('"') for c in match[3].split(',')]
        assert all(re.fullmatch('[a-z_0-9]+', c) for c in columns)
        keep = [i for i, c in enumerate(columns) if schema != 'auth' or c not in ('last_sign_in_at', 'updated_at')]
        normalize = lambda rows, keep=keep: Counter('\t'.join(row.split('\t')[i] for i in keep) for row in rows)
        before[schema + '.' + name] = (columns, normalize(match[4].splitlines()), normalize)
assert len(before) == 126
args = [str(binary / 'psql'), '-XqAt', '-v', 'ON_ERROR_STOP=1', '-h', '127.0.0.1', '-p', str(audit['db'].port), '-U', 'supabase_admin', '-d', 'postgres']
tables, changed = {}, []
for key, (columns, old, normalize) in before.items():
    schema, name = key.split('.')
    query = 'COPY (SELECT ' + ','.join('"' + c + '"' for c in columns) + ' FROM ' + schema + '."' + name + '") TO STDOUT;'
    current = subprocess.run(args, input=query, text=True, env=dict(audit['env'], PGTZ='UTC'), capture_output=True, check=True).stdout
    current = normalize(current.splitlines())
    missing, added = old - current, current - old
    if missing:
        changed.append(key)
    tables[key] = {'priorRows': sum(old.values()), 'currentRows': sum(current.values()), 'missingOrChangedPriorRows': sum(missing.values()), 'additionalRows': sum(added.values())}
record = {'success': not changed, 'at': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'requestId': intent['requestId'], 'conversationId': intent['conversationId'], 'requestFailedAtProviderUsageLimit': True, 'officeEditingDemonstrated': False, 'nativeToolItems': 0, 'newRequests': 1, 'OpenRouterRequests': 0, 'replayed': False, 'inputFilesUnchanged': True, 'editedFilesCreated': False, 'allPriorRowsPreserved': not changed, 'tablesCompared': len(tables), 'changedPriorTables': changed, 'tables': tables, 'currentCounts': audit['core'], 'fullGoalComplete': False}
with (out / 'refusal-acceptance.json').open('x') as f:
    json.dump(record, f, indent=2)
print(json.dumps({k: v for k, v in record.items() if k != 'tables'}))
assert not changed, ('Pre-existing rows changed; investigate before acceptance', changed)
