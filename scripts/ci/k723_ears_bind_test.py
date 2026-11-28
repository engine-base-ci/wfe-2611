#!/usr/bin/env python3
"""K-723 の形の試験：段 10 のナレッジの口 25 本の生成の試験の結びを、チケットの表（11_tickets/K-723.md）と、口の葉の md の行 ID と、
`07_qa/test-plan/ears-elsewhere.d/K-<葉>.json` と、作り手が作った生成の試験に照らす。行 ID は K723-BD-NNN。道具は ears_bind_lib.py。
チケットの CI（G65）で流れる。staging にもつながらない"""
from __future__ import annotations

import json
import pathlib
import sys
import unittest

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import ears_bind_lib as L  # noqa: E402

ROOT = L.ROOT
TICKET = ROOT / "11_tickets" / "K-723.md"
LEAVES = ["K-676", "K-677", "K-678", "K-679", "K-680", "K-681", "K-685", "K-686", "K-687", "K-688", "K-689", "K-690", "K-695"]
ROWS = L.table_rows(TICKET)


class KnowledgeBind(unittest.TestCase):
    def test_K723_BD_001_table_covers_every_op(self) -> None:
        self.assertEqual(len(ROWS), 25, "表はナレッジの口 25 本")
        self.assertEqual(sorted({str(r["leaf"]) for r in ROWS}), LEAVES, "表の葉は 13 枚")
        for leaf in LEAVES:
            frag_ops = sorted(L.fragment(leaf))
            table_ops = sorted(str(r["op"]) for r in ROWS if r["leaf"] == leaf)
            self.assertEqual(table_ops, frag_ops, f"{leaf}：表の口と断片の口が過不足なく合う")
        ops = [str(r["op"]) for r in ROWS]
        self.assertEqual(len(ops), len(set(ops)), "同じ口を 2 つの断片が持たない（ears_elsewhere は口ごとに 1 つ）")

    def test_K723_BD_002_row_ids_exist_in_leaves(self) -> None:
        self.assertEqual(L.problems_row_ids(ROWS), [], "表の行 ID が口の葉の md の行に在る")
        self.assertEqual(L.problems_missing_fragment(ROWS), [])

    def test_K723_BD_003_table_matches_fragments(self) -> None:
        self.assertEqual(L.problems_table_vs_fragment(ROWS), [], "断片の covers が表の行 ID と合う")

    def test_K723_BD_004_external_marks_exist(self) -> None:
        self.assertEqual(L.problems_external_marks(ROWS), [], "入口の共通の試験への結び（terms・session）の mark が在る")

    def test_K723_BD_005_na_reasons(self) -> None:
        self.assertEqual(L.problems_na_reasons(ROWS), [], "na の理由が 15 字以上")

    def test_K723_BD_006_no_todo_left(self) -> None:
        self.assertEqual(L.problems_todo_left([str(r["op"]) for r in ROWS]), [], "生成の試験に結ばれていない it.todo が残っていない")

    def test_K723_BD_007_complete_ticket_409_bound(self) -> None:
        # K-701 が足した completeTicket の 409（E-KNW-240）の名前は _base.json で K701-API-001 に結ぶ（同じ口の断片は _base.json と重なれない）
        base = json.loads(L.read(L.FRAG_DIR / "_base.json"))["ops"]["completeTicket"]
        # 行は別のファイル（features/F9/knowledge-complete-guard.test.ts）に在るので、K-701 は {file, mark} の形で結んだ。どちらの形も数える
        ids = {
            v if isinstance(v, str) else v.get("mark")
            for k, v in base.get("covers", {}).items()
            if "conflict" in k and isinstance(v, (str, dict))
        }
        self.assertIn("K701-API-001", ids)
        self.assertIn("K701-API-001", L.leaf_row_ids("K-701"))
        self.assertEqual(L.problems_todo_left(["completeTicket"]), [])

    def test_K723_BD_008_leaf_files_unique(self) -> None:
        names = [json.loads(L.read(L.FRAG_DIR / f"{leaf}.json")) for leaf in LEAVES if (L.FRAG_DIR / f"{leaf}.json").is_file()]
        self.assertEqual(len(names), len(LEAVES), "13 枚の断片が全部在る")


if __name__ == "__main__":
    unittest.main()
