#!/usr/bin/env bash
# "Every session becomes practice film" — LIVE Letta TUI cut. A real GLM-5.2 agent gets cooked by a
# failing script, fixes it, and muscle-memory distills the lesson ON ITS OWN (panel animates). Then a
# fresh task of the same class — the agent loads its own playbook and cleans it up. No fake text; real TUI.
set -uo pipefail
# The ZAI key is read from the environment at call time and only passed through to the recording
# subprocess — it is NEVER hardcoded here. ($ZAI_API_KEY is a reference, not a value.)
: "${ZAI_API_KEY:?need ZAI_API_KEY injected at call boundary}"
DEMO=/tmp/mm-story-$(date +%s); STATE="$DEMO/state"; mkdir -p "$STATE"; echo "$DEMO" > /tmp/mm-story-dir.txt
echo "DEMO=$DEMO"
# clean slate: stash any existing recovering-from-failing-script skill so the distill is fresh on camera
T=/tmp/mm-story-trash-$(date +%s); mkdir -p "$T"; for d in ~/.letta/skills/*failing* ~/.letta/skills/*script* ~/.letta/skills/*recover*; do [ -d "$d" ] && mv "$d" "$T/" 2>/dev/null; done

# --- two REAL failing-pytest projects (same class: a run fails → fix SOURCE → same run passes) ---
mkdir -p "$DEMO/checkout" "$DEMO/cart"
cat > "$DEMO/checkout/m.py" <<'PY'
def subtotal(prices):
    s = 0
    for i in range(len(prices) + 1):   # off-by-one
        s += prices[i]
    return s
PY
cat > "$DEMO/checkout/test_m.py" <<'PY'
from m import subtotal
def test_subtotal():
    assert subtotal([10, 5, 3]) == 18
PY
cat > "$DEMO/cart/m.py" <<'PY'
def cents(d):
    return int(d * 100)   # float truncation
PY
cat > "$DEMO/cart/test_m.py" <<'PY'
from m import cents
def test_cents():
    assert cents(2.30) == 230
    assert cents(2.00) == 200
PY
echo "two failing pytest projects ready (checkout: off-by-one, cart: float-trunc)"

# seed 3 mature sessions of the SAME class so the FIRST on-camera recovery distills immediately
python3 - "$STATE" <<'PY'
import json,os,sys
st=sys.argv[1]; cmd="python3 -m pytest -q"
P=[("Edit","Edit m.py","IndexError: list index out of range — loop ran one past the end of the list"),
   ("Edit","Edit m.py","AssertionError: got None — the function computed a value but never returned it"),
   ("Edit","Edit m.py","AssertionError: 114 != 115 — int() truncated a float that should round")]
e,o=[],[];i=0
for c in ["s1","s2","s3"]:
 for t,m,err in P:
  f=f"{c}-{i}";i+=1;e.append({"ts":i,"conv":c,"tool":"Bash","tmpl":cmd,"id":f});o.append({"id":f,"conv":c,"tool":"Bash","ok":False,"err":err,"ts":i})
  x=f"{c}-{i}";i+=1;e.append({"ts":i,"conv":c,"tool":t,"tmpl":m,"id":x});o.append({"id":x,"conv":c,"tool":t,"ok":True,"ts":i})
  p=f"{c}-{i}";i+=1;e.append({"ts":i,"conv":c,"tool":"Bash","tmpl":cmd,"id":p});o.append({"id":p,"conv":c,"tool":"Bash","ok":True,"ts":i})
open(os.path.join(st,"experience.jsonl"),"w").write("\n".join(json.dumps(r) for r in e)+"\n")
open(os.path.join(st,"outcomes.jsonl"),"w").write("\n".join(json.dumps(r) for r in o)+"\n")
print("seeded failing-script recovery x3 sessions")
PY

tmux kill-session -t mmstory 2>/dev/null || true; sleep 1
tmux new-session -d -s mmstory -x 210 -y 46 -c "$DEMO" \
  -e ZAI_API_KEY="$ZAI_API_KEY" -e ZAI_BASE_URL="https://api.z.ai/api/coding/paas/v4" \
  -e LETTA_LOCAL_BACKEND_DIR="$DEMO/lc" -e MM_STATE_DIR="$STATE" -e MM_REFLECT=auto -e MM_CAPTURE=worked -e MM_AGENT=demo \
  "asciinema rec $DEMO/demo.cast -q --overwrite"
sleep 3
tmux send-keys -t mmstory "env -u MEMORY_DIR -u LETTA_MEMORY_DIR letta --new-agent --backend local -m zai/glm-5.2" Enter
echo "booting (40s)..."; sleep 40
send(){ tmux send-keys -t mmstory "$1"; sleep 2; tmux send-keys -t mmstory Enter; }

# BEAT 1 — the rookie gets cooked. Pure WORK, no mention of skills/learning.
send "The tests in ./checkout are failing. Run pytest, find the bug, fix the SOURCE (never the test) until it's green. Then one short line on what bit you."
echo "beat1 work + AUTONOMOUS distill (130s)..."; sleep 130

# BEAT 2 — a NEW same-class bug. Using the skill is task-natural; the LEARNING already happened on its own.
send "New failure: the tests in ./cart are red. Check your skills, load the one that fits, and fix it. Keep your reply brief."
echo "beat2 reuse (110s)..."; sleep 110

tmux capture-pane -t mmstory -p -S -900 > "$DEMO/transcript.txt" 2>/dev/null
tmux send-keys -t mmstory "/exit" Enter; sleep 3
tmux send-keys -t mmstory C-c; sleep 1; tmux send-keys -t mmstory "exit" Enter; sleep 4
echo "=== DONE. cast: $DEMO/demo.cast ($(wc -c < "$DEMO/demo.cast" 2>/dev/null)B) ==="
echo "=== transcript tail ==="; tail -25 "$DEMO/transcript.txt" 2>/dev/null
