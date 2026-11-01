#!/usr/bin/env python3
"""layer_audit.py — 「検査していない層」を機械で出す（G21）。
   由来（2026-09-15・Kaname）：ゲートが全部緑でも、ER 図・設計書・エラー一覧は決定 9 節ぶん古かった。理由は、完了の定義が
   「手元にあるゲートの一覧」で、ゲートの無い層は誰も見ていなかったこと。人が層を覚えるのをやめ、
   spec-dependencies.yaml の layer_checks に 全成果物 × 検査 を持ち、無い層を赤で出す。
   layer_checks:
     - file: 03_architecture/ER図.md
       check: python3 scripts/ci/er_gate.py --flow 05_flow/flow.json --er 03_architecture/ER図.md   # 機械検査（exit 0 で緑）
     - file: 04_design/DESIGN-kaname.md
       manual: 色・書体のトークンは D-072 が最新。決定でトークンが増えたら手で更新（理由を書く）
   検査：decision_traceability.products の全ファイルが layer_checks にある／check は実行して exit 0／manual は理由あり。
   鮮度：ファイルが参照する最大の決定 ID が正本の最新 confirmed より小さいとき warn（manual の層は「古いかもしれない」と出す）。
使い方: python3 layer_audit.py [--map spec-dependencies.yaml] [--run] [--json]
"""
from __future__ import annotations
import argparse, glob, json, os, re, subprocess, sys, yaml

def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--map", default="spec-dependencies.yaml"); ap.add_argument("--run", action="store_true", help="check を実行する（既定は一覧だけ）")
    ap.add_argument("--json", action="store_true")
    a = ap.parse_args()
    cfg = yaml.safe_load(open(a.map, encoding="utf-8"))
    dt = cfg.get("decision_traceability", {}); products = []
    for p in dt.get("products", []):
        f = p.get("file", "")
        products.append(f)   # glob はそのまま 1 層として扱う
    checks = {c["file"]: c for c in cfg.get("layer_checks", [])}
    # 正本の最新 confirmed
    src = dt.get("sources", [{}])[0]; log = open(src.get("file", ""), encoding="utf-8").read() if src.get("file") and os.path.exists(src.get("file")) else ""
    latest = max((int(m) for m in re.findall(r"decision: D-(\d{3})\n\s+status: confirmed", log)), default=0)
    rows, bad = [], 0
    files = sorted(set(products) | set(checks))
    for f in files:
        c = checks.get(f); paths = sorted(glob.glob(f)) if any(ch in f for ch in "*?[") else [f]; exists = any(os.path.isfile(x) for x in paths)
        refs = [int(x) for x in re.findall(r"\bD-(\d{3})", "".join(open(x, encoding="utf-8", errors="ignore").read() for x in paths if os.path.isfile(x)))] if exists else []
        newest = max(refs) if refs else 0
        row = {"file": f, "exists": exists, "newest_ref": f"D-{newest:03d}" if newest else "—", "latest": f"D-{latest:03d}", "kind": "", "result": "", "note": ""}
        if not c: row["kind"] = "無"; row["result"] = "★ 検査が無い（layer_checks に check か manual を書く）"; bad += 1
        elif c.get("check"):
            row["kind"] = "機械"
            if a.run:
                cmd = re.sub(r"(^|&& |\| )python3 ", lambda m: m.group(1) + sys.executable + " ", c["check"])   # 検査は同じ Python で回す（system python3 だと構文で落ちる）
                r = subprocess.run(cmd, shell=True, capture_output=True, text=True, cwd=os.getcwd())
                row["result"] = "OK" if r.returncode == 0 else "★ FAIL"; row["note"] = (r.stdout + r.stderr).strip().splitlines()[-1][:120] if (r.stdout + r.stderr).strip() else ""
                if r.returncode: bad += 1
            else: row["result"] = "（--run で実行）"
        else:
            row["kind"] = "手"; row["note"] = c.get("manual", "")
            if not row["note"]: row["result"] = "★ manual の理由が無い"; bad += 1
            elif newest and newest < latest: row["result"] = f"warn 古いかもしれない（最新の参照 D-{newest:03d} < 正本 D-{latest:03d}）"
            else: row["result"] = "OK（手で見る層）"
        rows.append(row)
    if a.json: print(json.dumps({"pass": not bad, "latest": latest, "rows": rows}, ensure_ascii=False, indent=1))
    else:
        print(f"層の棚卸し {len(rows)} ファイル（正本の最新 confirmed: D-{latest:03d}）")
        for r in rows: print(f'  {r["kind"]:2s} {r["result"]:<44s} {r["newest_ref"]:>6s}  {r["file"]}' + (f'  ← {r["note"]}' if r["note"] else ""))
        print("PASS — G21 全部の層に検査（機械か理由つきの手）がある" if not bad else f"FAIL — G21 検査の無い層 {bad}")
    return 0 if not bad else 2

if __name__ == "__main__": sys.exit(main())
