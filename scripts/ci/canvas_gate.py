#!/usr/bin/env python3
"""canvas_gate.py — 画面デザインのキャンバスの写し（04_design/canvas・D-128.23）の検査。前の画面の見本（06_mockup v1・v2）をしまってからの正（D-128.117）。
 CV1 canvas.json の boards と .dc.html のファイルが 1 対 1（写し忘れ・消し忘れが無い）
 CV2 boards の page が pages にある
 CV3 製品名は半角の Kaname だけ（「かなめ」「製品名：要」を使わない・AD-011 と同じ）
 CV4 第1フェーズの画面（flow.json の release v1）に、どれもキャンバスの絵がある。絵はどれも、どれか 1 つの画面か共通に入る
     （対応表 04_design/canvas-screens.json・K-45。ここが無いと、画面に絵があるかを誰も見ていなかった）"""
import glob, json, os, re, sys
D = "04_design/canvas"
C = json.load(open(f"{D}/canvas.json", encoding="utf-8"))
files = {os.path.basename(p) for p in glob.glob(f"{D}/*.dc.html")}
boards = set(C["boards"])
pages = {p["id"] for p in C["pages"]}
fails = []
if boards - files: fails.append(("CV1", f"ファイルの無い board {sorted(boards - files)[:6]}"))
if files - boards: fails.append(("CV1", f"board の無いファイル {sorted(files - boards)[:6]}"))
m = sorted(k for k, b in C["boards"].items() if b.get("page") not in pages)
if m: fails.append(("CV2", f"page が無い board {m[:6]}"))
m = sorted(f for f in files if re.search(r"かなめ|製品名[：:]\s*要", open(f"{D}/{f}", encoding="utf-8").read()))
if m: fails.append(("CV3", f"製品名に「かなめ」を使っている {m[:6]}"))
MAP = "04_design/canvas-screens.json"
if not os.path.exists(MAP):
    fails.append(("CV4", f"画面とキャンバスの絵の対応表 {MAP} が無い"))
else:
    import collections
    mp = json.load(open(MAP, encoding="utf-8"))
    v1 = {x["id"] for x in json.load(open("05_flow/flow.json", encoding="utf-8"))["screens"] if x.get("release") == "v1"}
    scr = mp.get("screens", {})
    names = {f.replace(".dc.html", "") for f in files}
    every = [b for v in scr.values() for b in v] + list(mp.get("common", {}).get("boards", []))
    # キャンバスの絵が無く、正が本番と同じ部品で作ったモック（段 2 の /dev/mock）の画面は、理由つきで mock_only に載せる（K-315）
    mock_only = {k for k, v in mp.get("mock_only", {}).items() if isinstance(v, str) and v.strip()}
    nob = sorted(v1 - mock_only - {k for k, v in scr.items() if v})
    if nob: fails.append(("CV4", f"絵の無い画面 {nob[:8]}"))
    if set(scr) - v1: fails.append(("CV4", f"flow の第1フェーズに無い画面 {sorted(set(scr) - v1)[:8]}"))
    if names - set(every): fails.append(("CV4", f"どの画面にも共通にも入っていない絵 {sorted(names - set(every))[:8]}"))
    if set(every) - names: fails.append(("CV4", f"対応表にあるのにキャンバスに無い絵 {sorted(set(every) - names)[:8]}"))
    dup = sorted(b for b, n in collections.Counter(every).items() if n > 1)
    if dup: fails.append(("CV4", f"2 か所に入っている絵 {dup[:8]}"))
print(f"キャンバスの画面 {len(files)} ／ ページ {len(pages)}")
for k, x in fails: print(f"  ★ [{k}] {x}")
print("PASS — CV1〜CV4 すべて緑" if not fails else f"FAIL — {len(fails)} 件"); sys.exit(0 if not fails else 2)
