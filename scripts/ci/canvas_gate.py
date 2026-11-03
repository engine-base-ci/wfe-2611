#!/usr/bin/env python3
"""canvas_gate.py — 画面デザインのキャンバスの写し（04_design/canvas・D-128.23）の検査。前の画面の見本（06_mockup v1・v2）をしまってからの正（D-128.117）。
 CV1 canvas.json の boards と .dc.html のファイルが 1 対 1（写し忘れ・消し忘れが無い）
 CV2 boards の page が pages にある
 CV3 製品名は半角の Kaname だけ（「かなめ」「製品名：要」を使わない・AD-011 と同じ）"""
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
print(f"キャンバスの画面 {len(files)} ／ ページ {len(pages)}")
for k, x in fails: print(f"  ★ [{k}] {x}")
print("PASS — CV1〜CV3 すべて緑" if not fails else f"FAIL — {len(fails)} 件"); sys.exit(0 if not fails else 2)
