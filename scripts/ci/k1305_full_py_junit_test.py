#!/usr/bin/env python3
"""K-1305 段の全部の CI で毎回赤になる、プロジェクト側の元を直す試験。行 ID（K1305-CI-…）は 11_tickets/K-1305.md の表に結ぶ。

試験が決める形（実装の役が作る）:
  scripts/ci/ci_scope.py   全部の回（scope=full）でも、段の葉（base..head の件名の番号・取り込みのコミットは飛ばす）の tests: の .py を
                           py_tests に出す（_full_py_tests）。比べる元が無い・葉の tests: が何にも当たらない回は止めずに理由に残す。
                           チケットの回（scope=ticket）の動きは変えない
  scripts/ci/prior_refs.py 聞くことのページの「<K-番号> は枝 <枝> の <sha>」（控えの枝）を読む・確かめる
      declared(text) -> {チケット: (枝, sha)}（同じチケットに違う宣言が 2 つなら ValueError）
      missing_message(tid, sha, branch) -> 枝の名前・git push・prior_refs.py check --remote を含む赤の文
      commit_problems(root, tid, locs, decl) -> [赤の文]（宣言が無い・sha が git に無い・ファイル:行 がその版に無い）
      python3 scripts/ci/prior_refs.py list|check --remote <置き場> [--root R]
  scripts/ci/ticket_process_test.py の K146-CI-008 は着手前の確かめを prior_refs.commit_problems で流す（見る中身は今と同じ＋宣言が在ること）
使い方: python3 scripts/ci/k1305_full_py_junit_test.py
"""
from __future__ import annotations

import json
import os
import pathlib
import subprocess
import sys
import tempfile
import unittest
import xml.etree.ElementTree as ET

import yaml

HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parent.parent
sys.path.insert(0, str(HERE))
sys.path.insert(0, str(ROOT / "scripts" / "tickets"))
import ci_scope  # noqa: E402
import ci_scope_test as cst  # noqa: E402  試しの repo（Repo・RULES・git）は範囲の台本の試験の物をそのまま使う
import prior_refs  # noqa: E402  （実装はこのチケットで作る）

WF = yaml.safe_load((ROOT / ".github" / "workflows" / "v3-gate.yml").read_text(encoding="utf-8"))

PASS_FAIL = """import unittest


class T(unittest.TestCase):
    def test_KX_CI_001_ok(self):
        self.assertTrue(True)

    def test_KX_CI_002_red(self):
        self.assertEqual(1, 2)
"""
PASS_ONLY = """import unittest


class T(unittest.TestCase):
    def test_KY_CI_001_ok(self):
        self.assertTrue(True)
"""


def tmd(tid: str, tests: list[str]) -> str:
    return f"---\nid: {tid}\naffects: []\nci_wide: [ci]\ntests: [{', '.join(tests)}]\n---\n"


class Leaves(cst.Base):
    """本線（base）の先に、段の葉 K-1・K-2 のコミット"""

    def leaves(self) -> None:
        self.r.commit("K-1 test: 試験", **{"scripts__ci__a_test.py": PASS_FAIL, "apps__x__test__k1.test.ts": "// x\n",
                                          "11_tickets__K-1.md": tmd("K-1", ["scripts/ci/a_test.py", "apps/x/test/k1.test.ts"])})
        self.r.commit("K-2 test: 試験", **{"scripts__ci__b_test.py": PASS_ONLY, "11_tickets__K-2.md": tmd("K-2", ["scripts/ci/b_test.py"])})

    def test_K1305_CI_001_full_outputs_leaf_py_tests(self) -> None:
        """K1305-CI-001 全部の回：段の葉 2 本の tests: の .py だけが py_tests（並べた順）。.ts は入らない。全部の回の形は今のまま"""
        self.leaves()
        p = self.r.plan(scope="full")
        self.assertEqual(p["mode"], "full")
        self.assertEqual(p["py_tests"], ["scripts/ci/a_test.py", "scripts/ci/b_test.py"])
        self.assertEqual(p["unit_files"], [])
        self.assertEqual(p["unit_shards"], 6)
        self.assertEqual(p["errors"], [])
        self.assertEqual(json.loads(ci_scope.outputs(p)["py_tests"]), ["scripts/ci/a_test.py", "scripts/ci/b_test.py"])
        self.assertEqual(ci_scope.outputs(p)["full"], "true")

    def test_K1305_CI_002_merge_and_mainline_commits_are_not_leaves(self) -> None:
        """K1305-CI-002 全部の回：本線に入った葉（base より前）と、取り込みのコミット（親 2 つ）の件名の番号は葉に数えない"""
        r = self.r
        r.commit("K-3 test: 本線に入った葉", **{"scripts__ci__c_test.py": PASS_ONLY, "11_tickets__K-3.md": tmd("K-3", ["scripts/ci/c_test.py"])})
        r.commit("K-4 docs: 取り込みの番号だけ", **{"scripts__ci__d_test.py": PASS_ONLY, "11_tickets__K-4.md": tmd("K-4", ["scripts/ci/d_test.py"])})
        base = cst.git(r.dir, "rev-parse", "HEAD")
        cst.git(r.dir, "checkout", "-q", "-b", "side")
        r.commit("K-1 test: 試験", **{"scripts__ci__a_test.py": PASS_FAIL, "11_tickets__K-1.md": tmd("K-1", ["scripts/ci/a_test.py"])})
        cst.git(r.dir, "checkout", "-q", "main")
        r.commit("K-2 test: 試験", **{"scripts__ci__b_test.py": PASS_ONLY, "11_tickets__K-2.md": tmd("K-2", ["scripts/ci/b_test.py"])})
        cst.git(r.dir, "merge", "-q", "--no-ff", "-m", "K-4 merge: 取り込みの列の前の木", "side")
        p = r.plan(scope="full", base=base)
        self.assertEqual(p["py_tests"], ["scripts/ci/a_test.py", "scripts/ci/b_test.py"])

    def test_K1305_CI_003_missing_glob_is_reason_not_stop(self) -> None:
        """K1305-CI-003 全部の回：葉の tests: の .py が何にも当たらない → ほかの葉の .py は出る・理由に「K-2 の tests: の … が何にも当たらない」・
        errors は空で組は全部流れる（出せなかった行は記録に無く照らしで赤）"""
        self.r.commit("K-1 test: 試験", **{"scripts__ci__a_test.py": PASS_FAIL, "11_tickets__K-1.md": tmd("K-1", ["scripts/ci/a_test.py"])})
        self.r.commit("K-2 test: 試験", **{"11_tickets__K-2.md": tmd("K-2", ["scripts/ci/nope_test.py"])})
        p = self.r.plan(scope="full")
        self.assertEqual(p["py_tests"], ["scripts/ci/a_test.py"])
        self.assertIn("全部の回の .py の試験：K-2 の tests: の scripts/ci/nope_test.py が何にも当たらない", p["reasons"])
        self.assertEqual(p["errors"], [])
        self.assertEqual(p["jobs"], {"unit": True, "database": True, "web": True})

    def test_K1305_CI_004_full_without_base(self) -> None:
        """K1305-CI-004 全部の回・比べる元が無い（空・40 桁の 0）→ py_tests は空・理由に「比べる元が無い」・全部の回のまま（止めない）"""
        self.leaves()
        for base in ("", "0" * 40):
            p = self.r.plan(scope="full", base=base)
            self.assertEqual(p["mode"], "full", base)
            self.assertEqual(p["py_tests"], [], base)
            self.assertIn("全部の回の .py の試験：比べる元が無いので段の葉を出せない（0 本）", p["reasons"], base)
            self.assertEqual(p["errors"], [], base)

    def test_K1305_CI_005_ticket_scope_unchanged(self) -> None:
        """K1305-CI-005 チケットの回は今と同じ：葉 1 本（K-1）の回は K-1 の tests: の .py だけ。葉 2 本の回は今と同じく止める（py_tests は空）"""
        self.r.commit("K-1 test: 試験", **{"scripts__ci__a_test.py": PASS_FAIL, "11_tickets__K-1.md": tmd("K-1", ["scripts/ci/a_test.py"])})
        p = self.r.plan(scope="ticket")
        self.assertEqual(p["mode"], "scoped")
        self.assertEqual(p["py_tests"], ["scripts/ci/a_test.py"])
        self.assertFalse(any("全部の回" in x for x in p["reasons"]), p["reasons"])
        self.r.commit("K-2 test: 試験", **{"scripts__ci__b_test.py": PASS_ONLY, "11_tickets__K-2.md": tmd("K-2", ["scripts/ci/b_test.py"])})
        p2 = self.r.plan(scope="ticket")
        self.assertEqual(p2["py_tests"], [])
        self.assertTrue(any("全部には倒さず止める" in e for e in p2["errors"]), p2["errors"])

    def test_K1305_CI_006_full_py_tests_reach_junit(self) -> None:
        """K1305-CI-006 全部の回の py_tests を、CI の段と同じ命令（junit_unittest.py --files-json）に渡す → JUnit に葉の行が pass／fail で出る
        （KX-CI-001 は pass・KX-CI-002 は failure・KY-CI-001 は pass の 3 個）・落ちた行があるので終わりの番号 1"""
        self.leaves()
        out = ci_scope.outputs(self.r.plan(scope="full"))
        xml = self.r.dir / "junit" / "spec-py.xml"
        run = subprocess.run([sys.executable, str(HERE / "junit_unittest.py"), "--out", str(xml), "--files-json", out["py_tests"]],
                             cwd=self.r.dir, capture_output=True, text=True)
        self.assertEqual(run.returncode, 1, run.stdout + run.stderr)
        cases = {c.get("name"): c for c in ET.parse(xml).getroot().iter("testcase")}
        by_row = {}
        for name, c in cases.items():
            for row in ("KX_CI_001", "KX_CI_002", "KY_CI_001"):
                if row in name:
                    by_row[row] = "failure" if c.find("failure") is not None or c.find("error") is not None else "pass"
        self.assertEqual(by_row, {"KX_CI_001": "pass", "KX_CI_002": "failure", "KY_CI_001": "pass"}, list(cases))
        self.assertEqual(len(cases), 3)


class Workflow(unittest.TestCase):
    def test_K1305_CI_007_py_step_runs_on_full(self) -> None:
        """K1305-CI-007 CI の定義：spec の組の .py の段は 1 つ・if は !cancelled() だけ（全部の回を外さない）・scope の段の py_tests を読み
        junit/spec-py.xml に書く・G64 と G65 より前（G65 の && が赤で止まっても葉の .py の行は記録に載る）・spec の組は junit/ を always() で上げる"""
        st = WF["jobs"]["spec"]["steps"]
        names = [s.get("name", "") for s in st]
        py = [i for i, s in enumerate(st) if "py_tests" in str(s.get("env", ""))]
        self.assertEqual(len(py), 1)
        s = st[py[0]]
        self.assertEqual(s.get("if"), "${{ !cancelled() }}")
        self.assertIn("steps.scope.outputs.py_tests", str(s["env"]))
        self.assertIn("junit_unittest.py --out junit/spec-py.xml", s["run"])
        g64 = next(i for i, n in enumerate(names) if n.startswith("G64 "))
        g65 = next(i for i, n in enumerate(names) if n.startswith("G65 "))
        self.assertLess(py[0], g64)
        self.assertLess(py[0], g65)
        up = [x for x in st if "upload-artifact" in str(x.get("uses", "")) and (x.get("with") or {}).get("path") == "junit/"]
        self.assertEqual(len(up), 1)
        self.assertEqual(up[0].get("if"), "always()")

    def test_K1305_CI_012_wired(self) -> None:
        """K1305-CI-012 CI へのつなぎ：scripts/ci/g65.d/K-1305.txt がこの試験の命令 1 行で、CI の定義の G65 の段に在る"""
        line = (ROOT / "scripts/ci/g65.d/K-1305.txt").read_text(encoding="utf-8").strip()
        self.assertEqual(line, "python3 scripts/ci/k1305_full_py_junit_test.py")
        g65 = [s for s in WF["jobs"]["spec"]["steps"] if s.get("name", "").startswith("G65 ")]
        self.assertEqual(len(g65), 1)
        self.assertIn(line, g65[0]["run"])


def run_git(repo: pathlib.Path, *args: str) -> str:
    return cst.git(repo, *args)


PAGE = "K-63 は枝 k63-impl の a4375be9、K-64 は枝 k64-make の 87970598 と突き合わせた。\n"


class PriorRefs(unittest.TestCase):
    def test_K1305_CI_008_declared(self) -> None:
        """K1305-CI-008 G64 の控えの枝の宣言：本物のページ（聞くこと_K-146.md）から K-63＝k63-impl の a4375be9・K-64＝k64-make の 87970598。
        宣言の無い文は空。同じチケットに違う宣言が 2 つなら ValueError"""
        page = (ROOT / "01_hearing/聞くこと_K-146.md").read_text(encoding="utf-8")
        self.assertEqual(prior_refs.declared(page), {"K-63": ("k63-impl", "a4375be9"), "K-64": ("k64-make", "87970598")})
        self.assertEqual(prior_refs.declared("K-64 と突き合わせた（枝の名前なし）\n"), {})
        with self.assertRaises(ValueError):
            prior_refs.declared(PAGE + "K-64 は枝 k64-other の 1234567 と突き合わせた。\n")

    def test_K1305_CI_009_commit_problems(self) -> None:
        """K1305-CI-009 G64 の着手前の確かめ（commit_problems）：在る sha と行 → 空。無い sha → 宣言の枝の名前・git push・prior_refs.py check --remote を
        含む文。ファイルが無い・行が足りない → その文。宣言が無いチケット → 「枝 <枝> の <sha>」が無い文。形でない → 形の文"""
        with tempfile.TemporaryDirectory() as d:
            repo = pathlib.Path(d)
            run_git(repo, "init", "-q", "-b", "main")
            cst.write(repo, "a.txt", "1\n2\n3\n")
            run_git(repo, "add", "-A")
            run_git(repo, "commit", "-q", "-m", "K-0 chore: 土台")
            sha = run_git(repo, "rev-parse", "--short=8", "HEAD")
            decl = {"K-64": ("k64-make", sha)}
            self.assertEqual(prior_refs.commit_problems(repo, "K-64", [f"a.txt:3@{sha}"], decl), [])
            gone = "deadbeef"
            got = prior_refs.commit_problems(repo, "K-64", [f"a.txt:3@{gone}"], decl)
            self.assertEqual(got, [prior_refs.missing_message("K-64", gone, "k64-make")])
            for part in ("deadbeef", "k64-make", "git push <置き場> k64-make", "prior_refs.py check --remote"):
                self.assertIn(part, got[0])
            self.assertEqual(prior_refs.commit_problems(repo, "K-64", [f"b.txt:1@{sha}"], decl), [f"K-64（着手前）：b.txt が {sha} に無い"])
            self.assertEqual(prior_refs.commit_problems(repo, "K-64", [f"a.txt:4@{sha}"], decl), [f"K-64（着手前）：a.txt:4 が {sha} に無い"])
            self.assertTrue(prior_refs.commit_problems(repo, "K-63", [f"a.txt:1@{sha}"], decl)[0].startswith("K-63（着手前）：ページに「K-63 は枝 <枝> の <sha>」が無い"))
            self.assertEqual(prior_refs.commit_problems(repo, "K-64", ["a.txt@x"], decl), ["K-64：ファイル:行@sha の形でない：a.txt@x"])

    def test_K1305_CI_010_check_remote(self) -> None:
        """K1305-CI-010 置き場の確かめ（check --remote）：着手前の K-64 の枝が置き場に無い → exit 1・「k64-make が無い（git push <置き場> k64-make）」。
        上げたら exit 0。置き場の枝が sha を含まない古い先頭 → exit 1。K-64 が完了なら見ない（exit 0）。list は着手前の枝を 1 行ずつ"""
        with tempfile.TemporaryDirectory() as d:
            repo, bare = pathlib.Path(d) / "r", pathlib.Path(d) / "ci.git"
            repo.mkdir()
            run_git(repo, "init", "-q", "-b", "main")
            cst.write(repo, "a.txt", "1\n")
            cst.write(repo, "11_tickets/K-64.md", "---\nid: K-64\nstage: 未着手\n---\n")
            run_git(repo, "add", "-A")
            run_git(repo, "commit", "-q", "-m", "K-0 chore: 土台")
            old = run_git(repo, "rev-parse", "HEAD")
            run_git(repo, "checkout", "-q", "-b", "k64-make")
            cst.write(repo, "a.txt", "2\n")
            run_git(repo, "commit", "-q", "-am", "K-64 test: 先の実装")
            sha = run_git(repo, "rev-parse", "--short=8", "HEAD")
            run_git(repo, "checkout", "-q", "main")
            cst.write(repo, "01_hearing/聞くこと_K-146.md", f"K-64 は枝 k64-make の {sha} と突き合わせた。\n")
            run_git(repo, "add", "-A")
            run_git(repo, "commit", "-q", "-m", "K-146 docs: ページ")
            subprocess.run(["git", "init", "-q", "--bare", str(bare)], check=True)

            def check() -> subprocess.CompletedProcess:
                return subprocess.run([sys.executable, str(HERE / "prior_refs.py"), "check", "--remote", str(bare), "--root", str(repo)],
                                      capture_output=True, text=True)

            lst = subprocess.run([sys.executable, str(HERE / "prior_refs.py"), "list", "--root", str(repo)], capture_output=True, text=True)
            self.assertEqual(lst.stdout, "k64-make\n")
            r = check()
            self.assertEqual(r.returncode, 1, r.stdout)
            self.assertIn(f"K-64：置き場 {bare} に控えの枝 k64-make が無い（git push {bare} k64-make）", r.stdout)
            run_git(repo, "push", "-q", str(bare), f"{old}:refs/heads/k64-make")
            r = check()
            self.assertEqual(r.returncode, 1, r.stdout)
            self.assertIn(f"を含まない（git push {bare} k64-make）", r.stdout)
            run_git(repo, "push", "-q", "--force", str(bare), "k64-make:refs/heads/k64-make")
            r = check()
            self.assertEqual(r.returncode, 0, r.stdout)
            cst.write(repo, "11_tickets/K-64.md", "---\nid: K-64\nstage: 完了\n---\n")
            run_git(repo, "push", "-q", "--force", str(bare), f"{old}:refs/heads/k64-make")
            self.assertEqual(check().returncode, 0)
            self.assertEqual(subprocess.run([sys.executable, str(HERE / "prior_refs.py"), "list", "--root", str(repo)],
                                            capture_output=True, text=True).stdout, "")

    def test_K1305_CI_011_k146_uses_prior_refs(self) -> None:
        """K1305-CI-011 G64 の K146-CI-008 は着手前の確かめを prior_refs.commit_problems（宣言は prior_refs.declared）で流し、
        自分で git の cat-file を流さない（確かめは 1 か所）。本物の repo で K146-CI-008 を流すと緑（手元は控えの枝がある）"""
        src = (HERE / "ticket_process_test.py").read_text(encoding="utf-8")
        self.assertIn("prior_refs.commit_problems(ROOT, t,", src)
        self.assertIn("prior_refs.declared(page)", src)
        self.assertNotIn('"cat-file"', src)
        r = subprocess.run([sys.executable, str(HERE / "ticket_process_test.py"), "RepoTest.test_K146_CI_008_k63_k64_washed_against_code"],
                           cwd=ROOT, capture_output=True, text=True)
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)


if __name__ == "__main__":
    unittest.main(verbosity=2)
