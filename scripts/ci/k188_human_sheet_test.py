#!/usr/bin/env python3
"""K-188 の試験：人が実機で確かめるテストの表を作る台本（scripts/qa/human_sheet.py）。行 ID は K188-HS-NNN"""
from __future__ import annotations

import json
import pathlib
import re
import subprocess
import sys
import tempfile
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[2]
SCRIPT = ROOT / "scripts" / "qa" / "human_sheet.py"
sys.path.insert(0, str(ROOT / "scripts" / "qa"))

SHEETS = ["テスト項目", "進捗サマリ", "試験前提条件", "エビデンス", "課題管理", "前の版の結果"]
HEAD = ["No", "機能名/画面名", "区分１", "区分２", "区分３", "区分4", "パターン番号", "検証内容/パターン説明", "確認項目",
        "確認日", "確認者", "試験日", "OK/NG", "エビデンス", "備考"]
SPEC_HEAD = ("| ID | 画面 | テスト観点 | テスト項目 | 前提条件 | 操作手順 | 期待結果 | 結果 | 備考 | タスク | 実行条件 |\n"
             "|---|---|---|---|---|---|---|---|---|---|---|\n")
SPEC_A = "07_qa/test-specs/k/a 承認 の表.md"   # 名前に日本語と空白（K188-HS-013）
SPEC_B = "07_qa/test-specs/k/b.md"


def row(rid: str, task: str, *, screen: str = "approvals", axis: str = "操作", item: str = "（button）「承認する」",
        pre: str = "承認待ちが 1 件", op: str = "押す", exp: str = "行が一覧から消える", note: str = "", cond: str = "L1") -> str:
    return f"| {rid} | {screen} | {axis} | {item} | {pre} | {op} | {exp} | BLOCKED（実装待ち） | {note} | {task} | {cond} |\n"


def spec(*rows: str) -> str:
    return "# 表\n\n> 前書き\n\n" + SPEC_HEAD + "".join(rows)


def ticket(tid: str, *, kind: str = "タスク", parent: str = "K-0", deps: list[str] | None = None, title: str | None = None) -> str:
    return (f"---\nid: {tid}\ntitle: {title or tid + ' の題'}\nkind: {kind}\nparent: {parent}\n"
            f"depends_on: [{', '.join(deps or [])}]\n---\n\n## 目的\n\n本文\n")


# a のファイル（K-5 の組）が b のファイル（K-7）より名前の順で先。中間のチケット K-9 の depends_on は逆（K-7 → K-5）
A_ROWS = [
    row("K5-UI-001", "K-5", pre=r"承認待ちが 1 件（a\|b）", note="D-1 の決まり"),
    row("K5-API-001", "K-5", exp="200 を返す"),                       # 口の行：入れない
    row("K5-UI-003", "K-6", screen="tickets", item="帯"),              # 子 K-6 の行（表の順では 001 と 002 の間）
    row("K5-UI-002", "K-5", axis="入力", item="理由が空", op="空で押す", exp="「理由を書いてください」と出る"),
    row("K50-UI-001", "K-50"),                                         # 番号の頭が同じ別のチケット
    row("K1-UI-001", "K-1"),                                           # K-5 の depends_on の先
    row("K61-UI-001", "K-61", exp="孫の行が出る"),                     # 孫（K-6 の子）
]
B_ROWS = [
    row("K7-UI-001", "K-7", screen="delegate"),
    row("K57-UI-001", "K-5, K-7", screen="delegate", item="2 つのチケットの行"),
    row("K7-UI-002", "K-7", screen="delegate", item="止める"),
    row("K2-API-001", "K-2"),
    row("K3-UI-001", "K-3", op=""),
    row("K3-UI-002", "K-3", exp="   "),
    row("K3-UI-003", "K-3"),
]
TICKETS = {
    "K-1": ticket("K-1"), "K-2": ticket("K-2"), "K-3": ticket("K-3"),
    "K-5": ticket("K-5", deps=["K-1"], title="承認して完了する"), "K-6": ticket("K-6", parent="K-5"), "K-61": ticket("K-61", parent="K-6"),
    "K-50": ticket("K-50"), "K-7": ticket("K-7", title="AI に任せる"),
    "K-8": ticket("K-8", kind="QA", deps=["K-7"]),
    "K-9": ticket("K-9", kind="QA", deps=["K-7", "K-5"], title="中間テスト"),
    "K-10": ticket("K-10", kind="QA", deps=["K-8", "K-5", "K-7"], title="統合テスト"),
}


def put(root: pathlib.Path, files: dict[str, str]) -> None:
    for k, v in files.items():
        p = root / k
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(v, encoding="utf-8")


def book(path: pathlib.Path):
    import openpyxl
    return openpyxl.load_workbook(path)


def items(path: pathlib.Path) -> list[tuple]:
    """テスト項目の 5 行目からを A〜O の組で（A が空の行で終わり）"""
    out = []
    for r in book(path)["テスト項目"].iter_rows(min_row=5, max_col=15, values_only=True):
        if r[0] in (None, ""):
            break
        out.append(tuple(None if v == "" else v for v in r))
    return out


def by_id(path: pathlib.Path) -> dict[str, tuple]:
    return {r[6]: r for r in items(path)}


def fill(path: pathlib.Path, results: dict[str, tuple]) -> None:
    """パターン番号 → (確認日, 確認者, 試験日, OK/NG, エビデンス, 備考) を J〜O に書く（人が書いたことにする）"""
    wb = book(path)
    ws = wb["テスト項目"]
    seen = set()
    for r in ws.iter_rows(min_row=5, max_col=15):
        if r[6].value in results:
            seen.add(r[6].value)
            for c, v in zip(r[9:15], results[r[6].value]):
                c.value = v
    assert seen == set(results), f"書く先の行が無い: {set(results) - seen}"
    wb.save(path)


def table(ws, head_row: int) -> list[dict]:
    """見出しの行を鍵にして、その下の行を辞書で（全部の欄が空の行は飛ばす）"""
    head = [c.value for c in ws[head_row]]
    out = []
    for r in ws.iter_rows(min_row=head_row + 1, values_only=True):
        if any(v not in (None, "") for v in r):
            out.append({h: (None if v == "" else v) for h, v in zip(head, r) if h})
    return out


def dump(path: pathlib.Path) -> dict:
    wb = book(path)
    return {ws.title: [[c.value for c in r] for r in ws.iter_rows()] for ws in wb}


R_OK = ("2026-11-13", "高本", "2026-11-13", "OK", "写真 1", "気づいたこと")
R_NG = ("2026-11-14", "高本", "2026-11-14", "NG", None, "文が違う")


class HumanSheet(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = tempfile.TemporaryDirectory()
        self.root = pathlib.Path(self.tmp.name) / "repo"
        self.root.mkdir()
        put(self.root, {f"11_tickets/{k}.md": v for k, v in TICKETS.items()})
        put(self.root, {SPEC_A: spec(*A_ROWS), SPEC_B: spec(*B_ROWS)})

    def tearDown(self) -> None:
        self.tmp.cleanup()

    def build(self, tid: str = "K-5") -> pathlib.Path:
        import human_sheet
        p = pathlib.Path(human_sheet.build(self.root, tid))
        self.assertEqual(p.resolve(), (self.root / "07_qa/human" / f"{tid}.xlsx").resolve())
        return p

    def out(self, tid: str) -> pathlib.Path:
        return self.root / "07_qa/human" / f"{tid}.xlsx"

    def stops(self, tid: str) -> str:
        import human_sheet
        with self.assertRaises(SystemExit) as e:
            human_sheet.build(self.root, tid)
        self.assertNotIn(e.exception.code, (0, None), "理由なしで終わっている")
        return str(e.exception)

    # ── 列の当て方・入る行 ──
    def test_K188_HS_001_columns_follow_the_mapping(self) -> None:
        p = self.build()
        wb = book(p)
        self.assertEqual(wb.sheetnames, SHEETS)
        ws = wb["テスト項目"]
        self.assertEqual([c.value for c in ws[4]][:15], HEAD)
        self.assertIn("K-5", str(ws["A1"].value))
        self.assertIn("承認して完了する", str(ws["A1"].value))
        rows = items(p)
        self.assertEqual([r[0] for r in rows], list(range(1, len(rows) + 1)))
        got = by_id(p)
        self.assertEqual(got["K5-UI-001"][1:9], (
            "approvals", "K-5", "操作", "（button）「承認する」", "L1", "K5-UI-001",
            "【事前条件】承認待ちが 1 件（a|b）\n【操作】押す\n【補足】D-1 の決まり", "行が一覧から消える"))
        self.assertEqual(got["K5-UI-002"][1:9], (
            "approvals", "K-5", "入力", "理由が空", "L1", "K5-UI-002",
            "【事前条件】承認待ちが 1 件\n【操作】空で押す", "「理由を書いてください」と出る"))   # 備考が空なら【補足】は無い
        self.assertEqual(got["K57-UI-001"][2], "K-5")   # タスクの列が「K-5, K-7」：この冊のチケット 1 つ
        for r in rows:
            self.assertEqual(r[9:15], (None,) * 6, f"{r[6]} の人の欄が空でない")
            self.assertNotIn("BLOCKED", " ".join(str(v) for v in r if v), "機械の結果の欄を入れている")

    def test_K188_HS_002_only_own_screen_rows(self) -> None:
        self.assertEqual({r[6] for r in items(self.build())}, {"K5-UI-001", "K5-UI-002", "K5-UI-003", "K61-UI-001", "K57-UI-001"})
        self.assertEqual({r[6] for r in items(self.build("K-50"))}, {"K50-UI-001"})

    def test_K188_HS_003_children_rows_in_spec_order(self) -> None:
        self.assertEqual([r[6] for r in items(self.build())], ["K5-UI-001", "K5-UI-003", "K5-UI-002", "K61-UI-001", "K57-UI-001"])
        self.assertEqual([r[2] for r in items(self.build())], ["K-5", "K-6", "K-5", "K-61", "K-5"])
        self.assertEqual([r[6] for r in items(self.build("K-6"))], ["K5-UI-003", "K61-UI-001"])   # 子の冊は子と孫だけ

    def test_K188_HS_004_qa_ticket_gathers_depends_on_in_flow_order(self) -> None:
        k5 = ["K5-UI-001", "K5-UI-003", "K5-UI-002", "K61-UI-001"]
        p = self.build("K-9")
        self.assertEqual([r[6] for r in items(p)], ["K7-UI-001", "K57-UI-001", "K7-UI-002", *k5])   # depends_on の順（ファイルの順ではない）
        self.assertEqual(by_id(p)["K57-UI-001"][2], "K-7")                                           # 先に出た組のチケット
        summ = table(book(p)["進捗サマリ"], 3)
        self.assertEqual([s["チケット"] for s in summ], ["K-7", "K-5", "K-6", "K-61", "合計"])
        self.assertEqual(summ[0]["題"], "AI に任せる")
        # 入れ子の QA（K-8 → K-7）を開き、後ろにもう一度出る K-7 は足さない
        self.assertEqual([r[6] for r in items(self.build("K-10"))], ["K7-UI-001", "K57-UI-001", "K7-UI-002", *k5])

    # ── 止まる所 ──
    def test_K188_HS_005_empty_cells_stop_and_write_nothing(self) -> None:
        msg = self.stops("K-3")
        for want in ("K3-UI-001", "操作手順", "K3-UI-002", "期待結果"):
            self.assertIn(want, msg)
        self.assertNotIn("K3-UI-003", msg)
        self.assertFalse(self.out("K-3").exists(), "穴のある冊を作っている")
        # 前の冊があるとき：1 バイトも変えない
        p = self.build()
        before = p.read_bytes()
        put(self.root, {SPEC_A: spec(*A_ROWS[:3], row("K5-UI-002", "K-5", pre=" "), *A_ROWS[4:])})
        msg = self.stops("K-5")
        self.assertIn("K5-UI-002", msg)
        self.assertIn("前提条件", msg)
        self.assertEqual(p.read_bytes(), before)

    def test_K188_HS_015_ticket_without_screen_rows_stops(self) -> None:
        self.assertIn("K-2", self.stops("K-2"))
        self.assertFalse(self.out("K-2").exists())

    def test_K188_HS_016_unreadable_previous_book_is_not_overwritten(self) -> None:
        p = self.out("K-5")
        p.parent.mkdir(parents=True)
        p.write_bytes(b"this is not an xlsx")
        self.assertIn("K-5.xlsx", self.stops("K-5"))
        self.assertEqual(p.read_bytes(), b"this is not an xlsx")

    def test_K188_HS_018_broken_spec_stops(self) -> None:
        put(self.root, {"07_qa/test-specs/k/c.md": spec(row("K5-UI-001", "K-5", item="重なった ID"))})
        self.assertIn("K5-UI-001", self.stops("K-5"))
        self.assertFalse(self.out("K-5").exists())
        put(self.root, {"07_qa/test-specs/k/c.md": spec("| K5-UI-009 | approvals | 操作 | 欄が足りない | 前提 | 押す | K-5 | L1 |\n")})
        msg = self.stops("K-5")
        self.assertTrue("K5-UI-009" in msg or "c.md" in msg, msg)
        self.assertFalse(self.out("K-5").exists())

    def test_K188_HS_019_multiline_depends_on_stops(self) -> None:
        put(self.root, {"11_tickets/K-11.md": "---\nid: K-11\ntitle: 中間\nkind: QA\nparent: K-0\ndepends_on:\n  - K-7\n---\n本文\n"})
        self.assertIn("depends_on", self.stops("K-11"))
        self.assertFalse(self.out("K-11").exists())

    # ── 作り直し ──
    def test_K188_HS_006_results_follow_the_pattern_id(self) -> None:
        p = self.build()
        fill(p, {"K5-UI-001": R_OK, "K5-UI-002": R_NG})
        # 並びを変え（002 を先頭へ）、画面と観点の欄だけを変える。検証内容と確認項目は同じ
        put(self.root, {SPEC_A: spec(
            row("K5-UI-002", "K-5", screen="approvals2", axis="状態", item="理由が空", op="空で押す", exp="「理由を書いてください」と出る"),
            row("K5-UI-001", "K-5", screen="approvals2", pre=r"承認待ちが 1 件（a\|b）", note="D-1 の決まり"), *A_ROWS[1:3], *A_ROWS[4:])})
        got = by_id(self.build())
        self.assertEqual([r[6] for r in items(p)][:2], ["K5-UI-002", "K5-UI-001"])
        self.assertEqual(got["K5-UI-001"][9:15], R_OK)
        self.assertEqual(got["K5-UI-002"][9:15], R_NG)
        self.assertEqual(got["K5-UI-002"][1], "approvals2")
        self.assertEqual(got["K5-UI-003"][9:15], (None,) * 6)

    def test_K188_HS_007_added_and_removed_rows(self) -> None:
        p = self.build()
        fill(p, {"K5-UI-001": R_OK, "K5-UI-002": R_NG})
        # 002（結果あり）と 003（結果なし）が消え、004 が増える
        put(self.root, {SPEC_A: spec(A_ROWS[0], A_ROWS[1], row("K5-UI-004", "K-5", item="増えた行"), *A_ROWS[4:])})
        got = by_id(self.build())
        self.assertEqual(set(got), {"K5-UI-001", "K5-UI-004", "K61-UI-001", "K57-UI-001"})
        self.assertEqual(got["K5-UI-004"][9:15], (None,) * 6)
        self.assertEqual(got["K5-UI-001"][9:15], R_OK)
        old = table(book(p)["前の版の結果"], 1)
        self.assertEqual(len(old), 1, old)   # 結果を書いていない 003 は出ない
        self.assertEqual((old[0]["パターン番号"], old[0]["理由"], old[0]["OK/NG"], old[0]["備考"], old[0]["確認者"], old[0]["確認日"]),
                         ("K5-UI-002", "行が消えた", "NG", "文が違う", "高本", "2026-11-14"))

    def test_K188_HS_008_changed_content_resets_the_result(self) -> None:
        import human_sheet
        p = self.build()
        fill(p, {"K5-UI-001": R_OK, "K5-UI-002": R_OK})
        put(self.root, {SPEC_A: spec(*A_ROWS[:3], row("K5-UI-002", "K-5", axis="入力", item="理由が空", op="空で押す",
                                                       exp="「差し戻す理由を書いてください」と出る"), *A_ROWS[4:])})
        got = by_id(self.build())
        self.assertEqual(got["K5-UI-002"][9:15], (None,) * 6, "前の中身に対する OK が残っている")
        self.assertEqual(got["K5-UI-002"][8], "「差し戻す理由を書いてください」と出る")
        self.assertEqual(got["K5-UI-001"][9:15], R_OK)   # 変わっていない行は残る
        old = table(book(p)["前の版の結果"], 1)
        self.assertEqual([(o["パターン番号"], o["理由"], o["確認項目"], o["OK/NG"]) for o in old],
                         [("K5-UI-002", "中身が変わった", "「理由を書いてください」と出る", "OK")])
        k5 = next(x for x in human_sheet.progress(p) if x["ticket"] == "K-5")
        self.assertEqual((k5["done"], k5["ok"]), (1, 1))

    def test_K188_HS_009_human_sheets_are_carried_over(self) -> None:
        p = self.build()
        fill(p, {"K5-UI-002": R_NG})
        wb = book(p)
        issue = wb["課題管理"]
        self.assertEqual([c.value for c in issue[4]][:15], ["No", "パターン番号", "機能名/画面名", "現象内容", "対応内容", "ステータス", "記入日",
                                                           "記入者", "対応日", "対応者", "確認日", "確認者", "OK/NG", "エビデンス", "備考"])
        for col, v in zip("ABCDEFGH", (1, "K5-UI-002", "approvals", "文が違う", "文を直す", "対応中", "2026-11-14", "高本")):
            issue[f"{col}5"] = v
        ev = wb["エビデンス"]
        self.assertEqual([c.value for c in ev[3]][:6], ["No", "対応するパターン番号", "取得日", "取得者", "種別", "ファイル名／内容"])
        for col, v in zip("ABCDEF", (1, "K5-UI-002", "2026-11-14", "高本", "写真", "承認待ち の画面.png")):
            ev[f"{col}4"] = v
        pre = wb["試験前提条件"]
        label = {str(r[0].value): r for r in pre.iter_rows(min_row=3, max_col=3) if r[0].value}
        label["試験者"][2].value = "高本"
        label["試験期間"][2].value = "2026-11-13〜14"
        wb.save(p)
        put(self.root, {SPEC_A: spec(A_ROWS[0], *A_ROWS[1:3], *A_ROWS[4:])})   # 結果つきの 002 を消す → 前の版の結果に 1 行
        for _ in range(2):
            self.build()
            wb = book(p)
            self.assertEqual([c.value for c in wb["課題管理"][5]][:8], [1, "K5-UI-002", "approvals", "文が違う", "文を直す", "対応中", "2026-11-14", "高本"])
            self.assertEqual([c.value for c in wb["エビデンス"][4]][:6], [1, "K5-UI-002", "2026-11-14", "高本", "写真", "承認待ち の画面.png"])
            label = {str(r[0]): r for r in wb["試験前提条件"].iter_rows(min_row=3, max_col=3, values_only=True) if r[0]}
            self.assertEqual((label["試験者"][2], label["試験期間"][2]), ("高本", "2026-11-13〜14"))
            old = table(wb["前の版の結果"], 1)
            self.assertEqual([(o["パターン番号"], o["理由"], o["OK/NG"]) for o in old], [("K5-UI-002", "行が消えた", "NG")])

    def test_K188_HS_010_column_widths_are_carried_over(self) -> None:
        p = self.build()
        wb = book(p)
        wb["テスト項目"].column_dimensions["H"].width = 77
        wb["課題管理"].column_dimensions["D"].width = 55
        wb.save(p)
        self.build()
        wb = book(p)
        self.assertEqual(wb["テスト項目"].column_dimensions["H"].width, 77)
        self.assertEqual(wb["課題管理"].column_dimensions["D"].width, 55)

    def test_K188_HS_017_rebuild_without_changes_changes_nothing(self) -> None:
        p = self.build("K-9")
        fill(p, {"K7-UI-001": R_OK, "K5-UI-002": R_NG})
        self.build("K-9")
        first = dump(p)
        self.build("K-9")
        self.assertEqual(dump(p), first)
        self.assertEqual(by_id(p)["K5-UI-002"][9:15], R_NG)

    # ── 進み・前提条件・名前・命令 ──
    def test_K188_HS_011_progress_counts_ok_and_ng_only(self) -> None:
        import human_sheet
        p = self.build("K-9")
        blank = (None,) * 6
        fill(p, {"K7-UI-001": R_OK, "K57-UI-001": R_NG, "K7-UI-002": (None, None, None, "保留", None, None),
                 "K5-UI-001": R_OK, "K5-UI-002": blank})
        got = {x["ticket"]: (x["items"], x["done"], x["ok"], x["ng"]) for x in human_sheet.progress(p)}
        self.assertEqual(got, {"K-7": (3, 2, 1, 1), "K-5": (2, 1, 1, 0), "K-6": (1, 0, 0, 0), "K-61": (1, 0, 0, 0)})
        ws = book(p)["進捗サマリ"]
        self.assertEqual([c.value for c in ws[3]][:9], ["No", "チケット", "題", "項目数", "消化数", "OK数", "NG数", "消化率", "合格率"])
        for cell in ws[4][3:9]:
            self.assertTrue(str(cell.value).startswith("="), f"{cell.coordinate} が式でない: {cell.value!r}")
        self.assertIn("テスト項目", str(ws["D4"].value))
        r = subprocess.run([sys.executable, str(SCRIPT), "--root", str(self.root), "--status", "K-9"], capture_output=True, text=True)
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertIn("K-7", r.stdout)

    def test_K188_HS_012_preconditions_point_to_where_to_look(self) -> None:
        ws = book(self.build("K-9"))["試験前提条件"]
        rows = {str(r[0]): str(r[1] or "") for r in ws.iter_rows(min_row=3, max_col=2, values_only=True) if r[0]}
        for label in ("試験目的", "対象", "試験範囲", "参照資料", "試験環境", "立ち上げ方", "URL とアカウント", "必要な準備", "判定基準",
                      "NG のとき", "エビデンスの置き方", "試験者", "確認者", "試験期間"):
            self.assertIn(label, rows)
        for want in ("K-9", "中間テスト", "K-7", "AI に任せる", "K-5", "承認して完了する"):
            self.assertIn(want, rows["対象"])
        self.assertIn("7", rows["試験範囲"])   # 画面の行の数
        self.assertIn("scripts/dev/up.sh", rows["立ち上げ方"])
        self.assertIn("11_tickets/K-9.md", rows["参照資料"])
        self.assertIn("a 承認 の表.md", rows["参照資料"])
        for sheet in book(self.out("K-9")):
            for r in sheet.iter_rows(values_only=True):
                for v in r:
                    self.assertIsNone(re.search(r"https?://", str(v or "")), f"{sheet.title} に URL の値: {v!r}")

    def test_K188_HS_013_spec_file_names_with_japanese_and_spaces(self) -> None:
        put(self.root, {"07_qa/test-specs/k/登録 する 表.md": spec(row("K50-UI-002", "K-50", item="日本語の名前のファイルの行"))})
        self.assertEqual([r[6] for r in items(self.build("K-50"))], ["K50-UI-001", "K50-UI-002"])

    def test_K188_HS_014_cli(self) -> None:
        run = lambda *a: subprocess.run([sys.executable, str(SCRIPT), *a], capture_output=True, text=True)   # noqa: E731
        r = run("--root", str(self.root), "K-5")
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertEqual(len(items(self.out("K-5"))), 5)
        r = run("--root", str(self.root), "K-99")
        self.assertNotEqual(r.returncode, 0)
        self.assertIn("K-99", r.stderr)
        self.assertFalse(self.out("K-99").exists())
        self.assertEqual(run().returncode, 2)   # 引数が足りない


class Config(unittest.TestCase):
    def test_K188_HS_020_ci_parts_and_catalog(self) -> None:
        req = (ROOT / "scripts/ci/requirements-ci.txt").read_text(encoding="utf-8").splitlines()
        self.assertEqual(len([x for x in req if re.fullmatch(r"openpyxl==\d+(\.\d+)+", x.strip())]), 1, req)
        self.assertTrue(SCRIPT.is_file())
        cat = json.loads((ROOT / "scripts/ci/generated.json").read_text(encoding="utf-8"))
        outs = [o for g in cat["generators"] for o in g.get("outputs", [])]
        self.assertEqual([o for o in outs if o.startswith("07_qa/human")], [])


if __name__ == "__main__":
    unittest.main(verbosity=2)
