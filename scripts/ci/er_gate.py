#!/usr/bin/env python3
"""er_gate.py — flow.json の objects[] と ER 図のテーブルを機械で突き合わせる（G20）。
   由来（2026-09-15・Kaname）：決定 D-069〜D-077 で 問い合わせ・お知らせ・請求・プラン・権限・層・出来事の依存 を画面にしたのに、
   ER 図は D-068 で止まっていた。trace_gate は reflect_in に ER 図を書かなければ素通りする（T7 と同型）。
   列挙で守らず、オブジェクトの集合とテーブルの集合を双方向で照合する。
   ER 図の「## オブジェクト ↔ テーブル」の表：| オブジェクト | `table` `table` … | 備考 |。テーブルが無いなら `—` と理由（備考が空なら FAIL）。
使い方: python3 er_gate.py --flow 05_flow/flow.json --er 03_architecture/ER図.md [--json]
"""
from __future__ import annotations
import argparse, json, re, sys
from pathlib import Path

def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--flow", required=True); ap.add_argument("--er", required=True); ap.add_argument("--json", action="store_true")
    ap.add_argument("--heading", default="オブジェクト ↔ テーブル")
    a = ap.parse_args()
    objs = [o["name"] for o in json.load(open(a.flow, encoding="utf-8"))["objects"]]
    er = Path(a.er).read_text(encoding="utf-8")
    parts = re.split(r"^## .*" + re.escape(a.heading) + r".*$", er, flags=re.M)
    if len(parts) < 2: print(f"FAIL — ER 図に「## {a.heading}」の節が無い"); return 2
    body = parts[1].split("\n## ")[0]; rest = parts[0] + "\n## ".join(parts[1].split("\n## ")[1:])
    tbl_rows = re.findall(r"^\|\s*\**`([a-z_]+)`\**\s*\|([^|\n]*)\|([^|\n]*)\|", rest, flags=re.M)
    defined = {n for n, cols, _ in tbl_rows if "/" in cols or "<common>" in cols or "<scoped>" in cols or "<versioned>" in cols}   # 索引の表（GIN 等）は列の区切り / を持たない
    notes = {n: note for n, cols, note in tbl_rows}
    CHILD = re.compile(r"_(versions|items|steps|fields|stages|deliveries|kinds|masters|views|contributions|allocations|handovers|requests|profiles)$")
    rows = {}
    for m in re.finditer(r"^\|\s*([^|`\n]+?)\s*\|\s*([^|\n]*?)\s*\|\s*([^|\n]*?)\s*\|\s*$", body, flags=re.M):
        name = m.group(1).strip()
        if name in ("オブジェクト", "---") or name.startswith("-"): continue
        rows[name] = (re.findall(r"`([a-z_.()= ]+)`", m.group(2)), m.group(3).strip(), m.group(2).strip())
    bad = []
    for o in objs:
        if o not in rows: bad.append(f"{o}: 対応表に行が無い（テーブルか — と理由を書く）"); continue
        tbls, note, raw = rows[o]
        base = [t.split(".")[0].split("(")[0].strip() for t in tbls]
        if not base:
            if raw.strip() in ("—", "-", "なし") and note: continue
            bad.append(f"{o}: テーブルが無いのに理由が無い"); continue
        miss = [t for t in base if t not in defined]
        if miss: bad.append(f"{o}: 定義の無いテーブル {', '.join(miss)}")
    extra = sorted(set(rows) - set(objs))
    for x in extra: bad.append(f"{x}: flow.json の objects に無い（消えたオブジェクトの行）")
    mapped = {b.split(".")[0].split("(")[0].strip() for r in rows.values() for b in r[0]}
    unmapped = sorted(t for t in defined if t not in mapped)
    orphan = [t for t in unmapped if not (CHILD.search(t) or "マスタ" in notes.get(t, ""))]
    for t_ in orphan: bad.append(f"テーブル {t_}: どのオブジェクトにも紐づかない（flow.json の objects に足すか、マスタ／子表なら備考に書く）")
    if a.json: print(json.dumps({"pass": not bad, "objects": len(objs), "tables": len(defined), "bad": bad, "tables_without_object": unmapped}, ensure_ascii=False, indent=1))
    else:
        print(f"オブジェクト {len(objs)} / 定義されたテーブル {len(defined)} / 対応の行 {len(rows)}")
        for b in bad: print("  ★", b)
        rest_ = [t_ for t_ in unmapped if t_ not in orphan]
        if rest_: print(f"  （参考）マスタ・子表で対応表に無いもの {len(rest_)}：{', '.join(rest_)}")
        print("PASS — G20 全オブジェクトに DB の実体がある" if not bad else f"FAIL — G20 DB に無いオブジェクト {len(bad)}")
    return 0 if not bad else 2

if __name__ == "__main__": sys.exit(main())
