#!/usr/bin/env python3
"""人が触って確かめるための Excel を出す（タブ＝チケット）。手順は 07_tasks/handoff/*.md から。

  python3 scripts/ci/build_qa_xlsx.py --handoff 07_tasks/handoff --tickets 07_tasks/tickets.json \
      --out 07_tasks/handoff/確認.xlsx [--read]

  --read を付けると、Excel の「結果」列を読んで handoff/*.md の末尾に OK:／NG: を書き戻す（op_gate.py が読む）。
最初のタブ「はじめに」に 立ち上げ・URL・注意・一覧。各タブに 手順（操作・期待・結果・気づいたこと）と「今はまだ押せないもの」。
プロジェクト名は持たない。
"""
from __future__ import annotations
import argparse, datetime as dt, json, os, re, sys

from openpyxl import Workbook, load_workbook
from openpyxl.styles import Alignment, Font, PatternFill
from openpyxl.utils import get_column_letter
from openpyxl.worksheet.datavalidation import DataValidation

HEAD = PatternFill("solid", fgColor="22345C")
HEADF = Font(color="FFFFFF", bold=True, size=11)
TITLE = Font(bold=True, size=14)
SUB = Font(color="6B7280", size=10)
WRAP = Alignment(wrap_text=True, vertical="top")
TOP = Alignment(vertical="top")
OKF = PatternFill("solid", fgColor="E6F4EA")
NGF = PatternFill("solid", fgColor="FBE9E7")


def parse(md: str) -> dict:
    """手順の .md を読む → {title, before[], steps[(操作, 期待)], later[], result}"""
    title = (re.search(r"^# (.+)$", md, re.M) or [None, ""])[1]
    def section(name: str) -> list[str]:
        m = re.search(rf"^## {name}\s*$(.+?)(?=^## |\Z)", md, re.M | re.S)
        return [x.rstrip() for x in (m.group(1).splitlines() if m else []) if x.strip()]
    before = [re.sub(r"^\d+\.\s*", "", x).strip() for x in section("その前に") if re.match(r"^\d+\.", x.strip())]
    steps = []
    for x in section("手順"):
        if not re.match(r"^\d+\.", x.strip()):
            continue
        t = re.sub(r"^\d+\.\s*", "", x.strip())
        act, _, exp = t.partition(" → ")
        steps.append((act.replace("**", "").strip(), exp.replace("**", "").strip()))
    later = [x.lstrip("- ").strip() for x in section("今はまだ押せないもの（理由つき・触らなくてよい）") if x.strip().startswith("-")]
    ok = re.search(r"^(OK|NG):\s*(.+)$", md, re.M)
    return {"title": title, "before": before, "steps": steps, "later": later,
            "result": (ok.group(1) + ": " + ok.group(2)) if ok else ""}


def head(ws, cols: list[tuple[str, int]], row: int = 1) -> None:
    for i, (name, w) in enumerate(cols, 1):
        c = ws.cell(row=row, column=i, value=name)
        c.fill, c.font, c.alignment = HEAD, HEADF, TOP
        ws.column_dimensions[get_column_letter(i)].width = w
    ws.freeze_panes = ws.cell(row=row + 1, column=1)


def tab_name(tid: str, title: str) -> str:
    return (tid + ' ' + re.sub(r'[\[\]:*?/\\]', '', title)[:20]).strip()[:31]


def write(a, order: list[tuple[str, dict]]) -> int:
    wb = Workbook()
    ws = wb.active
    ws.title = "はじめに"
    ws["A1"] = "Kaname ── 触って確かめる（dev・ローカル）"
    ws["A1"].font = TITLE
    ws["A2"] = f"作った日 {dt.date.today().isoformat()}　1 タブ＝1 チケット。手順を上から触って「結果」を選んでください。"
    ws["A2"].font = SUB
    rows = [
        ("立ち上げ", "ターミナルで `bash scripts/dev/up.sh` を実行する（DB → API → 画面が立つ。初回は 2 分ほど）"),
        ("画面", a.base),
        ("止める", "`bash scripts/dev/up.sh --stop`　／　今どうなっているか `bash scripts/dev/up.sh --status`"),
        ("メール", "送りません。確認・再設定のリンクは `.dev-logs/api.log` の「verify →」「reset →」の行をブラウザに貼ってください"),
        ("招待の URL", "`bash scripts/dev/invite.sh` で作れます（メンバーの画面ができるまでの代わり）"),
        ("まだ無いもの", "自分のPC（Bridge）と自分のAIの返答は未実装です。各タブの「今はまだ押せないもの」に理由つきで書いてあります"),
        ("結果の書き方", "各タブの「結果」列から OK／NG を選ぶ。NG なら「気づいたこと」に 1 行書く"),
        ("戻し方", "保存したら `python3 scripts/ci/build_qa_xlsx.py --read` を実行（チケットの状態に反映されます）"),
    ]
    for i, (k, v) in enumerate(rows, 4):
        ws.cell(row=i, column=1, value=k).font = Font(bold=True)
        ws.cell(row=i, column=2, value=v).alignment = WRAP
    ws.column_dimensions["A"].width = 16
    ws.column_dimensions["B"].width = 108
    r = 4 + len(rows) + 2
    ws.cell(row=r, column=1, value="触るもの（この順で）").font = TITLE
    head(ws, [("タブ", 30), ("画面", 22), ("URL", 44), ("手順の数", 9), ("状態", 14)], r + 1)
    ws.freeze_panes = "A2"
    for i, (tid, d) in enumerate(order, r + 2):
        ws.cell(row=i, column=1, value=tab_name(tid, d["short"])).alignment = TOP
        ws.cell(row=i, column=2, value=d["screen"]).alignment = TOP
        ws.cell(row=i, column=3, value=d["url"]).alignment = TOP
        ws.cell(row=i, column=4, value=len(d["p"]["steps"])).alignment = TOP
        c = ws.cell(row=i, column=5, value=d["p"]["result"].split(":")[0] if d["p"]["result"] else "未確認")
        c.alignment = TOP
        if c.value == "OK":
            c.fill = OKF
        elif c.value == "NG":
            c.fill = NGF

    for tid, d in order:
        p = d["p"]
        s = wb.create_sheet(tab_name(tid, d["short"]))
        s["A1"] = f"{tid}　{p['title'].split(' ', 1)[-1]}"
        s["A1"].font = TITLE
        s["A2"] = d["url"]
        s["A2"].font = SUB
        row = 4
        if p["before"]:
            s.cell(row=row, column=1, value="その前に").font = Font(bold=True)
            for b in p["before"]:
                row += 1
                s.cell(row=row, column=1, value="・" + b).alignment = WRAP
            row += 2
        head(s, [("#", 5), ("何をする", 62), ("こうなれば OK", 52), ("結果", 12), ("気づいたこと", 44)], row)
        dv = DataValidation(type="list", formula1='"未確認,OK,NG"', allow_blank=True)
        s.add_data_validation(dv)
        first = row + 1
        for i, (act, exp) in enumerate(p["steps"], 1):
            rr = first + i - 1
            s.cell(row=rr, column=1, value=i).alignment = TOP
            s.cell(row=rr, column=2, value=act).alignment = WRAP
            s.cell(row=rr, column=3, value=exp).alignment = WRAP
            c = s.cell(row=rr, column=4, value="未確認")
            c.alignment = TOP
            dv.add(c)
            s.cell(row=rr, column=5, value="").alignment = WRAP
            s.row_dimensions[rr].height = 30
        s.freeze_panes = s.cell(row=first, column=1)
        if p["later"]:
            rr = first + len(p["steps"]) + 2
            s.cell(row=rr, column=1, value="今はまだ押せないもの（触らなくてよい）").font = Font(bold=True)
            for j, x in enumerate(p["later"], 1):
                s.cell(row=rr + j, column=1, value="・" + x).alignment = WRAP
    os.makedirs(os.path.dirname(a.out) or ".", exist_ok=True)
    wb.save(a.out)
    print(f"Excel → {a.out}（タブ {len(order) + 1}・チケット {len(order)}）")
    return 0


def read_back(a, order: list[tuple[str, dict]]) -> int:
    wb = load_workbook(a.out)
    n = 0
    for tid, d in order:
        name = tab_name(tid, d["short"])
        if name not in wb.sheetnames:
            continue
        s = wb[name]
        got = []
        for row in s.iter_rows(min_col=1, max_col=5):
            if isinstance(row[0].value, int) and row[3].value in ("OK", "NG"):
                got.append((row[0].value, row[3].value, row[4].value or ""))
        if not got or len(got) < len(d["p"]["steps"]):
            print(f"  - {tid}: {len(got)}/{len(d['p']['steps'])} 行（全部埋まってから書き戻します）")
            continue
        ng = [(i, note) for i, v, note in got if v == "NG"]
        fp = os.path.join(a.handoff, f"{tid}.md")
        md = open(fp, encoding="utf-8").read()
        md = re.sub(r"\n(OK|NG):.*$", "", md.rstrip()) + "\n"
        line = (f"NG: " + "／".join(f"手順 {i} {note}".strip() for i, note in ng)) if ng else f"OK: {dt.date.today().isoformat()} {a.by}"
        open(fp, "w", encoding="utf-8").write(md + line + "\n")
        n += 1
        print(f"  {tid}: {line[:70]}")
    print(f"書き戻した {n} 本 → {a.handoff}")
    return 0


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--handoff", default="07_tasks/handoff")
    ap.add_argument("--tickets", default="07_tasks/tickets.json")
    ap.add_argument("--screens", default="07_functional/screens.json")
    ap.add_argument("--out", default="07_tasks/handoff/確認.xlsx")
    ap.add_argument("--base", default="http://127.0.0.1:3124")
    ap.add_argument("--by", default="高本")
    ap.add_argument("--read", action="store_true")
    a = ap.parse_args()
    S = {s["id"]: s for s in json.load(open(a.screens, encoding="utf-8"))["items"]}
    pos = {sid: i for i, sid in enumerate(S)}
    T = json.load(open(a.tickets, encoding="utf-8"))["tasks"]
    done = [t for t in T if t.get("status") == "done" and t.get("deliverable_layer") in ("ui", "integration")]
    order: list[tuple[str, dict]] = []
    for t in sorted(done, key=lambda t: (t["deliverable_layer"] != "ui", bool(not t.get("screen_ids")), pos.get((t.get("screen_ids") or [""])[0], 999))):
        fp = os.path.join(a.handoff, f"{t['id']}.md")
        if not os.path.exists(fp):
            continue
        p = parse(open(fp, encoding="utf-8").read())
        if not p["steps"]:
            continue
        sid = (t.get("screen_ids") or [None])[0]
        order.append((t["id"], {"p": p, "short": S.get(sid, {}).get("name") or t["title"],
                                "screen": S.get(sid, {}).get("name", "（土台・通し）"),
                                "url": a.base + (S.get(sid, {}).get("route") or "")}))
    return read_back(a, order) if a.read else write(a, order)


if __name__ == "__main__":
    sys.exit(main())
