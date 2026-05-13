#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

OUT_DIR="$ROOT/logs/calibration"
mkdir -p "$OUT_DIR"

for i in 1 2 3; do
  echo "=== run $i ==="
  npm run -s benchmark > "$OUT_DIR/run-$i.json"
done

diff "$OUT_DIR/run-1.json" "$OUT_DIR/run-2.json"
diff "$OUT_DIR/run-2.json" "$OUT_DIR/run-3.json"

echo
echo "=== three runs byte-identical ==="
cat "$OUT_DIR/run-1.json"
echo
echo "=== sha256 ==="
sha256sum "$OUT_DIR"/run-*.json
