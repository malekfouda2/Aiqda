#!/usr/bin/env bash
set -euo pipefail

if [[ "$EUID" -ne 0 ]]; then
    echo "Run this script as root on the Aiqda production server." >&2
    exit 1
fi

deploy_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
config_source="$deploy_dir/nginx/aiqda.conf"
config_target="/etc/nginx/sites-available/aiqda"

if [[ "$(readlink -f /etc/nginx/sites-enabled/aiqda)" != "$config_target" ]] || [[ ! -f "$config_target" ]]; then
    echo "Unexpected Nginx site layout; configuration was not changed." >&2
    exit 1
fi

nginx -t
if cmp -s "$config_source" "$config_target"; then
    echo "Aiqda Nginx configuration already matches Git."
    exit 0
fi

backup_dir="$(mktemp -d /etc/nginx/aiqda-backup.XXXXXX)"
cp -p "$config_target" "$backup_dir/aiqda.conf"

restore_config() {
    echo "Deployment failed; restoring $backup_dir/aiqda.conf." >&2
    cp -p "$backup_dir/aiqda.conf" "$config_target"
    nginx -t && systemctl reload nginx
}
trap restore_config ERR

install -m 644 "$config_source" "$config_target"
nginx -t
systemctl reload nginx
trap - ERR

echo "Aiqda Nginx configuration deployed. Previous configuration: $backup_dir/aiqda.conf"
