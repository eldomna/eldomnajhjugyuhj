#!/bin/bash
# Restarts the app under pm2 using start.sh in this same folder.
# Portable: works from wherever this repo/folder is checked out, on any server.
set -e
APP_DIR="$(cd "$(dirname "$0")" && pwd)"
APP_NAME="smart-labor-calc"
PORT="${PORT:-3008}"

cd "$APP_DIR"
chmod +x ./start.sh

pm2 delete "$APP_NAME" 2>/dev/null || true
pm2 start ./start.sh --name "$APP_NAME" --interpreter bash --cwd "$APP_DIR"
pm2 save

sleep 2
pm2 logs "$APP_NAME" --lines 30 --nostream
ss -tlnp | grep ":$PORT" || true
curl -I "http://localhost:$PORT" || true
