#!/usr/bin/env python3
"""K-146（チケットを切る時点で決める人に聞くことを出し切る）の Kaname 側の試験。
行 ID（K146-CI-…）は 11_tickets/K-146.md の表に結ぶ。テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。
決め：D-129.52（①〜④を全部入れる）・D-129.53（③は精査の手順と、した証拠の検査）。

試験が決める形（Kaname 側・実装の役が作る）:
  scripts/ci/ticket_rows_gate.py   スキル ticket-planning の scripts/ticket_rows_gate.py の写し（K13・K14・--selftest。decision_source_gate と同じく
                                   CI の写しの中にスキルが無いので Kaname に置く）
  scripts/ci/ticket_rows_ci.py     11_tickets の着手前のチケット（頭の stage: 未着手）だけに ticket_rows_gate を当てる。
                                   作業中・確認中・保留・完了のチケットは当てない（取り込み済みを赤にしない）。
      targets(tickets_dir: Path) -> list[Path]
      python3 scripts/ci/ticket_rows_ci.py [--dir 11_tickets]：赤の行を出して exit 1、無ければ「PASS」と当てた枚数で exit 0
  scripts/ci/answers_merge.py      スキル ai-team-delivery の scripts/gates/answers_merge.py の写し（merge・check・--selftest）
      python3 scripts/ci/answers_merge.py check 01_hearing/decider-answers.jsonl --base <本線との分かれ目>：
      その版の記録にあった id が今の記録に全部あるか（落としていれば id を出して exit 1）。比べる版が読めない（無い ref）・空なら赤
      （スキルの今の版は読めない ref を黙って飛ばす。写しとスキルの両方を直す）
  v3-gate.yml の spec の段（作り手 05_flow/build_testplan.py）：G60 の隣に「answers_merge check」と「ticket_rows_ci」の段。
      answers_merge の --base は、spec の段の中の scope の段（K-143 で置く・ci_scope.py --github-output）が出す base を
      env CI_ANSWERS_BASE で渡す（run の文字に ${{ … }} を入れない・K107-CS-034）
  03_architecture/共通の決まり.md：入力の確かめ方（D-129.42）・作った口は全部契約の fuzz に当てる・消したものの扱い（D-129.43 を一般化）の行
  01_hearing/聞くこと_K-146.md：決める人に聞く項目の 1 枚のページ。表の列「問い」「答えの決定」。答えの決定は決定ログにある D-… の番号
  11_tickets/K-63.md・K-64.md：節「## 先にある実装との突き合わせ」（表の列「ファイル:行」「チケットの行」・1 行以上）。ticket_rows_gate も緑
使い方: python3 scripts/ci/ticket_process_test.py
"""
import json, re, subprocess, sys, tempfile, unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent

CLEAN = """---
id: K-901
stage: {stage}
---
## テスト仕様と確認の結果

| 観点 | 分岐 | 期待結果 | テスト |
|---|---|---|---|
| 入力 | 名前が空 | 422・E-VAL-001。何も書かない | K901-API-001 |
"""
VAGUE = """---
id: K-902
stage: {stage}
---
## テスト仕様と確認の結果

| 観点 | 分岐 | 期待結果 | テスト |
|---|---|---|---|
| 対象の状態 | 消した | 適切に扱う | K902-API-001 |
"""


def git(cwd, *args):
    r = subprocess.run(["git", *args], cwd=cwd, capture_output=True, text=True)
    assert r.returncode == 0, r.stderr
    return r.stdout


class RowsCiTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.d = Path(self.tmp.name)

    def tearDown(self):
        self.tmp.cleanup()

    def run_ci(self):
        r = subprocess.run([sys.executable, str(HERE / "ticket_rows_ci.py"), "--dir", str(self.d)], capture_output=True, text=True)
        return r.returncode, r.stdout + r.stderr

    def test_K146_CI_001_only_pending_tickets_are_checked(self):
        """K146-CI-001 ticket_rows_ci は着手前（stage: 未着手）のチケットだけに当てる。作業中・確認中・保留・完了のチケットの曖昧な行は赤にしない（取り込み済みを赤にしない）。
        着手前のチケットの曖昧な行は、ファイルと行を出して exit 1"""
        (self.d / "K-902.md").write_text(VAGUE.format(stage="未着手"), encoding="utf-8")
        for i, st in enumerate(["作業中", "確認中", "保留", "完了"]):
            (self.d / f"K-91{i}.md").write_text(VAGUE.format(stage=st).replace("K-902", f"K-91{i}"), encoding="utf-8")
        sys.path.insert(0, str(HERE))
        import ticket_rows_ci  # noqa: PLC0415

        self.assertEqual([p.name for p in ticket_rows_ci.targets(self.d)], ["K-902.md"])
        code, out = self.run_ci()
        self.assertEqual(code, 1, out)
        self.assertIn("K-902.md", out)
        for i in range(4):
            self.assertNotIn(f"K-91{i}.md", out)

    def test_K146_CI_002_clean_pending_tickets_are_green(self):
        """K146-CI-002 着手前のチケットが全部決まった書き方なら、PASS と当てた枚数で exit 0（何も見ずに緑にしない）"""
        (self.d / "K-901.md").write_text(CLEAN.format(stage="未着手"), encoding="utf-8")
        (self.d / "K-902.md").write_text(VAGUE.format(stage="完了"), encoding="utf-8")
        code, out = self.run_ci()
        self.assertEqual(code, 0, out)
        self.assertIn("PASS", out)
        self.assertRegex(out, r"\b1\b")


class RepoTest(unittest.TestCase):
    def test_K146_CI_003_real_pending_tickets_are_green(self):
        """K146-CI-003 本物の 11_tickets の着手前のチケットに当てて緑（入れた時点の赤：K-62・K-63・K-74・K-89・K-146 の行を直してから入れる）"""
        r = subprocess.run([sys.executable, str(HERE / "ticket_rows_ci.py"), "--dir", "11_tickets"], cwd=ROOT, capture_output=True, text=True)
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)

    def test_K146_CI_004_vendored_copies_selftest(self):
        """K146-CI-004 Kaname に置いた写し（ticket_rows_gate.py・answers_merge.py）の自己試験が緑（CI の写しの中にスキルが無くても流れる）"""
        for name in ("ticket_rows_gate.py", "answers_merge.py"):
            r = subprocess.run([sys.executable, str(HERE / name), "--selftest"], capture_output=True, text=True)
            self.assertEqual(r.returncode, 0, f"{name}: {r.stdout}{r.stderr}")

    def test_K146_CI_006_wired_next_to_g60(self):
        """K146-CI-006 CI から回る：spec の段で G60 の隣に answers_merge check と ticket_rows_ci を流す。answers_merge の --base は、spec の段の中の scope の段が出す base を
        env CI_ANSWERS_BASE で渡す（run の文字に ${{ … }} を入れない）。段の一覧は 05_flow/build_testplan.py"""
        import yaml  # noqa: PLC0415

        spec = yaml.safe_load((ROOT / ".github/workflows/v3-gate.yml").read_text(encoding="utf-8"))["jobs"]["spec"]
        steps = spec["steps"]
        idx = {i: st for i, st in enumerate(steps)}
        g60 = [i for i, st in idx.items() if "decision_source_gate.py" in st.get("run", "")]
        am = [i for i, st in idx.items() if "answers_merge.py check" in st.get("run", "")]
        rc = [i for i, st in idx.items() if "ticket_rows_ci.py" in st.get("run", "")]
        self.assertEqual((len(g60), len(am), len(rc)), (1, 1, 1))
        self.assertLessEqual(abs(am[0] - g60[0]), 2, "answers_merge check は G60 の隣")
        scope = [st for st in steps if "scripts/ci/ci_scope.py" in st.get("run", "") and "--github-output" in st.get("run", "")]
        self.assertEqual(len(scope), 1, "spec の段の中の scope の段（K-143）")
        run = steps[am[0]]["run"]
        self.assertRegex(run, r'answers_merge\.py check 01_hearing/decider-answers\.jsonl --base "\$CI_ANSWERS_BASE"')
        self.assertNotRegex(run, r"\$\{\{")
        self.assertEqual(steps[am[0]]["env"]["CI_ANSWERS_BASE"].replace(" ", ""), "${{steps.%s.outputs.base}}" % scope[0]["id"])
        self.assertIn("python3 scripts/ci/ticket_process_test.py", "\n".join(st.get("run", "") for st in steps))
        gen = (ROOT / "05_flow/build_testplan.py").read_text(encoding="utf-8")
        self.assertIn("ticket_rows_ci.py", gen)
        self.assertIn("answers_merge.py check", gen)

    def test_K146_CI_007_common_rules_and_question_page(self):
        """K146-CI-007 ① 共通の決まりに、入力の確かめ方（D-129.42）・作った口は全部契約の fuzz に当てる・消したものの扱い（D-129.43）の行がある。
        決める人に聞く項目の 1 枚のページ（01_hearing/聞くこと_K-146.md）の問いには、どれも決定ログにある答えの決定の番号が付いている"""
        rules = (ROOT / "03_architecture/共通の決まり.md").read_text(encoding="utf-8")
        rows = [ln for ln in rules.splitlines() if ln.startswith("| ")]
        self.assertTrue(any("D-129.42" in ln for ln in rows), "入力の確かめ方の行")
        self.assertTrue(any("D-129.43" in ln for ln in rows), "消したものの扱いの行")
        self.assertTrue(any("fuzz" in ln for ln in rows), "作った口は全部契約の fuzz に当てる行")
        page = (ROOT / "01_hearing/聞くこと_K-146.md").read_text(encoding="utf-8")
        log = (ROOT / "01_hearing/決定ログ_進行中.md").read_text(encoding="utf-8")
        head, qs = None, []
        for ln in page.splitlines():
            if not ln.startswith("|"):
                head = None
                continue
            cells = [c.strip() for c in ln.strip().strip("|").split("|")]
            if head is None:
                head = cells
                continue
            if all(re.fullmatch(r":?-{2,}:?", c) for c in cells if c):
                continue
            if "問い" in head and "答えの決定" in head:
                qs.append((cells[head.index("問い")], cells[head.index("答えの決定")]))
        self.assertTrue(qs, "問いの表が無い")
        for q, ans in qs:
            ids = re.findall(r"D-\d+(?:\.\d+)?", ans)
            self.assertTrue(ids, f"問い「{q[:30]}」に答えの決定が無い")
            for i in ids:
                self.assertIn(f"| {i} |", log, f"{i} が決定ログに無い")

    def test_K146_CI_008_k63_k64_washed_against_code(self):
        """K146-CI-008 ④ K-63・K-64 は、先にある実装との突き合わせの節（ファイル:行 → チケットの行）を持ち、ticket_rows_gate も緑"""
        for t in ("K-63", "K-64"):
            text = (ROOT / f"11_tickets/{t}.md").read_text(encoding="utf-8")
            self.assertIn("## 先にある実装との突き合わせ", text, t)
            sec = text.split("## 先にある実装との突き合わせ", 1)[1].split("\n## ", 1)[0]
            rows = [ln for ln in sec.splitlines() if ln.startswith("| ") and not ln.startswith("| ファイル") and not ln.startswith("|---")]
            self.assertTrue(rows, f"{t}：突き合わせた分かれ道が 1 行も無い")
            for ln in rows:
                self.assertRegex(ln.split("|")[1], r"\S+:\d+", f"{t}：ファイル:行 の形でない：{ln[:60]}")
            r = subprocess.run([sys.executable, str(HERE / "ticket_rows_gate.py"), f"11_tickets/{t}.md"], cwd=ROOT, capture_output=True, text=True)
            self.assertEqual(r.returncode, 0, f"{t}: {r.stdout}")


class AnswersTest(unittest.TestCase):
    def test_K146_CI_005_answers_check_finds_dropped_ids(self):
        """K146-CI-005 ⑤ answers_merge check：本線の版にあった答えの id を今の記録が落としていれば、その id を出して exit 1。和で足したもの（増えた）は exit 0。比べる版が読めない・空なら赤"""
        with tempfile.TemporaryDirectory() as t:
            t = Path(t)
            git(t, "init", "-q", "-b", "main")
            git(t, "config", "user.email", "k146@example.invalid")
            git(t, "config", "user.name", "k146")
            f = t / "answers.jsonl"
            f.write_text(json.dumps({"id": "aaa111", "at": "2026-11-08T10:00"}) + "\n" + json.dumps({"id": "bbb222", "at": "2026-11-08T11:00"}) + "\n", encoding="utf-8")
            git(t, "add", "-A")
            git(t, "commit", "-q", "-m", "本線")
            f.write_text(json.dumps({"id": "aaa111", "at": "2026-11-08T10:00"}) + "\n", encoding="utf-8")
            r = subprocess.run([sys.executable, str(HERE / "answers_merge.py"), "check", str(f), "--base", "main", "--repo", str(t)],
                               capture_output=True, text=True)
            self.assertEqual(r.returncode, 1, r.stdout + r.stderr)
            self.assertIn("bbb222", r.stdout + r.stderr)
            f.write_text(f.read_text(encoding="utf-8") + json.dumps({"id": "bbb222", "at": "2026-11-08T11:00"}) + "\n"
                         + json.dumps({"id": "ccc333", "at": "2026-11-08T12:00"}) + "\n", encoding="utf-8")
            r = subprocess.run([sys.executable, str(HERE / "answers_merge.py"), "check", str(f), "--base", "main", "--repo", str(t)],
                               capture_output=True, text=True)
            self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
            # 比べる版が読めない（無い ref）・空なら赤（黙って通さない）。ファイルがまだ無かった版（git show が無いと言う）とは分ける
            for base in ("無い-ref", ""):
                r = subprocess.run([sys.executable, str(HERE / "answers_merge.py"), "check", str(f), "--base", base, "--repo", str(t)],
                                   capture_output=True, text=True)
                self.assertNotEqual(r.returncode, 0, f"base「{base}」: {r.stdout}{r.stderr}")


if __name__ == "__main__":
    unittest.main(verbosity=2)
