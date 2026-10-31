#!/usr/bin/env python3
"""Generate installation-specific runtime keys before starting local services."""
import base64
import json
import os
from pathlib import Path
import pwd
import secrets
import uuid
import re
from cryptography.hazmat.primitives.asymmetric import ec

os.umask(0o077)
owner = pwd.getpwnam('sylvana')
private = Path('/home/sylvana/.config/sylvana')
private.mkdir(parents=True, exist_ok=True)
for folder in (private.parent, private):
    os.chown(folder, owner.pw_uid, owner.pw_gid)
    os.chmod(folder, 0o700)

def save(path, value):
    temporary = path.with_suffix(path.suffix + '.tmp')
    temporary.write_text(value)
    os.chmod(temporary, 0o600)
    os.chown(temporary, owner.pw_uid, owner.pw_gid)
    temporary.replace(path)

file = private / 'runtime-secrets.json'
initialized = not file.exists()
if initialized:
    numbers = ec.generate_private_key(ec.SECP256R1()).private_numbers()
    def encoded(number):
        return base64.urlsafe_b64encode(number.to_bytes(32, 'big')).decode().rstrip('=')
    signing_key = {'kty': 'EC', 'crv': 'P-256', 'alg': 'ES256', 'use': 'sig', 'key_ops': ['sign', 'verify'], 'ext': True,
                   'kid': str(uuid.uuid4()), 'x': encoded(numbers.public_numbers.x),
                   'y': encoded(numbers.public_numbers.y), 'd': encoded(numbers.private_value)}
    values = {'jwt_secret': secrets.token_hex(32),
              'publishable_key': 'sb_publishable_' + secrets.token_urlsafe(32),
              'secret_key': 'sb_secret_' + secrets.token_urlsafe(32),
              'signing_key': signing_key}
    save(file, json.dumps(values))
else:
    values = json.loads(file.read_text())
    assert len(values['jwt_secret']) >= 64 and values['signing_key']['d'], 'Invalid private runtime keys'
    values['signing_key'].update({'key_ops': ['sign', 'verify'], 'ext': True})
    save(file, json.dumps(values))

# Existing encrypted records must retain their original database encryption root.
if 'root_key' not in values:
    roots = list(Path('/home/sylvana/.supabase/stacks').glob('*/data/*/pgsodium_root.key'))
    assert len(roots) <= 1, 'Ambiguous database encryption root'
    values['root_key'] = roots[0].read_text().strip() if roots else secrets.token_hex(32)
    assert re.fullmatch('[0-9a-fA-F]{64}', values['root_key']), 'Invalid database encryption root'
    save(file, json.dumps(values))

directory = Path('/home/sylvana/app/supabase')
save(directory / 'signing-keys.json', json.dumps([values['signing_key']]))
template = Path('/opt/sylvana/config-template.toml').read_text()
settings = ''.join(name + ' = ' + json.dumps(values[name]) + '\n'
                   for name in ('jwt_secret', 'publishable_key', 'secret_key'))
settings += 'signing_keys_path = "./signing-keys.json"\n'
assert template.count('[auth]\n') == 1
configuration = template.replace('[auth]\n', '[auth]\n' + settings)
configuration = configuration.replace('[db]\n', '[db]\nroot_key = ' + json.dumps(values['root_key']) + '\n')
configuration += '\n[storage.s3_protocol]\nenabled = false\n'
previous_configuration = (directory / 'config.toml').read_text() if (directory / 'config.toml').exists() else ''
save(directory / 'config.toml', configuration)
print(json.dumps({'restartRequired': (initialized or previous_configuration != configuration) and any(Path('/home/sylvana/.supabase/stacks').glob('*/state.json'))}))
