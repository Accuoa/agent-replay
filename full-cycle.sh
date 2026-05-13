#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

echo "=== install ==="
npm install --no-audit --no-fund

echo
echo "=== test ==="
npm test -- --reporter=basic

echo
echo "=== benchmark (single run) ==="
npm run -s benchmark

echo
echo "=== calibrate (3 byte-identical runs) ==="
bash benchmark/calibrate.sh

echo
echo "=== full cycle complete ==="
