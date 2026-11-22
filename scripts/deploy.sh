#!/usr/bin/env bash
# Upload the working tree to the VPS, rebuild, and restart StazhTrek.
# Nginx, the basic-auth password, and Xray stay as they are.
#
# Usage: npm run deploy
# Overrides: DEPLOY_HOST, DEPLOY_DIR, DEPLOY_SERVICE
set -euo pipefail

HOST="${DEPLOY_HOST:-root@13.140.90.154}"
APP_DIR="${DEPLOY_DIR:-/opt/stazhtrek}"
SERVICE="${DEPLOY_SERVICE:-stazhtrek}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "Checking SSH to ${HOST}"
ssh -o BatchMode=yes -o ConnectTimeout=10 "$HOST" "command -v rsync >/dev/null || (export DEBIAN_FRONTEND=noninteractive; apt-get update -qq && apt-get install -y -qq rsync)"

echo "Uploading ${ROOT} to ${HOST}:${APP_DIR}"
rsync -az --delete \
  --exclude node_modules \
  --exclude dist \
  --exclude .git \
  --exclude coverage \
  --exclude '*.log' \
  --exclude .DS_Store \
  --include '.env.example' \
  --exclude .env \
  --exclude '.env.*' \
  "$ROOT/" "${HOST}:${APP_DIR}/"

echo "Installing dependencies, building, restarting ${SERVICE}"
ssh -o BatchMode=yes "$HOST" "APP_DIR=$(printf '%q' "$APP_DIR") SERVICE=$(printf '%q' "$SERVICE") bash -s" << 'EOF'
set -euo pipefail
cd "$APP_DIR"
# tsx is a devDependency, and the systemd unit runs it. A production npm ci would omit it.
npm ci --include=dev --no-audit --no-fund
npm run build
test -f dist/index.html
systemctl restart "$SERVICE"
for _ in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16 17 18 19 20; do
  if curl -sf -o /dev/null http://127.0.0.1:3000/api/sources; then
    break
  fi
  sleep 0.5
done
if ! curl -sf -o /dev/null http://127.0.0.1:3000/api/sources; then
  echo "stazhtrek did not answer on 127.0.0.1:3000" >&2
  journalctl -u "$SERVICE" -n 40 --no-pager >&2 || true
  exit 1
fi
auth_code=$(curl -s -o /dev/null -w "%{http_code}" -H "Host: zov.kabanchik.tech" http://127.0.0.1/)
if [[ "$auth_code" != "401" ]]; then
  echo "expected nginx to ask for a password, got HTTP ${auth_code}" >&2
  exit 1
fi
echo "stazhtrek is up"
EOF

echo "Deployed http://zov.kabanchik.tech/"
