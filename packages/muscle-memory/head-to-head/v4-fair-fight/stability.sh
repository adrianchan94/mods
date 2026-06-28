#!/usr/bin/env bash
# Multi-sample stability: re-judge each regime 3x (each run is itself order-swapped) -> mean + min/max.
set -uo pipefail
HT="$HOME/work/kevos-lab/mack/mods-repo/packages/muscle-memory/head-to-head"
declare -a NAME=("single" "4-session" "8-session" "lint")
declare -a MM=(
 "$HT/v3-worked-examples/mm/failing-test.single-session.md"
 "/tmp/h2h/mm-skills/failing-test.4agg.md"
 "/tmp/h2h/mm-skills/failing-test.8agg.md"
 "/tmp/h2h/mm-skills/lint.v5.model.md"
)
declare -a HM=(
 "$HT/v3-worked-examples/hermes/failing-test.single-session.md"
 "/tmp/h2h/hh-ft4/skills/testing/debugging-pytest-suites/SKILL.md"
 "/tmp/h2h/hh-ft8/skills/debugging/debugging-failing-pytest-suites/SKILL.md"
 "/tmp/h2h/hh-lint/skills/devops/python-pyflakes-cleanup/SKILL.md"
)
echo "REGIME | sample mm/hermes (x3) | mm_mean | hermes_mean | verdict"
for i in 0 1 2 3; do
  mms=(); hms=()
  for s in 1 2 3; do
    line=$(node /tmp/h2h/judge.mjs "${MM[$i]}" mm "${HM[$i]}" hermes 2>/dev/null | grep "^TOTAL")
    mm=$(echo "$line" | sed -n 's/.*mm=\([0-9.]*\).*/\1/p'); hm=$(echo "$line" | sed -n 's/.*hermes=\([0-9.]*\).*/\1/p')
    mms+=("$mm"); hms+=("$hm")
  done
  python3 - "${NAME[$i]}" "${mms[@]}" "--" "${hms[@]}" <<'PY'
import sys
name=sys.argv[1]; rest=sys.argv[2:]; sep=rest.index("--")
mm=[float(x) for x in rest[:sep]]; hm=[float(x) for x in rest[sep+1:]]
mmA=sum(mm)/len(mm); hmA=sum(hm)/len(hm)
pairs=" ".join(f"{a:.1f}/{b:.1f}" for a,b in zip(mm,hm))
v=f"mm WINS +{mmA-hmA:.1f}" if mmA>hmA else f"hermes WINS +{hmA-mmA:.1f}"
allwin = all(a>b for a,b in zip(mm,hm))
print(f"{name:11}| {pairs:26}| {mmA:5.1f}   | {hmA:5.1f}      | {v}  ({'3/3 samples mm' if allwin else 'MIXED'})")
PY
done
echo "STABILITY_DONE"
