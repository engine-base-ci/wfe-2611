#!/usr/bin/env python3
"""leave_gate.py — 「抜ける・退会・停止」の画面が、製品の全オブジェクトについて「何が起きるか」を持っているか。

なぜ必要か（2026-09-15・user「退会時の依存とかちゃんと徹底しているよね？」）
  退会の画面に「消えるもの 4 つ・残るもの 2 つ」だけを書いていた。flow.json のオブジェクトは 39 あり、
  タスク（行き先のないものへ）・承認待ち（承認者が 1 人なら止まる）・託されたAI社員（返す）・層の長（再指定）…は
  1 つも書かれていなかった。列挙は漏れる。だからオブジェクトの集合と機械で突き合わせる。

検査
  --screens で指定した各画面のモック HTML に、flow.json の objects[].name ごとに
    data-leave="<オブジェクト名>"     … 何が起きるかを書いた行
    data-leave-na="<オブジェクト名>"  … この出来事では関係ない、と理由つきで書いた行
  のどちらかがあること。無いオブジェクトがあれば FAIL。

使い方
  python3 leave_gate.py --flow 05_flow/flow.json --mocks 06_mockup/v1 --screens account-close member-detail [--prefix v1-]
"""
from __future__ import annotations
import argparse, json, re, sys
from pathlib import Path

def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--flow", required=True); ap.add_argument("--mocks", required=True); ap.add_argument("--screens", nargs="+", required=True); ap.add_argument("--prefix", default="v1-")
    ap.add_argument("--event", help="flow.json の account_events の id。指定すると data-event がその id の行だけを数える（1 画面に複数の出来事の表を置ける）")
    a = ap.parse_args()
    objs = [o["name"] for o in json.load(open(a.flow, encoding="utf-8"))["objects"]]
    bad = 0
    for sid in a.screens:
        p = Path(a.mocks) / f"{a.prefix}{sid}.html"
        if not p.exists(): print(f"  ★ {sid}: モックが無い"); bad += 1; continue
        h = p.read_text(encoding="utf-8")
        if a.event:
            have = set(re.findall(r'data-leave="([^"]+)"[^>]*data-event="' + re.escape(a.event) + '"', h)) | set(re.findall(r'data-leave-na="([^"]+)"[^>]*data-event="' + re.escape(a.event) + '"', h))
            have |= set(re.findall(r'data-event="' + re.escape(a.event) + r'"[^>]*data-leave="([^"]+)"', h))
        else:
            have = set(re.findall(r'data-leave="([^"]+)"', h)) | set(re.findall(r'data-leave-na="([^"]+)"', h))
        miss = [o for o in objs if o not in have]
        extra = sorted(x for x in have if x not in objs)
        print(f"{sid}: オブジェクト {len(objs)} / 書いてある {len(objs) - len(miss)}" + (f" / 無い {len(miss)}: {', '.join(miss)}" if miss else "") + (f" / 未知: {', '.join(extra)}" if extra else ""))
        bad += len(miss) + len(extra)
    print("PASS — 抜ける・退会の依存は全オブジェクトぶん書いてある" if not bad else f"FAIL — 書いていないオブジェクト {bad}")
    return 0 if not bad else 2

if __name__ == "__main__": sys.exit(main())
