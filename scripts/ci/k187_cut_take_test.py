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
TAIL = ["const p1 = 0;", "const p2 = 0;", "const p3 = 0;", "const p4 = 0;", "const Z = 26;", ""]
BASE_SHARED = "\n".join(["const A = 1;", *TAIL])


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
        put(self.repo, {SHARED: BASE_SHARED, EARS: json.dumps({"ops": {"oldOp": {"file": "t/old.test.ts", "covers": {"a": "X"}}}}),
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
                "const ten = 10; // K-10",
                "const fifty = 50; // K-50（自分 K-5 と頭が同じ）",
                "// K-6 ここから",
                "const block = 4;",
                "// K-6 ここまで",
                "// K-5 ここから：自分の範囲",
                "const mineBlock = 5;",
                "// K-5 ここまで",
                "const plain = 6;",
                *TAIL]),
            EARS: json.dumps({"ops": {
                "oldOp": {"file": "t/old.test.ts", "covers": {"a": "X", "b": {"file": "t/gone.test.ts", "mark": "M"}}},
                "myOp": {"file": "t/k5.test.ts", "covers": {"c": "K5-API-001", "d": {"file": "t/gone.test.ts", "mark": "M"},
                                                            "f": {"file": SHARED, "mark": "const other = 2"},      # 外した行を指す
                                                            "g": {"file": SHARED, "mark": "const mine = 1"}, "h": "無い題"}},
                "laterOp": {"file": "t/k6.test.ts", "covers": {"e": "K6-API-001"}}}}),
            "11_tickets/K-5.md": ticket("K-5", ["t/k5.test.ts", "apps/api/test/generated/x.test.ts"], ["docs/仕様 の表.md"]),
            "11_tickets/K-6.md": ticket("K-6", ["t/k6.test.ts"]),
            "t/k5.test.ts": "k5 の試験 K5-API-001\n", "t/k6.test.ts": "k6\n", "apps/api/test/generated/x.test.ts": "切る段の生成の試験\n",
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
        for gone in ("const other = 2;", "const other2 = 3;", "const block = 4;", "K-6 ここから", "K-6 ここまで",
                     "const ten = 10;", "const fifty = 50;"):   # K-1・K-5 と頭が同じ K-10・K-50 を取り違えない
            self.assertNotIn(gone, s)

    def test_K187_CT_002_ears_blocks_follow_existing_test_files(self) -> None:
        self.take()
        ops = json.loads((self.repo / EARS).read_text(encoding="utf-8"))["ops"]
        self.assertEqual(sorted(ops), ["myOp", "oldOp"])
        self.assertEqual(ops["oldOp"]["covers"], {"a": "X"})
        self.assertEqual((ops["oldOp"]["file"], ops["myOp"]["file"]), ("t/old.test.ts", "t/k5.test.ts"))
        # 指す先のファイルが無い（d）・共有の試験から外した行を指す（f）・題が試験に無い（h）は消える。置いた中身に印がある（c・g）は残る
        self.assertEqual(ops["myOp"]["covers"], {"c": "K5-API-001", "g": {"file": SHARED, "mark": "const mine = 1"}})

    def test_K187_CT_003_handwritten_tests_and_carry_are_copied_generated_are_not(self) -> None:
        self.take()
        self.assertEqual((self.repo / "t/k5.test.ts").read_text(encoding="utf-8"), "k5 の試験 K5-API-001\n")
        self.assertTrue((self.repo / "11_tickets/K-5.md").is_file())
        self.assertEqual((self.repo / "docs/仕様 の表.md").read_text(encoding="utf-8"), "切る段の版\n")   # carry:
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

    def test_K187_CT_007_unclosed_range_stops_and_writes_nothing(self) -> None:
        import cut_take
        git(self.repo, "checkout", "-q", "c/x")
        put(self.repo, {SHARED: "const A = 1;\n// K-6 ここから\nconst block = 4;\nconst after = 9;\n" + "\n".join(TAIL)})
        git(self.repo, "commit", "-qam", "cut: 閉じていない範囲")
        git(self.repo, "checkout", "-q", "t/K-5")
        with self.assertRaises(SystemExit) as e:
            cut_take.take(self.repo, "K-5", "c/x", shared=[SHARED], regenerate=False)
        self.assertIn("K-6", str(e.exception))
        self.assertIn("2 行目", str(e.exception))
        self.assertEqual((self.repo / SHARED).read_text(encoding="utf-8"), BASE_SHARED, "共有の試験を書き換えている")
        self.assertFalse((self.repo / "11_tickets/K-5.md").exists())

    def test_K187_CT_008_later_mainline_changes_are_kept(self) -> None:
        # 切る段の枝を切った後に、本線に共有の試験の行・ears の口・carry のファイルの行が入った
        git(self.repo, "checkout", "-q", "main")
        put(self.repo, {SHARED: BASE_SHARED + "const later = 7; // K-2\n",
                        EARS: json.dumps({"ops": {"oldOp": {"file": "t/old.test.ts", "covers": {"a": "X", "z": "後から"}},
                                                  "laterMain": {"file": "t/old.test.ts", "covers": {"y": "Y"}}}})})
        git(self.repo, "add", "-A")
        git(self.repo, "commit", "-qm", "K-2 feat: 本線に後から入った")
        git(self.repo, "checkout", "-q", "-B", "t/K-5", "main")
        self.take()
        s = (self.repo / SHARED).read_text(encoding="utf-8")
        self.assertIn("const later = 7; // K-2", s, "本線に後から入った行が消えた")
        self.assertIn("const mine = 1;", s)
        self.assertNotIn("const other = 2;", s)
        ops = json.loads((self.repo / EARS).read_text(encoding="utf-8"))["ops"]
        self.assertEqual(ops["oldOp"]["covers"], {"a": "X", "z": "後から"})
        self.assertIn("laterMain", ops)
        self.assertIn("myOp", ops)
        # ぶつかる形（同じ行を本線と切る段が別々に変えた）は止める
        git(self.repo, "checkout", "-q", "main")
        put(self.repo, {"docs/仕様 の表.md": "本線の版\n"})
        git(self.repo, "add", "-A")
        git(self.repo, "commit", "-qm", "K-3 docs: 本線でも作った")
        git(self.repo, "checkout", "-q", "-B", "t/K-5", "main")
        import cut_take
        with self.assertRaises(SystemExit) as e:
            cut_take.take(self.repo, "K-5", "c/x", shared=[SHARED], regenerate=False)
        self.assertIn("docs/仕様 の表.md", str(e.exception))

    def test_K187_CT_009_cli_exits_nonzero_with_reason(self) -> None:
        r = subprocess.run([sys.executable, str(ROOT / "scripts/tickets/cut_take.py"), "K-9", "c/x"], cwd=self.repo, capture_output=True, text=True)
        self.assertNotEqual(r.returncode, 0)
        self.assertIn("K-9", r.stderr)
        r = subprocess.run([sys.executable, str(ROOT / "scripts/tickets/cut_take.py")], cwd=self.repo, capture_output=True, text=True)
        self.assertEqual(r.returncode, 2)   # 引数が足りない
    def test_K187_CT_010_later_mainline_change_to_a_test_file_is_kept(self) -> None:
        # tests: のファイルが、切る段の枝を切った後に本線でも変わった（別の所）：両方の変更が残る
        git(self.repo, "checkout", "-q", "main")
        put(self.repo, {"t/shared.test.ts": "\n".join(["a", *TAIL])})
        git(self.repo, "add", "-A")
        git(self.repo, "commit", "-qm", "K-1 test: 共有の試験")
        git(self.repo, "checkout", "-q", "-B", "c/y", "main")
        put(self.repo, {"t/shared.test.ts": "\n".join(["a", "cut の行", *TAIL]), "11_tickets/K-7.md": ticket("K-7", ["t/shared.test.ts"])})
        git(self.repo, "add", "-A")
        git(self.repo, "commit", "-qm", "cut: K-7")
        git(self.repo, "checkout", "-q", "main")
        put(self.repo, {"t/shared.test.ts": "\n".join(["a", *TAIL]) + "本線の後からの行\n"})
        git(self.repo, "commit", "-qam", "K-2 test: 本線で後から")
        git(self.repo, "checkout", "-q", "-B", "t/K-7", "main")
        import cut_take
        cut_take.take(self.repo, "K-7", "c/y", shared=[], regenerate=False)
        s = (self.repo / "t/shared.test.ts").read_text(encoding="utf-8")
        self.assertIn("cut の行", s)
        self.assertIn("本線の後からの行", s, "本線に後から入った変更が消えた")

    def test_K187_CT_012_own_lines_right_below_a_later_merged_stack_base_are_added(self) -> None:
        # 重ねた元（K-6）が分かれ目の後に本線へ入り、切る段では K-6 の行のすぐ下に自分（K-5）の行がある（K-581 の形）
        git(self.repo, "checkout", "-q", "c/x")
        put(self.repo, {SHARED: "\n".join(["const A = 1;", "const s6 = 6; // K-6", "const s5 = 5; // K-5", *TAIL])})
        git(self.repo, "add", "-A")
        git(self.repo, "commit", "-qm", "cut: 重ねて切る")
        git(self.repo, "checkout", "-q", "main")
        put(self.repo, {SHARED: "\n".join(["const A = 1;", "const s6 = 6; // K-6", *TAIL])})
        git(self.repo, "add", "-A")
        git(self.repo, "commit", "-qm", "K-6 feat: 重ねた元が本線に入った")
        git(self.repo, "checkout", "-q", "-B", "t/K-5", "main")
        self.take()
        s = (self.repo / SHARED).read_text(encoding="utf-8")
        self.assertEqual(s, "\n".join(["const A = 1;", "const s6 = 6; // K-6", "const s5 = 5; // K-5", *TAIL]))

    def test_K187_CT_013_unmarked_cut_line_missing_from_mainline_stops(self) -> None:
        # 重ねた元の行のすぐ下に自分の行があり、離れた所に印の無い行（切る段だけの行）もある。本線にはその印の無い行が無い：
        # 自分の印を外した版を元にすると、印の無い行を本線が消したように見えて落ちるので、落とさずに止める
        import cut_take
        git(self.repo, "checkout", "-q", "c/x")
        put(self.repo, {SHARED: "\n".join(["const A = 1;", "const s6 = 6; // K-6", "const s5 = 5; // K-5", *TAIL[:-1], "const x = 9;", ""])})
        git(self.repo, "add", "-A")
        git(self.repo, "commit", "-qm", "cut: 印の無い行も足す")
        git(self.repo, "checkout", "-q", "main")
        main_shared = "\n".join(["const A = 1;", "const s6 = 6; // K-6", *TAIL])
        put(self.repo, {SHARED: main_shared})
        git(self.repo, "add", "-A")
        git(self.repo, "commit", "-qm", "K-6 feat: 重ねた元が本線に入った")
        git(self.repo, "checkout", "-q", "-B", "t/K-5", "main")
        with self.assertRaises(SystemExit) as e:
            cut_take.take(self.repo, "K-5", "c/x", shared=[SHARED], regenerate=False)
        self.assertIn("印の無い行が本線に無い：const x = 9;", str(e.exception))
        self.assertEqual((self.repo / SHARED).read_text(encoding="utf-8"), main_shared, "共有の試験を書き換えている")
        self.assertFalse((self.repo / "11_tickets/K-5.md").exists())

    def test_K187_CT_011_unreadable_header_stops(self) -> None:
        git(self.repo, "checkout", "-q", "c/x")
        put(self.repo, {"11_tickets/K-8.md": "---\nid: K-8\ntests:\n  - t/k5.test.ts\n---\n本文\n"})
        git(self.repo, "add", "-A")
        git(self.repo, "commit", "-qm", "cut: 複数行の tests")
        git(self.repo, "checkout", "-q", "t/K-5")
        import cut_take
        with self.assertRaises(SystemExit) as e:
            cut_take.take(self.repo, "K-8", "c/x", shared=[SHARED], regenerate=False)
        self.assertIn("tests:", str(e.exception))
        self.assertFalse((self.repo / "11_tickets/K-8.md").exists())

class Config(unittest.TestCase):
    def test_K187_CT_006_ticket_flow_points_at_the_script(self) -> None:
        import yaml
        cfg = yaml.safe_load((ROOT / "ticket-flow.yaml").read_text(encoding="utf-8"))
        self.assertEqual((cfg.get("cut") or {}).get("take"), "python3 scripts/tickets/cut_take.py {ticket} {ref}")
        self.assertTrue((ROOT / "scripts/tickets/cut_take.py").is_file())


if __name__ == "__main__":
    unittest.main(verbosity=2)
