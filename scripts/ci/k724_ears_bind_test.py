#!/usr/bin/env python3
"""K-724 の形の試験：段 10 のチケットの設定の口 14 本（種別 4・状態 5・項目 5）の生成の試験の結びを、チケットの表（11_tickets/K-724.md）と、
口の葉の md の行 ID と、`07_qa/test-plan/ears-elsewhere.d/K-<葉>.json` と、作り手が作った生成の試験に照らす。行 ID は K724-BD-NNN。
道具は K-723 が持ち込む ears_bind_lib.py。チケットの CI（G65）で流れる"""
from __future__ import annotations

import pathlib
import sys
import unittest

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import ears_bind_lib as L  # noqa: E402

TICKET = L.ROOT / "11_tickets" / "K-724.md"
LEAVES = ["K-704", "K-705", "K-706", "K-717"]
ROWS = L.table_rows(TICKET)


class SettingsBind(unittest.TestCase):
    def test_K724_BD_001_table_covers_every_op(self) -> None:
        self.assertEqual(len(ROWS), 14, "表は設定の口 14 本")
        for leaf in LEAVES:
            self.assertEqual(sorted(str(r["op"]) for r in ROWS if r["leaf"] == leaf), sorted(L.fragment(leaf)),
                             f"{leaf}：表の口と断片の口が過不足なく合う")

    def test_K724_BD_002_row_ids_exist_in_leaves(self) -> None:
        self.assertEqual(L.problems_row_ids(ROWS), [], "表の行 ID が口の葉の md の行に在る")
        self.assertEqual(L.problems_missing_fragment(ROWS), [])

    def test_K724_BD_003_table_matches_fragments(self) -> None:
        self.assertEqual(L.problems_table_vs_fragment(ROWS), [], "断片の covers が表の行 ID と合う")

    def test_K724_BD_004_external_marks_and_na(self) -> None:
        self.assertEqual(L.problems_external_marks(ROWS), [])
        self.assertEqual(L.problems_na_reasons(ROWS), [])

    def test_K724_BD_005_no_todo_left(self) -> None:
        # listTicketStages（読む口）の ok・shape は K705-API-001 に結ぶ（表の K-705 の行に在る）
        ops = [str(r["op"]) for r in ROWS]
        self.assertEqual(L.problems_todo_left(ops), [], "生成の試験に結ばれていない it.todo が残っていない")


if __name__ == "__main__":
    unittest.main()
