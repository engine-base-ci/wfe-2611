#!/usr/bin/env python3
"""テスト仕様書を「チケットごと」の表計算（.xlsx）にする（2026-10-01 user「チケット単位でちゃんとテスト」「スプレッドシートで」）。

  python3 scripts/ci/build_test_xlsx.py [--spec 07_qa/test-specs] [--tickets 07_tasks/tickets.json] [--out 07_qa/xlsx/テスト仕様書.xlsx]

- 正本は 07_qa/test-specs/**/*.md（ID は変えない）。行とチケットの対応は tickets.json の qa_rows.l1（1 行が複数のチケットに属することがある）
- 「もう無い行」の表（末尾）は載せない
- タブ：概要（チケットごとの数）＋ グループごと（土台・データ・API・Bridge・画面・共通の画面・結線・段階 2・スキル）。
  各タブはチケットの見出し行 → そのチケットの行。確かめ方（実ブラウザ／API・DB の試験／判定／手で触る）と結果を色で分ける
- 手で作らない。正本を直したらこれを流し直す
"""
from __future__ import annotations

import argparse
import glob
import json
import os
import re
import sys

try:
    from openpyxl import Workbook
    from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
    from openpyxl.utils import get_column_letter
except ImportError:
    sys.exit("openpyxl が要る: pip3 install --break-system-packages openpyxl")

ID_RE = re.compile(r"^[A-Z][A-Z0-9-]*-\d{3}(-[ABC])?$")
GROUPS = [("F", "土台"), ("D", "データ"), ("A", "API"), ("B", "Bridge・自分のAI"), ("US", "共通の画面"), ("U", "画面"), ("I", "結線・流れ"), ("V2", "段階2の仕様"), ("S", "スキル")]
HEAD = ["チケット", "ID", "確かめ方", "画面", "テスト観点", "テスト項目", "前提条件", "操作手順", "期待結果", "結果", "備考", "実行条件"]
WIDTH = [11, 22, 12, 14, 16, 46, 26, 34, 40, 30, 30, 10]

FILL = {k: PatternFill("solid", fgColor=v) for k, v in {
    "pass": "E4F1EA", "fail": "F8E9E6", "blocked": "FFF4DC", "na": "EEEEEE", "blank": "FFFFFF", "desc": "F2EEF8", "head": "2F5FA8", "ticket": "EAF0FA"}.items()}
THIN = Side(style="thin", color="D8D6D0")
BORDER = Border(left=THIN, right=THIN, top=THIN, bottom=THIN)


def load_rows(spec: str) -> dict[str, list[str]]:
    rows: dict[str, list[str]] = {}
    for fp in sorted(glob.glob(os.path.join(spec, "**", "*.md"), recursive=True)):
        now = True
        for ln in open(fp, encoding="utf-8"):
            if ln.startswith("## もう無い行"):
                now = False
            if not now or not ln.startswith("| "):
                continue
            c = [x.strip() for x in ln.strip().strip("|").split("|")]
            if len(c) >= 11 and ID_RE.match(c[0]):
                rows[c[0]] = c[:11]
    return rows


def state(result: str) -> str:
    """結果 → 区分（色と数に使う）"""
    if result.startswith("PASS") and ("実 Chrome" in result or "vitest" in result):
        return "pass"
    if result.startswith("PASS"):
        return "desc"      # 説明文だけの PASS（試験の証拠が無い）
    if result.startswith("BLOCKED"):
        return "blocked"
    if result.startswith("N/A"):
        return "na"
    if result == "":
        return "blank"
    return "fail"


def how(rid: str, view: str, result: str) -> str:
    """何で確かめるか（確かめた結果があればそれ、無ければ行の種類から）"""
    if "実 Chrome" in result:
        return "実ブラウザ"
    if "vitest" in result:
        return "API・DB の試験"
    if rid.startswith("API-"):
        return "API の試験"
    if rid.startswith("RLS-"):
        return "DB の試験"
    if re.match(r"G-1\d", view):
        return "判定"
    if view == "発注者確認":
        return "手で触る"
    return "実ブラウザ"


def group_of(tid: str) -> str:
    m = re.match(r"T-([A-Z0-9]+)-", tid)
    return m.group(1) if m else "?"


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--spec", default="07_qa/test-specs")
    ap.add_argument("--tickets", default="07_tasks/tickets.json")
    ap.add_argument("--out", default="07_qa/xlsx/テスト仕様書.xlsx")
    a = ap.parse_args()
    rows = load_rows(a.spec)
    T = json.load(open(a.tickets, encoding="utf-8"))["tasks"]

    wb = Workbook()
    ov = wb.active
    ov.title = "概要"
    ov.append(["Kaname テスト仕様書（チケットごと）"])
    ov.append(["正本は 07_qa/test-specs/**/*.md。チケットの行は tickets.json の qa_rows.l1。通過＝行 ID を名前に持つ試験が実ブラウザか API・DB で通ったものだけ。説明文＝前の回に文で書いた PASS（試験の証拠なし）"])
    ov.append([])
    cols = ["チケット", "名前", "状態", "層", "行", "通過", "未通過", "BLOCKED（まだ作っていない）", "N/A", "空欄", "説明文の PASS", "うち実ブラウザ", "うち API・DB"]
    ov.append(cols)
    for i, _ in enumerate(cols, 1):
        ov.cell(row=4, column=i).font = Font(bold=True, color="FFFFFF")
        ov.cell(row=4, column=i).fill = FILL["head"]

    sheets = {}
    for g, name in GROUPS:
        ws = wb.create_sheet(name)
        ws.append(HEAD)
        for i, w in enumerate(WIDTH, 1):
            ws.column_dimensions[get_column_letter(i)].width = w
            ws.cell(row=1, column=i).font = Font(bold=True, color="FFFFFF")
            ws.cell(row=1, column=i).fill = FILL["head"]
        ws.freeze_panes = "C2"
        sheets[g] = ws

    total = {}
    for t in T:
        ids = [i for i in (t.get("qa_rows") or {}).get("l1", []) if i in rows]
        g = group_of(t["id"])
        ws = sheets.get(g)
        cnt = {k: 0 for k in ("pass", "fail", "blocked", "na", "blank", "desc")}
        chrome = api = 0
        for i in ids:
            r = rows[i]
            s = state(r[7])
            cnt[s] += 1
            chrome += s == "pass" and "実 Chrome" in r[7]
            api += s == "pass" and "vitest" in r[7]
        for k, v in cnt.items():
            total[k] = total.get(k, 0) + v
        ov.append([t["id"], t["title"][:60], t.get("status", ""), t.get("deliverable_layer", ""), len(ids), cnt["pass"], cnt["fail"], cnt["blocked"], cnt["na"], cnt["blank"], cnt["desc"], chrome, api])
        if ws is None or not ids:
            continue
        ws.append([t["id"], f"{t['title'][:80]}（{t.get('status', '')}・{len(ids)} 行・通過 {cnt['pass']}・未通過 {cnt['fail']}・まだ {cnt['blocked']}・空欄 {cnt['blank']}）"])
        for c in range(1, len(HEAD) + 1):
            ws.cell(row=ws.max_row, column=c).fill = FILL["ticket"]
            ws.cell(row=ws.max_row, column=c).font = Font(bold=True)
        for i in ids:
            r = rows[i]
            ws.append([t["id"], r[0], how(r[0], r[2], r[7]), r[1], r[2], r[3], r[4], r[5], r[6], r[7], r[8], r[10]])
            fill = FILL[state(r[7])]
            for c in range(1, len(HEAD) + 1):
                cell = ws.cell(row=ws.max_row, column=c)
                cell.alignment = Alignment(wrap_text=True, vertical="top")
                cell.border = BORDER
            ws.cell(row=ws.max_row, column=10).fill = fill
    ov.append([])
    ov.append(["合計", "", "", "", sum(total.values()), total.get("pass", 0), total.get("fail", 0), total.get("blocked", 0), total.get("na", 0), total.get("blank", 0), total.get("desc", 0)])
    for i, w in enumerate([11, 50, 9, 12, 7, 7, 8, 14, 6, 6, 10, 10, 10], 1):
        ov.column_dimensions[get_column_letter(i)].width = w
    ov.freeze_panes = "C5"
    os.makedirs(os.path.dirname(a.out), exist_ok=True)
    wb.save(a.out)
    print(f"テスト仕様書 → {a.out}（チケット {len(T)}・行 {sum(total.values())}：通過 {total.get('pass', 0)}・未通過 {total.get('fail', 0)}・まだ {total.get('blocked', 0)}・N/A {total.get('na', 0)}・空欄 {total.get('blank', 0)}・説明文 {total.get('desc', 0)}）")
    return 0


if __name__ == "__main__":
    sys.exit(main())
