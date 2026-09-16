#!/usr/bin/env python3
"""mark_done.py — タスクの状態を tickets.json と tickets_plan.json の両方に書き、日程（schedule.html）まで同じ回で作り直す（手で両方を直さない・再生成を覚えない）。
使い方: python3 scripts/ci/mark_done.py T-F-01 T-F-02 … [--status done|in_progress|review|blocked|todo]
done にする条件：qa-ladder gate --task が PASS していること（ここで確かめる。通っていなければ書かない）"""
import argparse, json, subprocess, sys
ap = argparse.ArgumentParser(); ap.add_argument("ids", nargs="+"); ap.add_argument("--status", default="done"); ap.add_argument("--tickets", default="07_tasks/tickets.json"); ap.add_argument("--plan", default="07_tasks/tickets_plan.json"); ap.add_argument("--spec", default="07_qa/test-specs"); a = ap.parse_args()
T = json.load(open(a.tickets, encoding="utf-8")); P = json.load(open(a.plan, encoding="utf-8")); n = 0; bad = []
for tid in a.ids:
    if a.status == "done":
        r = subprocess.run([sys.executable, "scripts/ci/qa-ladder.py", "gate", "--spec", a.spec, "--tickets", a.tickets, "--task", tid], capture_output=True, text=True)
        if r.returncode != 0: bad.append(tid); continue
        # 実ブラウザの証拠（op_gate）：説明文の PASS を done にしない（2026-09-16・user「チケット単位で実際に押せ」）
        r = subprocess.run([sys.executable, "scripts/ci/op_gate.py", "--spec", a.spec, "--tickets", a.tickets, "--report", "apps/web/pw-reports/screens.json", "--report", "apps/web/pw-reports/showcase.json", "--report", "apps/e2e/test-results/report.json", "--task", tid], capture_output=True, text=True)
        if r.returncode != 0: print(r.stdout.strip().split("\n")[-1]); bad.append(tid); continue
    for x in T["tasks"]:
        if x["id"] == tid: x["status"] = a.status; n += 1
    for x in P["tickets"]:
        if x["id"] == tid: x["status"] = a.status
        elif x.get("parent") == tid and x["kind"] == "subtask" and a.status == "done": x["status"] = "done"
json.dump(T, open(a.tickets, "w", encoding="utf-8"), ensure_ascii=False, indent=1); json.dump(P, open(a.plan, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print(f"{a.status}: {n} 件" + (f" ／ gate が通っていないので書かなかった: {bad}" if bad else ""))
# 状態を変えたら日程（board・schedule.md・schedule.html）も同じ回で作り直す（人が「あとで再生成」を覚えない。2026-09-16 K9 が赤のまま残った）
if n and P.get("inputs", {}).get("roster"):
    r = subprocess.run([sys.executable, "scripts/ci/build_tickets.py", "--from-plan", a.plan], capture_output=True, text=True); print(r.stdout.strip().split("\n")[-1])
    if r.returncode != 0: print(r.stderr[-800:]); sys.exit(1)
    inp = json.load(open(a.plan, encoding="utf-8")).get("inputs", {})
    r = subprocess.run([sys.executable, "scripts/ci/ticket_gate.py", a.plan] + (["--flow", inp["flow"]] if inp.get("flow") else []) + (["--mocks", inp["mocks"]] if inp.get("mocks") else []), capture_output=True, text=True); print(r.stdout.strip().split("\n")[-1])
    if r.returncode != 0: sys.exit(1)
sys.exit(1 if bad else 0)
