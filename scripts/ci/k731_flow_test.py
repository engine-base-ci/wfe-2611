#!/usr/bin/env python3
"""K-731 の試験（流れ：flow.json の行為 A104・A106 の古い文）。行 ID は K731-FL-NNN（11_tickets/K-731.md の表と 1 対 1）。
作る段で 05_flow/phase1.py の 2 行を直し、作り手（cd 05_flow && python3 build_flow.py → python3 scripts/tickets/regen_all.py）で flow.json を作り直してから緑になる
（切る段の枝では赤）。テストはチケットを作る人が書き、実装する人は変えない"""
from __future__ import annotations

import json
import pathlib
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[2]
FLOW = json.loads((ROOT / "05_flow" / "flow.json").read_text(encoding="utf-8"))
ACTS = {a["id"]: a for ph in FLOW["backbone"] for a in ph["acts"]}
BP = FLOW["blueprint"]


class FlowTest(unittest.TestCase):
    def test_K731_FL_001_a104(self) -> None:
        """行為 A104（AI に任せる）の裏側の文が新しい形：確認項目を 1 つずつ確かめ、確かめられた物にチェックを付けてから終わりを知らせる。「業務の型」「ルール」「別のセッションで 2 回」が無い。根拠に D-153.2・D-153.18・D-153.19 を持ち、元の根拠も残る"""
        auto = BP["A104"]["auto"]
        for w in ("確認項目", "チェックを付け"):
            self.assertIn(w, auto)
        for w in ("業務の型", "ルール", "別のセッション"):
            self.assertNotIn(w, auto)
        src = set(ACTS["A104"]["source"])
        self.assertTrue({"D-153.2", "D-153.18", "D-153.19", "D-125.42"} <= src, src)
        self.assertEqual(BP["A104"]["choke_points"], ["C3", "C5", "C2"])

    def test_K731_FL_002_a106(self) -> None:
        """行為 A106（完了にする）の文が新しい形：行為の名前に「ナレッジ更新の候補を確定」「作らない理由」「ナレッジに残す」が無く、裏側の文に「ナレッジ更新の候補」「ナレッジに残す」が無い（代表の言葉 2026-11-22 19:50・D-153.15）。裏側の文は実行後の確認の結果を言い、根拠に D-153.15 を持つ"""
        self.assertNotRegex(ACTS["A106"]["act"], "候補を確定|作らない理由|ナレッジに残す")
        self.assertNotIn("ナレッジ更新の候補", BP["A106"]["auto"])
        self.assertNotIn("ナレッジに残す", BP["A106"]["auto"])
        self.assertIn("確認の結果", BP["A106"]["auto"])
        self.assertIn("D-153.15", ACTS["A106"]["source"])
        self.assertTrue({"D-125.55", "D-125.110"} <= set(ACTS["A106"]["source"]))


if __name__ == "__main__":
    unittest.main()
