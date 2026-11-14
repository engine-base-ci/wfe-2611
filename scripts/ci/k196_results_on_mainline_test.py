#!/usr/bin/env python3
"""K-196 の試験：全部の回（本線の先頭で流す回）でも、G61（結果の欄の PASS は CI の記録から）が中身を見て答える。行 ID は K196-RM-NNN。

  python3 scripts/ci/k196_results_on_mainline_test.py

見るのは scripts/ci/ci_results.py check の --ledger-base-ref・--target-ref の読み方と、CI の定義（v3-gate.yml の G61 の段）。
本線の上の回＝比べる元が HEAD と同じで、HEAD が取り込む先の先頭か先祖（枝の差分が 1 つも無い回）。
"""
from __future__ import annotations

import json
import pathlib
import subprocess
import sys
import tempfile
import unittest

import yaml

HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parent.parent
SCRIPT = HERE / "ci_results.py"
SHA = "abcdef1234567890abcdef1234567890abcdef12"
MARK = "PASS（CI abcdef1）"
HEAD = "| ID | 画面 | テスト観点 | テスト項目 | 前提条件 | 操作手順 | 期待結果 | 結果 | 備考 | タスク | 実行条件 |\n|---|---|---|---|---|---|---|---|---|---|---|\n"
MAINLINE = "本線の上の回"                      # 緑のときに出す 1 行に入る語
SWAP = "すり替え"                              # 枝が比べる元を自分にしたときの赤（前からの文）
CASCADE = "Results-Written-By"                 # 比べる元が使えないときに、行ごとに出していた見当違いの赤


def row(rid: str, result: str = "") -> str:
    return f"| {rid} | tickets | 操作 | 項目 | 前提 | 操作 | 期待 | {result} |  | K-1 | L1 |\n"


def git(cwd: pathlib.Path, *args: str) -> str:
    r = subprocess.run(["git", *args], cwd=cwd, capture_output=True, text=True)
    assert r.returncode == 0, r.stderr
    return r.stdout


class OnMainline(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = tempfile.TemporaryDirectory()
        self.t = pathlib.Path(self.tmp.name)
        git(self.t, "init", "-q", "-b", "main")
        git(self.t, "config", "user.email", "k196@example.invalid")
        git(self.t, "config", "user.name", "k196")
        (self.t / "specs").mkdir()
        (self.t / "rec").mkdir()
        self.spec = self.t / "specs" / "a.md"

    def tearDown(self) -> None:
        self.tmp.cleanup()

    def put(self, rows: str, ledger: list[str], record: dict | None) -> None:
        self.spec.write_text(HEAD + rows, encoding="utf-8")
        (self.t / "ledger.json").write_text(json.dumps({"rows": [{"file": "specs/a.md", "id": i} for i in ledger]}), encoding="utf-8")
        if record is not None:
            (self.t / "rec" / f"{SHA}.json").write_text(
                json.dumps({"sha": SHA, "made_by": "ci_results.py record", "at": "x", "rows": record}), encoding="utf-8")

    def commit(self, msg: str, trailer: bool = False) -> str:
        git(self.t, "add", "-A")
        extra = ["-m", f"Results-Written-By: ci_results.py write CI {SHA}"] if trailer else []
        git(self.t, "commit", "-q", "--allow-empty", "-m", msg, *extra)
        return git(self.t, "rev-parse", "HEAD").strip()

    def check(self, base: str, target: str | None = "main") -> tuple[int, str]:
        args = [sys.executable, str(SCRIPT), "check", "--specs", "specs/*.md", "--records", "rec",
                "--ledger", "ledger.json", "--ledger-base-ref", base]
        if target is not None:
            args += ["--target-ref", target]
        r = subprocess.run(args, cwd=self.t, capture_output=True, text=True)
        return r.returncode, r.stdout + r.stderr

    def good_mainline(self) -> str:
        """本線：印のある PASS 1 行（記録は pass・書き込みのコミットで入った）と、台帳に載った印の無い PASS 1 行"""
        self.put(row("K57-UI-001", MARK) + row("K57-UI-002", "PASS"), ["K57-UI-002"], {"K57-UI-001": "pass"})
        return self.commit("K-1 chore: 結果の欄を CI の記録から書く", trailer=True)

    def test_K196_RM_001_green_on_mainline_tip(self) -> None:
        """K196-RM-001 本線の先頭で流す回（比べる元＝HEAD＝取り込む先の先頭）：印のある PASS が記録で pass・印の無い PASS が台帳にあれば緑。
        「本線の上の回」と、照らした行の数を 1 行で言う"""
        head = self.good_mainline()
        code, out = self.check(head)
        self.assertEqual(code, 0, out)
        self.assertIn(MAINLINE, out)
        self.assertNotIn(SWAP, out)
        self.assertIn("PASS 2 行を見た", out)

    def test_K196_RM_002_marks_are_rechecked_against_records(self) -> None:
        """K196-RM-002 本線の上の回は、印のある PASS を全部、記録と照らし直す（本線にあるからと飛ばさない）：
        その回の記録で fail・記録に行が無い・記録のファイルが無い、のどれも赤で、その行の ID を言う"""
        for label, record in (("fail", {"K57-UI-001": "fail"}), ("行が無い", {"K57-UI-009": "pass"}), ("記録が無い", None)):
            with self.subTest(label):
                rec = self.t / "rec" / f"{SHA}.json"
                if rec.exists():
                    rec.unlink()
                self.put(row("K57-UI-001", MARK), [], record)
                head = self.commit(f"K-1 chore: 結果の欄（{label}）", trailer=True)
                code, out = self.check(head)
                self.assertEqual(code, 1, out)
                self.assertIn("K57-UI-001", out)
                self.assertNotIn(SWAP, out)

    def test_K196_RM_003_unmarked_pass_outside_ledger_is_red(self) -> None:
        """K196-RM-003 本線の上の回でも、印の無い PASS が台帳に無ければ赤（手で書いた PASS）。台帳の行がもう印の無い PASS でないのも赤"""
        self.put(row("K57-UI-001", MARK) + row("K57-UI-002", "PASS"), [], {"K57-UI-001": "pass"})
        code, out = self.check(self.commit("K-1 chore: 結果の欄", trailer=True))
        self.assertEqual(code, 1, out)
        self.assertIn("K57-UI-002", out)
        self.assertIn("手で書いた PASS", out)
        self.put(row("K57-UI-001", MARK), ["K57-UI-001"], {"K57-UI-001": "pass"})
        code, out = self.check(self.commit("K-1 chore: 台帳に残した"))
        self.assertEqual(code, 1, out)
        self.assertIn("台帳から消す", out)

    def test_K196_RM_004_target_moved_ahead(self) -> None:
        """K196-RM-004 流している間に取り込む先が先へ進んだ（HEAD は取り込む先の先祖・比べる元＝HEAD）：本線の上の回として緑"""
        head = self.good_mainline()
        git(self.t, "switch", "-q", "--detach", head)
        git(self.t, "branch", "-f", "main", head)
        git(self.t, "switch", "-q", "main")
        (self.t / "next.txt").write_text("次のチケット", encoding="utf-8")
        self.commit("K-2 feat: 次")
        git(self.t, "switch", "-q", "--detach", head)
        code, out = self.check(head)
        self.assertEqual(code, 0, out)
        self.assertIn(MAINLINE, out)

    def test_K196_RM_005_branch_cannot_use_itself_as_base(self) -> None:
        """K196-RM-005 枝（取り込む先の先祖でない HEAD）が比べる元を自分にすると、前と同じ「すり替え」で赤。
        枝の中身が正しくても（記録は pass・台帳は増えていない）通さない"""
        self.good_mainline()
        git(self.t, "switch", "-q", "-c", "atk")
        self.put(row("K57-UI-001", MARK) + row("K57-UI-002", "PASS") + row("K57-UI-003", MARK), ["K57-UI-002"],
                 {"K57-UI-001": "pass", "K57-UI-003": "pass"})
        head = self.commit("K-9 feat: 枝で印を手で足す")
        code, out = self.check(head)
        self.assertEqual(code, 1, out)
        self.assertIn(SWAP, out)
        self.assertNotIn(MAINLINE, out)

    def test_K196_RM_006_ref_problem_is_reported_alone(self) -> None:
        """K196-RM-006 比べる元が使えない赤（すり替え・取り込む先が無い／読めない・先祖でない）のときは、その 1 件だけを出す。
        行ごとの「書き込みのコミット（Results-Written-By）で入っていない」を続けて出さない（2026-11-13 の回は 1 件の訳に 224 行が続いた）"""
        base = self.good_mainline()
        git(self.t, "switch", "-q", "-c", "atk")
        (self.t / "x.txt").write_text("枝", encoding="utf-8")
        head = self.commit("K-9 feat: 枝")
        git(self.t, "switch", "-q", "-c", "other", base)
        (self.t / "y.txt").write_text("取り込む先に無いコミット", encoding="utf-8")
        stray = self.commit("K-8 feat: 別の枝")
        git(self.t, "switch", "-q", "atk")
        for label, (ref, target) in (("すり替え", (head, "main")), ("取り込む先が無い", (base, None)),
                                     ("取り込む先が読めない", (base, "無い-枝")), ("先祖でない", (stray, "main"))):
            with self.subTest(label):
                code, out = self.check(ref, target)
                self.assertEqual(code, 1, out)
                self.assertNotIn(CASCADE, out)
                self.assertEqual(len([ln for ln in out.splitlines() if ln.lstrip().startswith("★")]), 1, out)
                self.assertIn("FAIL — 1 件", out)

    def test_K196_RM_007_mainline_needs_readable_target(self) -> None:
        """K196-RM-007 比べる元＝HEAD でも、取り込む先が無い／読めないなら赤（本線の上かどうかを確かめられないので止める）"""
        head = self.good_mainline()
        for target in (None, "無い-枝"):
            with self.subTest(target=target):
                code, out = self.check(head, target)
                self.assertEqual(code, 1, out)
                self.assertNotIn(MAINLINE, out)

    def test_K196_RM_008_ticket_run_unchanged(self) -> None:
        """K196-RM-008 チケットの回（比べる元＝本線の先頭・HEAD は枝）は前のまま：書き込みのコミットで入った印は緑、
        普通のコミットで足した印は「書き込みのコミットで入っていない」で赤。「本線の上の回」とは言わない"""
        base = self.good_mainline()
        git(self.t, "switch", "-q", "-c", "ok")
        self.put(row("K57-UI-001", MARK) + row("K57-UI-002", "PASS") + row("K57-UI-003", MARK), ["K57-UI-002"],
                 {"K57-UI-001": "pass", "K57-UI-003": "pass"})
        self.commit("K-9 chore: 結果の欄を CI の記録から書く", trailer=True)
        code, out = self.check(base)
        self.assertEqual(code, 0, out)
        self.assertNotIn(MAINLINE, out)
        git(self.t, "switch", "-q", "-c", "hand", base)
        self.put(row("K57-UI-001", MARK) + row("K57-UI-002", "PASS") + row("K57-UI-003", MARK), ["K57-UI-002"],
                 {"K57-UI-001": "pass", "K57-UI-003": "pass"})
        self.commit("K-9 feat: 印を手で足す")
        code, out = self.check(base)
        self.assertEqual(code, 1, out)
        self.assertIn("K57-UI-003", out)
        self.assertIn(CASCADE, out)


class Definition(unittest.TestCase):
    def test_K196_RM_009_g61_runs_in_full_too(self) -> None:
        """K196-RM-009 CI の定義：G61 の段は全部の回でも流れる（scope・full を条件に飛ばさない）。check は
        --ledger-base-ref と --target-ref を持つ。この試験は G65 の並びで流れる"""
        wf = yaml.safe_load((ROOT / ".github/workflows/v3-gate.yml").read_text(encoding="utf-8"))
        steps = wf["jobs"]["spec"]["steps"]
        g61 = [s for s in steps if str(s.get("name", "")).startswith("G61 ")]
        self.assertEqual(len(g61), 1)
        cond = str(g61[0].get("if", ""))
        for word in ("scope", "full", "gates"):
            self.assertNotIn(word, cond, "G61 を回の種類で飛ばさない")
        run = str(g61[0]["run"])
        self.assertIn("ci_results.py check", run)
        self.assertIn('--ledger-base-ref "$CI_LEDGER_BASE"', run)
        self.assertIn('--target-ref "$CI_TARGET_REF"', run)
        g65 = [str(s["run"]) for s in steps if str(s.get("name", "")).startswith("G65 ")]
        self.assertEqual(len(g65), 1)
        self.assertIn("python3 scripts/ci/k196_results_on_mainline_test.py", g65[0])

    def test_K196_RM_010_real_tree_as_mainline(self) -> None:
        """K196-RM-010 本物：今の写しを本線の上の回として照らす（比べる元＝取り込む先＝HEAD）と緑。
        今の試験の仕様の印のある PASS は、どれも 07_qa/ci-results の記録で pass（2026-11-13：224 行・回 305e80b）"""
        head = git(ROOT, "rev-parse", "HEAD").strip()
        r = subprocess.run([sys.executable, str(SCRIPT), "check", "--specs", "07_qa/test-specs/**/*.md", "--records", "07_qa/ci-results",
                            "--ledger", "07_qa/test-plan/result-ledger.json", "--ledger-base-ref", head, "--target-ref", head],
                           cwd=ROOT, capture_output=True, text=True)
        out = r.stdout + r.stderr
        self.assertEqual(r.returncode, 0, out[-2000:])
        self.assertIn(MAINLINE, out)


if __name__ == "__main__":
    unittest.main(verbosity=2)
