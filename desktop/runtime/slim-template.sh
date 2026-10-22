#!/usr/bin/env bash
set -euo pipefail
test "$(id -u)" = 0
test "$(cat /opt/agentopia/runtime-identity)" = local.agentopia.desktop-runtime.v1
test ! -d /home/agentopia/.supabase/stacks
studio=/home/agentopia/.supabase/cache/stack/slim-services/studio
if test -d "$studio"; then
 test "$(readlink -f "$studio")" = /home/agentopia/.supabase/cache/stack/slim-services/studio
 rm -rf -- "$studio"
fi
apt-get clean
# Package indexes are build-time downloads; installed runtime libraries remain.
test "$(readlink -f /var/lib/apt/lists)" = /var/lib/apt/lists
find /var/lib/apt/lists -mindepth 1 -maxdepth 1 -exec rm -rf -- {} +
python3 - <<'PY'
from pathlib import Path
p=Path('/home/agentopia/app/supabase/config.toml')
s=p.read_text().replace('enable_signup = false','enable_signup = true')
s=s.replace('enable_signup = true','enable_signup = false',1)
s=s.replace('[studio]\nenabled = true','[studio]\nenabled = false')
p.write_text(s)
PY
printf 'Prepared the clean core runtime without the development Studio cache.\n'
