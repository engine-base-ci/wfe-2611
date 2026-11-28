#!/usr/bin/env python3
"""K-328 の試験：秘密の検査の行足しをやめる（.gitleaks.toml の path で _fake/ だけを外す）・親と子が同じ口と試験を持てば子を持ち主にする。

  python3 scripts/ci/k328_secrets_parents_test.py      行 ID は K328-SEC-NNN・K328-PAR-NNN（チケット 11_tickets/K-328.md の表の行と 1 対 1）
"""
from __future__ import annotations

import json
import pathlib
import re
import sys
import tomllib
import unittest

ROOT = pathlib.Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(ROOT / "scripts" / "ci"))
sys.path.insert(0, str(ROOT / "scripts" / "tickets"))

API_FAKE = ROOT / "apps/api/test/_fake/secrets.ts"
WEB_FAKE = ROOT / "apps/web/test/_fake/secrets.ts"
VALUES = {
    "test-secret-0123456789-abcdefghijklmnop": API_FAKE,
    "test-secret-k313-0123456789-abcdefghij": API_FAKE,
    "test-secret-k314-0123456789-abcdefghij": API_FAKE,
    "fuzz-test-secret-0123456789-abcdefghij": API_FAKE,
    "k262-edge-secret-0123456789abcdef": None,  # api と web の両方が使う：どちらかに在ればよい
    "rp_k320_0123456789abcdefghijklmnopqrstuv": WEB_FAKE,
}


def toml() -> dict:
    return tomllib.loads((ROOT / ".gitleaks.toml").read_text(encoding="utf-8"))


class Secrets(unittest.TestCase):
    def test_K328_SEC_001_config_shape(self) -> None:
        c = toml()
        self.assertIs(c["extend"]["useDefault"], True)
        self.assertEqual(len(c["allowlists"]), 1)
        a = c["allowlists"][0]
        # K-350 が Bridge と通しの試験の置き場 2 つを足した（2026-11-19 PM の決め）
        self.assertEqual(sorted(a["paths"]), sorted(["^apps/api/test/_fake/", "^apps/web/test/_fake/",
                                                     "^apps/bridge/test/_fake/", "^apps/e2e/_fake/"]))
        for key in ("regexes", "stopwords", "commits"):
            self.assertNotIn(key, a)
        self.assertNotIn("allowlist", c)

    def test_K328_SEC_002_ignore_file_gone(self) -> None:
        self.assertFalse((ROOT / ".gitleaksignore").exists())

    def test_K328_SEC_003_fake_files_say_so(self) -> None:
        for p in (API_FAKE, WEB_FAKE):
            head = "\n".join(p.read_text(encoding="utf-8").splitlines()[:3])
            self.assertIn("本物の秘密ではない", head, p)
            self.assertIn(".gitleaks.toml", head, p)

    def test_K328_SEC_004_values_unchanged(self) -> None:
        api = API_FAKE.read_text(encoding="utf-8")
        web = WEB_FAKE.read_text(encoding="utf-8")
        for value, where in VALUES.items():
            text = {API_FAKE: api, WEB_FAKE: web}.get(where, api + web) if where else api + web
            self.assertIn(f'"{value}"', text, value)
        self.assertIn('"k262-edge-secret-0123456789abcdef"', web)

    def test_K328_SEC_005_paths_hit_only_fake_dirs(self) -> None:
        rx = [re.compile(p) for p in toml()["allowlists"][0]["paths"]]
        hit = lambda s: any(r.search(s) for r in rx)  # noqa: E731
        self.assertTrue(hit("apps/api/test/_fake/secrets.ts"))
        self.assertTrue(hit("apps/web/test/_fake/secrets.ts"))
        self.assertTrue(hit("apps/bridge/test/_fake/secrets.ts"))
        self.assertTrue(hit("apps/e2e/_fake/secrets.ts"))
        for miss in ("apps/api/test/fuzz/server.ts", "apps/api/test/_fake2/x.ts", "apps/web/tests/_fake/x.ts",
                     "apps/bridge/src/_fake/x.ts", "apps/e2e/journeys/_fake/x.ts"):
            self.assertFalse(hit(miss), miss)

    def test_K328_SEC_006_scope_map(self) -> None:
        paths = json.loads((ROOT / "scripts/ci/ci_scope.json").read_text(encoding="utf-8"))["no_test_paths"]
        self.assertIn(".gitleaks.toml", paths)
        self.assertNotIn(".gitleaksignore", paths)


def ticket(tid: str, parent: str = "", apis: list[str] | None = None, tests: list[str] | None = None,
           split: str = "") -> dict:
    return {"id": tid, "parent": parent, "apis": apis or [], "tests": tests or [], "split": split}


class Parents(unittest.TestCase):
    def test_K328_PAR_001_prefer_descendants(self) -> None:
        import build_index  # noqa: PLC0415
        parent_of = {"C": "P", "P": "G", "G": None, "X": None}
        self.assertEqual(build_index.prefer_descendants(["G", "P", "C"], parent_of), ["C"])
        self.assertEqual(build_index.prefer_descendants(["P", "X"], parent_of), ["P", "X"])

    def test_K328_PAR_002_parent_and_child_share_test(self) -> None:
        import test_owner_gate as g  # noqa: PLC0415
        ts = [ticket("K-1", tests=["a/x.test.ts"], split="これから"), ticket("K-2", parent="K-1", tests=["a/x.test.ts"])]
        bad = g.check(ts, ["a/x.test.ts"], {}, [])
        self.assertFalse([b for b in bad if b.startswith("TO2")], bad)

    def test_K328_PAR_003_siblings_still_stop(self) -> None:
        import test_owner_gate as g  # noqa: PLC0415
        ts = [ticket("K-1", split="これから"), ticket("K-2", parent="K-1", tests=["a/x.test.ts"]),
              ticket("K-3", parent="K-1", tests=["a/x.test.ts"])]
        to2 = [b for b in g.check(ts, ["a/x.test.ts"], {}, []) if b.startswith("TO2")]
        self.assertEqual(len(to2), 1, to2)
        self.assertIn("K-2", to2[0])
        self.assertIn("K-3", to2[0])

    def test_K328_PAR_004_parent_and_child_share_api(self) -> None:
        import test_owner_gate as g  # noqa: PLC0415
        gen = "apps/api/test/generated/post_x.test.ts"
        ts = [ticket("K-1", apis=["opX"], tests=[gen], split="これから"),
              ticket("K-2", parent="K-1", apis=["opX"], tests=[gen])]
        bad = g.check(ts, [gen], {gen: "opX"}, ["opX"])
        self.assertFalse([b for b in bad if b.startswith(("TO2", "TO4"))], bad)

    def test_K328_PAR_005_kc7_parent_and_child(self) -> None:
        import coverage_gate  # noqa: PLC0415
        ts = [ticket("K-1", apis=["opX"], split="これから"), ticket("K-2", parent="K-1", apis=["opX"])]
        self.assertEqual([t["id"] for t in coverage_gate.op_owners(ts)["opX"]], ["K-2"])

    def test_K328_PAR_006_kc7_siblings(self) -> None:
        import coverage_gate  # noqa: PLC0415
        ts = [ticket("K-1", split="これから"), ticket("K-2", parent="K-1", apis=["opX"]),
              ticket("K-3", parent="K-1", apis=["opX"])]
        self.assertEqual([t["id"] for t in coverage_gate.op_owners(ts)["opX"]], ["K-2", "K-3"])


if __name__ == "__main__":
    unittest.main(verbosity=2)
