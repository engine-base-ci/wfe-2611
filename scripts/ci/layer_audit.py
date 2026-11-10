#!/usr/bin/env python3
"""layer_audit.py — 「検査していない層」を機械で出す（G21）。
   由来（2026-09-15・Kaname）：ゲートが全部緑でも、ER 図・設計書・エラー一覧は決定 9 節ぶん古かった。理由は、完了の定義が
   「手元にあるゲートの一覧」で、ゲートの無い層は誰も見ていなかったこと。人が層を覚えるのをやめ、
   spec-dependencies.yaml の layer_checks に 全成果物 × 検査 を持ち、無い層を赤で出す。
   layer_checks:
     - file: 03_architecture/ER図.md
       check: python3 scripts/ci/er_gate.py --flow 05_flow/flow.json --er 03_architecture/ER図.md   # 機械検査（exit 0 で緑）
     - file: apps/a/package.json
       check: pnpm -s type-check
       elsewhere: G2      # 同じ命令を CI の別の段（static・spec の無条件の段）が流している。ここでは流さない（K-156）
     - file: 04_design/DESIGN-kaname.md
       manual: 色・書体のトークンは D-072 が最新。決定でトークンが増えたら手で更新（理由を書く）
   検査：decision_traceability.products の全ファイルが layer_checks にある／check は実行して exit 0／manual は理由あり。
   同じ check の文字を持つ層は 1 回だけ流し、答えを使い回す（K-156）。elsewhere の印が段の命令を本当に流しているかは
   ci_wiring_gate.py の W5 が見る（印を付けただけで「流れている」にしない）。
   鮮度：ファイルが参照する最大の決定 ID が正本の最新 confirmed より小さいとき warn（manual の層は「古いかもしれない」と出す）。
使い方: python3 layer_audit.py [--map spec-dependencies.yaml] [--run] [--json]
"""
from __future__ import annotations

import argparse
import glob
import json
import os
import re
import subprocess
import sys
import time
from typing import Callable

import yaml

GATE = re.compile(r"\bG\d+\b")


def elsewhere_gates(entry: dict) -> list[str]:
    """層の elsewhere（"G2"・"G4・G5"・"G2 type check"）から段の番号 G<N> を順に"""
    return GATE.findall(str(entry.get("elsewhere") or ""))


def _default_runner(cmd: str, **kw) -> subprocess.CompletedProcess:
    # 検査は同じ Python で回す（system の python3 だと構文で落ちる）
    cmd = re.sub(r"(^|&& |\| )python3 ", lambda m: m.group(1) + sys.executable + " ", cmd)
    return subprocess.run(cmd, **kw)


def _latest(cfg: dict) -> int:
    dt = cfg.get("decision_traceability", {})
    src = (dt.get("sources") or [{}])[0]
    f = src.get("file", "")
    log = open(f, encoding="utf-8").read() if f and os.path.exists(f) else ""
    return max((int(m) for m in re.findall(r"decision: D-(\d{3})\n\s+status: confirmed", log)), default=0)


def _refs(paths: list[str]) -> list[int]:
    text = "".join(open(x, encoding="utf-8", errors="ignore").read() for x in paths if os.path.isfile(x))
    return [int(x) for x in re.findall(r"\bD-(\d{3})", text)]


def _run_once(cmd: str, runner: Callable, cache: dict) -> tuple[int, str, list[str], float, bool]:
    """(終わり方, 最後の行, 赤の要点, 秒, 流したか)。同じ文字の命令は 1 回だけ流し、2 回目からは流さず秒を 0 にする（G27 の時間の内訳・K-156）"""
    if cmd in cache:
        return (*cache[cmd][:3], 0.0, False)
    if cmd not in cache:
        t0 = time.monotonic()
        r = runner(cmd, shell=True, capture_output=True, text=True, cwd=os.getcwd())
        out = ((r.stdout or "") + (r.stderr or "")).strip()
        note = out.splitlines()[-1][:120] if out else ""
        # 落ちた検査は、何が落ちたかを読めるように要点を残す（CI のログで最後の 1 行しか見えないと原因が追えない）
        detail = [ln for ln in out.splitlines() if re.search(r"FAIL|×|✗|Error|expected|AssertionError|★", ln) and "UTC [" not in ln][:40] if r.returncode else []
        cache[cmd] = (r.returncode, note, detail, time.monotonic() - t0)
    return (*cache[cmd], True)


def audit(cfg: dict, run: bool, runner: Callable | None = None) -> tuple[list[dict], int]:
    """(行, 赤の数)。run のときだけ check を流す（同じ文字は 1 回・elsewhere の層は流さない）"""
    runner = runner or _default_runner
    products = [p.get("file", "") for p in cfg.get("decision_traceability", {}).get("products", [])]   # glob はそのまま 1 層
    checks = {c["file"]: c for c in cfg.get("layer_checks", [])}
    latest = _latest(cfg)
    cache: dict = {}
    rows, bad = [], 0
    for f in sorted(set(products) | set(checks)):
        c = checks.get(f)
        paths = sorted(glob.glob(f)) if any(ch in f for ch in "*?[") else [f]
        exists = any(os.path.isfile(x) for x in paths)
        refs = _refs(paths) if exists else []
        newest = max(refs) if refs else 0
        row = {"file": f, "exists": exists, "newest_ref": f"D-{newest:03d}" if newest else "—", "latest": f"D-{latest:03d}",
               "kind": "", "result": "", "note": ""}
        if c and c.get("elsewhere"):
            gates = elsewhere_gates(c)
            row["kind"] = "別"
            row["elsewhere"] = c["elsewhere"]
            row["result"] = f"OK（{'・'.join(gates) or c['elsewhere']} の段で流す）"
            row["note"] = c.get("check", "")[:120]
        elif c and c.get("check"):
            row["kind"] = "機械"
            if run:
                rc, note, detail, sec, ran = _run_once(c["check"], runner, cache)
                row["sec"] = round(sec, 1)
                row["ran"] = ran
                row["result"] = "OK" if rc == 0 else "★ FAIL"
                row["note"] = note
                if rc:
                    row["detail"] = detail
                    bad += 1
            else:
                row["result"] = "（--run で実行）"
        elif c and "manual" in c:
            row["kind"] = "手"
            row["note"] = c.get("manual") or ""
            if not row["note"]:
                row["result"] = "★ manual の理由が無い"
                bad += 1
            elif newest and newest < latest:
                row["result"] = f"warn 古いかもしれない（最新の参照 D-{newest:03d} < 正本 D-{latest:03d}）"
            else:
                row["result"] = "OK（手で見る層）"
        else:
            row["kind"] = "無"
            row["result"] = "★ 検査が無い（layer_checks に check か manual か elsewhere を書く）"
            bad += 1
        rows.append(row)
    return rows, bad


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--map", default="spec-dependencies.yaml")
    ap.add_argument("--run", action="store_true", help="check を実行する（既定は一覧だけ）")
    ap.add_argument("--json", action="store_true")
    a = ap.parse_args()
    cfg = yaml.safe_load(open(a.map, encoding="utf-8"))
    rows, bad = audit(cfg, a.run)
    latest = _latest(cfg)
    if a.json:
        print(json.dumps({"pass": not bad, "latest": latest, "rows": rows}, ensure_ascii=False, indent=1))
    else:
        print(f"層の棚卸し {len(rows)} ファイル（正本の最新 confirmed: D-{latest:03d}）")
        for r in rows:
            sec = f'{r["sec"]:5.1f}s ' if "sec" in r else ""
            print(f'  {r["kind"]:2s} {r["result"]:<44s} {sec}{r["newest_ref"]:>6s}  {r["file"]}' + (f'  ← {r["note"]}' if r["note"] else ""))
            for d in r.get("detail", []):
                print(f"      │ {d[:300]}")
        if a.run:
            print(f"流した命令 {sum(1 for r in rows if r.get('ran'))}・合計 {sum(r.get('sec', 0) for r in rows):.1f} 秒（別の段で流す層 {sum(1 for r in rows if r['kind'] == '別')} は流していない）")
        print("PASS — G21 全部の層に検査（機械か理由つきの手か別の段）がある" if not bad else f"FAIL — G21 検査の無い層 {bad}")
    return 0 if not bad else 2


if __name__ == "__main__":
    sys.exit(main())
