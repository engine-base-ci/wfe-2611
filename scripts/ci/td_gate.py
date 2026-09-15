#!/usr/bin/env python3
"""td_gate.py — task-decomposition の検査（TD1〜TD10）。JIT ポリシーの validate と同じ条件を機械で。
 TD1 全 v1 画面に UI タスク ／ TD2 全 v1 行為に A か U タスク ／ TD3 全タスクに source・acts（空なら why）・choke_points（空なら rationale）
 TD4 files_changed_predicted と acceptance_criteria_inline の 3 tier が空でない（Tier 1 は UI/API のみ）／ TD5 tier_2 に UNWANTED ／ TD6 test_scenarios_inline
 TD7 二軸工数 4 項目・短縮率 1〜30・critical は human_review_h > 0 ／ TD8 depends_on の循環なし・layer 順 ／ TD9 ui/backend/integration の qa_rows.l1 ≥ 1 ／ TD10 Foundation の Wave に他 Group が無い ／ TD11 後回し（決定ログの「段階 2：」の文・flow の deferred）に仕様づくりのタスク（Group V2）がある（後回しは日程から消えない）
使い方: python3 td_gate.py --flow 05_flow/flow.json --tickets 07_tasks/tickets.json"""
import argparse, json, sys
def main():
    ap = argparse.ArgumentParser(); ap.add_argument("--flow", required=True); ap.add_argument("--log", default="01_hearing/決定ログ_進行中.md", help="決定ログ（TD11 が「段階 2：」の文を読む）"); ap.add_argument("--tickets", default="07_tasks/tickets.json"); a = ap.parse_args()
    F = json.load(open(a.flow, encoding="utf-8")); J = json.load(open(a.tickets, encoding="utf-8")); T = J["tasks"]; ids = {t["id"]: t for t in T}; fails = []
    v1s = [s["id"] for s in F["screens"] if s.get("release") == "v1"]; hs = {s for t in T for s in t["screen_ids"] if t["deliverable_layer"] == "ui"}; m = [s for s in v1s if s not in hs]
    if m: fails.append(("TD1", f"UI タスクの無い画面 {m}"))
    v1a = [x["id"] for ph in F["backbone"] for x in ph["acts"] if x.get("release") == "v1"]; ha = {x for t in T if t["group"] in ("A", "U-screen") for x in t["acts"]}; m = [x for x in v1a if x not in ha]
    if m: fails.append(("TD2", f"タスクの無い行為 {m}"))
    m = [t["id"] for t in T if not t.get("source") or (not t["acts"] and not t.get("why") and t["group"] not in ("F", "D", "U-shared")) or (not t["choke_points"] and not t["choke_points_rationale"])]
    if m: fails.append(("TD3", f"source／acts／choke_points の欠け {m[:8]}"))
    m = [t["id"] for t in T if not (t["files_changed_predicted"]["new"] or t["files_changed_predicted"]["modify"]) or not t["acceptance_criteria_inline"]["tier_2_functional"] or not t["acceptance_criteria_inline"]["tier_3_regression"] or (t["deliverable_layer"] in ("ui",) and not t["acceptance_criteria_inline"]["tier_1_structural"])]
    if m: fails.append(("TD4", f"files_changed_predicted か 3-tier AC が空 {m[:8]}"))
    m = [t["id"] for t in T if t["deliverable_layer"] in ("backend", "ui") and not any(x["type"] == "UNWANTED" for x in t["acceptance_criteria_inline"]["tier_2_functional"])]
    if m: fails.append(("TD5", f"UNWANTED が無い {m[:8]}"))
    m = [t["id"] for t in T if not t["test_scenarios_inline"]]
    if m: fails.append(("TD6", f"test_scenarios_inline が空 {m[:8]}"))
    m = [t["id"] for t in T if any(k not in t for k in ("estimate_hours_human", "estimate_hours_ai", "wall_clock_h_ai", "ai_acceleration_factor")) or not (1 <= t["ai_acceleration_factor"] <= 30) or (t.get("critical") and t["human_review_h"] <= 0)]
    if m: fails.append(("TD7", f"二軸工数の欠け／致命級にレビュー時間なし {m[:8]}"))
    order = {"foundation": 0, "backend": 1, "ui": 2, "integration": 3, "polish": 4, "content": 4, "spec": 0}
    seen, stack, cyc = set(), set(), []
    def dfs(n):
        if n in stack: return True
        if n in seen: return False
        seen.add(n); stack.add(n)
        for d in ids[n]["depends_on"]:
            if d in ids and dfs(d): return True
        stack.discard(n); return False
    cyc = [t["id"] for t in T if dfs(t["id"])]; bad = [f'{t["id"]}→{d}' for t in T for d in t["depends_on"] if d in ids and order[ids[d]["deliverable_layer"]] > order[t["deliverable_layer"]]]
    ghost = sorted({d for t in T for d in t["depends_on"] if d not in ids})
    if cyc or bad or ghost: fails.append(("TD8", f"循環 {cyc[:4]} / 後段に依存 {bad[:4]} / 無い依存 {ghost[:4]}"))
    m = [t["id"] for t in T if t["deliverable_layer"] in ("ui", "backend", "integration") and not t["qa_rows"]["l1"]]
    if m: fails.append(("TD9", f"L1 行が 0 のタスク {m[:8]}"))
    import re as _re
    LOG = open(a.log, encoding="utf-8").read() if __import__("os").path.exists(a.log) else ""; need = []
    for sec in _re.split(r"\n(?=## \d+\. )", LOG):
        m = _re.search(r"decision: (D-\d{3})", sec); st = _re.search(r"status: (\w+)", sec); tb = sec.split("### 決めたこと", 1)
        if not m or not st or st.group(1) != "confirmed" or len(tb) < 2: continue
        rows = [r for r in tb[1].split("\n") if r.startswith("| ") and not r.startswith("| 項目") and not r.startswith("|---")]
        need += [f"{m.group(1)}.{i}" for i, r in enumerate(rows, 1) if _re.match(r"^段階 ?2", r.strip().strip("|").split("|")[0].strip())]
    need += [c for v in F.get("deferred", {}).values() for c in _re.findall(r"D-\d{3}\.\d+", v)]
    have = {s for t in T if t["group"] == "V2" for s in t["source"]}; m = sorted({c for c in need if c not in have})
    if m: fails.append(("TD11", f"後回しの文に仕様づくりのタスクが無い {m[:6]}"))
    fw = max((t["wave"] for t in T if t["group"] == "F"), default=-1); m = [t["id"] for t in T if t["group"] != "F" and t["wave"] <= fw]   # Foundation の Wave（並列上限で複数）に他 Group を混ぜない
    if m: fails.append(("TD10", f"Foundation が Wave 0 でない／Wave 0 に他 Group {m[:8]}"))
    s = J["summary"]; print(f"タスク {len(T)} / Wave {len(J['waves'])} / L1 行 {s['qa_rows_total']} / Human {s['total_estimate_hours_human']} h / AI wall-clock {s['total_wall_clock_h_ai_parallel']} h")
    for k, msg in fails: print(f"  ★ [{k}] {msg}")
    print("PASS — TD1〜TD10 すべて緑" if not fails else f"FAIL — {len(fails)} 件"); return 0 if not fails else 2
if __name__ == "__main__": sys.exit(main())
