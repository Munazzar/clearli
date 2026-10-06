#!/bin/bash
# Runs every test script; fails if any exits non-zero, prints a FAIL line, or reports browser errors.
cd "$(dirname "$0")/.."
mkdir -p test/shots
bash build-web.sh >/dev/null
bad=0
for t in test/*.test.js; do
  out=$(timeout 300 node "$t" 2>&1); code=$?
  if [ $code -ne 0 ] || echo "$out" | grep -qE '^FAIL|[0-9]+ FAILED'; then echo "✗ $t (exit $code)"; echo "$out" | grep -E 'FAIL|Error' | head -20; bad=1
  elif echo "$out" | grep -q 'NO ERRORS\|ALL PASS' || ! echo "$out" | grep -qi 'error'; then echo "✓ $t"
  else echo "✗ $t (browser errors)"; echo "$out" | tail -10; bad=1; fi
done
exit $bad
