#!/usr/bin/env python3
"""K-206 の試験：コミットの名義（author のメール）が、配る側のチームの物でなければ赤。行 ID は K206-AG-NNN。

  python3 scripts/ci/k206_author_gate_test.py

見るのは scripts/ci/author_gate.py（--base-ref <比べる元> [--config <設定>]。git は今いるフォルダで読む）と、
設定 scripts/ci/author_gate.json、CI の定義（v3-gate.yml の static の組）。
作り物の git のリポジトリに、名義を変えたコミットを積んで、台本を命令として流す。
住所はどれも作り物（.example・.invalid と、設定にあるドメイン）。
"""
from __future__ import annotations

import json
import os
import pathlib
import subprocess
import sys
import tempfile
import unittest

import yaml

HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parent.parent
SCRIPT = HERE / "author_gate.py"
CONFIG = HERE / "author_gate.json"
WORKFLOW = ROOT / ".github" / "workflows" / "v3-gate.yml"

DOMAIN = "engine-base.com"
ORG = ("Org Member", f"dev.member@{DOMAIN}")
PERSONAL = ("Taro Secret", "taro.secret@personal.example")
NOT_TEAM = "名義がチームの物でない"           # 赤の文に入る語
HOW_TO = "git config user.email"               # 赤の文に入る、直し方の手がかり
BASE_WORD = "比べる元"                         # 比べる元が読めない赤に入る語
CONFIG_WORD = "author_gate.json"               # 設定が無い・壊れている赤に入る語


def clean_env() -> dict[str, str]:
    """GIT_ で始まる環境の値を除いた env（フックの中・rebase --exec の中で流しても、本物のリポジトリと環境の名義に当たらない）"""
    return {k: v for k, v in os.environ.items() if not k.startswith("GIT_")}


def git(cwd: pathlib.Path, *args: str) -> str:
    r = subprocess.run(["git", *args], cwd=cwd, capture_output=True, text=True, env=clean_env())
    assert r.returncode == 0, r.stderr
    return r.stdout.strip()


class Repo(unittest.TestCase):
    """作り物の git のリポジトリと、台本を命令として流す道具（試験は持たない）"""

    def setUp(self) -> None:
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.t = pathlib.Path(self.tmp.name) / "repo"
        self.t.mkdir()
        self.cfg = pathlib.Path(self.tmp.name) / "author_gate.json"
        self.cfg.write_text(json.dumps({"allowed_domains": [DOMAIN]}), encoding="utf-8")
        git(self.t, "init", "-q", "-b", "main")
        # リポジトリの設定の名義は、どの試験でも「チームの物でない」側。author は commit() が毎回決める
        git(self.t, "config", "user.name", "repo default")
        git(self.t, "config", "user.email", "default@repo-default.invalid")
        git(self.t, "config", "commit.gpgsign", "false")
        self.n = 0
        self.base = self.commit(ORG)          # 比べる元（ここより後ろだけを見る）

    def commit(self, who: tuple[str, str], *, committer: tuple[str, str] | None = None) -> str:
        """who の名義で 1 本積み、短い番号（7 桁）を返す"""
        self.n += 1
        (self.t / f"f{self.n}.txt").write_text(str(self.n), encoding="utf-8")
        git(self.t, "add", "-A")
        c = committer or who
        git(self.t, "-c", f"user.name={c[0]}", "-c", f"user.email={c[1]}",
            "commit", "-q", "-m", f"c{self.n}", f"--author={who[0]} <{who[1]}>")
        return git(self.t, "rev-parse", "--short=7", "HEAD")

    def gate(self, base: str | None = None, *, config: pathlib.Path | None = None,
             default_config: bool = False) -> tuple[int, str]:
        """default_config=True は --config を渡さない（CI の段と同じ呼び方。台本の隣の設定を読む）"""
        cmd = [sys.executable, str(SCRIPT), "--base-ref", self.base if base is None else base]
        if not default_config:
            cmd += ["--config", str(config or self.cfg)]
        r = subprocess.run(cmd, cwd=self.t, capture_output=True, text=True, env=clean_env())
        out = r.stdout + r.stderr
        self.assertNotIn("Traceback", out, "台本が落ちている（赤は、訳を出して終わりの値 1 で返す）")
        return r.returncode, out

    def assert_red(self, code: int, out: str, *shas: str) -> None:
        self.assertEqual(code, 1, out)
        self.assertIn(NOT_TEAM, out)
        self.assertIn(HOW_TO, out)
        for s in shas:
            self.assertIn(s, out)


class AuthorGate(Repo):
    def test_K206_AG_001_org_authors_green(self) -> None:
        """K206-AG-001 比べる元より後ろのコミットが、どれも組織のドメインの名義 → 緑で、見た本数が出る"""
        self.commit(ORG)
        self.commit(("Another Member", f"second@{DOMAIN}"))
        code, out = self.gate()
        self.assertEqual(code, 0, out)
        self.assertIn("2 本を見た", out)
        self.assertNotIn(NOT_TEAM, out)

    def test_K206_AG_002_one_personal_commit_red_with_sha(self) -> None:
        """K206-AG-002 個人の名義が 1 本でも混ざる → 赤。そのコミットの短い番号と直し方が出て、ほかのコミットの番号は出ない"""
        ok1 = self.commit(ORG)
        bad = self.commit(PERSONAL)
        ok2 = self.commit(ORG)                # 先頭が組織の名義でも、間の 1 本で赤
        code, out = self.gate()
        self.assert_red(code, out, bad)
        self.assertNotIn(ok1, out)
        self.assertNotIn(ok2, out)

    def test_K206_AG_003_merge_commits_are_checked(self) -> None:
        """K206-AG-003 取り込みのコミット（親が 2 つ）の名義も、取り込みで入ってきた側のコミットの名義も見る"""
        # ① 取り込みのコミットそのものが個人の名義（両方の親の側のコミットは組織の名義）
        git(self.t, "checkout", "-q", "-b", "side")
        self.commit(ORG)
        git(self.t, "checkout", "-q", "main")
        self.commit(ORG)
        git(self.t, "-c", f"user.name={PERSONAL[0]}", "-c", f"user.email={PERSONAL[1]}",
            "merge", "-q", "--no-ff", "-m", "merge side", "side")
        merge = git(self.t, "rev-parse", "--short=7", "HEAD")
        self.assertEqual(len(git(self.t, "rev-list", "--parents", "-n", "1", "HEAD").split()), 3, "親が 2 つの取り込み")
        code, out = self.gate()
        self.assert_red(code, out, merge)
        # ② 取り込みのコミットは組織の名義で、入ってきた側（2 つ目の親の先）に個人の名義が 1 本
        git(self.t, "checkout", "-q", "-b", "side2", self.base)
        inner = self.commit(PERSONAL)
        git(self.t, "checkout", "-q", "-b", "main2", self.base)
        self.commit(ORG)
        git(self.t, "-c", f"user.name={ORG[0]}", "-c", f"user.email={ORG[1]}",
            "merge", "-q", "--no-ff", "-m", "merge side2", "side2")
        code, out = self.gate()
        self.assert_red(code, out, inner)

    def test_K206_AG_004_commits_before_base_are_not_checked(self) -> None:
        """K206-AG-004 比べる元と、それより前のコミットは見ない（前からある個人の名義では赤にしない）"""
        self.commit(PERSONAL)
        old_base = self.commit(PERSONAL)      # 比べる元そのものも個人の名義
        self.commit(ORG)
        code, out = self.gate(old_base)
        self.assertEqual(code, 0, out)
        self.assertIn("1 本を見た", out)
        # 同じ履歴で、比べる元を手前に戻すと赤（見ていないのは、比べる元より前だから）
        code, out = self.gate()
        self.assert_red(code, out, old_base)

    def test_K206_AG_005_address_is_masked(self) -> None:
        """K206-AG-005 赤の文に、メールの @ の前と名義の名前を出さない（`***@<ドメイン>` で出す）"""
        self.commit(PERSONAL)
        code, out = self.gate()
        self.assert_red(code, out)
        self.assertIn("***@personal.example", out)
        self.assertNotIn("taro.secret", out)
        self.assertNotIn("Taro Secret", out)
        # 緑のときも、名義の @ の前は出さない
        git(self.t, "reset", "-q", "--hard", self.base)
        self.commit(ORG)
        code, out = self.gate()
        self.assertEqual(code, 0, out)
        self.assertNotIn("dev.member", out)
        self.assertNotIn(ORG[0], out)

    def test_K206_AG_006_unreadable_base_is_red(self) -> None:
        """K206-AG-006 比べる元が読めない（無い参照・無いコミット・空）→ 赤（黙って 0 本の緑にしない）"""
        self.commit(ORG)
        for base in ("no-such-ref", "0123456789abcdef0123456789abcdef01234567", ""):
            with self.subTest(base=base):
                code, out = self.gate(base)
                self.assertEqual(code, 1, out)
                self.assertIn(BASE_WORD, out)
                self.assertNotIn("本を見た", out)

    def test_K206_AG_007_zero_commits_is_green(self) -> None:
        """K206-AG-007 差分が 0 本（比べる元＝HEAD。全部の回の形）→ 緑で「0 本を見た」と出す"""
        head = git(self.t, "rev-parse", "HEAD")
        code, out = self.gate(head)
        self.assertEqual(code, 0, out)
        self.assertIn("0 本を見た", out)

    def test_K206_AG_008_missing_or_broken_config_is_red(self) -> None:
        """K206-AG-008 設定が無い・壊れている・空・住所そのものが書いてある → 赤（コミットが全部組織の名義でも緑にしない）"""
        self.commit(ORG)
        d = pathlib.Path(self.tmp.name)
        cases = {
            "無い": None,
            "JSON でない": "{allowed_domains: [",
            "一番上が入れ物でない（並び）": json.dumps([]),
            "一番上が入れ物でない（null）": "null",
            "鍵が無い": json.dumps({}),
            "並びでない": json.dumps({"allowed_domains": DOMAIN}),
            "空の並び": json.dumps({"allowed_domains": []}),
            "空の文字": json.dumps({"allowed_domains": [""]}),
            "文字でない": json.dumps({"allowed_domains": [1]}),
            "住所そのもの": json.dumps({"allowed_domains": [f"dev.member@{DOMAIN}"]}),
        }
        for i, (name, body) in enumerate(cases.items()):
            with self.subTest(case=name):
                p = d / f"cfg{i}.json"
                if body is not None:
                    p.write_text(body, encoding="utf-8")
                code, out = self.gate(config=p)
                self.assertEqual(code, 1, out)
                self.assertIn(CONFIG_WORD, out)
                self.assertNotIn("本を見た", out)

    def test_K206_AG_009_domain_match_is_exact_and_case_insensitive(self) -> None:
        """K206-AG-009 ドメインは @ の後ろ全部が設定と同じ（大文字小文字は同じと見る）。似せたドメイン・下の階のドメイン・@ の無い名義は赤"""
        for mail in (f"x@{DOMAIN.upper()}", "X.Y@Engine-Base.Com"):
            with self.subTest(green=mail):
                git(self.t, "reset", "-q", "--hard", self.base)
                self.commit(("x", mail))
                code, out = self.gate()
                self.assertEqual(code, 0, out)
        for mail in (f"x@evil-{DOMAIN}", f"x@{DOMAIN}.evil.io", f"x@mail.{DOMAIN}",
                     f"x@{DOMAIN}@evil.example", f"{DOMAIN}"):
            with self.subTest(red=mail):
                git(self.t, "reset", "-q", "--hard", self.base)
                bad = self.commit(("x", mail))
                code, out = self.gate()
                self.assert_red(code, out, bad)
        # 出す文のドメイン：英数字・「.」・「-」のほかは「?」に替えて出す（CI の記録に、制御の文字や命令の形を出さない）
        git(self.t, "reset", "-q", "--hard", self.base)
        bad = self.commit(("x", "x@a\x1b[31m::error.example"))
        code, out = self.gate()
        self.assert_red(code, out, bad)
        self.assertNotIn("\x1b", out)
        self.assertNotIn("::error", out)
        self.assertIn("***@a??31m??error.example", out)

    def test_K206_AG_010_committer_is_not_checked(self) -> None:
        """K206-AG-010 committer は見ない（author が組織の名義なら、committer が別でも緑）"""
        self.commit(ORG, committer=("GitHub", "noreply@web-ui.example"))
        code, out = self.gate()
        self.assertEqual(code, 0, out)
        self.assertIn("1 本を見た", out)

    def test_K206_AG_011_mailmap_cannot_disguise(self) -> None:
        """K206-AG-011 .mailmap で個人の名義を組織の名義に見せかけても赤（コミットに書いてある名義そのものを見る）"""
        (self.t / ".mailmap").write_text(
            f"{ORG[0]} <{ORG[1]}> {PERSONAL[0]} <{PERSONAL[1]}>\n", encoding="utf-8")
        bad = self.commit(PERSONAL)
        self.assertEqual(git(self.t, "log", "-1", "--format=%aE"), ORG[1], "mailmap が効いている（試験の前提）")
        code, out = self.gate()
        self.assert_red(code, out, bad)


class CiDefinition(Repo):
    def test_K206_AG_012_ci_runs_gate_with_scope_base(self) -> None:
        """K206-AG-012 CI の static の組に名義の検査の段があり、どの回でも流れ、比べる元は範囲の段の出力。設定はドメインだけで、--config 無しで読める"""
        jobs = yaml.safe_load(WORKFLOW.read_text(encoding="utf-8"))["jobs"]
        steps = [s for s in jobs["static"]["steps"] if "scripts/ci/author_gate.py" in str(s.get("run", ""))]
        self.assertEqual(len(steps), 1, "static の組に author_gate.py の段が 1 つ")
        step = steps[0]
        self.assertIn('--base-ref "$CI_BASE"', step["run"])
        self.assertEqual(step.get("env", {}).get("CI_BASE"), "${{ steps.scope.outputs.base }}")
        self.assertNotIn("continue-on-error", step)
        # どの回でも流れる（全部の回だけ・重い検査の組だけ、の条件で足すと、チケットの回で何も見ない）
        self.assertIn(step.get("if"), (None, "${{ !cancelled() }}"))
        self.assertNotIn("|| true", step["run"])
        ids = [s.get("id") for s in jobs["static"]["steps"]]
        self.assertLess(ids.index("scope"), jobs["static"]["steps"].index(step), "範囲の段の後ろで流す")
        # この試験そのものが CI で流れる（G65 の並び）
        runs = "\n".join(str(s.get("run", "")) for j in jobs.values() for s in j.get("steps", []))
        self.assertIn("python3 scripts/ci/k206_author_gate_test.py", runs)
        # 設定：ドメインだけ（住所そのものを書かない）
        cfg = json.loads(CONFIG.read_text(encoding="utf-8"))
        self.assertEqual(cfg["allowed_domains"], [DOMAIN])
        self.assertNotIn("@", CONFIG.read_text(encoding="utf-8"))

        # CI の段と同じ呼び方（--config 無し）：今いるフォルダが別のリポジトリでも、台本の隣の設定を読む
        self.commit(ORG)
        code, out = self.gate(default_config=True)
        self.assertEqual(code, 0, out)
        self.assertIn("1 本を見た", out)


if __name__ == "__main__":
    unittest.main(verbosity=2)
