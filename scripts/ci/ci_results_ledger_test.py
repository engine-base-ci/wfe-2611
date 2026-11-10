#!/usr/bin/env python3
"""台帳（07_qa/test-plan/result-ledger.json）は減らすだけ（D-129.51）を、台帳が本線に入った版と比べて確かめる試験（K-159）。
行 ID（K159-CI-001〜007）は 11_tickets/K-159.md の表に結ぶ。テストはチケットと一緒に先に書き、実装に入ったら変えない（D-132）。

由来：K143-CI-014 は「台帳に K57- と K60- の行がある」を確かめていた。ところが K-143 の取り込みの write が、CI の印を付けた行を
台帳から消した（台帳は減らすだけ・D-129.51 どおり）ので、本線 7b49eed9 で赤になった。仕組みが自分で書き換える台帳について、
試験の前提を書き換える前の形で書いていた。K-159 で、特定の行が残ることは求めず、「増えない・入れた時点の 2593 行を超えない・
消えた行はどれも、その行の結果の欄に CI の回の印がある（消えた理由が記録で説明できる）」に直した。

試験が決める形（scripts/ci/ci_results.py に足す）:
  ledger_at(ref: str, path: str, cwd) -> dict | None
      git show <ref>:<path> の台帳（JSON）を返す。ref が無い・その版に台帳が無い・JSON でない・git でないなら None
      （K143-CI-014 は None なら赤にする。守りの所で読めないなら止める側）
  ledger_drift(ledger: dict, entered: dict, root, cap: int = 2593) -> list[str]
      問題の一覧（空なら緑）。台帳の行の鍵は (file を normpath したもの, id)。file は root からの道で読む
        ・台帳の行の数が cap を超えたら赤（文に cap と今の行の数を出す）
        ・entered（台帳が本線に入った版）に無い行が台帳にあれば赤（文にファイルと行 ID・「台帳は減らすだけ」）
        ・entered にあって台帳に無い行（消えた行）は、root/<file> の試験の仕様の表で、その行の結果の欄が
          「PASS（CI <sha>）」「FAIL（CI <sha>）」（ci_results の印つきの形ちょうど）なら緑。
          それ以外（印の無い PASS・空・該当なし・BLOCKED）・ファイルが無い・ファイルにその行が無い は赤（文にファイルと行 ID）
使い方: python3 scripts/ci/ci_results_ledger_test.py
"""
import json, os, subprocess, sys, tempfile, unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import ci_results as cr  # noqa: E402

HEAD = "| ID | 画面 | テスト観点 | テスト項目 | 前提条件 | 操作手順 | 期待結果 | 結果 | 備考 | タスク | 実行条件 |\n|---|---|---|---|---|---|---|---|---|---|---|\n"


def row(rid, result=""):
    return f"| {rid} | tickets | 操作 | 項目 | 前提 | 操作 | 期待 | {result} |  | K-1 | L1 |\n"


def led(*keys):
    return {"rows": [{"file": f, "id": i} for f, i in keys]}


class Base(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)
        (self.root / "07_qa/test-specs/k").mkdir(parents=True)
        self.f = "07_qa/test-specs/k/a.md"

    def tearDown(self):
        self.tmp.cleanup()

    def spec(self, rel, *rows):
        (self.root / rel).write_text(HEAD + "".join(rows), encoding="utf-8")


class LedgerDriftTest(Base):
    def test_K159_CI_001_added_row_is_red(self):
        """K159-CI-001 入力：台帳が本線に入った版に無い行（印の無い PASS）を台帳に足す → 赤。足した行のファイルと行 ID を出す（台帳は減らすだけ）"""
        self.spec(self.f, row("K57-UI-001", "PASS"), row("K57-UI-002", "PASS"))
        entered = led((self.f, "K57-UI-001"))
        got = cr.ledger_drift(led((self.f, "K57-UI-001"), (self.f, "K57-UI-002")), entered, self.root, cap=2593)
        self.assertEqual(len(got), 1, got)
        self.assertIn("K57-UI-002", got[0])
        self.assertIn("a.md", got[0])
        self.assertIn("減らすだけ", got[0])
        # 足さなければ緑（同じ形で、何も足していない）
        self.assertEqual(cr.ledger_drift(entered, entered, self.root, cap=2593), [])

    def test_K159_CI_002_over_cap_is_red(self):
        """K159-CI-002 守り：台帳の行の数が上限（入れた時点の行の数・既定 2593）を超える → 赤。文に上限と今の数を出す。上限ちょうどは緑"""
        self.spec(self.f, row("K57-UI-001", "PASS"), row("K57-UI-002", "PASS"), row("K57-UI-003", "PASS"))
        three = led((self.f, "K57-UI-001"), (self.f, "K57-UI-002"), (self.f, "K57-UI-003"))
        got = cr.ledger_drift(three, three, self.root, cap=2)
        self.assertEqual(len(got), 1, got)
        self.assertIn("2", got[0])
        self.assertIn("3", got[0])
        self.assertEqual(cr.ledger_drift(three, three, self.root, cap=3), [])

    def test_K159_CI_003_removed_marked_rows_are_green(self):
        """K159-CI-003 時間の流れ：取り込みの write が印を付けて台帳から消した行（結果の欄が PASS（CI …）・FAIL（CI …）） → 緑。
        残った行（印の無い PASS のまま）もそのまま緑"""
        self.spec(self.f, row("K57-UI-001", "PASS（CI fb2998f）"), row("K57-UI-002", "FAIL（CI fb2998f）"),
                  row("K57-UI-003", "PASS"))
        entered = led((self.f, "K57-UI-001"), (self.f, "K57-UI-002"), (self.f, "K57-UI-003"))
        self.assertEqual(cr.ledger_drift(led((self.f, "K57-UI-003")), entered, self.root, cap=2593), [])
        self.assertEqual(cr.ledger_drift(led(), entered, self.root, cap=2593), [], "台帳が空になっても緑（台帳は減って空になるのがゴール・K-150）")

    def test_K159_CI_004_removed_unmarked_rows_are_red(self):
        """K159-CI-004 守り：消えた行の結果の欄に CI の回の印が無い（印の無い PASS・空・該当なし・BLOCKED・飾った印） → 赤。
        どの行も文にファイルと行 ID を出す（消えた理由が記録で説明できない）"""
        cases = {"K57-UI-001": "PASS", "K57-UI-002": "", "K57-UI-003": "PASS（該当なし：入力が無い）",
                 "K57-UI-004": "BLOCKED（staging が無い）", "K57-UI-005": "**PASS（CI fb2998f）**"}
        self.spec(self.f, *[row(k, v) for k, v in cases.items()])
        entered = led(*[(self.f, k) for k in cases])
        got = cr.ledger_drift(led(), entered, self.root, cap=2593)
        self.assertEqual(len(got), len(cases), got)
        for k in cases:
            with self.subTest(k=k):
                self.assertTrue(any(k in g and "a.md" in g for g in got), got)

    def test_K159_CI_005_removed_row_without_file_or_row_is_red(self):
        """K159-CI-005 失敗：消えた行のファイルが無い・ファイルにその行が無い → 赤（文にファイルと行 ID）"""
        self.spec(self.f, row("K57-UI-002", "PASS（CI fb2998f）"))
        entered = led(("07_qa/test-specs/k/無い.md", "K57-UI-001"), (self.f, "K57-UI-009"))
        got = cr.ledger_drift(led(), entered, self.root, cap=2593)
        self.assertEqual(len(got), 2, got)
        self.assertTrue(any("無い.md" in g and "K57-UI-001" in g for g in got), got)
        self.assertTrue(any("a.md" in g and "K57-UI-009" in g for g in got), got)

    def test_K159_CI_006_japanese_file_name(self):
        """K159-CI-006 入力（TP-TOOL-01）：日本語の名前の試験の仕様のファイルの消えた行も読む。印があれば緑・無ければ赤（日本語の道を名指し）"""
        jp = "07_qa/test-specs/k/試験の仕様.md"
        self.spec(jp, row("K60-UI-001", "PASS（CI fb2998f）"), row("K60-UI-002", "PASS"))
        got = cr.ledger_drift(led(), led((jp, "K60-UI-001"), (jp, "K60-UI-002")), self.root, cap=2593)
        self.assertEqual(len(got), 1, got)
        self.assertIn("試験の仕様.md", got[0])
        self.assertIn("K60-UI-002", got[0])


class LedgerAtTest(unittest.TestCase):
    def test_K159_CI_007_ledger_at_reads_git_or_none(self):
        """K159-CI-007 失敗（TP-TOOL-03）：台帳が本線に入った版を git の中から読む（作業場所のファイルでなく版で読むので、まっさらな写しと
        手元で同じ）。読めれば dict。無い ref・その版に台帳が無い・JSON でない・git でない置き場は None（呼ぶ側が赤にする）"""
        with tempfile.TemporaryDirectory() as t:
            d = Path(t)
            env = {**os.environ, "GIT_AUTHOR_NAME": "t", "GIT_AUTHOR_EMAIL": "t@example.com",
                   "GIT_COMMITTER_NAME": "t", "GIT_COMMITTER_EMAIL": "t@example.com"}

            def git(*a):
                return subprocess.run(["git", *a], cwd=d, check=True, capture_output=True, text=True, env=env).stdout.strip()

            git("init", "-q")
            (d / "README.md").write_text("x", encoding="utf-8")
            git("add", "-A")
            git("commit", "-qm", "base")
            no_ledger = git("rev-parse", "HEAD")
            p = d / "07_qa/test-plan/result-ledger.json"
            p.parent.mkdir(parents=True)
            p.write_text(json.dumps(led(("07_qa/test-specs/a.md", "K57-UI-001"))), encoding="utf-8")
            git("add", "-A")
            git("commit", "-qm", "ledger")
            good = git("rev-parse", "HEAD")
            p.write_text("{", encoding="utf-8")
            git("add", "-A")
            git("commit", "-qm", "broken")
            broken = git("rev-parse", "HEAD")
            # 作業場所のファイルを変えても、版で読む
            p.write_text(json.dumps(led()), encoding="utf-8")
            got = cr.ledger_at(good, "07_qa/test-plan/result-ledger.json", d)
            self.assertEqual(got, led(("07_qa/test-specs/a.md", "K57-UI-001")))
            self.assertIsNone(cr.ledger_at("0" * 40, "07_qa/test-plan/result-ledger.json", d))
            self.assertIsNone(cr.ledger_at(no_ledger, "07_qa/test-plan/result-ledger.json", d))
            self.assertIsNone(cr.ledger_at(broken, "07_qa/test-plan/result-ledger.json", d))
        with tempfile.TemporaryDirectory() as t:
            self.assertIsNone(cr.ledger_at("HEAD", "07_qa/test-plan/result-ledger.json", Path(t)))


if __name__ == "__main__":
    unittest.main(verbosity=1)
