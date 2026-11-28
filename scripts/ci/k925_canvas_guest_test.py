#!/usr/bin/env python3
"""K-925 の試験：キャンバスの絵の元データから「取引先」の絵と検収の絵を外す（段 12・D-155.35・D-155.44）。

  python3 scripts/ci/k925_canvas_guest_test.py      行 ID は K925-DS-NNN（11_tickets/K-925.md の表と 1 対 1）

決まり：
  ・取引先を持たない（D-155.35）・検収を作らない（D-155.44）。取引先と検収を描いた絵 9 枚（REMOVED）を、絵・作り手・登録（canvas.json・
    canvas-screens.json・canvas_layout_ledger.json）から外す。絵の左のメニューの 1 項目は K-870 が先に「届いた依頼」にしてある（この葉はその後）。
  ・「取引先」の字が残ってよいのは、段 5（チケットの詳細の欄・作る小窓）・段 10（ルール・ナレッジ）・ワークスペースの設定の持ち物の絵だけ（CARRY）。
    その絵は、この葉では字を直さず各段に申し送る。ほかの絵に「取引先」が在れば赤。
  ・検収の押す所（「先方に確かめてもらう」ほか）はチケットの詳細の絵 21 枚にもある。押す所だけを外す（成果物のカードそのものは段 6）。
テストはチケットを作る人が書き、実装する人は変えない（D-128.125）
"""
from __future__ import annotations

import glob
import json
import os
import pathlib
import re
import subprocess
import sys
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[2]
CANVAS = ROOT / "04_design" / "canvas"
GEN = ROOT / "04_design" / "canvas_gen"
# 外す絵（ファイルごと）：取引先の一覧・1 社のページ・人と見せ方・検収を頼む小窓・先方の検収・取引先を足す小窓・先方の人を招く小窓・はじめての取引先・スマホの取引先
REMOVED = ("CuList", "CuPage", "CuShare", "CuReview", "CpReview", "EdClient", "EdContact", "OnClients", "MbClients")
# 検収の押す所・見出しの字（絵と作り手のどこにも残さない）
KENSHU_WORDS = ("検収", "確かめてもらう", "確認してほしいもの", "OK／直してほしい")
# 「取引先」の字を持ち越してよい絵（段 5・段 10・設定の持ち物。K-925 は字を直さず各段に申し送る）
CARRY = {
    "ApprovalsFocus", "Create", "EdApproval", "EdDeleteWs", "EdMove", "EdParent", "EdPlan",
    "EdRule", "EdSection", "EdTypeChange", "KnEdit", "KnHome", "KnImport",
    "KnLinks", "KnNew", "KnPage", "KnProposal", "List", "LsBulk",
    "LsFilter", "LsSave", "LsView", "MbCreate", "MbKnowledge", "MbMenu",
    "OpNotices", "OpPlans", "RoomAddRule", "RoomKnows", "RoomType", "StBefore",
    "StConfirmDone", "StCreateAi", "StDelegated", "StDone", "StFailed", "StRunning",
    "TdAssignee", "TdCheck", "TdDecision", "TdDelete", "TdDue", "TdDuplicate",
    "TdLink", "TdMore", "TdPreview", "TdRunLog", "TdTalk", "TicketDetail",
    "WsMember", "WsPriceChange", "WsSettings",
}
# この葉が字を直す絵（「取引先」も検収も残さない）
FIXED = ("CuRequests", "CpHome", "EdInquiry", "MeHelp")


def pictures() -> dict[str, str]:
    return {os.path.basename(p).replace(".dc.html", ""): pathlib.Path(p).read_text(encoding="utf-8") for p in glob.glob(str(CANVAS / "*.dc.html"))}


def gen_sources() -> dict[str, str]:
    return {os.path.basename(p): pathlib.Path(p).read_text(encoding="utf-8") for p in glob.glob(str(GEN / "*.py"))}


def run_py(*args: str) -> subprocess.CompletedProcess[str]:
    return subprocess.run([sys.executable, *args], cwd=ROOT, capture_output=True, text=True, timeout=600)


class RemovedPictures(unittest.TestCase):
    def test_K925_DS_001_pictures_and_registers(self) -> None:
        """外す 9 枚のファイルが無く、canvas.json（boards・order）・canvas-screens.json（どの画面にも共通にも）・canvas_layout_ledger.json に名前が出ない"""
        names = set(pictures())
        for n in REMOVED:
            self.assertNotIn(n, names, n)
            self.assertFalse((CANVAS / f"{n}.dc.html").exists(), n)
        reg = json.loads((CANVAS / "canvas.json").read_text(encoding="utf-8"))
        shown = json.dumps([reg["boards"], reg["order"]], ensure_ascii=False)
        scr = json.dumps(json.loads((ROOT / "04_design" / "canvas-screens.json").read_text(encoding="utf-8")), ensure_ascii=False)
        led = json.dumps(json.loads((ROOT / "scripts" / "ci" / "canvas_layout_ledger.json").read_text(encoding="utf-8")), ensure_ascii=False)
        for n in REMOVED:
            for label, text in (("canvas.json", shown), ("canvas-screens.json", scr), ("canvas_layout_ledger.json", led)):
                self.assertIsNone(re.search(r'"' + n + r'(\.dc\.html)?"', text), f"{label} に {n}")

    def test_K925_DS_002_generators(self) -> None:
        """作り手 04_design/canvas_gen/*.py が外した 9 枚の名前を出さない（作り直しても戻らない）"""
        bad = [(f, n) for f, src in gen_sources().items() for n in REMOVED if re.search(r"\b" + n + r"\b", src)]
        self.assertEqual(bad, [], bad[:10])

    def test_K925_DS_003_no_links_to_removed(self) -> None:
        """どの絵にも、外した絵への行き先（href="….dc.html"）が無い（取引先の欄の行き先は届いた依頼 CuRequests に付け替えてある）"""
        pat = re.compile(r'href="(' + "|".join(REMOVED) + r')\.dc\.html"')
        bad = sorted(n for n, s in pictures().items() if pat.search(s))
        self.assertEqual(bad, [], bad[:10])


class Words(unittest.TestCase):
    def test_K925_DS_004_no_kenshu_words(self) -> None:
        """検収の字（検収・確かめてもらう・確認してほしいもの・OK／直してほしい）が、どの絵にも作り手にも無い（チケットの詳細の絵 21 枚の「先方に確かめてもらう」の押す所を含む）"""
        bad = [(n, w) for n, s in pictures().items() for w in KENSHU_WORDS if w in s]
        bad += [(f, w) for f, s in gen_sources().items() for w in KENSHU_WORDS if w in s]
        self.assertEqual(bad, [], bad[:10])

    def test_K925_DS_005_clients_word_only_in_carry(self) -> None:
        """「取引先」の字が残る絵は CARRY（段 5・段 10・設定の持ち物）の中だけ。この葉が直す絵と外した絵のほかは、左のメニューの 1 項目も含めて 0。この葉が触る作り手（cu・on・edwire・shellfix。mb・linkfix は持ち越しの絵の字を持つので外す）に「取引先」が無い"""
        pics = pictures()
        have = {n for n, s in pics.items() if "取引先" in s}
        self.assertEqual(sorted(have - CARRY), [], sorted(have - CARRY))
        for n in FIXED:
            self.assertNotIn("取引先", pics[n], n)
        src = gen_sources()
        # mb.py（MbCreate・MbMenu・MbKnowledge）と linkfix.py（KnPage への行き先の字）の「取引先」は持ち越しの絵の字（段 5・段 10）。外した絵の名前が無いことは DS-002・003 が見る
        for f in ("cu.py", "on.py", "edwire.py", "shellfix.py"):
            self.assertNotIn("取引先", src[f], f)

    def test_K925_DS_006_guest_words(self) -> None:
        """この葉が直した絵：届いた依頼 CuRequests は同じゲストのグループの人に見える言い方・通知の見本（EdInquiry・MeHelp）は「ゲストのグループを足しました」・先方のホーム CpHome に「確認してほしいもの」の箱が無く依頼と見せてもらったチケットの 2 つが在る"""
        p = pictures()
        self.assertIn("同じゲストのグループの人にも見えている", p["CuRequests"])
        for n in ("EdInquiry", "MeHelp"):
            self.assertIn("ゲストのグループを足しました", p[n], n)
            self.assertNotIn("取引先の場所を足しました", p[n], n)
        self.assertNotIn("確認してほしい", p["CpHome"])
        self.assertIn("見せてもらったチケット", p["CpHome"])


class Consistency(unittest.TestCase):
    def test_K925_DS_007_registers_agree(self) -> None:
        """canvas.json の boards と .dc.html のファイルが 1 対 1・対応表 canvas-screens.json の画面と共通に外した絵が無い・台帳の絵は全部ファイルが在る"""
        reg = json.loads((CANVAS / "canvas.json").read_text(encoding="utf-8"))
        self.assertEqual({k.replace(".dc.html", "") for k in reg["boards"]}, set(pictures()))
        mp = json.loads((ROOT / "04_design" / "canvas-screens.json").read_text(encoding="utf-8"))
        every = [b for v in mp["screens"].values() for b in v] + list(mp["common"]["boards"])
        self.assertEqual([b for b in every if b in REMOVED], [])
        led = json.loads((ROOT / "scripts" / "ci" / "canvas_layout_ledger.json").read_text(encoding="utf-8"))["entries"]
        self.assertEqual([e["board"] for e in led if e["board"] not in pictures()], [])

    def test_K925_DS_008_gates(self) -> None:
        """canvas_gate.py（CV1〜CV4）・canvas_design_gate.py が 0 で終わる"""
        for g in ("scripts/ci/canvas_gate.py", "scripts/ci/canvas_design_gate.py"):
            r = run_py(g)
            self.assertEqual(r.returncode, 0, g + "\n" + r.stdout[-1200:] + r.stderr[-400:])


if __name__ == "__main__":
    unittest.main()
