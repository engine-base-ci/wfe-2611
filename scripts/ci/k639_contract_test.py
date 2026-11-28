#!/usr/bin/env python3
"""K-639 の契約の試験：引き取りの契約（記憶の口の行 K639-SHAPE-001・002 は K-712 が口ごと外した・D-152.20）（08_api/openapi.yaml・元は 05_flow/screen_api.py と screen_api.d/K-639.py）が口の振る舞いと同じ形か。
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
    def test_K639_SHAPE_003_claim_declares_404_for_an_unusable_code(self) -> None:
        r404 = response("claimPairingCode", "404")
        self.assertTrue(r404, "404 が契約に無い")
        self.assertIn("E-CONN-013", r404.get("description", ""))
        self.assertNotIn("E-CONN-013", response("claimPairingCode", "422").get("description", ""))
        self.assertEqual([x for x in unexpressible("claimPairingCode") if "E-CONN-013" in x], [])

    def test_K639_SHAPE_007_no_unexpressible_422_is_left_for_what_the_contract_now_writes(self) -> None:
        for op in ("signInWithPassword", "verifySignInCode"):   # 記憶の 2 本は K-712 で契約から外した（D-152.20）
            r = response(op, "422")
            self.assertNotIn("x-unexpressible-422", r, op)
            self.assertNotIn("契約に書けない", r.get("description", ""), op)


if __name__ == "__main__":
    unittest.main(verbosity=2)
