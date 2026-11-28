#!/usr/bin/env python3
"""fd_gate.py — feature-decomposition の検査（FD1〜FD8）。
 FD1 全 v1 行為が B か C の機能に含まれる ／ FD2 全 v1 画面が C の機能に含まれる ／ FD3 B/C の全機能が結線（D）から参照される（孤立なし）
 FD4 依存の循環なし・Group 順（A→B→C→D→E）に矛盾なし ／ FD5 全機能に source ／ FD6 二軸工数（human/ai/wall_clock/factor）が全機能にある
 FD7 流れ候補（J-xx）が背骨のフェーズと一致 ／ FD8 test_coverage と type_check の gate が全機能で true
使い方: python3 fd_gate.py --flow 05_flow/flow.json --dir 09_features"""
import argparse, json, sys
from pathlib import Path
def main():
    ap = argparse.ArgumentParser(); ap.add_argument("--flow", required=True); ap.add_argument("--dir", default="09_features"); a = ap.parse_args()
    F = json.load(open(a.flow, encoding="utf-8")); J = json.load(open(Path(a.dir) / "features.json", encoding="utf-8")); items = J["items"]; ids = {x["id"]: x for x in items}
    fails = []
    v1acts = [x["id"] for ph in F["backbone"] for x in ph["acts"] if x.get("release") == "v1"]
    have = {x for f in items if f["group"] in ("B", "C") for x in f["acts"]}; miss = [x for x in v1acts if x not in have]
    if miss: fails.append(("FD1", f"機能に無い行為 {miss}"))
    v1s = [s["id"] for s in F["screens"] if s.get("release") == "v1"]; hs = {x for f in items if f["group"] == "C" for x in f["screen_ids"]}; miss = [x for x in v1s if x not in hs]
    if miss: fails.append(("FD2", f"UI 機能に無い画面 {miss}"))
    if J["summary"]["orphan_components"]: fails.append(("FD3", f"結線されていない部品 {J['summary']['orphan_components']}"))
    order = {"A": 0, "B": 1, "C": 2, "D": 3, "E": 4}; bad = [f'{f["id"]}→{d}' for f in items for d in f["depends_on"] if d in ids and order[ids[d]["group"]] > order[f["group"]]]
    if J["summary"]["cycles"] or bad: fails.append(("FD4", f"循環 {J['summary']['cycles']} / 後段に依存 {bad[:6]}"))
    ns = [f["id"] for f in items if not f.get("source")]
    if ns: fails.append(("FD5", f"source の無い機能 {ns}"))
    ax = [f["id"] for f in items if any(k not in f for k in ("estimate_hours_human", "estimate_hours_ai", "wall_clock_h_ai", "ai_acceleration_factor")) or not (1.0 <= f["ai_acceleration_factor"] <= 30)]
    if ax: fails.append(("FD6", f"二軸工数が無い・短縮率が非現実 {ax[:6]}"))
    phases = [ph["phase"] for ph in F["backbone"] if any(x.get("release") == "v1" for x in ph["acts"])]; jn = [j["name"] for j in J["journeys"]]
    if phases != jn: fails.append(("FD7", f"流れ候補が背骨と一致しない {set(phases) ^ set(jn)}"))
    bg = [f["id"] for f in items if not (f["ci_gates"]["test_coverage"] and f["ci_gates"]["type_check"])]
    if bg: fails.append(("FD8", f"test/type gate が false {bg[:6]}"))
    print(f"機能 {len(items)} / Wave {J['summary']['waves']} / 流れ {len(J['journeys'])} / Human {J['summary']['total_estimate_hours_human']} h / AI wall-clock {J['summary']['total_wall_clock_h_ai_parallel']} h")
    for k, m in fails: print(f"  ★ [{k}] {m}")
    print("PASS — FD1〜FD8 すべて緑" if not fails else f"FAIL — {len(fails)} 件"); return 0 if not fails else 2
if __name__ == "__main__": sys.exit(main())
