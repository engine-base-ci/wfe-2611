#!/usr/bin/env python3
"""K-191 の試験：本線の取り込みの後に作り手を全部流す台本（scripts/tickets/regen_all.py）と、その設定・目録。行 ID は K191-RG-NNN

一時のフォルダに小さい作り物のリポジトリ（目録 scripts/ci/generated.json・作り手 tools/g.py・最後の命令 scripts/ci/trace_gate.py）を置き、
台本を命令として流す。作り物の作り手は、流れた順と流れた場所をリポジトリの外の記録（K191_LOG）に足す。
"""
from __future__ import annotations

import json
import os
import pathlib
import shutil
import subprocess
import sys
import tempfile
import unittest

import yaml

ROOT = pathlib.Path(__file__).resolve().parents[2]
SCRIPT = ROOT / "scripts" / "tickets" / "regen_all.py"
GATE = ROOT / "scripts" / "ci" / "generated_gate.py"
CATALOG = "scripts/ci/generated.json"
LAST = "python3 scripts/ci/trace_gate.py --index"
STRAYS = ["08_api/api-field-consumption.json", "08_api/ears-ac-seed.json", "08_api/lint-mapping.json"]
# changes_ignore にだけあってよい物（作り手の目録の outputs に無い）と、その理由
ONLY_IGNORE = {"01_hearing/decider-answers.jsonl": "決める人の答えの記録。作り手は作らない（フックが足す）。取り込みでは両方の行を残す（catch_up.union）"}

# 作り物の作り手：python3 tools/g.py <名前> [<道>=<中身>…] [FAIL]。中身の @DATE は環境の K191_DATE に置き換える
G_PY = '''import os, pathlib, sys
name = sys.argv[1]
with open(os.environ["K191_LOG"], "a", encoding="utf-8") as h:
    h.write(name + "\\t" + os.path.realpath(os.getcwd()) + "\\n")
for spec in sys.argv[2:]:
    if spec == "FAIL":
        print("作り物の作り手が落ちた " + name, file=sys.stderr)
        sys.exit(3)
    path, _, body = spec.partition("=")
    p = pathlib.Path(path)
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(body.replace("@DATE", os.environ["K191_DATE"]) + "\\n", encoding="utf-8")
'''
TRACE_PY = '''import os, sys
with open(os.environ["K191_LOG"], "a", encoding="utf-8") as h:
    h.write("trace " + " ".join(sys.argv[1:]) + "\\t" + os.path.realpath(os.getcwd()) + "\\n")
if os.environ.get("K191_TRACE_FAIL"):
    print("作り物の最後の命令が落ちた", file=sys.stderr)
    sys.exit(4)
'''
OLD = "2026-11-01"


def git(repo: pathlib.Path, *a: str) -> str:
    return subprocess.run(["git", "-C", str(repo), "-c", "core.quotepath=off", *a], check=True, capture_output=True, text=True, encoding="utf-8").stdout


def gen(name: str, *specs: str, pre: str = "", tool: str = "tools/g.py") -> dict:
    return {"name": f"作り手 {name}", "run": f"{pre}python3 {tool} {name} " + " ".join(specs), "outputs": [s.split("=")[0].strip("'") for s in specs if "=" in s]}


class Repo:
    """作り物のリポジトリ。files は最初のコミットに入れる物（道 → 中身）"""

    def __init__(self, test: unittest.TestCase, catalog: object, files: dict[str, str] | None = None, trace: bool = True) -> None:
        tmp = tempfile.TemporaryDirectory()
        test.addCleanup(tmp.cleanup)
        self.top = pathlib.Path(os.path.realpath(tmp.name))
        self.dir = self.top / "repo"
        self.log = self.top / "order.log"
        self.dir.mkdir()
        git(self.dir, "init", "-q", "-b", "main")
        git(self.dir, "config", "user.email", "t@example.invalid")
        git(self.dir, "config", "user.name", "t")
        put = {"tools/g.py": G_PY, **(files or {})}
        if trace:
            put["scripts/ci/trace_gate.py"] = TRACE_PY
        if catalog is not None:
            put[CATALOG] = catalog if isinstance(catalog, str) else json.dumps(catalog, ensure_ascii=False, indent=1)
        for k, v in put.items():
            p = self.dir / k
            p.parent.mkdir(parents=True, exist_ok=True)
            p.write_text(v, encoding="utf-8")
        git(self.dir, "add", "-A")
        git(self.dir, "commit", "-qm", "K-1 feat: 土台")

    def env(self, date: str = "2026-11-13", **extra: str) -> dict[str, str]:
        return {**os.environ, "K191_LOG": str(self.log), "K191_DATE": date, **extra}

    def order(self) -> list[tuple[str, str]]:
        if not self.log.exists():
            return []
        return [tuple(line.split("\t")) for line in self.log.read_text(encoding="utf-8").splitlines()]  # type: ignore[misc]

    def names(self) -> list[str]:
        return [n for n, _ in self.order()]

    def status(self, at: pathlib.Path | None = None) -> str:
        return git(at or self.dir, "status", "--porcelain", "-z", "--untracked-files=all")

    def read(self, path: str, at: pathlib.Path | None = None) -> bytes:
        return ((at or self.dir) / path).read_bytes()


def regen(test: unittest.TestCase, cwd: pathlib.Path, env: dict[str, str]) -> subprocess.CompletedProcess:
    test.assertTrue(SCRIPT.exists(), f"台本がまだ無い：{SCRIPT.relative_to(ROOT)}")
    return subprocess.run([sys.executable, str(SCRIPT)], cwd=cwd, env=env, capture_output=True, text=True, encoding="utf-8", timeout=120)


class RegenAll(unittest.TestCase):
    def test_K191_RG_001_runs_every_generator_in_catalog_order_at_the_root_then_the_index(self) -> None:
        r = Repo(self, {"generators": [
            gen("c", "out/c.txt=3"),
            gen("a", "here.txt=1", pre="cd sub && ", tool="../tools/g.py"),
            gen("b", "out/b.txt=2"),
        ]}, {"sub/.keep": ""})
        res = regen(self, r.dir, r.env())
        self.assertEqual(res.returncode, 0, res.stdout + res.stderr)
        self.assertEqual(r.names(), ["c", "a", "b", "trace --index"], "目録の順に 1 回ずつ、最後に要件一覧の作り直し")
        where = dict(r.order())
        self.assertEqual(where["c"], str(r.dir))
        self.assertEqual(where["a"], str(r.dir / "sub"), "run の中の cd はその作り手にだけ効く")
        self.assertEqual(where["b"], str(r.dir), "前の作り手の cd を引きずらない")
        self.assertEqual(where["trace --index"], str(r.dir))
        self.assertEqual(r.read("sub/here.txt"), b"1\n")
        self.assertEqual(r.read("out/b.txt"), b"2\n")

    def test_K191_RG_002_failing_generator_stops_with_its_name_and_command(self) -> None:
        bad = gen("b", "FAIL")
        r = Repo(self, {"generators": [gen("a", "out/a.txt=1"), bad, gen("c", "out/c.txt=3")]})
        res = regen(self, r.dir, r.env())
        self.assertNotEqual(res.returncode, 0)
        out = res.stdout + res.stderr
        self.assertIn(bad["name"], out)
        self.assertIn(bad["run"].strip(), out)
        self.assertIn("作り物の作り手が落ちた b", out, "落ちた作り手が出した文も出す")
        self.assertEqual(r.names(), ["a", "b"], "落ちた後ろの作り手と最後の命令は流さない")
        self.assertFalse((r.dir / "out/c.txt").exists())

    def test_K191_RG_003_failing_or_missing_last_command_is_not_success(self) -> None:
        with self.subTest("最後の命令が落ちる"):
            r = Repo(self, {"generators": [gen("a", "out/a.txt=1")]})
            res = regen(self, r.dir, r.env(K191_TRACE_FAIL="1"))
            self.assertNotEqual(res.returncode, 0)
            self.assertIn(LAST, res.stdout + res.stderr)
            self.assertEqual(r.names(), ["a", "trace --index"])
        with self.subTest("最後の命令の台本が無い"):
            r = Repo(self, {"generators": [gen("a", "out/a.txt=1")]}, trace=False)
            res = regen(self, r.dir, r.env())
            self.assertNotEqual(res.returncode, 0)
            self.assertIn(LAST, res.stdout + res.stderr)

    def test_K191_RG_004_date_only_change_is_put_back(self) -> None:
        before = {"out/day.txt": f"作成日 {OLD}\n本文\n", "out/stamp.json": '{"at": "2026-11-01T09:00:00Z", "n": 1}\n'}
        r = Repo(self, {"generators": [gen("a", "out/day.txt='作成日 @DATE\n本文'"), gen("b", """out/stamp.json='{"at": "@DATE", "n": 1}'""")]}, before)
        res = regen(self, r.dir, r.env(date="2026-11-13T01:02:03.456Z"))
        self.assertEqual(res.returncode, 0, res.stdout + res.stderr)
        self.assertEqual(r.names(), ["a", "b", "trace --index"], "作り手は流れた（流さずに差分なしではない）")
        for f, body in before.items():
            self.assertEqual(r.read(f), body.encode(), f"{f} は日付だけの違いなので元のバイトに戻る")
        self.assertEqual(r.status(), "", "差分を残さない")

    def test_K191_RG_005_content_change_and_new_file_stay(self) -> None:
        r = Repo(self, {"generators": [
            gen("a", "out/both.txt='v2 @DATE'"),
            gen("b", "out/body.txt=v2"),
            gen("c", "out/new.txt='できた @DATE'"),
            gen("d", "out/day.txt='作成日 @DATE'"),
        ]}, {"out/both.txt": f"v1 {OLD}\n", "out/body.txt": "v1\n", "out/day.txt": f"作成日 {OLD}\n"})
        res = regen(self, r.dir, r.env())
        self.assertEqual(res.returncode, 0, res.stdout + res.stderr)
        self.assertEqual(r.read("out/both.txt"), "v2 2026-11-13\n".encode(), "中身も日付も変わった物は、新しい版のまま残る")
        self.assertEqual(r.read("out/body.txt"), b"v2\n")
        self.assertEqual(r.read("out/new.txt"), "できた 2026-11-13\n".encode(), "新しくできた物は残る")
        self.assertEqual(r.read("out/day.txt"), f"作成日 {OLD}\n".encode(), "同じ回の日付だけの物は戻る")
        changed = sorted(e[3:] for e in r.status().split("\0") if e)
        self.assertEqual(changed, ["out/body.txt", "out/both.txt", "out/new.txt"])

    def test_K191_RG_006_unreadable_catalog_stops_before_running_anything(self) -> None:
        ok = gen("a", "out/a.txt=1")
        cases: dict[str, object] = {
            "目録が無い": None,
            "JSON でない": "{ これは JSON ではない",
            "generators が無い": {"_doc": "x"},
            "generators が並びでない": {"generators": {"a": ok}},
            "generators が空": {"generators": []},
            "run の無い項目（前に流せる作り手がある）": {"generators": [ok, {"name": "run が無い", "outputs": ["x"]}]},
            "run が空の字": {"generators": [ok, {"name": "空", "run": "  ", "outputs": ["x"]}]},
        }
        for label, catalog in cases.items():
            with self.subTest(label):
                r = Repo(self, catalog)
                res = regen(self, r.dir, r.env())
                self.assertNotEqual(res.returncode, 0, "読めない目録・流す物が無い目録で成功しない")
                self.assertIn(CATALOG, res.stdout + res.stderr)
                self.assertEqual(r.names(), [], "作り手も最後の命令も 1 つも流さない")
                self.assertEqual(r.status(), "")

    def test_K191_RG_007_japanese_name_with_space_is_not_missed(self) -> None:
        name = "出力 物/一 覧.md"
        r = Repo(self, {"generators": [gen("a", f"'{name}=作成日 @DATE'")]}, {name: f"作成日 {OLD}\n"})
        res = regen(self, r.dir, r.env())
        self.assertEqual(res.returncode, 0, res.stdout + res.stderr)
        self.assertEqual(r.names(), ["a", "trace --index"])
        self.assertEqual(r.read(name), f"作成日 {OLD}\n".encode(), "日本語と空白の名前の物も、日付だけの違いなら戻る")
        self.assertEqual(r.status(), "")

    def test_K191_RG_008_runs_at_the_root_of_the_worktree_it_is_called_from(self) -> None:
        catalog = {"generators": [gen("a", "out/a.txt=v2")]}
        with self.subTest("下のフォルダから呼ぶ"):
            r = Repo(self, catalog, {"out/a.txt": "v1\n", "deep/er/.keep": ""})
            res = regen(self, r.dir / "deep" / "er", r.env())
            self.assertEqual(res.returncode, 0, res.stdout + res.stderr)
            self.assertEqual(r.order(), [("a", str(r.dir)), ("trace --index", str(r.dir))])
            self.assertEqual(r.read("out/a.txt"), b"v2\n")
            self.assertFalse((r.dir / "deep/er/out").exists())
        with self.subTest("別の作業場所から呼ぶ"):
            r = Repo(self, catalog, {"out/a.txt": "v1\n", "deep/.keep": ""})
            wt = r.top / "wt"
            git(r.dir, "worktree", "add", "-q", "-b", "t/x", str(wt))
            res = regen(self, wt / "deep", r.env())
            self.assertEqual(res.returncode, 0, res.stdout + res.stderr)
            self.assertEqual(r.order(), [("a", str(wt)), ("trace --index", str(wt))])
            self.assertEqual(r.read("out/a.txt", wt), b"v2\n")
            self.assertEqual(r.read("out/a.txt"), b"v1\n", "元の作業場所は変えない")
            self.assertEqual(r.status(), "")
        with self.subTest("git の作業場所の外から呼ぶ"):
            r = Repo(self, catalog)
            plain = r.top / "plain"
            shutil.copytree(r.dir, plain, ignore=shutil.ignore_patterns(".git"))
            res = regen(self, plain, r.env())
            self.assertNotEqual(res.returncode, 0, "根を決められないのに、台本のあるリポジトリなど別の場所で流さない")
            self.assertEqual(r.names(), [])
            self.assertFalse((plain / "out").exists())

    def test_K191_RG_009_after_a_failure_date_only_changes_are_still_put_back(self) -> None:
        r = Repo(self, {"generators": [gen("a", "out/day.txt='作成日 @DATE'"), gen("b", "out/body.txt=v2"), gen("c", "FAIL")]},
                 {"out/day.txt": f"作成日 {OLD}\n", "out/body.txt": "v1\n"})
        res = regen(self, r.dir, r.env())
        self.assertNotEqual(res.returncode, 0)
        self.assertEqual(r.names(), ["a", "b", "c"])
        self.assertEqual(r.read("out/day.txt"), f"作成日 {OLD}\n".encode(), "落ちる前の作り手の、日付だけの違いは戻る")
        self.assertEqual(r.read("out/body.txt"), b"v2\n", "中身の違いは隠さない")

    def test_K191_RG_010_running_twice_changes_nothing_more(self) -> None:
        r = Repo(self, {"generators": [gen("a", "out/day.txt='作成日 @DATE'"), gen("b", "out/body.txt=v2")]},
                 {"out/day.txt": f"作成日 {OLD}\n", "out/body.txt": "v1\n"})
        first = regen(self, r.dir, r.env(date="2026-11-13"))
        self.assertEqual(first.returncode, 0, first.stdout + first.stderr)
        after_first = (r.status(), r.read("out/day.txt"), r.read("out/body.txt"))
        second = regen(self, r.dir, r.env(date="2026-11-14"))
        self.assertEqual(second.returncode, 0, second.stdout + second.stderr)
        self.assertEqual((r.status(), r.read("out/day.txt"), r.read("out/body.txt")), after_first)
        self.assertEqual(r.names(), ["a", "b", "trace --index"] * 2, "2 回目も全部流す（前の結果を覚えて飛ばさない）")
        self.assertEqual(r.read("out/day.txt"), f"作成日 {OLD}\n".encode())

    def test_K191_RG_011_script_keeps_no_list_of_its_own_and_shares_the_date_rule(self) -> None:
        self.assertTrue(SCRIPT.exists(), f"台本がまだ無い：{SCRIPT.relative_to(ROOT)}")
        src = SCRIPT.read_text(encoding="utf-8")
        sys.path[:0] = [str(ROOT / "scripts" / "ci"), str(ROOT / "scripts" / "tickets")]
        import generated_gate  # noqa: PLC0415
        import regen_all  # noqa: PLC0415

        self.assertEqual(regen_all.DATE.pattern, generated_gate.DATE.pattern, "日付の見方は生成物の検査（generated_gate.py の DATE）と同じ")
        self.assertIsNone(generated_gate.MARK.search("".join(src.splitlines(keepends=True)[:3])), "台本の先頭 3 行を、生成物の検査が生成物と読む")
        real = json.loads((ROOT / CATALOG).read_text(encoding="utf-8"))["generators"]
        self.assertGreater(len(real), 10)
        for g in real:
            if g["run"] == LAST:
                continue
            self.assertNotIn(g["run"], src, "作り手の一覧を台本が持っている（目録から読む）")
            for word in g["run"].split():
                if word.endswith((".py", ".mjs")) and not word.endswith("trace_gate.py"):
                    self.assertNotIn(pathlib.PurePosixPath(word).name, src, f"作り手 {word} の名前を台本が持っている（目録から読む）")


class Config(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.cfg = yaml.safe_load((ROOT / "ticket-flow.yaml").read_text(encoding="utf-8"))
        cls.gen = json.loads((ROOT / CATALOG).read_text(encoding="utf-8"))
        cls.ign = cls.cfg.get("changes_ignore") or []
        cls.outs = [o for g in cls.gen["generators"] for o in g.get("outputs", [])]

    def test_K191_RG_012_catch_up_is_set_and_points_at_the_script(self) -> None:
        cu = self.cfg.get("catch_up") or {}
        self.assertEqual(cu.get("union"), ["01_hearing/decider-answers.jsonl"])
        self.assertEqual(cu.get("union"), [self.cfg["answers"]], "両方の行を残すのは、決める人の答えの記録（設定 answers）")
        for f in cu.get("union") or []:
            self.assertIn(f, self.ign, "取り込みでぶつかってよいのは changes_ignore の物だけ（union の物もそこに要る）")
            self.assertTrue((ROOT / f).is_file(), f)
        self.assertEqual(cu.get("regen"), "python3 scripts/tickets/regen_all.py")
        self.assertTrue(SCRIPT.is_file(), "catch_up.regen が指す台本が無い")

    def test_K191_RG_013_build_api_strays_are_in_both_lists(self) -> None:
        api = [g for g in self.gen["generators"] if g["run"] == "python3 05_flow/build_api.py"]
        self.assertEqual(len(api), 1)
        for f in STRAYS:
            self.assertTrue((ROOT / f).is_file(), f)
            self.assertIn(f, api[0]["outputs"], f"{f} が目録の作り手（05_flow/build_api.py）の outputs に無い")
            self.assertIn(f, self.ign, f"{f} が ticket-flow.yaml の changes_ignore に無い")

    def test_K191_RG_014_changes_ignore_and_catalog_outputs_agree(self) -> None:
        self.assertEqual(len(self.ign), len(set(self.ign)), "changes_ignore に同じ行が 2 つある")
        self.assertEqual(len(self.outs), len(set(self.outs)), "同じ outputs を 2 つの作り手が持っている")
        only_ignore = sorted(set(self.ign) - set(self.outs))
        only_catalog = sorted(set(self.outs) - set(self.ign))
        self.assertEqual(only_catalog, [], "目録の outputs にあるのに changes_ignore に無い（作り直しただけのチケットが changes: の外で止まる）")
        self.assertEqual(only_ignore, sorted(ONLY_IGNORE), "changes_ignore にあるのに目録の outputs に無い（作り手が作らない物は、理由つきで ONLY_IGNORE に）")
        for f, why in ONLY_IGNORE.items():
            self.assertTrue(why.strip(), f"{f} の理由が空")


class GateF5(unittest.TestCase):
    """生成物の検査（generated_gate.py）の F5：作り手が、目録のどの outputs にも当たらないファイルを書いた"""

    def gate(self, catalog: dict, files: dict[str, str]) -> tuple[subprocess.CompletedProcess, Repo]:
        r = Repo(self, catalog, {"scripts/ci/generated_gate.py": GATE.read_text(encoding="utf-8"), **files}, trace=False)
        res = subprocess.run([sys.executable, "scripts/ci/generated_gate.py"], cwd=r.dir, env=r.env(), capture_output=True, text=True, encoding="utf-8", timeout=120)
        return res, r

    def test_K191_RG_015_generator_writing_outside_its_catalog_is_red(self) -> None:
        jp = "記録 物/外 の物.json"
        files = {"out/a.txt": "1\n", "stray/s.json": "same\n", jp: "same\n"}
        res, r = self.gate({"generators": [{"name": "作り手 a", "run": f"python3 tools/g.py a out/a.txt=1 stray/s.json=same '{jp}=same'", "outputs": ["out/a.txt"]}]}, files)
        out = res.stdout + res.stderr
        self.assertEqual(r.names(), ["a"])
        self.assertEqual(res.returncode, 1, out)
        self.assertIn("F5", out)
        self.assertIn("stray/s.json", out, "中身が同じでも、書いた物が目録に無ければ赤")
        self.assertIn(jp, out, "日本語と空白の名前の物も見落とさない")
        self.assertIn("作り手 a", out, "どの作り手が書いたかを出す")
        self.assertEqual(sum(1 for line in out.splitlines() if "F5" in line), 2, out)
        self.assertEqual(r.status(), "", "検査の後は手元を元に戻す")

    def test_K191_RG_016_declared_outputs_are_not_f5(self) -> None:
        files = {"out/a.txt": "1\n", "out/deep/b.txt": "2\n", "other/c.json": "3\n", "keep/untouched.txt": "x\n"}
        run = "python3 tools/g.py a out/a.txt=1 out/deep/b.txt=2 other/c.json=3"
        cases = {
            "自分の outputs（glob を含む）と、ほかで確かめる物（checked_elsewhere）": {
                "generators": [{"name": "作り手 a", "run": run, "outputs": ["out/a.txt", "out/deep/*"]}],
                "checked_elsewhere": [{"outputs": ["other/c.json"], "by": "別の検査"}]},
            "ほかの作り手の outputs に載っている物": {
                "generators": [{"name": "作り手 a", "run": run, "outputs": ["out/a.txt", "out/deep/*"]},
                               {"name": "作り手 c", "run": "python3 tools/g.py c other/c.json=3", "outputs": ["other/c.json"]}]},
        }
        for label, catalog in cases.items():
            with self.subTest(label):
                res, r = self.gate(catalog, files)
                out = res.stdout + res.stderr
                self.assertEqual(res.returncode, 0, out)
                self.assertNotIn("F5", out)
                self.assertIn("PASS", out)
                self.assertIn("a", r.names())


if __name__ == "__main__":
    unittest.main()
