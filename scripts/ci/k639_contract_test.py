#!/usr/bin/env python3
"""K-639 の契約の試験：記憶・引き取りの契約（08_api/openapi.yaml・元は 05_flow/screen_api.py と screen_api.d/K-639.py）が口の振る舞いと同じ形か。
行 ID は K639-SHAPE-NNN（11_tickets/K-639.md の表と 1 対 1）。作り手を回した後の契約を読む。口そのものの答えは apps/api/test/features/contract/k639-pm-fuzz.test.ts。
"""
from __future__ import annotations

import sys
import unittest

sys.path.insert(0, __import__("pathlib").Path(__file__).resolve().parent.as_posix())
from pm_fuzz_contract import fits, response  # noqa: E402


def unexpressible(op: str) -> list[str]:
    return response(op, "422").get("x-unexpressible-422", [])


class K639ContractTest(unittest.TestCase):
    def test_K639_SHAPE_001_memory_body_is_text(self) -> None:
        self.assertTrue(fits("updateMemory", {"body": "覚える"}))
        self.assertTrue(fits("updateMemory", {"title": None, "body": "覚える"}))
        for b in [{"body": None}, {}, {"body": ""}, {"body": "  "}, {"body": 1}]:
            self.assertFalse(fits("updateMemory", b), b)
        # 記憶を作る口も、覚えること null は契約に合わない（無いのは合う・実物の失敗は両方の口の body が null）
        self.assertTrue(fits("createMemory", {}))
        self.assertTrue(fits("createMemory", {"body": "覚える", "kind_id": None, "approved_by": "3fa85f64-5717-4562-b3fc-2c963f66afa6"}))
        for b in [{"body": None}, {"title": "題", "body": None}, {"body": 1}]:
            self.assertFalse(fits("createMemory", b), b)

    def test_K639_SHAPE_002_create_memory_kind_and_confidence_match_the_database(self) -> None:
        for kind in ["rule", "preference", "example", None]:
            self.assertTrue(fits("createMemory", {"kind_id": kind}), kind)
        self.assertFalse(fits("createMemory", {"kind_id": "k639-無い種類"}))
        for c in ["0", "9", "9.9", "9.99", "9.994", "-9.99", "8.999999"]:
            self.assertTrue(fits("createMemory", {"confidence": c}), c)
        for c in ["9.995", "-9.995", "9.9951", "10", "99", "abc", ""]:
            self.assertFalse(fits("createMemory", {"confidence": c}), repr(c))

    def test_K639_SHAPE_003_claim_declares_404_for_an_unusable_code(self) -> None:
        r404 = response("claimPairingCode", "404")
        self.assertTrue(r404, "404 が契約に無い")
        self.assertIn("E-CONN-013", r404.get("description", ""))
        self.assertNotIn("E-CONN-013", response("claimPairingCode", "422").get("description", ""))
        self.assertEqual([x for x in unexpressible("claimPairingCode") if "E-CONN-013" in x], [])

    def test_K639_SHAPE_007_no_unexpressible_422_is_left_for_what_the_contract_now_writes(self) -> None:
        for op in ("updateMemory", "createMemory", "signInWithPassword", "verifySignInCode"):
            r = response(op, "422")
            self.assertNotIn("x-unexpressible-422", r, op)
            self.assertNotIn("契約に書けない", r.get("description", ""), op)


if __name__ == "__main__":
    unittest.main(verbosity=2)
