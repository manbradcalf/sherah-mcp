#!/usr/bin/env bash
# Deploy the latest master on the server. Run as your own login user (not
# root, not the service user); it asks for your sudo password once.
#
# git and npm run as the service user, which owns the checkout. That user has
# no home directory, so npm's cache is pointed at /tmp. The systemd unit's
# ExecStartPre does the build on restart.
#
# Usage: deploy/deploy.sh   (SERVICE overrides the service/user name)
set -euo pipefail

SERVICE="${SERVICE:-sherah-mcp}"
APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"

cd "$APP_DIR"
sudo -u "$SERVICE" git pull --ff-only
sudo -u "$SERVICE" npm ci --cache "/tmp/$SERVICE-npm-cache"
sudo systemctl restart "$SERVICE"
sleep 3
systemctl is-active --quiet "$SERVICE" && echo "$SERVICE is running" || {
  echo "$SERVICE failed to start. Recent logs:"
  sudo journalctl -u "$SERVICE" -n 30 --no-pager
  exit 1
}
