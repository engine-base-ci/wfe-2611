#!/usr/bin/env python3
"""発注者確認の手順（Rule 12）を操作要素の一覧から機械で出す。

  python3 scripts/ci/gen_handoff.py --tickets 07_tasks/tickets.json --screens 07_functional/screens.json --ops 07_qa/test-specs/ops --out 07_tasks/handoff [--task T-U-05 …] [--base http://localhost:3123]

1 タスク＝1 ファイル（5〜10 手順・15〜30 分）。発注者が触って OK なら末尾に「OK: YYYY-MM-DD 名前」を書く。op_gate.py の O3 がそれを読む。
既にある手順ファイルの「OK:」の行は残す（再生成で消さない）。プロジェクト名は持たない。
"""
from __future__ import annotations
import argparse, json, os, re, sys

KIND_JA = {"button": "押す", "link": "押す", "input": "入れる", "checkbox": "切り替える", "select": "選ぶ", "textarea": "入れる", "tab": "押す", "toggle": "開く", "error": "わざと起こす", "radio": "選ぶ"}


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--tickets", required=True); ap.add_argument("--screens", required=True); ap.add_argument("--ops", required=True); ap.add_argument("--out", required=True)
    ap.add_argument("--task", action="append", default=[]); ap.add_argument("--base", default="http://localhost:3123")
    a = ap.parse_args()
    S = {s["id"]: s for s in json.load(open(a.screens, encoding="utf-8"))["items"]}
    tasks = json.load(open(a.tickets, encoding="utf-8"))["tasks"]
    os.makedirs(a.out, exist_ok=True)
    n = 0
    for t in tasks:
        if a.task and t["id"] not in a.task:
            continue
        sids = t.get("screen_ids") or []
        if not sids and not t["id"].startswith("T-US-"):
            continue
        steps = []
        for sid in sids:
            s = S.get(sid, {}); op = os.path.join(a.ops, f"{sid}.json")
            ops = json.load(open(op, encoding="utf-8"))["ops"] if os.path.exists(op) else []
            steps.append(f"ブラウザで {a.base}{s.get('route', '/' + sid)} を開く（{s.get('name', sid)}）。見出しが「{s.get('h1_text', '')}」で、横にスクロールしないことを見る")
            seen = set()
            order = {"input": 0, "textarea": 0, "checkbox": 1, "radio": 1, "select": 1, "button": 2, "tab": 3, "toggle": 3, "link": 4, "error": 5}
            ops = sorted(ops, key=lambda o: ("" if o["states"][0] == "共通" else o["states"][0], order.get(o["kind"], 9)))   # 入れる → 押す → 開く → わざと起こす の順（状態ごと）
            for o in ops:
                k = (o["kind"], o["label"])
                if k in seen: continue
                seen.add(k)
                if o["kind"] == "error":
                    steps.append(f"わざと「{o['label'][:24]}…」になる操作をして、その文言と直す導線が出るのを見る")
                elif o["kind"] == "link":
                    steps.append(f"「{o['label']}」を押して {('/' + o['target']) if o.get('target') else 'リンク先'} が開くのを見て、戻る")
                else:
                    steps.append(f"「{o['label']}」を{KIND_JA.get(o['kind'], '押す')}。結果（画面が変わる・保存される・数字が変わる）が出るのを見る")
        if t["id"].startswith("T-US-"):
            steps.append(f"ブラウザで {a.base}/dev/shell を開き、役割と時点を切り替えてサイドバー・下タブ・AI のパネルの項目を全部押す")
        if not steps:
            continue
        fp = os.path.join(a.out, f"{t['id']}.md")
        oks = [ln.rstrip("\n") for ln in open(fp, encoding="utf-8")] if os.path.exists(fp) else []
        oks = [x for x in oks if re.match(r"^OK:\s*\d{4}-\d{2}-\d{2}\s+\S+", x)]
        body = [f"# {t['id']} {t['title']} — 発注者確認の手順（Rule 12・機械生成）", "", f"> 所要 15〜30 分。1 手順ずつ触り、違えば「NG: 何が違うか」を末尾に書く。全部よければ末尾に `OK: YYYY-MM-DD 名前` を書く（op_gate.py が読む）。", "", "## 手順", ""]
        body += [f"{i}. {st}" for i, st in enumerate(steps, 1)]
        body += ["", "## 結果", ""] + (oks or ["（未確認）"])
        open(fp, "w", encoding="utf-8").write("\n".join(body) + "\n"); n += 1
    print(f"手順 {n} 本 → {a.out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
