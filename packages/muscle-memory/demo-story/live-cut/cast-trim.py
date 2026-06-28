#!/usr/bin/env python3
# Trim a cast to the action (drop before <start>, after <end>), version-aware. Usage: cast-trim.py <cast> <start> [end]
import sys, json
cast = sys.argv[1]; start = sys.argv[2]; end = sys.argv[3] if len(sys.argv) > 3 else None
lines = open(cast).read().splitlines()
header = lines[0]; ver = json.loads(header).get("version", 2)
ev = [json.loads(l) for l in lines[1:] if l.strip()]
si = 0
for i, e in enumerate(ev):
    if e[1] == "o" and start in e[2]: si = max(0, i - 1); break
ei = len(ev) - 1
if end:
    for i, e in enumerate(ev):
        if i > si and e[1] == "o" and end in e[2]: ei = min(len(ev) - 1, i + 2)
kept = [list(e) for e in ev[si:ei + 1]]
if ver >= 3:
    kept[0][0] = 0.3  # deltas: only reset the first interval; the rest are already relative
else:
    base = kept[0][0] - 0.3
    for e in kept: e[0] = max(0.0, round(e[0] - base, 3))
open(cast.replace(".cast", "-trim.cast"), "w").write("\n".join([header] + [json.dumps(e) for e in kept]) + "\n")
# report rendered-ish raw span
span = sum(min(e[0], 99) for e in kept[1:]) if ver >= 3 else kept[-1][0] - kept[0][0]
print(f"trimmed {len(ev)} -> {len(kept)} events | raw span ~{span:.0f}s")
