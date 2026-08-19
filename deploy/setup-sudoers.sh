#!/usr/bin/env bash
# Grants the app's OS user passwordless sudo for exactly the nginx commands
# vps-monitor needs, and nothing else. Run this once, as root:
#
#   sudo ./deploy/setup-sudoers.sh <linux-username>
#
set -euo pipefail

TARGET_USER="${1:-}"
if [[ -z "$TARGET_USER" ]]; then
  echo "Usage: sudo $0 <linux-username>" >&2
  exit 1
fi

if ! id "$TARGET_USER" &>/dev/null; then
  echo "User '$TARGET_USER' does not exist." >&2
  exit 1
fi

SYSTEMCTL_BIN="$(command -v systemctl)"
NGINX_BIN="$(command -v nginx)"
NGINX_SERVICE="${NGINX_SERVICE_NAME:-nginx}"

SUDOERS_FILE="/etc/sudoers.d/vps-monitor"

cat > "$SUDOERS_FILE" <<EOF
# Managed by vps-monitor/deploy/setup-sudoers.sh — do not hand-edit.
# Allows $TARGET_USER to control ONLY the nginx service, without a password.
$TARGET_USER ALL=(root) NOPASSWD: $SYSTEMCTL_BIN start $NGINX_SERVICE
$TARGET_USER ALL=(root) NOPASSWD: $SYSTEMCTL_BIN stop $NGINX_SERVICE
$TARGET_USER ALL=(root) NOPASSWD: $SYSTEMCTL_BIN restart $NGINX_SERVICE
$TARGET_USER ALL=(root) NOPASSWD: $SYSTEMCTL_BIN reload $NGINX_SERVICE
$TARGET_USER ALL=(root) NOPASSWD: $NGINX_BIN -t
EOF

chmod 0440 "$SUDOERS_FILE"

# Validate syntax before it can lock anyone out of sudo.
if visudo -c -f "$SUDOERS_FILE"; then
  echo "OK: $SUDOERS_FILE installed and validated."
else
  echo "Syntax error detected — removing $SUDOERS_FILE." >&2
  rm -f "$SUDOERS_FILE"
  exit 1
fi
