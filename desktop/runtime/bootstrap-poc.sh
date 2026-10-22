#!/usr/bin/env bash
set -euo pipefail

archive_path="$1"
resources_path="$2"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq ca-certificates curl xz-utils tar libatomic1 libreadline8t64 libssl3t64 libicu74 libxml2 libxslt1.1 zlib1g > /tmp/agentopia-packages.log 2>&1
tar -xzf "$archive_path" -C /usr/local/bin
chmod 755 /usr/local/bin/supabase /usr/local/bin/supabase-go
if ! id agentopia >/dev/null 2>&1; then
  useradd --create-home --shell /bin/bash agentopia
fi
install -d -o agentopia -g agentopia /home/agentopia/app/supabase/functions/runtime-probe
install -m 644 "$resources_path/poc-config.toml" /home/agentopia/app/supabase/config.toml
install -m 644 "$resources_path/runtime-probe.ts" /home/agentopia/app/supabase/functions/runtime-probe/index.ts
chown -R agentopia:agentopia /home/agentopia/app
printf 'Agentopia isolated runtime prepared.\n'
runuser -u agentopia -- /usr/local/bin/supabase --version
