#!/usr/bin/env python3
"""coverage_review.py — 全体照合（5 方向）。指摘された 1 画面を直す前に、これを回して欠けを全部出す。

なぜ必要か（2026-09-15・L-011）
  画面を「言われた指摘」からしか足していなかった。決定ログ全文・役割・時点・出来事・手本 の 5 方向から
  機械で突き合わせたのは、user「一旦全て見直せ」の後が初めてだった。人が思い出す方式は破れる。
  ここで出るものは全部「まだ設計していない」であって「無い」ではない。

5 方向
  ① 決定 × 画面    trace_gate.py（T8 文の被覆）              → 未検査・未反映の文
  ② 役割 × 画面    role_gate.py（G15）                       → 役割ごとの中身が無い画面
  ③ 時点 × 画面    G18：アプリの画面は 空（データ無し）と 止まっている（AI 停止）の状態を持つ
                    モックの <!-- cover: empty=<state> stopped=<state> --> か <!-- cover-na: stopped 理由 --> で宣言
  ④ 出来事 × オブジェクト  G16 を全出来事に：flow.json の account_events[] ごとに leave_gate
  ⑤ 手本の面 × 画面  G19：references/saas-surfaces.yaml の面が flow.json の surface_map に全部ある
                    値は画面 ID か "out_of_scope: 理由" か "deferred: D-xxx"

使い方
  python3 coverage_review.py --flow 05_flow/flow.json --mocks 06_mockup/v1 [--surfaces <yaml>] [--prefix v1-] [--gate]
  --gate で ③④⑤ に欠けがあれば非ゼロ終了（①② は各ゲートの結果を再表示）
"""
from __future__ import annotations
import argparse, json, os, re, subprocess, sys
from pathlib import Path
HERE = Path(__file__).resolve().parent

def sh(cmd):
    r = subprocess.run(cmd, capture_output=True, text=True); return (r.stdout + r.stderr).strip().splitlines()

def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--flow", required=True); ap.add_argument("--mocks", required=True); ap.add_argument("--prefix", default="v1-")
    ap.add_argument("--surfaces", default=str(HERE.parent / "references" / "saas-surfaces.yaml")); ap.add_argument("--gate", action="store_true")
    ap.add_argument("--er", help="ER 図（03_architecture/ER図.md）。渡すと ⑥ オブジェクト × テーブル（G20・er_gate.py）も回す")
    a = ap.parse_args()
    F = json.load(open(a.flow, encoding="utf-8")); bad = 0
    print("# 全体照合（5 方向 ＋ ⑥ DB）\n")
    # ① 決定 × 画面
    tg = HERE / "trace_gate.py"
    if tg.exists():
        out = sh([sys.executable, str(tg), "--clauses"]); cov = [l for l in out if l.startswith("文の被覆")]
        heads = [l for l in out if l.startswith("   D-")]; miss = sum(1 for l in out if l.strip().startswith("未 "))
        print("## ① 決定 × 画面（T8）"); print("  " + (cov[0] if cov else "trace_gate を実行できない")); print(f"  文の未反映 {miss}（{len(heads)} 決定）\n")
    # ② 役割 × 画面
    rg = HERE.parent.parent / "ui-mockup" / "scripts" / "role_gate.py"
    for cand in (rg, Path("scripts/ci/role_gate.py")):
        if cand.exists():
            out = sh([sys.executable, str(cand), "--flow", a.flow, "--mocks", a.mocks, "--prefix", a.prefix])
            print("## ② 役割 × 画面（G15）"); print("  " + (out[-1] if out else "?")); print("  " + "\n  ".join(l.strip() for l in out if l.strip().startswith("★"))[:1500] + "\n"); break
    # ③ 時点 × 画面（G18）
    print("## ③ 時点 × 画面（G18：空・止まっている）")
    lack = []
    for s in F["screens"]:
        if s.get("release") != "v1" or not s.get("has_shell"): continue
        p = Path(a.mocks) / f'{a.prefix}{s["id"]}.html'
        if not p.exists(): continue
        h = p.read_text(encoding="utf-8")
        cov = dict(re.findall(r'<!--\s*cover:\s*([^>]*?)-->', h) and [kv.split("=") for kv in re.findall(r'<!--\s*cover:\s*([^>]*?)-->', h)[0].split()] or [])
        na = {m.split()[0]: " ".join(m.split()[1:]) for m in re.findall(r'<!--\s*cover-na:\s*([^>]*?)-->', h)}
        need = []
        for k in ("empty", "stopped"):
            if k not in cov and k not in na: need.append(k)
        if need: lack.append(f'{s["id"]}: {"・".join({"empty":"空","stopped":"止まっている"}[k] for k in need)} の状態が無い（<!-- cover: empty=<状態> stopped=<状態> --> か <!-- cover-na: … 理由 --> を宣言）')
    print(f"  欠け {len(lack)} 画面"); [print("  ★ " + l) for l in lack[:60]]; print(); bad += len(lack)
    # ④ 出来事 × オブジェクト（G16 を全出来事に）
    print("## ④ 出来事 × オブジェクト（G16）")
    evs = F.get("account_events") or []
    if not evs: print("  ★ flow.json に account_events[] が無い（人が抜ける・停止・権限変更・会社が退会・プラン変更・層を消す・AI社員を消す …）"); bad += 1
    lg = HERE / "leave_gate.py"
    for ev in evs:
        scr = ev.get("screens") or []
        if not scr: print(f'  ★ {ev["id"]} {ev.get("name","")}: 画面が無い'); bad += 1; continue
        out = sh([sys.executable, str(lg), "--flow", a.flow, "--mocks", a.mocks, "--prefix", a.prefix, "--event", ev["id"], "--screens", *scr])
        ok = out and out[-1].startswith("PASS"); print(f'  {"OK" if ok else "★"} {ev["id"]} {ev.get("name","")}: {out[-1] if out else "?"}'); bad += 0 if ok else 1
    print()
    # ⑤ 手本の面 × 画面（G19）
    print("## ⑤ 手本の面 × 画面（G19）")
    try:
        import yaml; S = yaml.safe_load(open(a.surfaces, encoding="utf-8"))
    except Exception as e:
        print(f"  手本の面を読めない: {e}"); S = {}
    smap = F.get("surface_map") or {}; ids = {s["id"] for s in F["screens"]}
    for side in ("customer", "operator"):
        for sf in S.get(side, []):
            v = smap.get(sf["id"])
            if not v: print(f'  ★ {sf["id"]} {sf["name"]}: surface_map に無い'); bad += 1
            elif isinstance(v, str) and (v.startswith("out_of_scope:") or v.startswith("deferred:")): print(f'  - {sf["id"]} {sf["name"]}: {v}')
            else:
                vs = v if isinstance(v, list) else [v]
                ghost = [x for x in vs if x not in ids]
                if ghost: print(f'  ★ {sf["id"]} {sf["name"]}: 画面が無い {ghost}'); bad += 1
                else: print(f'  OK {sf["id"]} {sf["name"]}: {", ".join(vs)}')
    # ⑥ オブジェクト × テーブル（G20）
    if a.er:
        eg = HERE / "er_gate.py"
        for cand in (eg, HERE.parent.parent / "architecture-design" / "scripts" / "er_gate.py", Path("scripts/ci/er_gate.py")):
            if cand.exists():
                out = sh([sys.executable, str(cand), "--flow", a.flow, "--er", a.er])
                print("## ⑥ オブジェクト × テーブル（G20）"); print("  " + (out[-1] if out else "?")); [print("  " + l.strip()) for l in out if l.strip().startswith("★")]; print()
                if out and out[-1].startswith("FAIL"): bad += 1
                break
        else: print("## ⑥ オブジェクト × テーブル（G20）\n  ★ er_gate.py が見つからない\n"); bad += 1
    else: print("## ⑥ オブジェクト × テーブル（G20）\n  （--er 未指定。ER 図があるなら渡す）\n")
    print(); print("PASS — ③④⑤⑥ に欠け無し（①② は各ゲートの結果を見る）" if not bad else f"FAIL — ③④⑤⑥ の欠け {bad}")
    return 2 if (a.gate and bad) else 0

if __name__ == "__main__": sys.exit(main())
