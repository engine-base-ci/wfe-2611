#!/usr/bin/env python3
"""role_gate.py — G15「役割ごとの中身」。画面は役割ごとに中身が変わる。同じでよいなら同じと宣言する。

なぜ必要か（2026-09-15・L-010）
  代表の中身を 1 つ作り、他の役割には「この画面は見えません」の錠前だけを出していた。
  担当者・閲覧のみ・運営が何を見るかは誰も設計しておらず、ゲートは緑のまま通った。
  役割は flow.json の screens[].roles にある。中身が役割ごとに出し分けられているか、
  それとも「同じ中身でよい」と明示したかを、機械で検査する。

検査
  各画面（flow.json の screens、release=v1）について、screens[].roles の各役割が
    (a) モック HTML の data-roles="R1 R2 …" の塊のどれかに含まれている、または
    (b) モック HTML の宣言 <!-- role-same: R1 R2 --> に含まれている（＝この役割たちは同じ中身と決めた）
  のどちらかでなければ FAIL。
  加えて、data-roles / role-same に screens[].roles に無い役割が書かれていたら FAIL（誰にも見えない中身）。

使い方
  python3 role_gate.py --flow 05_flow/flow.json --mocks 06_mockup/v1 [--prefix v1-] [--json]
  exit 0 = PASS / 2 = FAIL
"""
from __future__ import annotations
import argparse, json, re, sys
from pathlib import Path

def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--flow", required=True); ap.add_argument("--mocks", required=True)
    ap.add_argument("--prefix", default="v1-"); ap.add_argument("--release", default="v1"); ap.add_argument("--json", action="store_true")
    a = ap.parse_args()
    flow = json.load(open(a.flow, encoding="utf-8"))
    roles_all = {r["id"] for r in flow["roles"]}
    bad, ok, results = [], 0, []
    for s in flow["screens"]:
        if s.get("release") != a.release: continue
        p = Path(a.mocks) / f'{a.prefix}{s["id"]}.html'
        if not p.exists(): bad.append(f'{s["id"]}: モックが無い'); continue
        h = p.read_text(encoding="utf-8")
        blocks = set(t for m in re.finditer(r'data-roles="([^"]+)"', h) for t in m.group(1).split())
        same = set(t for m in re.finditer(r'<!--\s*role-same:\s*([^>]*?)-->', h) for t in m.group(1).split())
        roles = set(s.get("roles", []))
        miss = sorted(r for r in roles if r not in blocks and r not in same)
        dead = sorted(r for r in (blocks | same) if r not in roles and r in roles_all)
        unknown = sorted(r for r in (blocks | same) if r not in roles_all)
        results.append({"screen": s["id"], "roles": sorted(roles), "blocks": sorted(blocks), "same": sorted(same), "missing": miss, "dead": dead})
        if miss: bad.append(f'{s["id"]}: 役割 {"/".join(miss)} の中身が無い（data-roles で出し分けるか <!-- role-same: … --> で「同じ」と宣言する）')
        if dead: bad.append(f'{s["id"]}: 役割 {"/".join(dead)} は screens[].roles に無いのに中身がある（誰にも見えない）')
        if unknown: bad.append(f'{s["id"]}: 未知の役割 {"/".join(unknown)}')
        if not (miss or dead or unknown): ok += 1
    if a.json: print(json.dumps({"pass": not bad, "ok": ok, "bad": bad, "screens": results}, ensure_ascii=False, indent=1))
    else:
        print(f'画面 {ok + len({b.split(":")[0] for b in bad})} / 役割ごとの中身あり or 同じと宣言 {ok}')
        for b in bad: print("  ★", b)
        print("PASS — G15 役割ごとの中身" if not bad else f"FAIL — G15 役割ごとの中身が無い画面 {len({b.split(':')[0] for b in bad})}")
    return 0 if not bad else 2

if __name__ == "__main__": sys.exit(main())
