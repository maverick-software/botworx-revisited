#!/usr/bin/env python3
"""Run SQL against the isolated native stack without printing credentials."""
import glob
import json
import os
import subprocess
import sys
from urllib.parse import urlparse, unquote

state = json.loads(subprocess.check_output(
    ["supabase", "stack", "status", "--output-format", "json"], text=True))
assert state["runtime"] == "native", "This probe requires the native runtime"
url = urlparse(state["env"]["DB_URL"])
env = dict(os.environ, PGPASSWORD=unquote(url.password or ""))
psql = glob.glob(os.path.expanduser(
    "~/.supabase/cache/stack/slim-services/postgres/*/linux-amd64/*/bin/psql"))
assert len(psql) == 1, "Expected one pinned PostgreSQL binary"
result = subprocess.run([
    psql[0], "-X", "-v", "ON_ERROR_STOP=1", "-h", url.hostname,
    "-p", str(url.port), "-U", "supabase_admin" if "--admin" in sys.argv else unquote(url.username), "-d", url.path[1:],
    "--no-psqlrc", "-f", sys.argv[1],
], env=env)
sys.exit(result.returncode)
