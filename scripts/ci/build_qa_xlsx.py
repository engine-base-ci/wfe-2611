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
from openpyxl.formatting.rule import CellIsRule
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
    ok = next((m for m in re.finditer(r"^(OK|NG):\s*(.+)$", md, re.M) if "YYYY" not in m.group(2)), None)   # 書き方の見本「OK: YYYY-MM-DD 名前」は答えではない
    return {"title": title, "before": before, "steps": steps, "later": later,
            "result": (ok.group(1) + ": " + ok.group(2)) if ok else ""}


def head(ws, cols: list[tuple[str, int]], row: int = 1) -> None:
    for i, (name, w) in enumerate(cols, 1):
        c = ws.cell(row=row, column=i, value=name)
        c.fill, c.font, c.alignment = HEAD, HEADF, TOP
        ws.column_dimensions[get_column_letter(i)].width = w
    ws.freeze_panes = ws.cell(row=row + 1, column=1)


KEEP_TABS: dict[str, str] = {}   # 前の Excel にあったタブの名前（チケット ID → 名前）。名前を変えると人の付けた印・リンクが切れる


def tab_name(tid: str, title: str) -> str:
    if tid in KEEP_TABS:
        return KEEP_TABS[tid]
    return (tid + ' ' + re.sub(r'[\[\]:*?/\\]', '', title)[:20]).strip()[:31]


def prev_widths(path: str) -> dict[str, dict[str, float]]:
    """前に渡した Excel の列幅を (タブ名 → 列 → 幅) で読む。人が広げた幅を作り直しでつぶさない"""
    if not os.path.exists(path):
        return {}
    try:
        wb = load_workbook(path)
    except Exception:
        return {}
    out: dict[str, dict[str, float]] = {}
    for name in wb.sheetnames:
        w = {k: d.width for k, d in wb[name].column_dimensions.items() if d.width}
        if w:
            out[name] = w
    return out


def apply_widths(ws, keep: dict[str, dict[str, float]]) -> None:
    for col, w in (keep.get(ws.title) or {}).items():
        ws.column_dimensions[col].width = w


def prev_answers(path: str) -> dict[tuple[str, str], tuple[str, str]]:
    """前に渡した Excel に書かれた答えを (タブ名, 何をする) で引けるようにする。
    作り直すたびに人が書いた OK／NG と気づいたことが消えるのを防ぐ（正本の行は ID を変えない・test-ladder §9 と同じ考え）"""
    if not os.path.exists(path):
        return {}
    try:
        wb = load_workbook(path)
    except Exception:
        return {}
    out: dict[tuple[str, str], tuple[str, str]] = {}
    for name in wb.sheetnames:
        s = wb[name]
        for row in s.iter_rows(min_col=1, max_col=5):
            act = row[1].value
            res = row[3].value
            note = row[4].value
            if isinstance(row[0].value, (int, float)) and isinstance(act, str) and act.strip():   # Google の書き出しは番号が 1.0
                if (res and res != "未確認") or note:
                    out[(name, act.strip())] = (str(res or "未確認"), str(note or ""))
    return out


def bare(act: str) -> str:
    """手順の言い方のゆれ（「（状態：…）」の有無）を除いた形。答えを引き継ぐときだけ使う"""
    return re.sub(r"（状態：[^）]*）", "", act).strip()


def write(a, order: list[tuple[str, dict]]) -> int:
    if os.path.exists(a.out):   # 前からあるチケットのタブは、前の名前のまま（2026-10-01）
        from openpyxl import load_workbook as _lw
        for _n in _lw(a.out, read_only=True).sheetnames:
            _m = re.match(r"^(T-[A-Z0-9]+-\d+) ", _n)
            if _m:
                KEEP_TABS[_m.group(1)] = _n
    keep = prev_answers(a.out)
    # 言い方が少し変わった手順にも答えを引き継ぐ（同じタブで、ゆれを除いた形が 1 つに決まるときだけ）
    _cnt: dict = {}
    for (tab, act) in keep:
        _cnt[(tab, bare(act))] = _cnt.get((tab, bare(act)), 0) + 1
    loose = {(tab, bare(act)): v for (tab, act), v in keep.items() if _cnt[(tab, bare(act))] == 1}
    widths = prev_widths(a.out)
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
        ("メール", "実際に送ります（Resend・差出人は noreply@engine-base.com）。送信ドメインは検証済みなので、どの宛先にも届きます。送れなかったときは `.dev-logs/api.log` に「[mail] 送れなかった → …」と理由が出ます"),
        ("運営の宛先", "運営（ENGINE BASE）は info@engine-base.com。問い合わせの届け先と運営アカウントのログイン名はこれです"),
        ("届かないとき", a.base + "/dev/mail を開くと、送ったリンクが並んでいます。そこから押せば先へ進めます（ローカルで確かめるためだけの画面）"),
        ("招待の URL", "`bash scripts/dev/invite.sh` で作れます（メンバーの画面ができるまでの代わり）"),
        ("自分のPC（Bridge）", "本物で動きます。「自分のPCをつなぐ」の画面から Kaname Bridge を受け取って入れ、つないでください（入っていれば自動で新しい版に上がります）。自分のAI は、その PC の本物の Claude Code で答えます"),
        ("まだ無いもの", "まだ作っていないものは、各タブの下の「今はまだ押せないもの」に理由つきで書いてあります。触らなくて大丈夫です"),
        ("結果の書き方", "各タブの「結果」列から OK／NG を選ぶ。NG なら「気づいたこと」に 1 行書く"),
        ("戻し方", "保存したら `python3 scripts/ci/build_qa_xlsx.py --read` を実行（チケットの状態に反映されます）"),
    ]
    for i, (k, v) in enumerate(rows, 4):
        ws.cell(row=i, column=1, value=k).font = Font(bold=True)
        ws.cell(row=i, column=2, value=v).alignment = WRAP
    ws.column_dimensions["A"].width = 14
    ws.column_dimensions["B"].width = 96
    r = 4 + len(rows) + 2
    ws.cell(row=r, column=1, value="触るもの（この順で）").font = TITLE
    head(ws, [("タブ", 28), ("画面", 20), ("URL", 40), ("手順", 6), ("状態", 10)], r + 1)
    ws.freeze_panes = "A2"
    for i, (tid, d) in enumerate(order, r + 2):
        ws.cell(row=i, column=1, value=tab_name(tid, d["short"])).alignment = TOP
        ws.cell(row=i, column=2, value=d["screen"]).alignment = TOP
        ws.cell(row=i, column=3, value=d["url"]).alignment = TOP
        ws.cell(row=i, column=4, value=len(d["p"]["steps"])).alignment = TOP
        # 状態は、そのタブに書かれた答えから出す（全部 OK＝OK・NG が 1 つでも＝NG・一部＝途中）。無ければ手順ファイルの OK:／NG:
        _ans = [(keep.get((tab_name(tid, d["short"]), act.strip())) or loose.get((tab_name(tid, d["short"]), bare(act))) or ("未確認", ""))[0] for act, _ in d["p"]["steps"]]
        _st = ("NG" if "NG" in _ans else "OK" if _ans and all(x == "OK" for x in _ans) else f"途中 {sum(x == 'OK' for x in _ans)}/{len(_ans)}" if any(x == "OK" for x in _ans)
               else (d["p"]["result"].split(":")[0] if d["p"]["result"] else "未確認"))
        c = ws.cell(row=i, column=5, value=_st)
        c.alignment = TOP
        if c.value == "OK":
            c.fill = OKF
        elif c.value == "NG":
            c.fill = NGF
    apply_widths(ws, widths)   # 既定を置き終えてから、人が広げた幅を戻す

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
                c = s.cell(row=row, column=1, value="・" + b); c.alignment = WRAP; s.merge_cells(start_row=row, start_column=1, end_row=row, end_column=5)
            row += 2
        head(s, [("#", 4), ("何をする", 56), ("こうなれば OK", 46), ("結果", 10), ("気づいたこと", 38)], row)
        dv = DataValidation(type="list", formula1='"未確認,OK,NG"', allow_blank=True)
        s.add_data_validation(dv)
        first = row + 1
        for i, (act, exp) in enumerate(p["steps"], 1):
            rr = first + i - 1
            s.cell(row=rr, column=1, value=i).alignment = TOP
            s.cell(row=rr, column=2, value=act).alignment = WRAP
            s.cell(row=rr, column=3, value=exp).alignment = WRAP
            res, note = keep.get((s.title, act.strip())) or loose.get((s.title, bare(act)), ("未確認", ""))
            c = s.cell(row=rr, column=4, value=res)
            c.alignment = TOP
            dv.add(c)
            s.cell(row=rr, column=5, value=note).alignment = WRAP
        s.freeze_panes = s.cell(row=first, column=1)
        last = first + len(p["steps"]) - 1
        if p["steps"]:
            rng = f"D{first}:D{last}"
            s.conditional_formatting.add(rng, CellIsRule(operator="equal", formula=['"OK"'], fill=OKF))
            s.conditional_formatting.add(rng, CellIsRule(operator="equal", formula=['"NG"'], fill=NGF))
        s.auto_filter.ref = f"A{row}:E{last if p["steps"] else row}"
        apply_widths(s, widths)
        if p["later"]:
            rr = first + len(p["steps"]) + 2
            s.cell(row=rr, column=1, value="今はまだ押せないもの（触らなくてよい）").font = Font(bold=True)
            for j, x in enumerate(p["later"], 1):
                c = s.cell(row=rr + j, column=1, value="・" + x); c.alignment = WRAP; s.merge_cells(start_row=rr + j, start_column=1, end_row=rr + j, end_column=5)
    os.makedirs(os.path.dirname(a.out) or ".", exist_ok=True)
    wb.save(a.out)
    print(f"Excel → {a.out}（タブ {len(order) + 1}・チケット {len(order)}・引き継いだ 答え {len(keep)} 行／幅 {sum(len(v) for v in widths.values())} 列）")
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
    done = pick_tickets(T)
    order: list[tuple[str, dict]] = []
    for t in sorted(done, key=lambda t: (t["deliverable_layer"] != "ui", bool(not t.get("screen_ids")), pos.get((t.get("screen_ids") or [""])[0], 999))):
        fp = os.path.join(a.handoff, f"{t['id']}.md")
        if not os.path.exists(fp):
            continue
        p = parse(open(fp, encoding="utf-8").read())
        if not p["steps"]:
            continue
        sid = (t.get("screen_ids") or [None])[0]
        # タブの名前：画面のチケットは画面の名前、裏側のチケット（Bridge・会話の動き）は中身の頭（同じ画面の名前が並んで区別できなかった）
        _short = (S.get(sid, {}).get("name") if t["id"].startswith("T-U-") else None) or re.split(r"[（(]", t["title"])[0].strip() or t["title"]
        order.append((t["id"], {"p": p, "short": _short,
                                "screen": S.get(sid, {}).get("name", "（土台・通し）"),
                                "url": a.base + (S.get(sid, {}).get("route") or "")}))
    return read_back(a, order) if a.read else write(a, order)


def pick_tickets(T: list[dict], spec: str = "07_qa/test-specs") -> list[dict]:
    """触って確かめるチケット：完了にした画面・流れのチケット ＋ 作り終わっていて実ブラウザで押した証拠がある（完了の印はまだの）チケット。
    確認表のページ（build_qa_artifact.py）と同じ選び方（2026-10-01：会話・Bridge のチケットが表に出ていなかった）"""
    import glob as _g
    proof = set()
    for fp in _g.glob(os.path.join(spec, "**", "*.md"), recursive=True):
        for ln in open(fp, encoding="utf-8"):
            c = [x.strip() for x in ln.strip().strip("|").split("|")] if ln.startswith("| ") else []
            if len(c) >= 11 and c[7].startswith("PASS") and "実 Chrome" in c[7] and ".spec.ts" in c[7]:   # 画面のテスト（Playwright）だけ。API の行の「実 Chrome」は手で触る手順にならない
                proof.update(x.strip() for x in c[9].split(","))
    # 実ブラウザで押した証拠があるチケットは、完了にしても層（backend の Bridge・会話）に関わらず残す（2026-10-03：done にした Bridge のタブが消えた）
    return [t for t in T if (t.get("status") == "done" and t.get("deliverable_layer") in ("ui", "integration")) or t["id"] in proof]


if __name__ == "__main__":
    sys.exit(main())
