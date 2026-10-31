#!/usr/bin/env bash
set -euo pipefail
test "$(id -un)" = sylvana
cd /home/sylvana/app
mapfile -t key_paths < <(find /home/sylvana/.supabase/stacks -name pgsodium_root.key)
test "${#key_paths[@]}" = 1
supabase stop >/dev/null
cp -- "${key_paths[0]}" "${key_paths[0]}.before-migration-proof"
install -m 600 "$1" "${key_paths[0]}"
supabase start --runtime native --eager --exclude analytics,pooler >/dev/null
printf 'Imported the private encryption root and restarted the isolated native stack.\n'
