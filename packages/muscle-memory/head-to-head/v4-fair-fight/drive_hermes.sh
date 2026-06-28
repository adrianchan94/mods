#!/usr/bin/env bash
# Drive REAL Hermes (GLM-5.2) through a sequence of fail->fix->pass tasks in an ISOLATED home, so its own
# skill-manager authors + evolves ONE debugging skill across the sessions. Usage: drive_hermes.sh <regime> <Nbugs>
set -uo pipefail
export PATH="$HOME/.local/bin:$PATH"
REGIME="$1"; N="${2:-8}"
HH="/tmp/h2h/hh-$REGIME"; rm -rf "$HH"; mkdir -p "$HH"
cp "$HOME/.hermes-bench/.env" "$HH/.env" 2>/dev/null; cp "$HOME/.hermes-bench/config.yaml" "$HH/config.yaml" 2>/dev/null
export HERMES_HOME="$HH"

# the 8 diverse failing-test bugs (same set mm sees in mm-8agg)
declare -a SRC=(
'def add(a, b):\n    return a - b'
'def last3(xs):\n    return [xs[i] for i in range(len(xs) + 1)][-3:]'
'def handle(x):\n    result = x * 2'
'def norm(raw):\n    mode = raw\n    return mode'
'def get(d, k):\n    return d[k]'
'def total(items):\n    return sum(items)'
'def add_item(xs, x):\n    xs.append(x)\n    return xs'
'def cents(d):\n    return int(d * 100)'
)
declare -a TEST=(
'from m import add\ndef test_add():\n    assert add(2, 3) == 5'
'from m import last3\ndef test_last3():\n    assert last3([1,2,3,4]) == [2,3,4]'
'from m import handle\ndef test_handle():\n    assert handle(21) == 42'
'from m import norm\ndef test_norm():\n    assert norm("PROD") == "prod"'
'from m import get\ndef test_get():\n    assert get({"a":1}, "b") is None'
'from m import total\ndef test_total():\n    assert total(["1","2","3"]) == 6'
'from m import add_item\ndef test_add_item():\n    base=[1]; add_item(base,2); assert base==[1]'
'from m import cents\ndef test_cents():\n    assert cents(1.15) == 115'
)

for ((i=0; i<N; i++)); do
  P="$HH/proj$i"; mkdir -p "$P"
  printf "%b\n" "${SRC[$i]}" > "$P/m.py"
  printf "%b\n" "${TEST[$i]}" > "$P/test_m.py"
  echo "  [bug $((i+1))/$N] driving hermes..."
  (cd "$P" && timeout 240 hermes -z "A pytest test here is failing. Fix the SOURCE file m.py only (never the test) until 'python3 -m pytest -q' is green. Then use skill_manage to create OR update a single reusable class-level skill for debugging failing pytest suites, capturing this failure pattern as a concrete worked example." -m glm-5.2 --provider zai --yolo >/dev/null 2>&1)
  (cd "$P" && python3 -m pytest -q >/dev/null 2>&1 && echo "    ✓ green" || echo "    ✗ still failing")
done

echo "=== authored/evolved skills in $HH/skills ==="
find "$HH/skills" -name "SKILL.md" -newermt "-1 hour" 2>/dev/null | while read f; do echo "  $(wc -c < "$f")B  $f"; done | grep -iE "debug|pytest|test|fail" || find "$HH/skills" -name "SKILL.md" -path "*debug*" -o -name "SKILL.md" -path "*pytest*" 2>/dev/null
echo "DRIVE_DONE $REGIME"
