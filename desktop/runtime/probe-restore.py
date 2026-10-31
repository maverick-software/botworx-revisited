#!/usr/bin/env python3
"""Restore a private copy only into the dedicated disposable feasibility stack."""
import glob
import json
import os
import subprocess
import sys
import tempfile
from urllib.parse import urlparse, unquote

state = json.loads(subprocess.check_output(
    ["supabase", "stack", "status", "--output-format", "json"], text=True))
assert state["runtime"] == "native"
url = urlparse(state["env"]["DB_URL"])
assert url.port == 56322, "Restore is restricted to the disposable proof database"
env = dict(os.environ, PGPASSWORD=unquote(url.password or ""))
binary = glob.glob(os.path.expanduser(
    "~/.supabase/cache/stack/slim-services/postgres/*/linux-amd64/*/bin/pg_restore"))
assert len(binary) == 1
archives = [arg for arg in sys.argv[1:] if arg != "--admin"]
role = "supabase_admin" if "--admin" in sys.argv else unquote(url.username)
for archive in archives:
    toc = subprocess.check_output([binary[0], "--list", archive], text=True)
    # The native service bootstrap already owns the public schema itself.
    toc = "\n".join(line for line in toc.splitlines()
                    if " SCHEMA - public " not in line
                    and not (" DEFAULT ACL " in line and line.endswith(" supabase_admin")))
    with tempfile.NamedTemporaryFile(mode="w+", prefix="sylvana-restore-") as listing:
        listing.write(toc + "\n")
        listing.flush()
        subprocess.run([
            binary[0], "--exit-on-error", "--single-transaction", "--no-owner",
            "--use-list", listing.name,
            "-h", url.hostname, "-p", str(url.port),
            "-U", role, "-d", url.path[1:], archive,
        ], env=env, check=True)
