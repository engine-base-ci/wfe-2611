#!/usr/bin/env python3
"""sp_gate.py — Wave 編成（S13 sprint-planning）の整合 SP1〜SP8。
 SP1 tickets の全タスクがちょうど 1 つの Wave にある ／ SP2 各 Wave の qa_scope.l1_tasks == tasks ／ SP3 l2_flows が journeys に実在し runnable_after がその Wave までに揃う・全流れがどこかの Wave に付く
 SP4 regression_from ＝ それより前の全 Wave ／ SP5 Phase 順序（F<D<A<U-shared<U-screen<I。S は F の後なら可） ／ SP6 日付が節目の中（最終 finish ≤ R1）で start ≤ finish
 SP7 三層（json/md/html）が揃い md/html が json より古くない ／ SP8 二軸（human／ai_compute／wall_clock／review）が各 Wave にある。staging 未確定は warn（S14 に進む前に確定）"""
import json, os, sys, collections, argparse
ap = argparse.ArgumentParser(); ap.add_argument("--dir", default="08_schedule"); ap.add_argument("--tickets", default="07_tasks/tickets.json"); ap.add_argument("--journeys", default="07_qa/test-specs/journeys/plan.json"); a = ap.parse_args()
J = lambda p: json.load(open(p, encoding="utf-8")); OUT = a.dir; fails = []
try: S = J(f"{OUT}/wave-schedule.json")
except FileNotFoundError: print(f"FAIL — {OUT}/wave-schedule.json が無い"); sys.exit(2)
T = J(a.tickets); ids = {t["id"] for t in T["tasks"]}; JR = J(a.journeys)["rows"]; W = S["waves"]
c = collections.Counter(t for w in W for t in w["tasks"]); m = [t for t in ids if c[t] != 1] + [t for t in c if t not in ids]
if m: fails.append(("SP1", f"Wave に 0 回か 2 回以上のタスク {m[:5]}"))
m = [w["id"] for w in W if set(w["qa_scope"]["l1_tasks"]) != set(w["tasks"])]
if m: fails.append(("SP2", f"qa_scope.l1_tasks が tasks と違う {m[:5]}"))
after = collections.defaultdict(set)
for r in JR: after[r["journey"]] |= set(r["runnable_after"])
done = set(); m = []; seen = set()
for w in W:
    done |= set(w["tasks"])
    for j in w["qa_scope"]["l2_flows"]:
        if j not in after or not (after[j] <= done) or j in seen: m.append(f"{w['id']}:{j}")
        seen.add(j)
m += [f"未割り当て:{j}" for j in after if j not in seen and after[j]]
if m: fails.append(("SP3", f"流れの割り当て {m[:6]}"))
m = [w["id"] for i, w in enumerate(W) if w["qa_scope"]["regression_from"] != [x["id"] for x in W[:i]]]
if m: fails.append(("SP4", f"regression_from が前の全 Wave でない {m[:5]}"))
order = {"F": 0, "D": 1, "A": 2, "U-shared": 3, "U-screen": 4, "I": 5}; last = {}; m = []   # 段階（stage）ごとに順序を見る（段階 2 は段階 1 の後に A → U-screen で再開する）
for w in W:
    if w["group"] in ("S", "V2"): continue
    st = w.get("stage", "v1")
    if order[w["group"]] < last.get(st, -1): m.append(w["id"])
    last[st] = max(last.get(st, -1), order[w["group"]])
fw = max((i for i, w in enumerate(W) if w["group"] == "F"), default=-1); m += [w["id"] for i, w in enumerate(W) if w["group"] in ("S", "V2") and i <= fw]
if m: fails.append(("SP5", f"Phase 順序違反 {m[:5]}"))
R = max(x["due"] for x in S["milestones"]); m = [w["id"] for w in W if not w["start"] or not w["finish"] or w["start"] > w["finish"] or w["finish"] > R or w["start"] < S["start"]]
if m: fails.append(("SP6", f"日付が範囲外 {m[:5]}"))
tj = os.path.getmtime(f"{OUT}/wave-schedule.json"); m = [f for f in ("sprint.md", "sprint.html") if not os.path.exists(f"{OUT}/{f}") or os.path.getmtime(f"{OUT}/{f}") + 1 < tj]
if m: fails.append(("SP7", f"三層の欠け／古い {m}"))
m = [w["id"] for w in W if any(k not in w for k in ("estimate_hours_human", "estimate_hours_ai_compute", "wall_clock_h_ai", "human_review_h"))]
if m: fails.append(("SP8", f"二軸の欠け {m[:5]}"))
print(f"Wave {len(W)} / タスク {sum(len(w['tasks']) for w in W)} / 流れ {len(after)}（付いた {len(seen)}） / {W[0]['start']} → {max(w['finish'] for w in W if w['finish'])} / staging {'確定' if S['staging']['defined'] else '★未確定（S14 に進む前に user と決める・GAP-246）'}")
for k, x in fails: print(f"  ★ [{k}] {x}")
print("PASS — SP1〜SP8 すべて緑" if not fails else f"FAIL — {len(fails)} 件"); sys.exit(0 if not fails else 2)
