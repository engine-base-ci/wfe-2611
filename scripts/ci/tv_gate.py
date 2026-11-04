#!/usr/bin/env python3
"""tv_gate.py — テスト計画（S11 test-verification）の整合 TV1〜TV8。
 TV1 foundation_gates の 26 本が全部 v3-gate.yml にある ／ TV2 仕様の層のゲート（layer_audit・qa-ladder validate・qa-ladder gate --task・error_catalog 全引数・skill_pkg_gate）がある
 TV3 EARS の全文が ears-test-mapping.json にあり、各 test に file/function/gate がある ／ TV4 1 作業のチケット（11_tickets）が持つ API と画面の API の EARS が、全部 mapping にある（D-128.117：しまった 07_tasks から読む先を替えた）
 TV5 access-matrix.json が全 policy を ≥2 場合で持つ ／ TV6 三層（json/md/html）が揃い md/html が json より古くない ／ TV7 3-tier の structural/functional/regression 全部に段とゲートがある
 TV8 auto-merge の needs に static/database/spec/task-gate が全部あり、test-plan.json の source と ladder L1〜L5 がある"""
import json, os, re, sys, argparse
ap = argparse.ArgumentParser(); ap.add_argument("--dir", default="07_qa/test-plan"); ap.add_argument("--workflow", default=".github/workflows/v3-gate.yml"); ap.add_argument("--gates", default="03_architecture/foundation_gates.json"); ap.add_argument("--ears", default="08_api/ears-ac-seed.json"); ap.add_argument("--tickets", default="11_tickets/tickets.json"); ap.add_argument("--entities", default="07_functional/entities.json"); ap.add_argument("--mocks", default="06_mockup/v1"); ap.add_argument("--spec", default="07_qa/test-specs"); ap.add_argument("--skills", default="10_skills"); a = ap.parse_args()
J = lambda p: json.load(open(p, encoding="utf-8")); OUT = a.dir; fails = []
try:
    P = J(f"{OUT}/test-plan.json"); M = J(f"{OUT}/ears-test-mapping.json"); A = J(f"{OUT}/access-matrix.json"); Y = open(a.workflow, encoding="utf-8").read()
except FileNotFoundError as e: print(f"FAIL — 成果物が無い: {e}"); sys.exit(2)
FG = J(a.gates); EARS = J(a.ears)["ac_seeds"]; T = J(a.tickets)["tickets"]; EN = J(a.entities); EN = EN.get("entities") or EN["items"]
m = [g["name"] for g in FG["merge_gates"] if g["script"] not in Y]
if m: fails.append(("TV1", f"v3-gate.yml に無い基盤ゲート {m[:5]}"))
need = ["layer_audit.py --run", "qa-ladder.py validate", "qa-ladder.py gate", "--task", "error_catalog.py gate --catalog", f"--mocks {a.mocks} --spec {a.spec} --choke", f"skill_pkg_gate.py {a.skills}", "tv_gate.py"]
m = [x for x in need if x not in Y]
if m: fails.append(("TV2", f"仕様の層のゲートが無い {m}"))
texts = {x["ears_text"] for x in M["mappings"]}; miss = [l[:60] for e in EARS for l in e["ears_ac_seed"] if l not in texts]; bad = [x["test_id"] for x in M["mappings"] if not (x.get("test_file") and x.get("test_function") and x.get("gate"))]
if miss or bad or len(M["mappings"]) != sum(len(e["ears_ac_seed"]) for e in EARS): fails.append(("TV3", f"EARS 未対応 {len(miss)} {miss[:2]} / 欠け {bad[:3]} / 本数 {len(M['mappings'])} vs {sum(len(e['ears_ac_seed']) for e in EARS)}"))
pols = {c["policy"] for c in A["cases"]}
kids = {t.get("parent") for t in T if t.get("parent")}; leaves = [t for t in T if t.get("split") != "これから" and t["id"] not in kids]
EP = J("08_api/endpoints.json")["endpoints"]; op2ep = {e["operation_id"]: f'{e["method"]} {e["path"]}' for e in EP}; seed = {e["endpoint"]: e["ears_ac_seed"] for e in EARS}
mine = lambda t: {op2ep[o] for o in t.get("apis", []) if o in op2ep} | {f'{e["method"]} {e["path"]}' for e in EP if set(e.get("screens", [])) & set(t.get("screens", []))}
m = [(t["id"], l[:40]) for t in leaves for ep in sorted(mine(t)) for l in seed.get(ep, []) if l not in texts]
if m: fails.append(("TV4", f"1 作業のチケットの API の EARS で test の無いもの {len(m)} {m[:2]}"))
cnt = {}
for c in A["cases"]: cnt[(c["entity"], c["policy"])] = cnt.get((c["entity"], c["policy"]), 0) + 1
# 業務の表として作らない表（ログインの部品の側・段階 1 は作らない）は場合表に入れない（build_testplan.py と同じ・K-12）
skip_t = {"passkeys", "pending_signup"} | {e["table_name"] for e in EN if "段階 1 は作らない" in (e.get("note") or "")}
m = [f"{e['table_name']}.{p['name']}" for e in EN if e["table_name"] not in skip_t for p in e["access_control_policies"] if cnt.get((e["id"], p["name"]), 0) < 2]
if m: fails.append(("TV5", f"場合が 2 未満の policy {len(m)} {m[:3]}"))
tj = os.path.getmtime(f"{OUT}/test-plan.json"); m = [f for f in ("test-plan.md", "test-plan.html") if not os.path.exists(f"{OUT}/{f}") or os.path.getmtime(f"{OUT}/{f}") + 1 < tj]
if m: fails.append(("TV6", f"三層の欠け／古い {m}"))
tiers = " ".join(x["tier"] for x in P["tier_mapping"]); m = [k for k in ("structural", "functional", "regression") if k not in tiers] + [x["tier"] for x in P["tier_mapping"] if not (x.get("gate") and x.get("level"))]
if m: fails.append(("TV7", f"3-tier の対応が欠け {m}"))
am = re.search(r"auto-merge:\n.*?needs: \[([^\]]*)\]", Y, re.S); needs = set(x.strip() for x in am.group(1).split(",")) if am else set()
m = [x for x in ("static", "database", "spec", "task-gate") if x not in needs] + ([] if P.get("source") else ["source"]) + [s for s in ("L1", "L2", "L3", "L4", "L5") if s not in {x["stage"] for x in P["ladder"]}]
if m: fails.append(("TV8", f"auto-merge の needs／source／梯子の欠け {m}"))
print(f"ゲート {len(P['gates'])} / EARS test {len(M['mappings'])} / RLS の場合 {len(A['cases'])} / 3-tier {len(P['tier_mapping'])} 行 / 梯子 {len(P['ladder'])}")
for k, x in fails: print(f"  ★ [{k}] {x}")
print("PASS — TV1〜TV8 すべて緑" if not fails else f"FAIL — {len(fails)} 件"); sys.exit(0 if not fails else 2)
