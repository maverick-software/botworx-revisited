"""Read the ordinary Windows process paths without touching its UI or credentials."""
import json
import subprocess

def ordinary_processes(expected_version):
    assert expected_version in ('0.44.44', '0.44.45')
    command = "$OutputEncoding=[Console]::OutputEncoding=[Text.UTF8Encoding]::new();Get-Process -Name Agentopia -ErrorAction SilentlyContinue | Select-Object Id,Path | ConvertTo-Json -Compress"
    result = subprocess.run(['/mnt/c/Windows/System32/WindowsPowerShell/v1.0/powershell.exe', '-NoProfile', '-NonInteractive', '-Command', command], text=True, encoding='utf8', capture_output=True, timeout=15)
    assert result.returncode == 0 and result.stdout.strip(), 'No ordinary Agentopia process is available for verification'
    records = json.loads(result.stdout.lstrip('\ufeff'))
    records = records if isinstance(records, list) else [records]
    prefix = 'C:\\Users\\charl\\AppData\\Local\\AgentopiaDesktop\\app-'
    selected = [record for record in records if str(record.get('Path') or '').casefold().startswith(prefix.casefold())]
    expected = prefix + expected_version + '\\Agentopia.exe'
    assert selected and all(record['Path'].casefold() == expected.casefold() for record in selected), 'The running ordinary process does not match the expected installed version'
    return {'version': expected_version, 'processIds': [record['Id'] for record in selected], 'allOrdinaryProcessesMatch': True}
