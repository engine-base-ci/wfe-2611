#!/usr/bin/env python3
"""human_sheet.py — 人が実機で確かめるテストの表（Excel の冊）を、チケットと試験の仕様の表から組む（K-188）。

正本（読むだけ・書き換えない）：11_tickets/K-*.md の頭の欄と、07_qa/test-specs/k/*.md の表（11 欄）。
出す先：07_qa/human/<チケット番号>.xlsx。人が書くのは結果（J〜O）・エビデンス・課題管理・試験前提条件の記入だけで、
作り直しても人が書いたものは消さない（行から外した結果は「前の版の結果」へ移す）。

使い方:
  python3 scripts/qa/human_sheet.py <チケット番号>            1 冊を作る・作り直す（中間・統合のチケットも同じ）
  python3 scripts/qa/human_sheet.py --status <チケット番号>   今の冊の進みを出すだけ
  --root <フォルダ>                                           読む・書くリポジトリの根（無ければこの台本のあるリポジトリ）

読み手は前からある物を使う：表の行を割るのは scripts/ci/ci_results.py の _cells、
チケットの頭の欄は scripts/tickets/build_index.py の parse（1 行 1 欄・`[a, b]` だけを並びとして読む）。
この台本は 4 つに分けてある：読む（正本）／組む（冊に入る行）／引き継ぐ（前の冊）／書く（冊）。
"""
from __future__ import annotations

import argparse
import os
import re
import sys
import tempfile
from dataclasses import dataclass, field
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts" / "ci"))
sys.path.insert(0, str(ROOT / "scripts" / "tickets"))
import build_index  # noqa: E402
from ci_results import _cells  # noqa: E402

SPEC_DIR = "07_qa/test-specs/k"
TICKET_DIR = "11_tickets"
OUT_DIR = "07_qa/human"
SPEC_COLS = 11
SPEC_NAMES = ["ID", "画面", "テスト観点", "テスト項目", "前提条件", "操作手順", "期待結果", "結果", "備考", "タスク", "実行条件"]
CONTROL_RE = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f]")   # Excel の冊に書けない制御文字（openpyxl が拒む範囲と同じ）
ID_RE = re.compile(r"K\d+-[A-Za-z]+-\d+")
UI_RE = re.compile(r"K\d+-UI-\d+")
TICKET_RE = re.compile(r"K-\d+")
NA_MARK = "人=対象外"
NA = "対象外（機械の試験で確認）"
NA_HEAD = "対象外"

S_ITEMS, S_SUM, S_PRE, S_EV, S_ISSUE, S_OLD = "テスト項目", "進捗サマリ", "試験前提条件", "エビデンス", "課題管理", "前の版の結果"
SHEETS = [S_ITEMS, S_SUM, S_PRE, S_EV, S_ISSUE, S_OLD]
RESULT_HEAD = ["確認日", "確認者", "試験日", "OK/NG", "エビデンス", "備考"]
ITEM_HEAD = ["No", "機能名/画面名", "区分１", "区分２", "区分３", "区分4", "パターン番号", "検証内容/パターン説明", "確認項目", *RESULT_HEAD]
SUM_HEAD = ["No", "チケット", "題", "項目数", "消化数", "OK数", "NG数", "消化率", "合格率"]
PRE_HEAD = ["項目", "中身", "記入"]
EV_HEAD = ["No", "対応するパターン番号", "取得日", "取得者", "種別", "ファイル名／内容"]
ISSUE_HEAD = ["No", "パターン番号", "機能名/画面名", "現象内容", "対応内容", "ステータス", "記入日", "記入者", "対応日", "対応者",
              "確認日", "確認者", "OK/NG", "エビデンス", "備考"]
OLD_HEAD = ["パターン番号", "理由", "検証内容/パターン説明", "確認項目", *RESULT_HEAD]
ITEM_HEAD_ROW, SUM_HEAD_ROW, PRE_HEAD_ROW, EV_HEAD_ROW, ISSUE_HEAD_ROW, OLD_HEAD_ROW = 4, 3, 2, 3, 4, 1
ITEM_FIRST = ITEM_HEAD_ROW + 1
COL_OWNER, COL_ID, COL_H, COL_I, COL_RESULT, COL_OKNG = 3, 7, 8, 9, 10, 13   # C・G・H・I・J・M
OKNG_AT = COL_OKNG - COL_RESULT                                              # J〜O の中の OK/NG の位置
BLANK_NO_ROWS = 30                                                           # エビデンス・課題管理に先に置く No の数
WIDTHS = {
    S_ITEMS: [6, 16, 9, 12, 28, 8, 14, 60, 44, 12, 10, 12, 12, 18, 26],
    S_SUM: [6, 10, 40, 10, 10, 10, 10, 10, 10],
    S_PRE: [20, 90, 30],
    S_EV: [6, 20, 12, 10, 10, 60],
    S_ISSUE: [6, 14, 16, 40, 40, 12, 12, 10, 12, 10, 12, 10, 10, 18, 26],
    S_OLD: [14, 14, 60, 44, 12, 10, 12, 12, 18, 26],
}
Cell = tuple  # (値, 表示の形) か (値, 表示の形, 人が入れた式か)
EMPTY: Cell = (None, "General")


# ---------------------------------------------------------------- 読む（正本）
@dataclass(frozen=True)
class Row:
    rid: str
    screen: str
    axis: str
    item: str
    pre: str
    op: str
    exp: str
    note: str
    tasks: tuple[str, ...]
    cond: str
    file: str

    @property
    def is_na(self) -> bool:
        return NA_MARK in self.note

    @property
    def detail(self) -> str:
        text = f"【事前条件】{self.pre}\n【操作】{self.op}"
        return text + (f"\n【補足】{self.note}" if self.note else "")


def _row(cells: list[str], file: str) -> Row:
    c = [x.replace("\\|", "|").strip() for x in cells]
    tasks = tuple(t.strip() for t in c[9].split(",") if t.strip())
    return Row(c[0], c[1], c[2], c[3], c[4], c[5], c[6], c[8], tasks, c[10], file)


def read_specs(root: Path) -> list[Row]:
    """仕様の表の行を全部（ファイルの名前の順 → 表の中の順）。形の誤りは全部まとめて出して止まる"""
    rows: list[Row] = []
    errs: list[str] = []
    seen: dict[str, str] = {}
    for f in sorted((root / SPEC_DIR).glob("*.md"), key=lambda p: p.name):
        for line in f.read_text(encoding="utf-8").split("\n"):   # splitlines は制御文字（\x0b など）でも行を割るので使わない
            cells = _cells(line)
            if not cells or not ID_RE.fullmatch(cells[0]):
                continue
            rid = cells[0]
            if len(cells) != SPEC_COLS:
                errs.append(f"{f.name}: {rid} の欄の数が {len(cells)}（{SPEC_COLS} でない）")
            elif rid in seen:
                errs.append(f"{f.name}: {rid} が重なっている（先は {seen[rid]}）")
            elif any(CONTROL_RE.search(c) for c in cells):
                bad = "・".join(n for n, c in zip(SPEC_NAMES, cells) if CONTROL_RE.search(c))
                errs.append(f"{f.name}: {rid} の欄（{bad}）に制御文字がある")
            else:
                seen[rid] = f.name
                rows.append(_row(cells, f.name))
    if errs:
        raise SystemExit("仕様の表（" + SPEC_DIR + "）の形が誤り。正本の側で直す：\n  " + "\n  ".join(errs))
    return rows


def read_tickets(root: Path) -> dict[str, dict]:
    """チケットの頭の欄（鍵はファイルの名前の番号）"""
    return {p.stem: build_index.parse(str(p)) for p in sorted((root / TICKET_DIR).glob("K-*.md"))}


def depends_on(tickets: dict[str, dict], tid: str) -> list[str]:
    v = tickets[tid].get("depends_on", [])
    if not isinstance(v, list):
        raise SystemExit(f"{TICKET_DIR}/{tid}.md: 頭の欄 depends_on が 1 行の並び（[K-1, K-2]）でない")
    return v


# ---------------------------------------------------------------- 組む（冊に入る行）
@dataclass(frozen=True)
class Plan:
    tid: str
    title: str
    is_qa: bool
    picked: tuple[tuple[Row, str], ...]            # (行, この冊での持ち主)
    owners: tuple[tuple[str, str], ...]            # 冊に先に出る順の (チケット, 題)
    files: tuple[str, ...]                         # 行を読んだ仕様のファイル
    no_ticket: tuple[str, ...]                     # 持ち主のチケットのファイルが無い行の ID
    outside: tuple[tuple[str, int], ...]           # 冊に入れていない行の (持ち主, 件数)


def family(tickets: dict[str, dict], tid: str) -> set[str]:
    """そのチケットと、parent: をたどった子・孫"""
    out = {tid}
    grew = True
    while grew:
        more = {k for k, t in tickets.items() if t.get("parent") in out} - out
        out |= more
        grew = bool(more)
    return out


def groups(tickets: dict[str, dict], tid: str, seen: tuple[str, ...] = ()) -> list[set[str]]:
    """冊に並べる組（先の組から行を置く）。中間・統合は depends_on の順に開き、自分の行は最後"""
    if tickets[tid].get("kind") != "QA":
        return [family(tickets, tid)]
    out: list[set[str]] = []
    for dep in depends_on(tickets, tid):
        if dep not in tickets:
            raise SystemExit(f"{tid} の depends_on の先 {dep} のチケットのファイル（{TICKET_DIR}/{dep}.md）が無い")
        if dep not in (*seen, tid):
            out += groups(tickets, dep, (*seen, tid))
    return [*out, {tid}]


def pick(ui_rows: list[Row], grps: list[set[str]]) -> list[tuple[Row, str]]:
    out: list[tuple[Row, str]] = []
    used: set[str] = set()
    for g in grps:
        for r in ui_rows:
            owner = next((t for t in r.tasks if t in g), None)
            if owner and r.rid not in used:
                used.add(r.rid)
                out.append((r, owner))
    return out


def left_out(ui_rows: list[Row], picked: list[tuple[Row, str]], tickets: dict[str, dict]) -> tuple[list[str], dict[str, int]]:
    """行を読んだファイルの中の、入れなかった画面の行：① チケットが無い行の ID ② 持ち主ごとの件数"""
    files = {r.file for r, _ in picked}
    used = {r.rid for r, _ in picked}
    no_ticket: list[str] = []
    outside: dict[str, int] = {}
    for r in ui_rows:
        if r.file not in files or r.rid in used:
            continue
        owner = next((t for t in r.tasks if t in tickets), None)
        if owner is None:
            no_ticket.append(r.rid)
        else:
            outside[owner] = outside.get(owner, 0) + 1
    return no_ticket, outside


def holes(picked: list[tuple[Row, str]]) -> list[str]:
    names = (("テスト項目", "item"), ("前提条件", "pre"), ("操作手順", "op"), ("期待結果", "exp"))
    return [f"{r.rid}（{r.file}）: {label} が空" for r, _ in picked for label, attr in names if not getattr(r, attr).strip()]


def check_tid(tid: str) -> None:
    if not TICKET_RE.fullmatch(tid):
        raise SystemExit(f"チケットの番号の形（K-<数字>）でない: {tid}")


def make_plan(root: Path, tid: str) -> Plan:
    check_tid(tid)
    rows = read_specs(root)
    tickets = read_tickets(root)
    if tid not in tickets:
        raise SystemExit(f"{tid} のチケットのファイル（{TICKET_DIR}/{tid}.md）が無い")
    depends_on(tickets, tid)
    ui_rows = [r for r in rows if UI_RE.fullmatch(r.rid)]
    picked = pick(ui_rows, groups(tickets, tid))
    if not picked:
        raise SystemExit(f"{tid}: 人が触る画面の行（ID が K<数字>-UI-<数字>）が 1 つも無い。冊は作らない")
    bad = holes(picked)
    if bad:
        raise SystemExit(f"{tid}: 詳しさの穴がある。冊は作らない（正本の側で埋める）：\n  " + "\n  ".join(bad))
    no_ticket, outside = left_out(ui_rows, picked, tickets)
    owners = list(dict.fromkeys(o for _, o in picked))
    for t in dict.fromkeys([tid, *owners]):
        if CONTROL_RE.search(str(tickets[t].get("title", ""))):
            raise SystemExit(f"{TICKET_DIR}/{t}.md: 頭の欄 title に制御文字がある。正本の側で直す")
    files = list(dict.fromkeys(r.file for r, _ in picked))
    return Plan(tid, str(tickets[tid].get("title", "")), tickets[tid].get("kind") == "QA", tuple(picked),
                tuple((o, str(tickets[o].get("title", ""))) for o in owners), tuple(files), tuple(no_ticket), tuple(outside.items()))


# ---------------------------------------------------------------- 引き継ぐ（前の冊）
@dataclass
class Prior:
    results: dict[str, tuple[str, str, list[Cell]]] = field(default_factory=dict)   # パターン番号 → (H, I, J〜O)
    kept: dict[str, dict[int, list[Cell]]] = field(default_factory=dict)            # シート → 行の番号 → 人が書いた行
    pre_c: dict[str, Cell] = field(default_factory=dict)                            # 試験前提条件の項目 → C
    widths: dict[str, dict[str, float]] = field(default_factory=dict)


def _blank(v: object) -> bool:
    return v is None or (isinstance(v, str) and not v.strip())


def _cell(c) -> Cell:
    return (None if _blank(c.value) else c.value, c.number_format, c.data_type == "f")


def _shape_errors(wb) -> list[str]:
    errs = [f"シート「{s}」が無い" for s in SHEETS if s not in wb.sheetnames]
    if errs:
        return errs
    for sheet, at, head in ((S_ITEMS, ITEM_HEAD_ROW, ITEM_HEAD), (S_ISSUE, ISSUE_HEAD_ROW, ISSUE_HEAD),
                            (S_EV, EV_HEAD_ROW, EV_HEAD), (S_OLD, OLD_HEAD_ROW, OLD_HEAD)):
        got = [wb[sheet].cell(at, i + 1).value for i in range(len(head))]
        if got != head:
            errs.append(f"シート「{sheet}」の {at} 行目の見出しが決めた並びでない")
    return errs


def _read_results(ws) -> tuple[dict[str, tuple[str, str, list[Cell]]], list[str]]:
    out: dict[str, tuple[str, str, list[Cell]]] = {}
    errs: list[str] = []
    for r in ws.iter_rows(min_row=ITEM_FIRST, max_col=len(ITEM_HEAD)):
        rid, res = r[COL_ID - 1].value, [_cell(c) for c in r[COL_RESULT - 1:]]
        if _blank(rid):
            if any(c[0] is not None for c in res):
                errs.append(f"シート「{S_ITEMS}」の {r[0].row} 行目：パターン番号が空なのに結果が書いてある")
            continue
        if str(rid) in out:
            errs.append(f"シート「{S_ITEMS}」に同じパターン番号 {rid} が 2 行ある")
        out[str(rid)] = (str(r[COL_H - 1].value or ""), str(r[COL_I - 1].value or ""), res)
    return out, errs


def _read_kept(ws, head_row: int, from_col: int) -> dict[int, list[Cell]]:
    """見出しの下で、from_col から右に何か書いてある行（＝人が書いた行）を、行の番号つきで"""
    out: dict[int, list[Cell]] = {}
    for r in ws.iter_rows(min_row=head_row + 1):
        cells = [_cell(c) for c in r]
        if any(c[0] is not None for c in cells[from_col - 1:]):
            out[r[0].row] = cells
    return out


def _read_widths(ws) -> dict[str, float]:
    from openpyxl.utils import get_column_letter
    out: dict[str, float] = {}
    for key, dim in ws.column_dimensions.items():
        if dim.width is None:
            continue
        lo, hi = dim.min or 0, dim.max or 0
        letters = [get_column_letter(i) for i in range(lo, hi + 1)] if lo and hi >= lo else [key]
        out.update({x: dim.width for x in letters})
    return out


def read_prior(path: Path) -> Prior | None:
    """前の冊。無ければ None。開けない・形が違うときは止まる（結果を「無い」と読んで上書きしない）"""
    if not path.exists():
        return None
    import openpyxl
    try:
        wb = openpyxl.load_workbook(path)
    except Exception as e:  # noqa: BLE001  壊れ方は色々（zip でない・中の部品が無い）。どれでも止まる
        raise SystemExit(f"前の冊 {path} が開けない（{type(e).__name__}）。上書きしない。冊を直すか、どかしてから作り直す") from e
    errs = _shape_errors(wb)
    results: dict[str, tuple[str, str, list[Cell]]] = {}
    if not errs:
        results, errs = _read_results(wb[S_ITEMS])
    if errs:
        raise SystemExit(f"前の冊 {path} の形が違う。上書きしない：\n  " + "\n  ".join(errs))
    kept = {S_EV: _read_kept(wb[S_EV], EV_HEAD_ROW, 2), S_ISSUE: _read_kept(wb[S_ISSUE], ISSUE_HEAD_ROW, 2),
            S_OLD: _read_kept(wb[S_OLD], OLD_HEAD_ROW, 1)}
    pre_c = {str(r[0].value): _cell(r[2]) for r in wb[S_PRE].iter_rows(min_row=PRE_HEAD_ROW + 1, max_col=3)
             if not _blank(r[0].value) and not _blank(r[2].value)}
    return Prior(results, kept, pre_c, {s: _read_widths(wb[s]) for s in SHEETS})


def _written(res: list[Cell]) -> bool:
    """人が何か書いたか（台本が入れた対象外の字は数えない）"""
    return any(c[0] is not None and not (i == OKNG_AT and c[0] == NA) for i, c in enumerate(res))


def _carry_one(row: Row, before: tuple[str, str, list[Cell]] | None) -> tuple[list[Cell], str | None]:
    """今の行の J〜O と、前の結果を「前の版の結果」へ移す理由（移さなければ None）"""
    fresh = [EMPTY] * len(RESULT_HEAD)
    if row.is_na:
        fresh[OKNG_AT] = (NA, "General")
    if before is None:
        return fresh, None
    h, i, res = before
    if (h, i) != (row.detail, row.exp):
        return fresh, ("中身が変わった" if _written(res) else None)
    if row.is_na and res[OKNG_AT][0] not in (None, NA):
        return fresh, "対象外の行"
    kept = list(res)
    kept[OKNG_AT] = fresh[OKNG_AT] if (row.is_na or res[OKNG_AT][0] == NA) else res[OKNG_AT]
    return kept, None


def carry(plan: Plan, prior: Prior | None) -> tuple[dict[str, list[Cell]], list[list[Cell]]]:
    """パターン番号 → J〜O と、「前の版の結果」に足す行"""
    before = prior.results if prior else {}
    now: dict[str, list[Cell]] = {}
    moved: list[list[Cell]] = []

    def move(rid: str, reason: str) -> None:
        h, i, res = before[rid]
        moved.append([(rid, "General"), (reason, "General"), (h, "General"), (i, "General"), *res])

    for row, _ in plan.picked:
        now[row.rid], reason = _carry_one(row, before.get(row.rid))
        if reason:
            move(row.rid, reason)
    for rid, (_, _, res) in before.items():
        if rid not in now and _written(res):
            move(rid, "行が消えた")
    return now, moved


# ---------------------------------------------------------------- 書く（冊）
def _text(ws, r: int, c: int, v: object):
    """正本や前の冊から来た値を入れる。文字は `=` などで始まっても式にしない（文字として入れる）"""
    x = ws.cell(r, c)
    x.value = v
    if isinstance(v, str):
        x.data_type = "s"
    return x


def _put(ws, r: int, c: int, cell: Cell) -> None:
    v, fmt, *rest = cell
    if v is None:
        return
    x = ws.cell(r, c, v) if rest and rest[0] else _text(ws, r, c, v)   # 式のままにするのは、人が前の冊に式で入れた欄だけ
    if fmt and fmt != "General":
        x.number_format = fmt


def _head(ws, at: int, names: list[str]) -> None:
    from openpyxl.styles import Alignment, Font, PatternFill
    for i, name in enumerate(names, 1):
        c = ws.cell(at, i, name)
        c.font = Font(bold=True)
        c.fill = PatternFill("solid", fgColor="DDE5EE")
        c.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)


def _widths(ws, prior: Prior | None) -> None:
    from openpyxl.utils import get_column_letter
    for i, w in enumerate(WIDTHS[ws.title], 1):
        ws.column_dimensions[get_column_letter(i)].width = w
    for letter, w in (prior.widths.get(ws.title, {}) if prior else {}).items():
        ws.column_dimensions[letter].width = w


def _rng(col: str, last: int, sheet: bool = True) -> str:
    return f"{S_ITEMS + '!' if sheet else ''}${col}${ITEM_FIRST}:${col}${last}"


def write_items(ws, plan: Plan, results: dict[str, list[Cell]]) -> None:
    from openpyxl.styles import Alignment, Font
    from openpyxl.worksheet.datavalidation import DataValidation
    last = ITEM_HEAD_ROW + len(plan.picked)
    m, g = _rng("M", last, False), _rng("G", last, False)
    _text(ws, 1, 1, f"【人の確かめ】{plan.tid} {plan.title}")
    ws["A1"].font = Font(bold=True, size=14)
    top = (("項目数", f'=COUNTA({g})-COUNTIF({m},"{NA_HEAD}*")'), ("消化数", f'=COUNTIF({m},"OK")+COUNTIF({m},"NG")'),
           ("OK数", f'=COUNTIF({m},"OK")'))
    for i, (label, formula) in enumerate(top):
        ws.cell(2, 2 + i * 2, label).font = Font(bold=True)
        ws.cell(2, 3 + i * 2, formula)
    _head(ws, ITEM_HEAD_ROW, ITEM_HEAD)
    for n, (row, owner) in enumerate(plan.picked, 1):
        at = ITEM_HEAD_ROW + n
        fixed = [n, row.screen, owner, row.axis, row.item, row.cond, row.rid, row.detail, row.exp]
        for c, v in enumerate(fixed, 1):
            _text(ws, at, c, v if v != "" else None)
        for c, cell in enumerate(results[row.rid], COL_RESULT):
            _put(ws, at, c, cell)
        for c in range(1, len(ITEM_HEAD) + 1):
            ws.cell(at, c).alignment = Alignment(vertical="top", wrap_text=True)
    ws.freeze_panes = f"A{ITEM_FIRST}"
    # 選ぶ欄は OK・NG。対象外（台本が入れる字）や保留も書けるよう、止めずに知らせるだけにする
    dv = DataValidation(type="list", formula1='"OK,NG"', allow_blank=True, errorStyle="warning", showErrorMessage=True,
                        error="OK か NG を選ぶ（ほかの字は消化に数えない）", errorTitle="OK/NG")
    dv.add(f"M{ITEM_FIRST}:M{last}")
    ws.add_data_validation(dv)


def write_summary(ws, plan: Plan) -> None:
    from openpyxl.styles import Font
    last = ITEM_HEAD_ROW + len(plan.picked)
    c, m = _rng("C", last), _rng("M", last)
    _text(ws, 1, 1, f"進捗サマリ：{plan.tid} {plan.title}")
    ws["A1"].font = Font(bold=True, size=14)
    _head(ws, SUM_HEAD_ROW, SUM_HEAD)
    first = SUM_HEAD_ROW + 1
    for n, (owner, title) in enumerate(plan.owners, 1):
        at, b = SUM_HEAD_ROW + n, f"$B{SUM_HEAD_ROW + n}"
        line = [n, owner, title or None, f'=COUNTIF({c},{b})-COUNTIFS({c},{b},{m},"{NA_HEAD}*")',
                f'=COUNTIFS({c},{b},{m},"OK")+COUNTIFS({c},{b},{m},"NG")', f'=COUNTIFS({c},{b},{m},"OK")', f'=COUNTIFS({c},{b},{m},"NG")']
        for col, v in enumerate(line[:3], 1):
            _text(ws, at, col, v)
        for col, v in enumerate(line[3:], 4):
            ws.cell(at, col, v)
    end = SUM_HEAD_ROW + len(plan.owners)
    total = end + 1
    ws.cell(total, 2, "合計").font = Font(bold=True)
    for col in "DEFG":
        ws[f"{col}{total}"] = f"=SUM({col}{first}:{col}{end})"
    for at in range(first, total + 1):
        ws[f"H{at}"] = f"=IF(D{at}=0,0,E{at}/D{at})"
        ws[f"I{at}"] = f"=IF(D{at}=0,0,F{at}/D{at})"
        ws[f"H{at}"].number_format = ws[f"I{at}"].number_format = "0%"


def scope_text(plan: Plan) -> str:
    na = sum(1 for r, _ in plan.picked if r.is_na)
    lines = [f"画面の行 {len(plan.picked)} 件（うち対象外 {na} 件）。口の行は CI の試験が持つので入れない。"]
    if plan.is_qa:
        lines.append("depends_on の組のチケットと自分の行だけ。組の外のチケットの行は入れていない。")
    lines.append(f"まだチケットが無い行 {len(plan.no_ticket)} 件" + ("：" + "、".join(plan.no_ticket) if plan.no_ticket else ""))
    if plan.outside:
        lines.append("読んだ仕様のファイルにあるが、この冊に入れていない行（持ち主の冊で確かめる）：" + "、".join(f"{o}（{n} 件）" for o, n in plan.outside))
    return "\n".join(lines)


def pre_rows(plan: Plan) -> list[tuple[str, str | None]]:
    target = [f"{plan.tid} {plan.title}", *(f"{o} {t}" for o, t in plan.owners if o != plan.tid)]
    refs = [f"{TICKET_DIR}/{plan.tid}.md", *(f"{SPEC_DIR}/{f}" for f in plan.files)]
    return [
        ("試験目的", "CI の画面の試験（機械）と別に、人が実機で触って確かめる"),
        ("対象", "\n".join(target)),
        ("試験範囲", scope_text(plan)),
        ("参照資料", "\n".join(refs)),
        ("試験環境", "手元（自分の PC）。実ブラウザ"),
        ("立ち上げ方", "bash scripts/dev/up.sh（止める：--stop・今の状態：--status）"),
        ("URL とアカウント", "URL は bash scripts/dev/up.sh --status に出る。アカウントは自分で新規登録して作る"
                       "（やり直すとき：scripts/dev/reset-users.sh・招待が要るとき：scripts/dev/invite.sh）。値はここに書かない"),
        ("必要な準備", "各行の【事前条件】のとおりに画面から作る。作れない事前条件は NG にせず課題管理に書く"),
        ("判定基準", "全部の行が OK。NG が 1 つでもあれば、このチケットは人の確かめを通っていない"),
        ("NG のとき", "課題管理に 1 行書く（パターン番号・現象）。直した後に同じ行を確かめ直す"),
        ("エビデンスの置き方", "画像などのファイルは扱わない（リポジトリにも置かない）。エビデンスのシートに、何を見たか・あればファイルの名前や置き場を文字で書く。"
                       "写真を冊に貼らない（作り直しで落ちうる）"),
        ("試験者", None), ("確認者", None), ("試験期間", None),
    ]


def write_pre(ws, plan: Plan, prior: Prior | None) -> None:
    from openpyxl.styles import Alignment, Font
    _text(ws, 1, 1, f"試験前提条件：{plan.tid} {plan.title}")
    ws["A1"].font = Font(bold=True, size=14)
    _head(ws, PRE_HEAD_ROW, PRE_HEAD)
    for at, (label, body) in enumerate(pre_rows(plan), PRE_HEAD_ROW + 1):
        ws.cell(at, 1, label).font = Font(bold=True)
        _text(ws, at, 2, body).alignment = Alignment(vertical="top", wrap_text=True)
        if prior and label in prior.pre_c:
            _put(ws, at, 3, prior.pre_c[label])


def write_log(ws, title: str | None, head_row: int, head: list[str], kept: dict[int, list[Cell]], numbered: bool) -> None:
    """人が書くシート（エビデンス・課題管理・前の版の結果）：見出しと、前の冊で人が書いた行を同じ行に"""
    from openpyxl.styles import Font
    if title:
        ws["A1"] = title
        ws["A1"].font = Font(bold=True, size=14)
    _head(ws, head_row, head)
    for n in range(1, (BLANK_NO_ROWS if numbered else 0) + 1):
        if head_row + n not in kept:
            ws.cell(head_row + n, 1, n)
    for at, cells in kept.items():
        for c, cell in enumerate(cells, 1):
            _put(ws, at, c, cell)


def write_book(path: Path, plan: Plan, prior: Prior | None) -> None:
    import openpyxl
    results, moved = carry(plan, prior)
    kept = prior.kept if prior else {}
    old = dict(kept.get(S_OLD, {}))
    for n, line in enumerate(moved, max(old, default=OLD_HEAD_ROW) + 1):
        old[n] = line
    wb = openpyxl.Workbook()
    wb.remove(wb.active)
    sheets = {s: wb.create_sheet(s) for s in SHEETS}
    write_items(sheets[S_ITEMS], plan, results)
    write_summary(sheets[S_SUM], plan)
    write_pre(sheets[S_PRE], plan, prior)
    write_log(sheets[S_EV], "エビデンス（ファイルは扱わない。何を見たかを文字で書く）", EV_HEAD_ROW, EV_HEAD, kept.get(S_EV, {}), True)
    write_log(sheets[S_ISSUE], "課題管理（NG と、作れない事前条件を 1 行ずつ）", ISSUE_HEAD_ROW, ISSUE_HEAD, kept.get(S_ISSUE, {}), True)
    write_log(sheets[S_OLD], None, OLD_HEAD_ROW, OLD_HEAD, old, False)
    for ws in sheets.values():
        _widths(ws, prior)
    path.parent.mkdir(parents=True, exist_ok=True)
    # 書き切ってから置き換える（途中で止まっても前の冊が残る）。一時の名前は回ごとに別（同時に流しても互いの途中を置き換えない）
    fd, name = tempfile.mkstemp(dir=path.parent, prefix=f".{path.name}.", suffix=".tmp")
    os.close(fd)
    tmp = Path(name)
    try:
        wb.save(tmp)
        os.chmod(tmp, path.stat().st_mode & 0o777 if path.exists() else 0o644)
        os.replace(tmp, path)
    finally:
        tmp.unlink(missing_ok=True)


# ---------------------------------------------------------------- 口
def out_path(root: Path, tid: str) -> Path:
    return root / OUT_DIR / f"{tid}.xlsx"


def build_book(root: Path | str, tid: str) -> tuple[Path, Plan]:
    root = Path(root)
    plan = make_plan(root, tid)
    path = out_path(root, tid)
    write_book(path, plan, read_prior(path))
    return path, plan


def build(root: Path | str, tid: str) -> Path:
    """1 冊を作る・作り直す。作った冊の道を返す。止まるときは理由の文つきの SystemExit"""
    return build_book(root, tid)[0]


def progress(path: Path | str) -> list[dict]:
    """冊に行を持つチケットごとの進み（冊に先に出る順・合計は入れない）"""
    import openpyxl
    ws = openpyxl.load_workbook(path)[S_ITEMS]
    out: dict[str, dict] = {}
    for r in ws.iter_rows(min_row=ITEM_FIRST, max_col=len(ITEM_HEAD), values_only=True):
        if _blank(r[COL_ID - 1]):
            continue
        t = out.setdefault(str(r[COL_OWNER - 1]), {"ticket": str(r[COL_OWNER - 1]), "items": 0, "done": 0, "ok": 0, "ng": 0, "na": 0})
        v = r[COL_OKNG - 1]
        if isinstance(v, str) and v.startswith(NA_HEAD):
            t["na"] += 1
            continue
        word = v.casefold() if isinstance(v, str) else None   # Excel の COUNTIF と同じ：大文字小文字は区別しない・空白は削らない
        t["items"] += 1
        t["ok"] += word == "ok"
        t["ng"] += word == "ng"
        t["done"] += word in ("ok", "ng")
    return list(out.values())


def _say(text: str) -> None:
    sys.stdout.write(text + "\n")


def status(root: Path, tid: str) -> int:
    check_tid(tid)
    path = out_path(root, tid)
    if not path.exists():
        sys.stderr.write(f"{tid} の冊がまだ無い（{path}）。先に python3 scripts/qa/human_sheet.py {tid} で作る\n")
        return 1
    for p in progress(path):
        _say(f"{p['ticket']}: 項目 {p['items']}・消化 {p['done']}・OK {p['ok']}・NG {p['ng']}・対象外 {p['na']}")
    return 0


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description="人が実機で確かめるテストの表（07_qa/human/<チケット番号>.xlsx）を作る・作り直す")
    ap.add_argument("ticket", help="チケットの番号（K-63 の形）")
    ap.add_argument("--status", action="store_true", help="今の冊の進みを出すだけ")
    ap.add_argument("--root", default=str(ROOT), help="読む・書くリポジトリの根")
    a = ap.parse_args(argv)
    root = Path(a.root)
    if a.status:
        return status(root, a.ticket)
    path, plan = build_book(root, a.ticket)
    _say(f"作った: {path}（画面の行 {len(plan.picked)} 件・チケット {len(plan.owners)}）")
    _say(f"まだチケットが無い行 {len(plan.no_ticket)} 件" + ("：" + "、".join(plan.no_ticket) if plan.no_ticket else ""))
    if plan.outside:
        _say("この冊に入れていない行：" + "、".join(f"{o}（{n} 件）" for o, n in plan.outside))
    return 0


if __name__ == "__main__":
    sys.exit(main())
