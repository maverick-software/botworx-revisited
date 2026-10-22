"""Start only the verified existing production services for closed-app recovery.

This command never provisions a runtime, applies SQL, replaces maintenance code,
or changes an encryption root. Service output stays in the private F-drive job.
"""
from pathlib import Path
import hashlib, importlib.util, json, os, re, subprocess, sys, time, tomllib
from urllib.parse import urlparse

INSTANCE = 'a91a4800-e08f-4440-a4ec-588762d01bfd'
REQUIRED = {'database', 'rest', 'auth', 'storage', 'realtime', 'functions'}


def healthy(state):
    return REQUIRED <= {v['service'] for v in state.get('services', [])
                        if v.get('state') == 'running' and v.get('health') == 'healthy'}


def validated_existing(root=Path('/opt/agentopia'), home=Path('/home/agentopia')):
    assert (root/'runtime-instance').read_text().strip() == INSTANCE
    assert (root/'runtime-identity').read_text().strip() == 'local.agentopia.desktop-runtime.v1'
    states = list((home/'.supabase/stacks').glob('*/state.json'))
    assert len(states) == 1 and not states[0].is_symlink()
    saved = json.loads(states[0].read_text())
    assert saved['identity']['projectRoot'] == '/home/agentopia/app'
    assert saved['identity']['stackName'] == 'default'
    assert saved['identity']['branchContext'] == 'ordinary-workspace'
    versions = list((states[0].parent/'data').glob('*/data/PG_VERSION'))
    assert len(versions) == 1 and versions[0].read_text().strip() == '17'
    data = versions[0].parent
    assert data.resolve() == data and not data.is_symlink() and (data/'global/pg_control').is_file()
    key = (data.parent/'pgsodium_root.key').read_text().strip()
    assert re.fullmatch('[0-9a-fA-F]{64}', key)
    assert saved['credentials']['postgresRootKey'] == key
    assert json.loads((home/'.config/agentopia/runtime-secrets.json').read_text())['root_key'] == key
    assert tomllib.loads((home/'app/supabase/config.toml').read_text())['db']['root_key'] == key
    controls = list((home/'.supabase/cache/stack/slim-services/postgres').glob('*/linux-amd64/*/bin/pg_ctl'))
    assert len(controls) == 1
    with (root/'manage.py').open('rb') as stream:
        maintenance_sha = hashlib.file_digest(stream, 'sha256').hexdigest()
    return {'identityVerified': True, 'encryptionRootBindingsVerified': 4,
            'installedManageSha256': maintenance_sha}


def status():
    state = json.loads(subprocess.check_output(['supabase', 'stack', 'status', '--output-format', 'json'], text=True))
    assert state['runtime'] == 'native'
    if 'DB_URL' in state.get('env', {}):
        assert urlparse(state['env']['DB_URL']).port == 57322
    return state


def validated_helper(helper, release_root=Path('/mnt/f/Agentopia/.supabase/desktop-release-04450')):
    assert helper.is_file() and helper.resolve() == helper and helper.is_relative_to(release_root)
    return helper


def verified_service_count(mode, state):
    assert mode in ('observe', 'start-existing')
    if mode == 'start-existing':
        assert healthy(state), 'All six existing core services must be healthy before recovery'
    return len(REQUIRED & {v['service'] for v in state.get('services', [])
                           if v.get('state') == 'running' and v.get('health') == 'healthy'})


def main():
    assert len(sys.argv) == 4 and sys.argv[1] in ('observe', 'start-existing')
    mode, helper, job = sys.argv[1], Path(sys.argv[2]), Path(sys.argv[3])
    assert job.parent == Path('/mnt/f/Agentopia/.supabase/desktop-normal-maintenance') and re.fullmatch(r'\d{13}', job.name)
    assert job.resolve() == job and job.is_dir()
    validated_helper(helper)
    os.umask(0o077)
    os.chdir('/home/agentopia/app')
    before = validated_existing()
    state = status()
    started = False
    retired = 0
    if mode == 'start-existing' and not healthy(state):
        spec = importlib.util.spec_from_file_location('qualified_database_state', helper)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        retired = module.retire_runtime_pidfiles()
        # The native supervisor uses the existing project, service files and key.
        result = subprocess.run(['supabase', 'start', '--runtime', 'native', '--eager', '--exclude', 'analytics,pooler,studio'],
                                capture_output=True, text=True, timeout=300)
        if result.returncode:
            (job/'private-service-start.log').write_text(result.stdout+'\n'+result.stderr)
            raise RuntimeError('Existing services did not start; private diagnostics retained in the maintenance job')
        started = True
        deadline = time.monotonic()+120
        while not healthy(state := status()) and time.monotonic() < deadline:
            time.sleep(1)
    core_services = verified_service_count(mode, state)
    assert validated_existing() == before, 'The existing identity, root bindings or installed maintenance code changed'
    report = dict(before, success=True, existingServicesStarted=started, verifiedStaleProcessRecordsRetired=retired,
                  coreServicesHealthy=core_services, provisioned=False, sqlWrites=0, providerRequests=0)
    (job/'existing-runtime.json').write_text(json.dumps(report, indent=2))
    print(json.dumps(report), flush=True)


if __name__ == '__main__':
    main()
