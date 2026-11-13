#!/usr/bin/env python3
"""K-187 の試験：切る段の枝から 1 本の分を持ち込む台本（scripts/tickets/cut_take.py）。行 ID は K187-CT-NNN"""
from __future__ import annotations

import json
import pathlib
import subprocess
import sys
import tempfile
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts" / "tickets"))
SHARED = "apps/api/test/features/contract/k144-contract.test.ts"
EARS = "07_qa/test-plan/ears-elsewhere.json"


def git(repo: pathlib.Path, *a: str) -> str:
    return subprocess.run(["git", "-C", str(repo), *a], check=True, capture_output=True, text=True).stdout


def put(repo: pathlib.Path, files: dict[str, str]) -> None:
    for k, v in files.items():
        p = repo / k
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(v, encoding="utf-8")


def ticket(tid: str, tests: list[str], carry: list[str] | None = None) -> str:
    return f"---\nid: {tid}\ntests: [{', '.join(tests)}]\n" + (f"carry: [{', '.join(carry)}]\n" if carry else "") + "---\n本文\n"


class CutTake(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = tempfile.TemporaryDirectory()
        self.repo = pathlib.Path(self.tmp.name) / "repo"
        self.repo.mkdir()
        git(self.repo, "init", "-q", "-b", "main")
        git(self.repo, "config", "user.email", "t@example.invalid")
        git(self.repo, "config", "user.name", "t")
        put(self.repo, {SHARED: "const A = 1;\n", EARS: json.dumps({"ops": {"oldOp": {"file": "t/old.test.ts", "covers": {"a": "X"}}}}),
                        "t/old.test.ts": "old\n", "11_tickets/K-1.md": ticket("K-1", [])})
        git(self.repo, "add", "-A")
        git(self.repo, "commit", "-qm", "K-1 feat: 土台")
        git(self.repo, "checkout", "-q", "-b", "c/x")
        put(self.repo, {
            SHARED: "\n".join([
                "const A = 1;",
                'import { a } from "./a"; // K-1',
                "const mine = 1; // K-5（自分の行）",
                "const other = 2; // K-6",
                "const other2 = 3; // K-6：注つき",
                "// K-6 ここから",
                "const block = 4;",
                "// K-6 ここまで",
                "// K-5 ここから：自分の範囲",
                "const mineBlock = 5;",
                "// K-5 ここまで",
                "const plain = 6;",
                ""]),
            EARS: json.dumps({"ops": {
                "oldOp": {"file": "t/old.test.ts", "covers": {"a": "X", "b": {"file": "t/gone.test.ts", "mark": "M"}}},
                "myOp": {"file": "t/k5.test.ts", "covers": {"c": "K5-API-001", "d": {"file": "t/gone.test.ts", "mark": "M"}}},
                "laterOp": {"file": "t/k6.test.ts", "covers": {"e": "K6-API-001"}}}}),
            "11_tickets/K-5.md": ticket("K-5", ["t/k5.test.ts", "apps/api/test/generated/x.test.ts"], ["docs/仕様 の表.md"]),
            "11_tickets/K-6.md": ticket("K-6", ["t/k6.test.ts"]),
            "t/k5.test.ts": "k5 の試験\n", "t/k6.test.ts": "k6\n", "apps/api/test/generated/x.test.ts": "切る段の生成の試験\n",
            "docs/仕様 の表.md": "切る段の版\n"})
        git(self.repo, "add", "-A")
        git(self.repo, "commit", "-qm", "cut: まとめて切る")
        git(self.repo, "checkout", "-q", "main")
        git(self.repo, "checkout", "-q", "-b", "t/K-5")

    def tearDown(self) -> None:
        self.tmp.cleanup()

    def take(self, tid: str = "K-5") -> None:
        import cut_take
        cut_take.take(self.repo, tid, "c/x", shared=[SHARED], regenerate=False)

    def test_K187_CT_001_marked_lines_of_unmerged_tickets_are_dropped(self) -> None:
        self.take()
        s = (self.repo / SHARED).read_text(encoding="utf-8")
        for keep in ("const A = 1;", "// K-1", "const mine = 1;", "const mineBlock = 5;", "const plain = 6;"):
            self.assertIn(keep, s)
        for gone in ("const other = 2;", "const other2 = 3;", "const block = 4;", "K-6 ここから", "K-6 ここまで"):
            self.assertNotIn(gone, s)

    def test_K187_CT_002_ears_blocks_follow_existing_test_files(self) -> None:
        self.take()
        ops = json.loads((self.repo / EARS).read_text(encoding="utf-8"))["ops"]
        self.assertEqual(sorted(ops), ["myOp", "oldOp"])
        self.assertEqual(ops["oldOp"]["covers"], {"a": "X"})
        self.assertEqual(ops["myOp"]["covers"], {"c": "K5-API-001"})

    def test_K187_CT_003_handwritten_tests_and_carry_are_copied_generated_are_not(self) -> None:
        self.take()
        self.assertEqual((self.repo / "t/k5.test.ts").read_text(encoding="utf-8"), "k5 の試験\n")
        self.assertTrue((self.repo / "11_tickets/K-5.md").is_file())
        self.assertFalse((self.repo / "apps/api/test/generated/x.test.ts").exists(), "生成の試験を写している")
        self.assertFalse((self.repo / "t/k6.test.ts").exists(), "ほかのチケットの試験を写している")
        self.assertFalse((self.repo / "11_tickets/K-6.md").exists(), "ほかのチケットの md を写している")

    def test_K187_CT_004_missing_ticket_or_test_stops_with_reason(self) -> None:
        import cut_take
        with self.assertRaises(SystemExit) as e:
            cut_take.take(self.repo, "K-9", "c/x", shared=[SHARED], regenerate=False)
        self.assertIn("K-9", str(e.exception))
        git(self.repo, "checkout", "-q", "c/x")
        (self.repo / "t/k5.test.ts").unlink()
        git(self.repo, "commit", "-qam", "cut: 試験を消す")
        git(self.repo, "checkout", "-q", "t/K-5")
        with self.assertRaises(SystemExit) as e:
            cut_take.take(self.repo, "K-5", "c/x", shared=[SHARED], regenerate=False)
        self.assertIn("t/k5.test.ts", str(e.exception))
        self.assertFalse((self.repo / "11_tickets/K-5.md").exists(), "途中まで写して終わっている")

    def test_K187_CT_005_names_with_japanese_and_spaces_are_kept(self) -> None:
        self.take()
        self.assertEqual((self.repo / "docs/仕様 の表.md").read_text(encoding="utf-8"), "切る段の版\n")


class Config(unittest.TestCase):
    def test_K187_CT_006_ticket_flow_points_at_the_script(self) -> None:
        import yaml
        cfg = yaml.safe_load((ROOT / "ticket-flow.yaml").read_text(encoding="utf-8"))
        self.assertEqual((cfg.get("cut") or {}).get("take"), "python3 scripts/tickets/cut_take.py {ticket} {ref}")
        self.assertTrue((ROOT / "scripts/tickets/cut_take.py").is_file())


if __name__ == "__main__":
    unittest.main(verbosity=2)
