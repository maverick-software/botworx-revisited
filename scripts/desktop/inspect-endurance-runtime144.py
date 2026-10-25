"""Read-only metadata for the exact retained acceptance runtime. No credentials exported."""
import datetime
import glob
import json
import os
from pathlib import Path
import subprocess
import sys
from urllib.parse import urlparse, unquote
from uuid import UUID

out = Path(sys.argv[1])
spec = json.loads((out / "intent.json").read_text())
assert str(UUID(spec["instance"])) == spec["instance"]
assert spec["instance"] == "b521a8fe-d803-4031-af23-4bb51f4e1e56"
assert Path("/opt/agentopia/runtime-instance").read_text().strip() == spec["instance"]
assert spec["dbPort"] == 60750
owner = str(UUID(spec["owner"]))
goals = [str(UUID(value)) for value in spec["goals"]]
os.chdir("/home/agentopia/app")
state = json.loads(subprocess.check_output(["supabase", "stack", "status", "--output-format", "json"], text=True))
result = {"success": True, "at": datetime.datetime.now(datetime.timezone.utc).isoformat(), "identityVerified": True, "services": [{"service": r["service"], "state": r["state"]} for r in state.get("services", [])], "readOnly": True}
if any(row["service"] == "database" and row["state"] == "running" for row in state.get("services", [])):
    db = urlparse(state["env"]["DB_URL"])
    assert db.port == spec["dbPort"]
    binary = glob.glob("/home/agentopia/.supabase/cache/stack/slim-services/postgres/*/linux-amd64/*/bin/psql")[0]
    env = dict(os.environ, PGPASSWORD=unquote(db.password or ""), PGOPTIONS="-c default_transaction_read_only=on", PGAPPNAME="endurance144_readonly")
    selected = ",".join("'" + value + "'" for value in goals)
    query = "SELECT jsonb_build_object('unfinishedRequests',(SELECT count(*) FROM public.desktop_requests WHERE status='running'),'unfinishedPreviews',(SELECT count(*) FROM public.desktop_preview_requests WHERE status='running'),'goals',(SELECT jsonb_agg(jsonb_build_object('id',id,'status',status,'turns',turns_used)) FROM public.desktop_goals WHERE user_id='" + owner + "' AND id IN (" + selected + ")));"
    sql = subprocess.run([binary, "-XqAt", "-v", "ON_ERROR_STOP=1", "-h", "127.0.0.1", "-p", str(db.port), "-U", "supabase_admin", "-d", "postgres"], input="BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;\n" + query + "\nCOMMIT;\n", env=env, text=True, capture_output=True)
    if sql.returncode:
        (out / "private-query-error.txt").write_text(sql.stderr)
        raise RuntimeError("Read-only acceptance metadata query failed")
    result["metadata"] = json.loads(sql.stdout)
    assert result["metadata"]["unfinishedRequests"] == 0
    assert result["metadata"]["unfinishedPreviews"] == 0
    assert len(result["metadata"]["goals"]) == len(goals)
    assert all(row["status"] == "paused" for row in result["metadata"]["goals"])
else:
    result["databaseAlreadyStopped"] = True
(out / "runtime-inspection.json").write_text(json.dumps(result, indent=2))
print(json.dumps({"success": True, "identityVerified": True, "readOnly": True, "databaseAlreadyStopped": result.get("databaseAlreadyStopped", False)}))
