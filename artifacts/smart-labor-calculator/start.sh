#!/bin/bash
cd "$(dirname "$0")"
set -a
source .env
set +a
exec node dist/server/index.mjs
