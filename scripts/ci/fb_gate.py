#!/usr/bin/env python3
"""fb_gate.py — functional-breakdown の 4 JSON ＋ マトリクスの検査（FB1〜FB8）。
 FB1 画面 = flow.json の screens と 1 対 1 ／ FB2 全要素に source ／ FB3 全画面に required_apis ≥ 1 ／ FB4 EARS 5 形式
 FB5 entities.table_name が ER 図に定義 ／ FB6 related_entities の実在 ／ FB7 features.acts が flow に実在 ／ FB8 マトリクスの未被覆 0
使い方: python3 fb_gate.py --flow 05_flow/flow.json --er 03_architecture/ER図.md --dir 07_functional
"""
import argparse, json, re, sys
from pathlib import Path
EARS = re.compile(r"^(UBIQUITOUS|EVENT-DRIVEN|STATE-DRIVEN|OPTIONAL|UNWANTED):")
def main():
    ap = argparse.ArgumentParser(); ap.add_argument("--flow", required=True); ap.add_argument("--er", required=True); ap.add_argument("--dir", default="07_functional")
    a = ap.parse_args(); d = Path(a.dir); F = json.load(open(a.flow, encoding="utf-8")); er = Path(a.er).read_text(encoding="utf-8")
    E = json.load(open(d / "entities.json", encoding="utf-8"))["entities"]; FE = json.load(open(d / "features.json", encoding="utf-8"))["items"]
    R = json.load(open(d / "roles.json", encoding="utf-8"))["roles"]; S = json.load(open(d / "screens.json", encoding="utf-8"))["items"]; TM = json.load(open(d / "traceability-matrix.json", encoding="utf-8"))
    fails = []
    fs, ss = {s["id"] for s in F["screens"]}, {s["id"] for s in S}
    if fs != ss: fails.append(("FB1", f"画面が flow と一致しない 欠け {sorted(fs-ss)} 余り {sorted(ss-fs)}"))
    nosrc = [x["id"] for L in (E, FE, R, S) for x in L if not x.get("source")]
    if nosrc: fails.append(("FB2", f"source の無い要素 {len(nosrc)}: {nosrc[:10]}"))
    noapi = [s["id"] for s in S if not s.get("required_apis")]
    if noapi: fails.append(("FB3", f"required_apis が空の画面 {noapi}"))
    bad = [(f["id"], x[:40]) for f in FE for x in f.get("ears_ac_seed", []) if not EARS.match(x)]
    if bad: fails.append(("FB4", f"EARS 5 形式でない {len(bad)}: {bad[:5]}"))
    defined = set(re.findall(r"^\|\s*\**`([a-z_]+)`\**\s*\|", er, flags=re.M))
    nt = [e["table_name"] for e in E if e["table_name"] not in defined]
    if nt: fails.append(("FB5", f"ER 図に無いテーブル {nt}"))
    eids = {e["id"] for e in E}
    ghost = sorted({x for s in S for x in s.get("related_entities", []) if x not in eids} | {x for f in FE for x in f.get("related_entities", []) if x not in eids})
    if ghost: fails.append(("FB6", f"存在しないエンティティ参照 {ghost}"))
    acts = {a["id"] for ph in F["backbone"] for a in ph["acts"]}
    ga = sorted({x for f in FE for x in f.get("acts", []) if x not in acts} | {x for s in S for x in s.get("acts", []) if x not in acts})
    if ga: fails.append(("FB7", f"存在しない行為 {ga}"))
    if TM["summary"]["uncovered_screens"] or TM["summary"]["uncovered_features"]: fails.append(("FB8", f"未被覆 画面 {TM['summary']['uncovered_screens']} 機能 {TM['summary']['uncovered_features']}"))
    print(f"エンティティ {len(E)} / 機能 {len(FE)} / ロール {len(R)} / 画面 {len(S)}")
    for k, m in fails: print(f"  ★ [{k}] {m}")
    print("PASS — FB1〜FB8 すべて緑" if not fails else f"FAIL — {len(fails)} 件"); return 0 if not fails else 2
if __name__ == "__main__": sys.exit(main())
