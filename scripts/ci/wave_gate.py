#!/usr/bin/env python3
"""wave_gate.py — Wave の締め（L3）。08_schedule/wave-schedule.json の qa_scope を機械で確かめる。
 W1 l1_tasks の全部が qa-ladder gate --task PASS（実装者が書いた結果が消えていないことも兼ねる）
 W2 l2_flows の行（journeys/plan.json）が全部 PASS
 W3 regression_from の Wave の l1_tasks も gate PASS（前 Wave の回帰。差分でなく全部を再確認）
 W4 tickets の status が全部 done
使い方: python3 scripts/ci/wave_gate.py --wave W0 [--schedule 08_schedule/wave-schedule.json]"""
import argparse, json, subprocess, sys
ap = argparse.ArgumentParser(); ap.add_argument("--wave", required=True); ap.add_argument("--schedule", default="08_schedule/wave-schedule.json"); ap.add_argument("--tickets", default="07_tasks/tickets.json"); ap.add_argument("--spec", default="07_qa/test-specs"); a = ap.parse_args()
S = json.load(open(a.schedule, encoding="utf-8")); W = {w["id"]: w for w in S["waves"]}; w = W.get(a.wave)
if not w: print(f"FAIL — Wave {a.wave} が無い"); sys.exit(2)
T = {t["id"]: t for t in json.load(open(a.tickets, encoding="utf-8"))["tasks"]}
def gate(tid):
    r = subprocess.run([sys.executable, "scripts/ci/qa-ladder.py", "gate", "--spec", a.spec, "--tickets", a.tickets, "--task", tid], capture_output=True, text=True); return r.returncode == 0
fails = []
bad = [t for t in w["qa_scope"]["l1_tasks"] if not gate(t)]
if bad: fails.append(("W1", f"L1 が未消化のタスク {bad}"))
J = json.load(open(f"{a.spec}/journeys/plan.json", encoding="utf-8"))["rows"]
for j in w["qa_scope"]["l2_flows"]:
    rows = [r for r in J if r["journey"] == j]; nb = [r["id"] for r in rows if "PASS" not in str(r.get("result", ""))]
    if nb: fails.append(("W2", f"流れ {j} の未消化 {nb[:5]}"))
reg = [t for wid in w["qa_scope"]["regression_from"] for t in W[wid]["qa_scope"]["l1_tasks"] if not gate(t)]
if reg: fails.append(("W3", f"前 Wave の回帰で赤 {reg[:6]}"))
nd = [t for t in w["qa_scope"]["l1_tasks"] if T.get(t, {}).get("status") != "done"]
r = subprocess.run([sys.executable, "scripts/ci/op_gate.py", "--spec", a.spec, "--tickets", a.tickets, "--report", "apps/web/pw-reports/screens.json", "--report", "apps/web/pw-reports/showcase.json", "--report", "apps/e2e/test-results/report.json"] + [x for t in w["qa_scope"]["l1_tasks"] for x in ("--task", t)], capture_output=True, text=True)
if r.returncode != 0: fails.append(("W4", "実ブラウザの証拠が無い行がある（op_gate）: " + r.stdout.strip().split("\n")[-2][:160]))
if nd: fails.append(("W4", f"status が done でない {nd}"))
print(f"Wave {a.wave}（{w['group']}・{w['phase_name']}）：L1 タスク {len(w['qa_scope']['l1_tasks'])}／L2 {len(w['qa_scope']['l2_flows'])}／回帰 {len(w['qa_scope']['regression_from'])} Wave")
for k, m in fails: print(f"  ★ [{k}] {m}")
print("STATUS: 完了 — 次の Wave を始めてよい" if not fails else f"STATUS: 未完了 — {len(fails)} 件"); sys.exit(0 if not fails else 2)
