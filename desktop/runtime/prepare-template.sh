#!/usr/bin/env bash
set -euo pipefail
test "$(id -u)" = 0
resources="$1"
cache_archive="$2"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq ca-certificates curl python3 python3-cryptography xz-utils tar libatomic1 libreadline8t64 libssl3t64 libicu74 libxml2 libxslt1.1 zlib1g >/tmp/sylvana-packages.log 2>&1
tar -xzf "$3" -C /usr/local/bin
id sylvana >/dev/null 2>&1 || useradd --create-home --shell /bin/bash sylvana
install -d -o sylvana -g sylvana /home/sylvana/app/supabase/functions/runtime-probe /home/sylvana/.supabase
tar -xf "$cache_archive" -C /home/sylvana/.supabase
install -d /opt/sylvana/database
printf 'local.sylvana.desktop-runtime.v1\n' >/opt/sylvana/runtime-identity
cp "$resources"/database/*.sql /opt/sylvana/database/
install -m 644 "$resources/runtime/manage.py" /opt/sylvana/manage.py
sed 's/sylvana-desktop-poc/sylvana-desktop/;s/563/573/g' "$resources/runtime/poc-config.toml" >/home/sylvana/app/supabase/config.toml
sed -i '/^\[auth\]/,/^\[auth.email\]/s/enable_signup = true/enable_signup = false/' /home/sylvana/app/supabase/config.toml
install -m 644 "$resources/runtime/runtime-probe.ts" /home/sylvana/app/supabase/functions/runtime-probe/index.ts
chown -R sylvana:sylvana /home/sylvana
printf '[user]\ndefault=sylvana\n' >/etc/wsl.conf
# This template deliberately contains cached software only. No stack, account,
# database, encryption root, provider credential, or host identity is exported.
test ! -d /home/sylvana/.supabase/stacks
test ! -d /root/.supabase/stacks
apt-get clean
bash "$resources/runtime/slim-template.sh"
printf 'Clean runtime template is ready for export.\n'
