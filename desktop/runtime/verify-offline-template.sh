#!/usr/bin/env bash
set -euo pipefail
test "$(id -u)" = 0
# Run only after `unshare --net`; enabling this namespace's loopback interface
# leaves the host and every other WSL distribution's networking unchanged.
test -z "$(ip -o route show default)"
ip link set lo up
runuser -u sylvana -- /bin/bash -c '
 set -euo pipefail
 cd /home/sylvana/app
 trap "supabase stop >/dev/null 2>&1 || true" EXIT
 supabase start --runtime native --eager --exclude analytics,pooler >/home/sylvana/offline-start.private.log 2>&1
 python3 /opt/sylvana/manage.py provision
 curl --fail --silent http://127.0.0.1:57321/auth/v1/health >/dev/null
 printf "PASS: Fresh database provisioning and local authentication work with no external network interface.\n"
 python3 /opt/sylvana/manage.py provision
 printf "PASS: Database provisioning is repeatable without changing migration versions.\n"
'
