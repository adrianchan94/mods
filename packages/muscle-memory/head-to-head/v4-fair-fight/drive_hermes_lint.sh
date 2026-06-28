set -uo pipefail
export PATH="$HOME/.local/bin:$PATH"
HH=/tmp/h2h/hh-lint; rm -rf "$HH"; mkdir -p "$HH"; cp ~/.hermes-bench/.env "$HH/.env" 2>/dev/null; cp ~/.hermes-bench/config.yaml "$HH/config.yaml" 2>/dev/null
export HERMES_HOME="$HH"
declare -a F=("service.py" "utils.py" "api.py" "models.py")
declare -a SRC=(
'def f():\n    result = compute()\n    print(reuslt)'
'import os\n\ndef f():\n    return 1'
'def f():\n    tmp = compute()'
'import json\nimport json\n\ndef f():\n    return json.dumps({})'
)
for ((i=0;i<4;i++)); do
  P="$HH/proj$i"; mkdir -p "$P"; printf "%b\n" "${SRC[$i]}" > "$P/${F[$i]}"
  echo "  [lint $((i+1))/4] ${F[$i]} driving hermes..."
  (cd "$P" && timeout 240 hermes -z "Running 'pyflakes ${F[$i]}' reports a lint error. Fix the SOURCE so pyflakes is clean. Then use skill_manage to create OR update a single reusable class-level skill for cleaning up Python lint/pyflakes errors, capturing this violation as a concrete worked example." -m glm-5.2 --provider zai --yolo >/dev/null 2>&1)
  (cd "$P" && pyflakes "${F[$i]}" >/dev/null 2>&1 && echo "    ✓ clean" || echo "    ✗ still flagged")
done
find "$HH/skills" -name SKILL.md 2>/dev/null | xargs -I{} sh -c 'echo "$(wc -c <"{}")B {}"' 2>/dev/null | grep -iE "lint|pyflake|clean" | head
echo "LINT_DRIVE_DONE"
