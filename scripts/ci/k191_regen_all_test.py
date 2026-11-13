#!/usr/bin/env python3
"""K-191 の試験：本線の取り込みの後に作り手を全部流す台本（scripts/tickets/regen_all.py）と、その設定・目録・生成物の検査の F5・F6。行 ID は K191-RG-NNN

一時のフォルダに小さい作り物のリポジトリ（目録 scripts/ci/generated.json・作り手 tools/g.py）を置き、台本と検査を命令として流す。
作り物の作り手は、流れた順と流れた場所をリポジトリの外の記録（K191_LOG）に足す。
"""
from __future__ import annotations

import datetime
import fnmatch
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
STRAYS = ["08_api/api-field-consumption.json", "08_api/ears-ac-seed.json", "08_api/lint-mapping.json"]
# 目録の glob に当たっていたが、どの作り手も書かない物（手で持つ）。目録と changes_ignore から外す
HAND = ["07_qa/test-plan/ears-elsewhere.json", "07_qa/test-plan/result-ledger.json", "packages/contracts/src/index.ts"]
# glob を、作り手が実際に書くファイルの並びに替える（glob → 並び）
EXACT = {
    "07_qa/test-plan/*": ["07_qa/test-plan/access-matrix.json", "07_qa/test-plan/ears-test-mapping.json", "07_qa/test-plan/test-plan.html",
                         "07_qa/test-plan/test-plan.json", "07_qa/test-plan/test-plan.md"],
    "packages/contracts/src/*": ["packages/contracts/src/ops.ts", "packages/contracts/src/registry.ts", "packages/contracts/src/schemas.ts",
                                 "packages/contracts/src/types.ts"],
}
# 作った日を刻む出力（目録の作り手の dated）。作り手の run → 並び
DATED = {
    "python3 05_flow/build_functional.py": ["07_functional/*"],
    "python3 05_flow/build_api.py": ["08_api/API-SPEC.md", "08_api/api-decisions.json", "08_api/api-spec.html", "08_api/endpoints.json",
                                     "08_api/openapi.yaml", "08_api/screen-api-coverage.json"],
    "python3 05_flow/build_testplan.py": EXACT["07_qa/test-plan/*"],
}
# 日付を持つが、作った日ではない生成物（期限・決めた日）。dated に入れない
NOT_DATED = ["11_tickets/tickets.json", "11_tickets/tickets.csv", "11_tickets/README.md", "01_hearing/要件一覧.md"]
# changes_ignore にだけあってよい物（作り手の目録の outputs に無い）と、その理由
ONLY_IGNORE = {"01_hearing/decider-answers.jsonl": "決める人の答えの記録。作り手は作らない（フックが足す）。取り込みでは両方の行を残す（catch_up.union）"}

# 作り物の作り手：python3 tools/g.py <名前> <すること>…。すること：
#   <道>=<中身>      書く（中身の @DATE は環境の K191_DATE に置き換える）
#   <道><<元>+<元>   ある元のファイルの中身をつないで書く（ほかの作り手の生成物を読む作り手）
#   -<道>            消す        GROW:<道>  流すたびに 1 行足す（いつまでも変わる作り手）
#   FAIL             文を出して落ちる        FAILLONG  300 字よりずっと長い文を出して落ちる
G_PY = '''import os, pathlib, sys
name = sys.argv[1]
with open(os.environ["K191_LOG"], "a", encoding="utf-8") as h:
    h.write(name + "\\t" + os.path.realpath(os.getcwd()) + "\\n")
for spec in sys.argv[2:]:
    if spec in ("FAIL", "FAILLONG"):
        if spec == "FAILLONG":
            print("標準出力の長い文 " + "あ" * 900)
            print("作り手の長い文 " + "x" * 2000, file=sys.stderr)
        print("作り物の作り手が落ちた " + name, file=sys.stderr)
        sys.exit(3)
    if spec.startswith("-"):
        pathlib.Path(spec[1:]).unlink(missing_ok=True)
        continue
    if spec.startswith("GROW:"):
        with open(spec[5:], "a", encoding="utf-8") as h:
            h.write("もう 1 行\\n")
        continue
    if "=" in spec:
        path, _, body = spec.partition("=")
        body = body.replace("@DATE", os.environ["K191_DATE"]) + "\\n"
    else:
        path, _, srcs = spec.partition("<")
        body = "".join(pathlib.Path(s).read_text(encoding="utf-8") for s in srcs.split("+") if pathlib.Path(s).exists())
    p = pathlib.Path(path)
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(body, encoding="utf-8")
'''
OLD = "2026-11-01"
TODAY = datetime.date.today().isoformat()   # 台本を流す日（手元の日付）
NOW_UTC = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.456Z")
TAIL = 300   # 取り込みの道具が PM に見せるのは、出力（stdout の後に stderr）の最後の 300 字


def git(repo: pathlib.Path, *a: str) -> str:
    return subprocess.run(["git", "-C", str(repo), "-c", "core.quotepath=off", *a], check=True, capture_output=True, text=True, encoding="utf-8").stdout


def gen(name: str, *specs: str, pre: str = "", tool: str = "tools/g.py", dated: bool | list[str] = False) -> dict:
    """作り物の作り手の目録の 1 行。dated=True は outputs を全部「作った日を刻む出力」にする（並びを渡せばその並び）"""
    outs = [s.strip("'").split("=")[0].split("<")[0] for s in specs if "=" in s or "<" in s]
    g = {"name": f"作り手 {name}", "run": f"{pre}python3 {tool} {name} " + " ".join(specs), "outputs": outs}
    if dated:
        g["dated"] = outs if dated is True else dated
    return g


class Repo:
    """作り物のリポジトリ。files は最初のコミットに入れる物（道 → 中身）"""

    def __init__(self, test: unittest.TestCase, catalog: object, files: dict[str, str] | None = None) -> None:
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
        if catalog is not None:
            put[CATALOG] = catalog if isinstance(catalog, str) else json.dumps(catalog, ensure_ascii=False, indent=1)
        for k, v in put.items():
            p = self.dir / k
            p.parent.mkdir(parents=True, exist_ok=True)
            p.write_text(v, encoding="utf-8")
        git(self.dir, "add", "-A")
        git(self.dir, "commit", "-qm", "K-1 feat: 土台")

    def env(self, date: str = TODAY, **extra: str) -> dict[str, str]:
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


def tail(res: subprocess.CompletedProcess) -> str:
    return (res.stdout + res.stderr).strip()[-TAIL:]


def regen(test: unittest.TestCase, cwd: pathlib.Path, env: dict[str, str]) -> subprocess.CompletedProcess:
    test.assertTrue(SCRIPT.exists(), f"台本がまだ無い：{SCRIPT.relative_to(ROOT)}")
    return subprocess.run([sys.executable, str(SCRIPT)], cwd=cwd, env=env, capture_output=True, text=True, encoding="utf-8", timeout=120)


class RegenAll(unittest.TestCase):
    def test_K191_RG_001_runs_every_generator_in_catalog_order_at_the_root(self) -> None:
        r = Repo(self, {"generators": [
            gen("c", "out/c.txt=3"),
            gen("a", "here.txt=1", pre="cd sub && ", tool="../tools/g.py"),
            gen("b", "out/b.txt=2"),
        ]}, {"out/c.txt": "3\n", "sub/here.txt": "1\n", "out/b.txt": "2\n"})
        res = regen(self, r.dir, r.env())
        self.assertEqual(res.returncode, 0, res.stdout + res.stderr)
        self.assertEqual(r.names(), ["c", "a", "b"], "目録の順に 1 回ずつ。何も変わらなければ 1 周で終わる")
        where = dict(r.order())
        self.assertEqual(where["c"], str(r.dir))
        self.assertEqual(where["a"], str(r.dir / "sub"), "run の中の cd はその作り手にだけ効く")
        self.assertEqual(where["b"], str(r.dir), "前の作り手の cd を引きずらない")
        self.assertEqual(r.status(), "")

    def test_K191_RG_002_failing_generator_stops_and_names_it_in_the_last_300_chars(self) -> None:
        for how in ("FAIL", "FAILLONG"):
            with self.subTest(how):
                bad = gen("b", how)
                r = Repo(self, {"generators": [gen("a", "out/a.txt=1"), bad, gen("c", "out/c.txt=3")]})
                res = regen(self, r.dir, r.env())
                self.assertNotEqual(res.returncode, 0)
                self.assertIn("作り物の作り手が落ちた b", res.stdout + res.stderr, "落ちた作り手が出した文も出す")
                self.assertIn(bad["name"], tail(res), "長い文の後でも、最後の 300 字に落ちた作り手の名前が入る")
                self.assertIn(bad["run"].strip(), tail(res), "最後の 300 字に落ちた命令が入る")
                self.assertEqual(r.names(), ["a", "b"], "落ちた後ろの作り手は流さない・次の周にも入らない")
                self.assertFalse((r.dir / "out/c.txt").exists())

    def test_K191_RG_003_never_settling_generator_stops_after_three_rounds(self) -> None:
        with self.subTest("1 つだけ変わり続ける"):
            grow = {"name": "作り手 a", "run": "python3 tools/g.py a GROW:out/g.txt", "outputs": ["out/g.txt"]}
            r = Repo(self, {"generators": [grow, gen("b", "out/b.txt=2")]}, {"out/g.txt": "はじめ\n", "out/b.txt": "2\n"})
            res = regen(self, r.dir, r.env())
            self.assertNotEqual(res.returncode, 0, "3 周流してもまだ変わるのに成功しない")
            self.assertEqual(r.names(), ["a", "b"] * 3, "上限は 3 周")
            self.assertIn("3 周", tail(res), "最後の 300 字に、何が起きたかの説明が入る")
            self.assertIn("out/g.txt", tail(res), "最後の 300 字に、まだ変わるファイルが出る")
            self.assertNotIn("out/b.txt", tail(res))
        with self.subTest("長い名前のファイルが 40 個変わり続ける"):
            names = [f"out/いつまでも変わる長い名前の生成物-{i:02d}.txt" for i in range(40)]
            grow = {"name": "作り手 a", "run": "python3 tools/g.py a " + " ".join(f"GROW:{n}" for n in names), "outputs": ["out/*"]}
            r = Repo(self, {"generators": [grow]}, {n: "はじめ\n" for n in names})
            res = regen(self, r.dir, r.env())
            self.assertNotEqual(res.returncode, 0)
            out = res.stdout + res.stderr
            self.assertIn("3 周", tail(res), "ファイルが多くても、説明が最後の 300 字から押し出されない")
            self.assertIn("40 件", tail(res), "変わるファイルの総数が出る")
            self.assertIn(names[0], tail(res), "先頭の数件の名前が出る")
            self.assertLessEqual(out.count("いつまでも変わる長い名前の生成物-"), 5, "名前は先頭の 5 件まで")

    def test_K191_RG_004_today_only_date_change_is_put_back(self) -> None:
        before = {"out/day.txt": f"作成日 {OLD}\n本文\n", "out/stamp.json": '{"at": "2026-11-01T09:00:00Z", "n": 1}\n'}
        for label, date in {"手元の今日の日付": TODAY, "UTC の今日の日時": NOW_UTC}.items():
            with self.subTest(label):
                r = Repo(self, {"generators": [gen("a", "out/day.txt='作成日 @DATE\n本文'", dated=True),
                                                gen("b", """out/stamp.json='{"at": "@DATE", "n": 1}'""", dated=["out/*.json"])]}, before)
                res = regen(self, r.dir, r.env(date=date))
                self.assertEqual(res.returncode, 0, res.stdout + res.stderr)
                self.assertEqual(r.names(), ["a", "b"], "作り手は流れた。今日の日付だけの違いは「変わった」に数えない（1 周で終わる）")
                for f, body in before.items():
                    self.assertEqual(r.read(f), body.encode(), f"{f} は今日の日付だけの違いなので元のバイトに戻る")
                self.assertEqual(r.status(), "", "差分を残さない")

    def test_K191_RG_005_content_change_and_new_file_stay(self) -> None:
        r = Repo(self, {"generators": [
            gen("a", "out/both.txt='v2 @DATE'", dated=True),
            gen("b", "out/body.txt=v2"),
            gen("c", "out/new.txt='できた @DATE'"),
            gen("d", "out/day.txt='作成日 @DATE'", dated=True),
        ]}, {"out/both.txt": f"v1 {OLD}\n", "out/body.txt": "v1\n", "out/day.txt": f"作成日 {OLD}\n"})
        res = regen(self, r.dir, r.env())
        self.assertEqual(res.returncode, 0, res.stdout + res.stderr)
        self.assertEqual(r.read("out/both.txt"), f"v2 {TODAY}\n".encode(), "中身も日付も変わった物は、新しい版のまま残る")
        self.assertEqual(r.read("out/body.txt"), b"v2\n")
        self.assertEqual(r.read("out/new.txt"), f"できた {TODAY}\n".encode(), "新しくできた物は残る")
        self.assertEqual(r.read("out/day.txt"), f"作成日 {OLD}\n".encode(), "同じ回の今日の日付だけの物は戻る")
        changed = sorted(e[3:] for e in r.status().split("\0") if e)
        self.assertEqual(changed, ["out/body.txt", "out/both.txt", "out/new.txt"])
        self.assertEqual(r.names(), ["a", "b", "c", "d"] * 2, "変わった周の次にもう 1 周流し、変わらないのを見て終わる")

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
            "dated が並びでない": {"generators": [ok, {**ok, "dated": "out/a.txt"}]},
            "dated の中身が字でない": {"generators": [ok, {**ok, "dated": [1]}]},
        }
        for label, catalog in cases.items():
            with self.subTest(label):
                r = Repo(self, catalog)
                res = regen(self, r.dir, r.env())
                self.assertNotEqual(res.returncode, 0, "読めない目録・流す物が無い目録で成功しない")
                self.assertIn(CATALOG, tail(res))
                self.assertEqual(r.names(), [], "作り手を 1 つも流さない")
                self.assertEqual(r.status(), "")

    def test_K191_RG_007_japanese_name_with_space_is_not_missed(self) -> None:
        name = "出力 物/一 覧.md"
        r = Repo(self, {"generators": [gen("a", f"'{name}=作成日 @DATE'", dated=True)]}, {name: f"作成日 {OLD}\n"})
        res = regen(self, r.dir, r.env())
        self.assertEqual(res.returncode, 0, res.stdout + res.stderr)
        self.assertEqual(r.names(), ["a"])
        self.assertEqual(r.read(name), f"作成日 {OLD}\n".encode(), "日本語と空白の名前の物も、今日の日付だけの違いなら戻る")
        self.assertEqual(r.status(), "")

    def test_K191_RG_008_runs_at_the_root_of_the_worktree_it_is_called_from(self) -> None:
        catalog = {"generators": [gen("a", "out/a.txt=v2")]}
        with self.subTest("下のフォルダから呼ぶ"):
            r = Repo(self, catalog, {"out/a.txt": "v1\n", "deep/er/.keep": ""})
            res = regen(self, r.dir / "deep" / "er", r.env())
            self.assertEqual(res.returncode, 0, res.stdout + res.stderr)
            self.assertEqual(set(r.order()), {("a", str(r.dir))})
            self.assertEqual(r.read("out/a.txt"), b"v2\n")
            self.assertFalse((r.dir / "deep/er/out").exists())
        with self.subTest("別の作業場所から呼ぶ"):
            r = Repo(self, catalog, {"out/a.txt": "v1\n", "deep/.keep": ""})
            wt = r.top / "wt"
            git(r.dir, "worktree", "add", "-q", "-b", "t/x", str(wt))
            res = regen(self, wt / "deep", r.env())
            self.assertEqual(res.returncode, 0, res.stdout + res.stderr)
            self.assertEqual(set(r.order()), {("a", str(wt))})
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

    def test_K191_RG_009_after_a_failure_today_only_changes_are_still_put_back(self) -> None:
        r = Repo(self, {"generators": [gen("a", "out/day.txt='作成日 @DATE'", dated=True), gen("b", "out/body.txt=v2"), gen("c", "FAIL")]},
                 {"out/day.txt": f"作成日 {OLD}\n", "out/body.txt": "v1\n"})
        res = regen(self, r.dir, r.env())
        self.assertNotEqual(res.returncode, 0)
        self.assertEqual(r.names(), ["a", "b", "c"])
        self.assertEqual(r.read("out/day.txt"), f"作成日 {OLD}\n".encode(), "落ちる前の作り手の、今日の日付だけの違いは戻る")
        self.assertEqual(r.read("out/body.txt"), b"v2\n", "中身の違いは隠さない")

    def test_K191_RG_010_running_twice_changes_nothing_more(self) -> None:
        r = Repo(self, {"generators": [gen("a", "out/day.txt='作成日 @DATE'", dated=True), gen("b", "out/body.txt=v2")]},
                 {"out/day.txt": f"作成日 {OLD}\n", "out/body.txt": "v1\n"})
        first = regen(self, r.dir, r.env())
        self.assertEqual(first.returncode, 0, first.stdout + first.stderr)
        after_first = (r.status(), r.read("out/day.txt"), r.read("out/body.txt"))
        ran_first = len(r.names())
        second = regen(self, r.dir, r.env())
        self.assertEqual(second.returncode, 0, second.stdout + second.stderr)
        self.assertEqual((r.status(), r.read("out/day.txt"), r.read("out/body.txt")), after_first)
        self.assertEqual(r.names()[ran_first:], ["a", "b"], "2 回目も全部流す（前の結果を覚えて飛ばさない）。変わらないので 1 周")
        self.assertEqual(r.read("out/day.txt"), f"作成日 {OLD}\n".encode())

    def test_K191_RG_011_script_keeps_no_list_of_its_own_and_shares_the_date_rule(self) -> None:
        self.assertTrue(SCRIPT.exists(), f"台本がまだ無い：{SCRIPT.relative_to(ROOT)}")
        src = SCRIPT.read_text(encoding="utf-8")
        sys.path[:0] = [str(ROOT / "scripts" / "ci"), str(ROOT / "scripts" / "tickets")]
        import generated_gate  # noqa: PLC0415
        import regen_all  # noqa: PLC0415

        self.assertEqual(regen_all.DATE.pattern, generated_gate.DATE.pattern, "日付の形の見方は生成物の検査（generated_gate.py の DATE）と同じ")
        real = json.loads((ROOT / CATALOG).read_text(encoding="utf-8"))["generators"]
        self.assertGreater(len(real), 10)
        for g in real:
            self.assertNotIn(g["run"], src, "作り手の一覧を台本が持っている（目録から読む）")
            for word in g["run"].split():
                if word.endswith((".py", ".mjs")):
                    self.assertNotIn(pathlib.PurePosixPath(word).name, src, f"作り手 {word} の名前を台本が持っている（目録から読む）")

    def test_K191_RG_017_generator_reading_a_later_generators_output_ends_up_current(self) -> None:
        # 前の作り手 a が、後ろの作り手 b の生成物を読む（本物：テスト計画がチケットの一覧を読む）
        r = Repo(self, {"generators": [gen("a", "'out/a.txt<out/b.txt'"), gen("b", "'out/b.txt<src.txt'")]},
                 {"src.txt": "新しい元\n", "out/b.txt": "古い元\n", "out/a.txt": "古い元\n"})
        res = regen(self, r.dir, r.env())
        self.assertEqual(res.returncode, 0, res.stdout + res.stderr)
        self.assertEqual(r.read("out/b.txt"), "新しい元\n".encode())
        self.assertEqual(r.read("out/a.txt"), "新しい元\n".encode(), "前の作り手の生成物が、後ろの作り手の新しい物を映していない（1 周で終わっている）")
        self.assertEqual(r.names(), ["a", "b"] * 3, "変わった周の次にもう 1 周。3 周目で変わらないのを見て終わる")
        again = regen(self, r.dir, r.env())
        self.assertEqual(again.returncode, 0)
        self.assertEqual((r.read("out/a.txt"), r.read("out/b.txt")), ("新しい元\n".encode(), "新しい元\n".encode()), "終わった状態は、もう 1 回流しても変わらない")

    def test_K191_RG_018_dated_output_keeps_a_change_to_another_day(self) -> None:
        r = Repo(self, {"generators": [
            gen("a", "'out/due.csv=K-1,期限 2001-02-20'", dated=True),
            gen("b", "'out/mix.md=作成日 @DATE／期限 2001-02-20'", dated=True),
            gen("c", "'out/day.txt=作成日 @DATE'", dated=True),
        ]}, {"out/due.csv": "K-1,期限 2001-02-14\n", "out/mix.md": f"作成日 {OLD}／期限 2001-02-14\n", "out/day.txt": f"作成日 {OLD}\n"})
        res = regen(self, r.dir, r.env())
        self.assertEqual(res.returncode, 0, res.stdout + res.stderr)
        self.assertEqual(r.read("out/due.csv"), "K-1,期限 2001-02-20\n".encode(), "作った日を刻む出力でも、今日でない日付への変更は中身の違い。戻さない")
        self.assertEqual(r.read("out/mix.md"), f"作成日 {TODAY}／期限 2001-02-20\n".encode(), "今日の刻みと今日でない日付の変更が混ざった物は、新しい版のまま残る")
        self.assertEqual(r.read("out/day.txt"), f"作成日 {OLD}\n".encode())
        self.assertEqual(sorted(e[3:] for e in r.status().split("\0") if e), ["out/due.csv", "out/mix.md"])

    def test_K191_RG_019_works_in_the_middle_of_a_merge(self) -> None:
        # 取り込みの道具と同じ形：git merge --no-commit でぶつかった生成物を本線の版に書き、git add せずに台本を呼ぶ
        r = Repo(self, {"generators": [gen("list", "'out/list.txt<src/a.txt+src/b.txt+src/m.txt'"), gen("day", "'out/day.txt=作成日 @DATE'", dated=True)]},
                 {"src/a.txt": "a\n", "out/list.txt": "a\n", "out/day.txt": f"作成日 {OLD}\n", "out/old.txt": "前からある生成物\n"})

        def commit(branch: str, files: dict[str, str], remove: str | None = None) -> None:
            git(r.dir, "checkout", "-q", branch)
            for k, v in files.items():
                r.dir.joinpath(k).parent.mkdir(parents=True, exist_ok=True)
                r.dir.joinpath(k).write_text(v, encoding="utf-8")
            if remove:
                git(r.dir, "rm", "-q", remove)
            git(r.dir, "add", "-A")
            git(r.dir, "commit", "-qm", f"K-2 feat: {branch}")

        git(r.dir, "branch", "t/x")
        commit("main", {"src/m.txt": "m\n", "out/list.txt": "a\nm\n"}, remove="out/old.txt")
        commit("t/x", {"src/b.txt": "b\n", "out/list.txt": "a\nb\n", "out/old.txt": "枝が作り直した生成物\n"})
        m = subprocess.run(["git", "-C", str(r.dir), "merge", "--no-ff", "--no-commit", "main"], capture_output=True, text=True)
        self.assertNotEqual(m.returncode, 0, "作り物の取り込みがぶつかっていない")
        unmerged = sorted(f for f in git(r.dir, "diff", "--name-only", "--diff-filter=U", "-z").split("\0") if f)
        self.assertEqual(unmerged, ["out/list.txt", "out/old.txt"])
        r.dir.joinpath("out/list.txt").write_text(git(r.dir, "show", "main:out/list.txt"), encoding="utf-8")   # ぶつかった物は本線の版に
        r.dir.joinpath("out/old.txt").unlink(missing_ok=True)                                                  # 本線が消した物は消す
        before_day = r.read("out/day.txt")
        res = regen(self, r.dir, r.env())
        self.assertEqual(res.returncode, 0, res.stdout + res.stderr)
        self.assertEqual(r.read("out/list.txt"), b"a\nb\nm\n", "生成物が、本線の元と枝の元の両方を映す")
        self.assertEqual(r.read("out/day.txt"), before_day, "今日の日付だけの物は流す前（取り込んだ後）のバイトに戻る")
        self.assertFalse((r.dir / "out/old.txt").exists(), "版にあるのに作業場所に無い物を、戻して作らない")
        git(r.dir, "add", "-A")
        git(r.dir, "commit", "-qm", "K-2 merge: main を取り込む")
        self.assertEqual(r.status(), "")
        self.assertEqual(len(git(r.dir, "log", "-1", "--format=%P").split()), 2, "取り込みのコミットになっている")

    def test_K191_RG_020_missing_and_deleted_files_do_not_break_it(self) -> None:
        drop = {"name": "作り手 a", "run": "python3 tools/g.py a -out/del.txt", "outputs": ["out/del.txt"]}
        r = Repo(self, {"generators": [drop, gen("b", "'out/day.txt=作成日 @DATE'", dated=True)]},
                 {"out/del.txt": f"作り手が消す物 {OLD}\n", "out/gone.txt": f"流す前から無い物 {OLD}\n", "out/day.txt": f"作成日 {OLD}\n"})
        r.dir.joinpath("out/gone.txt").unlink()
        res = regen(self, r.dir, r.env())
        self.assertEqual(res.returncode, 0, res.stdout + res.stderr)
        self.assertFalse((r.dir / "out/del.txt").exists(), "作り手が消した物は消えたまま（戻さない）")
        self.assertFalse((r.dir / "out/gone.txt").exists(), "流す前から作業場所に無い物は無いまま")
        self.assertEqual(r.read("out/day.txt"), f"作成日 {OLD}\n".encode(), "ほかの物の、今日の日付だけの違いは戻る")
        self.assertEqual(sorted(e[3:] for e in r.status().split("\0") if e), ["out/del.txt", "out/gone.txt"])


    def test_K191_RG_023_only_dated_outputs_are_put_back(self) -> None:
        # 本物：チケットの期限 due を今日に変えた → tickets.json・tickets.csv の違いは「日付だけ・新しい側が今日」だが本物の変更
        due = f"K-1,期限 {TODAY}"
        with self.subTest("dated に無い出力（期限を今日に変えた一覧）は残る。同じ作り手の dated の出力は戻る"):
            r = Repo(self, {"generators": [gen("a", f"'out/tickets.csv={due}'", "'out/plan.md=作成日 @DATE'", dated=["out/plan.md"])]},
                     {"out/tickets.csv": "K-1,期限 2026-11-01\n", "out/plan.md": f"作成日 {OLD}\n"})
            res = regen(self, r.dir, r.env())
            self.assertEqual(res.returncode, 0, res.stdout + res.stderr)
            self.assertEqual(r.read("out/tickets.csv"), f"{due}\n".encode(), "作った日を刻む出力でない物の日付の違いは、今日でも本物の変更。戻さない")
            self.assertEqual(r.read("out/plan.md"), f"作成日 {OLD}\n".encode())
            self.assertEqual(sorted(e[3:] for e in r.status().split("\0") if e), ["out/tickets.csv"])
            self.assertEqual(r.names(), ["a", "a"], "dated に無い物の日付の違いは「変わった」に数える（次の周で変わらないのを見る）")
        with self.subTest("dated が無い作り手の出力は、今日の刻みでも戻さない"):
            r = Repo(self, {"generators": [gen("a", "'out/day.txt=作成日 @DATE'")]}, {"out/day.txt": f"作成日 {OLD}\n"})
            res = regen(self, r.dir, r.env())
            self.assertEqual(res.returncode, 0, res.stdout + res.stderr)
            self.assertEqual(r.read("out/day.txt"), f"作成日 {TODAY}\n".encode())

    def test_K191_RG_025_put_back_replaces_the_file_instead_of_writing_into_it(self) -> None:
        r = Repo(self, {"generators": [gen("a", "'out/day.sh=作成日 @DATE'", dated=True)]}, {"out/day.sh": f"作成日 {OLD}\n"})
        target = r.dir / "out/day.sh"
        target.chmod(0o755)
        git(r.dir, "commit", "-qam", "K-1 chore: 実行できる生成物")
        outside = r.top / "同じ中身を指す名前"
        os.link(target, outside)   # 作り手は中に書くので、この名前にも今日の刻みが見える。戻すときに中へ書けば、ここも元に戻ってしまう
        res = regen(self, r.dir, r.env())
        self.assertEqual(res.returncode, 0, res.stdout + res.stderr)
        self.assertEqual(target.read_bytes(), f"作成日 {OLD}\n".encode())
        self.assertEqual(outside.read_bytes(), f"作成日 {TODAY}\n".encode(), "戻すときは一時のファイルに書いてから置き換える（元のファイルの中に直に書かない）")
        self.assertEqual(target.stat().st_mode & 0o777, 0o755, "権限は元のまま")
        self.assertEqual(r.status(), "", "一時のファイルを残さない")
        self.assertEqual(sorted(x.name for x in (r.dir / "out").iterdir()), ["day.sh"])

    def test_K191_RG_026_os_and_git_failures_end_nonzero_with_the_reason_last(self) -> None:
        with self.subTest("戻す先のフォルダに書けない"):
            self.assertNotEqual(os.geteuid(), 0, "root では権限の失敗を作れない（CI の台は runner で流す）")
            r = Repo(self, {"generators": [gen("a", "'ro/day.txt=作成日 @DATE'", dated=True)]}, {"ro/day.txt": f"作成日 {OLD}\n"})
            (r.dir / "ro").chmod(0o555)
            self.addCleanup((r.dir / "ro").chmod, 0o755)
            res = regen(self, r.dir, r.env())
            out = res.stdout + res.stderr
            self.assertNotEqual(res.returncode, 0, "戻せなかったのに成功しない")
            self.assertNotIn("Traceback", out)
            self.assertIn("ro/day.txt", tail(res), "最後の 300 字に、何が失敗したか（どのファイルか）が出る")
            self.assertEqual(r.read("ro/day.txt"), f"作成日 {TODAY}\n".encode(), "戻せなかった物は、作り手が書いた中身のまま欠けない")
        with self.subTest("作り手が落ち、戻すのにも失敗した"):
            bad = gen("b", "FAIL")
            r = Repo(self, {"generators": [gen("a", "'ro/day.txt=作成日 @DATE'", dated=True), bad]}, {"ro/day.txt": f"作成日 {OLD}\n"})
            (r.dir / "ro").chmod(0o555)
            self.addCleanup((r.dir / "ro").chmod, 0o755)
            res = regen(self, r.dir, r.env())
            self.assertNotEqual(res.returncode, 0)
            self.assertNotIn("Traceback", res.stdout + res.stderr)
            self.assertIn(bad["name"], tail(res), "戻すときの失敗が、落ちた作り手の名前を隠さない")
            self.assertIn("ro/day.txt", tail(res))
        with self.subTest("git がファイルの一覧を出せない"):
            r = Repo(self, {"generators": [gen("a", "out/a.txt=1")]})
            real = shutil.which("git")
            fake = r.top / "bin"
            fake.mkdir()
            (fake / "git").write_text(f'#!/bin/sh\nfor a in "$@"; do [ "$a" = ls-files ] && {{ echo "fatal: 作り物の git の失敗" >&2; exit 128; }}; done\nexec "{real}" "$@"\n', encoding="utf-8")
            (fake / "git").chmod(0o755)
            res = regen(self, r.dir, r.env(PATH=f"{fake}{os.pathsep}{os.environ['PATH']}"))
            out = res.stdout + res.stderr
            self.assertNotEqual(res.returncode, 0)
            self.assertNotIn("Traceback", out)
            self.assertIn("ls-files", tail(res), "最後の 300 字に、失敗した git の命令が出る")
            self.assertEqual(r.names(), [], "ファイルの一覧を読めないなら、作り手を流さない")


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

    def test_K191_RG_013_catalog_and_changes_ignore_list_exactly_what_generators_write(self) -> None:
        api = [g for g in self.gen["generators"] if g["run"] == "python3 05_flow/build_api.py"]
        self.assertEqual(len(api), 1)
        for f in STRAYS:
            self.assertTrue((ROOT / f).is_file(), f)
            self.assertIn(f, api[0]["outputs"], f"{f} が目録の作り手（05_flow/build_api.py）の outputs に無い")
            self.assertIn(f, self.ign, f"{f} が ticket-flow.yaml の changes_ignore に無い")
        for glob, files in EXACT.items():
            self.assertNotIn(glob, self.outs, f"目録の outputs に glob {glob} が残っている（手で持つ物まで当たる）")
            self.assertNotIn(glob, self.ign, f"changes_ignore に glob {glob} が残っている")
            for f in files:
                self.assertTrue((ROOT / f).is_file(), f)
                self.assertIn(f, self.outs)
                self.assertIn(f, self.ign)
        nogen = {n["path"] for n in self.gen.get("not_generated", [])}
        for f in HAND:
            self.assertTrue((ROOT / f).is_file(), f)
            self.assertEqual([g for g in self.outs if fnmatch.fnmatch(f, g)], [], f"手で持つ {f} が目録の outputs に当たる")
            self.assertEqual([g for g in self.ign if fnmatch.fnmatch(f, g)], [], f"手で持つ {f} が changes_ignore に当たる（取り込みで本線の版に置き換わる）")
        self.assertIn("packages/contracts/src/index.ts", nogen, "先頭の説明が検査の印に当たる手書きの物は、理由つきで not_generated に")
        lazy = {n["path"]: n.get("reason", "") for n in self.gen.get("not_always_written", [])}
        self.assertEqual(sorted(lazy), ["apps/web/lib/built-routes.ts"], "変わらない回は書かない作り手の物（F6 の理由つきの一覧）")
        self.assertTrue(lazy["apps/web/lib/built-routes.ts"].strip())

    def test_K191_RG_024_real_catalog_marks_exactly_the_outputs_that_stamp_the_day(self) -> None:
        got = {g["run"]: sorted(g["dated"]) for g in self.gen["generators"] if "dated" in g}
        self.assertEqual(got, {k: sorted(v) for k, v in DATED.items()}, "作った日を刻む出力（2026-11-13 に、にせの日付で作り手を流して洗い出した 18 個）")
        for g in self.gen["generators"]:
            for d in g.get("dated", []):
                self.assertIn(d, g["outputs"], f"dated の {d} が、その作り手の outputs に無い")
        every = [d for g in self.gen["generators"] for d in g.get("dated", [])]
        for f in NOT_DATED:
            self.assertTrue((ROOT / f).is_file(), f)
            self.assertEqual([d for d in every if fnmatch.fnmatch(f, d)], [], f"{f} は作った日を刻まない（日付の違いは本物の変更）。dated に入れない")

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
    """生成物の検査（generated_gate.py）。F5：作り手が、目録のどの outputs にも当たらないファイルを書いた。
    F6：目録の outputs に当たる版に入ったファイルを、どの作り手も書かなかった"""

    def gate(self, catalog: dict, files: dict[str, str]) -> tuple[subprocess.CompletedProcess, Repo]:
        r = Repo(self, catalog, {"scripts/ci/generated_gate.py": GATE.read_text(encoding="utf-8"), **files})
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
        self.assertNotIn("F6", out)
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
                self.assertNotIn("F6", out)
                self.assertIn("PASS", out)
                self.assertIn("a", r.names())


    def test_K191_RG_021_tracked_file_matching_outputs_but_never_written_is_red(self) -> None:
        jp = "out/手で 持つ.json"
        files = {"out/a.txt": "1\n", "out/hand.json": "{}\n", jp: "{}\n", "keep/x.txt": "x\n"}
        res, r = self.gate({"generators": [{"name": "作り手 a", "run": "python3 tools/g.py a out/a.txt=1", "outputs": ["out/*"]}]}, files)
        out = res.stdout + res.stderr
        self.assertEqual(res.returncode, 1, out)
        lines = [line for line in out.splitlines() if "F6" in line]
        self.assertEqual(len(lines), 2, out)
        self.assertTrue(any("out/hand.json" in line and "作り手 a" in line for line in lines), "どの作り手の outputs に当たるかとファイルの名前を出す")
        self.assertTrue(any(jp in line for line in lines), "日本語と空白の名前の物も見落とさない")
        self.assertNotIn("F5", out)
        self.assertFalse(any("out/a.txt" in line or "keep/x.txt" in line for line in lines), "書かれた物・outputs の外の物は F6 にしない")

    def test_K191_RG_022_not_always_written_needs_a_reason(self) -> None:
        files = {"out/a.txt": "1\n", "out/lazy.ts": "x\n"}
        gens = [{"name": "作り手 a", "run": "python3 tools/g.py a out/a.txt=1", "outputs": ["out/a.txt", "out/lazy.ts"]}]
        with self.subTest("理由つきで載せた物は F6 にしない"):
            res, _ = self.gate({"generators": gens, "not_always_written": [{"path": "out/lazy.ts", "reason": "中身が同じ回は書かない作り手"}]}, files)
            self.assertEqual(res.returncode, 0, res.stdout + res.stderr)
            self.assertNotIn("F6", res.stdout + res.stderr)
        for label, entry in {"理由が空": {"path": "out/lazy.ts", "reason": " "}, "理由が無い": {"path": "out/lazy.ts"}}.items():
            with self.subTest(label):
                res, _ = self.gate({"generators": gens, "not_always_written": [entry]}, files)
                out = res.stdout + res.stderr
                self.assertEqual(res.returncode, 1, out)
                self.assertTrue(any("F6" in line and "out/lazy.ts" in line for line in out.splitlines()), out)
        with self.subTest("載せたのに、どの outputs にも当たらない（消した・名前を変えた）"):
            res, _ = self.gate({"generators": gens, "not_always_written": [{"path": "out/lazy.ts", "reason": "x"}, {"path": "out/nai.ts", "reason": "x"}]}, files)
            out = res.stdout + res.stderr
            self.assertEqual(res.returncode, 1, out)
            self.assertTrue(any("F6" in line and "out/nai.ts" in line for line in out.splitlines()), out)


if __name__ == "__main__":
    unittest.main()
