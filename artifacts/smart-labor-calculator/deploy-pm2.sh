#!/bin/bash
# Builds and (re)starts the app under pm2 using start.sh in this same folder.
# Portable: works from wherever this repo/folder is checked out, on any server.
set -e
APP_DIR="$(cd "$(dirname "$0")" && pwd)"
APP_NAME="smart-labor-calc"
PORT="${PORT:-3008}"

cd "$APP_DIR"

echo ">>> Installing deps..."
pnpm install --frozen-lockfile

echo ">>> Building..."
# The Nitro/rollup server bundle for this app can exceed Node's default
# heap size on this VPS (other pm2 apps are running concurrently and eat
# RAM too). Raise the heap ceiling just for the build step.
NODE_OPTIONS="--max-old-space-size=5120" pnpm build

chmod +x ./start.sh

pm2 delete "$APP_NAME" 2>/dev/null || true
pm2 start ./start.sh --name "$APP_NAME" --interpreter bash --cwd "$APP_DIR"
pm2 save

sleep 2
pm2 logs "$APP_NAME" --lines 30 --nostream
ss -tlnp | grep ":$PORT" || true
curl -I "http://localhost:$PORT" || true
