#!/usr/bin/env python3
"""K-1304：画面の試験の組（web）を、置き場の変数 WEB_SHARDS の数の台で「取りに行く形」で流す（試験は 1 本も減らさない・照らしは今と同じ 1 回）。

変数が無い（か 1）の回は、web の組は今と全く同じ 1 組（matrix の all）。2 以上なら取りに行く台 pull-1〜N と専用の段を 1 組ずつにし、
どの台も G48・G59 の「まだ流していない試験のファイル」を取り台（git の印を無いときだけ作る push）から 1 本ずつ取って流す。
web-report の組が並びのどの番号にも結果がちょうど 1 つかを見て、blob を merge-reports でまとめ、試験の集合が並びと同じかを確かめ、
今と同じ ci_results.py record と op_gate.py を 1 回流す。画面の組み立て（next build）は web-build の組で 1 回だけ。
"""
from __future__ import annotations

import contextlib
import io
import json
import os
import pathlib
import re
import shutil
import subprocess
import sys
import tempfile
import unittest
from unittest import mock

import yaml

ROOT = pathlib.Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts" / "ci"))
import web_pull  # noqa: E402
import web_run  # noqa: E402

WF_TEXT = (ROOT / ".github/workflows/v3-gate.yml").read_text(encoding="utf-8")
WF = yaml.safe_load(WF_TEXT)
JOBS = WF["jobs"]
BUILDER = (ROOT / "05_flow/build_testplan.py").read_text(encoding="utf-8")
GATE_IDS = sorted(json.loads((ROOT / "scripts/ci/ci_scope.json").read_text(encoding="utf-8"))["web_select"]["gates"], key=int)
PW = pathlib.Path(os.environ.get("K1304_PW") or ROOT / "apps/web/node_modules/.bin/playwright")   # 手元で部品の置き場が違うときだけ K1304_PW で渡す
OLD_G48 = [["pnpm", "--filter", "@kaname/web", "e2e:k"],
           ["python3", "scripts/ci/ci_results.py", "record", "--report", "apps/web/pw-reports/k.json", "--sha", "abc", "--records", "07_qa/ci-results"],
           ["python3", "scripts/ci/op_gate.py", "--spec", "07_qa/test-specs/k", "--tickets", "11_tickets/tickets.json", "--all", "--pending-from-report"]]


# ---------------------------------------------------------------- 式を読む（GitHub の式のうち、この試験が使う形だけ）
def ev(expr: str, ctx: dict[str, object]) -> object:
    """${{ … }} の式を ctx（matrix.part などの値）で評価する。知らない名前は KeyError（黙って偽にしない）"""
    body = str(expr).strip()
    if body.startswith("${{") and body.endswith("}}"):
        body = body[3:-2]
    strings: list[str] = []

    def keep(m: re.Match) -> str:
        strings.append(m.group(1))
        return f"__s{len(strings) - 1}__"

    body = re.sub(r"'([^']*)'", keep, body)

    def name(m: re.Match) -> str:
        w = m.group(0)
        if w in ("fromJSON", "format", "startsWith", "contains", "always", "cancelled", "success", "failure") or re.fullmatch(r"__s\d+__", w):
            return w
        if w not in ctx:
            raise KeyError(w)
        return f"ctx[{w!r}]"

    body = re.sub(r"[A-Za-z_][\w.-]*(?<![.-])", name, body)
    body = body.replace("&&", " and ").replace("||", " or ")
    body = re.sub(r"!(?!=)", " not ", body)
    body = re.sub(r"__s(\d+)__", lambda m: repr(strings[int(m.group(1))]), body)
    fns = {"fromJSON": json.loads, "format": lambda f, *a: f.format(*a), "startsWith": lambda a, b: str(a).startswith(b),
           "contains": lambda a, b: b in a, "always": lambda: True, "cancelled": lambda: bool(ctx.get("@cancelled")),
           "success": lambda: not ctx.get("@failed"), "failure": lambda: bool(ctx.get("@failed"))}
    return eval(body, {"__builtins__": {}}, {**fns, "ctx": ctx})   # noqa: S307 — 版に入った CI の定義の式だけ


def web_ctx(part: str, shards: str, parts: str = "", hosted: bool = False) -> dict[str, object]:
    return {"matrix.part": part, "needs.static.outputs.web_shards": shards, "needs.static.outputs.web_parts": parts,
            "needs.static.outputs.web": "true", "inputs.web": "run", "runner.environment": "github-hosted" if hosted else "self-hosted",
            "runner.os": "Linux", "github.workspace": "/w", "github.run_id": "1", "github.run_attempt": "1", "github.job": "web"}


def runs(job: str, ctx: dict[str, object]) -> list[dict]:
    """その回に流れる段（if を ctx で評価した結果）"""
    return [s for s in JOBS[job]["steps"] if "if" not in s or ev(s["if"], ctx)]


def upload_names(steps: list[dict], ctx: dict[str, object]) -> list[str]:
    out = []
    for s in steps:
        if str(s.get("uses", "")).startswith("actions/upload-artifact@"):
            n = str((s.get("with") or {}).get("name"))
            out.append(re.sub(r"\$\{\{ matrix\.part \}\}", str(ctx["matrix.part"]), n))
    return out


# ---------------------------------------------------------------- web_run.py を、命令を記録するだけの偽の subprocess で流す
class Run:
    def __init__(self, rc: int = 0) -> None:
        self.calls: list[tuple[list[str], dict]] = []
        self.rc = rc

    def __call__(self, cmd, env=None, **kw):   # noqa: ANN001
        self.calls.append((list(cmd), dict(env or {})))
        return subprocess.CompletedProcess(cmd, self.rc)


def go(argv: list[str], env: dict[str, str], cwd: pathlib.Path, rc: int = 0) -> tuple[int, list[tuple[list[str], dict]], str]:
    fake = Run(rc)
    base = {k: v for k, v in os.environ.items() if not k.startswith(("CI_", "WEB_", "PLAYWRIGHT_"))}
    out = io.StringIO()
    old = os.getcwd()
    os.chdir(cwd)
    try:
        with mock.patch.dict(os.environ, {**base, "GITHUB_SHA": "abc", **env}, clear=True), mock.patch.object(web_run.subprocess, "run", fake), \
                mock.patch.object(sys, "argv", ["web_run.py", *argv]), contextlib.redirect_stdout(out):
            code = web_run.main()
    finally:
        os.chdir(old)
    return code, fake.calls, out.getvalue()


FULL = {"CI_FULL": "true", "CI_WEB_SPECS": "[]", "CI_WEB_OTHER": "[]", "CI_WEB_TASKS": "[]", "CI_WEB_GATES": "{}"}


class ShardCount(unittest.TestCase):
    def test_K1304_CI_001_variable_value_to_parts(self) -> None:
        """K1304-CI-001 変数の値 → 分ける数と組の一覧。空は 1（今と同じ all の 1 組）。数でない・範囲の外は赤で、出力を書かない"""
        self.assertEqual([web_run.shard_count(v) for v in ("", "  ", "1", "4", "40")], [1, 1, 1, 4, 40])
        for bad in ("0", "41", "-1", "abc", "2.5", "3x", "１"):
            with self.subTest(bad), self.assertRaises(ValueError):
                web_run.shard_count(bad)
        self.assertEqual(web_run.parts(1, GATE_IDS), ["all"])
        self.assertEqual(web_run.parts(4, GATE_IDS), ["pull-1", "pull-2", "pull-3", "pull-4"] + [f"g{g}" for g in GATE_IDS])
        self.assertEqual(GATE_IDS, ["70", "73"], "（前提）専用の段は G70 と G73")
        with tempfile.TemporaryDirectory() as t:
            for raw, want in (("", ("1", ["all"])), ("4", ("4", web_run.parts(4, GATE_IDS)))):
                out = pathlib.Path(t) / f"out-{raw or 'none'}"
                code, calls, _ = go(["shards", "--github-output", str(out)], {"WEB_SHARDS_VAR": raw} if raw else {}, ROOT)
                got = dict(ln.split("=", 1) for ln in out.read_text(encoding="utf-8").splitlines())
                self.assertEqual((code, calls, got["web_shards"], json.loads(got["web_parts"])), (0, [], want[0], want[1]), raw)
            out = pathlib.Path(t) / "out-bad"
            code, _, text = go(["shards", "--github-output", str(out)], {"WEB_SHARDS_VAR": "abc"}, ROOT)
            self.assertEqual(code, 1)
            self.assertIn("★", text)
            self.assertFalse(out.exists(), "読めない値では出力を書かない（web の組が黙って 1 組で流れない）")


class OnePart(unittest.TestCase):
    """WEB_SHARDS が無い・1 の回は、今と全く同じ流れ"""

    def test_K1304_CI_002_one_part_runs_exactly_as_before(self) -> None:
        """K1304-CI-002 1 組（all）：G48 は今と同じ 3 つの命令（e2e:k → record → op_gate --all）で、web-part を作らない。G59・G70・G73 も今の命令"""
        for env in ({}, {"WEB_PART": "all", "WEB_SHARDS": "1"}):
            with self.subTest(env), tempfile.TemporaryDirectory() as t:
                code, calls, _ = go(["g48"], {**FULL, **env}, pathlib.Path(t))
                self.assertEqual((code, [c for c, _ in calls]), (0, OLD_G48))
                self.assertEqual(calls[0][1].get("PW_REPORT"), "pw-reports/k.json")
                self.assertNotIn("PLAYWRIGHT_BLOB_OUTPUT_DIR", calls[0][1])
                self.assertFalse((pathlib.Path(t) / "web-part").exists())
                code, calls, _ = go(["g59"], {**FULL, **env}, pathlib.Path(t))
                self.assertEqual((code, [c for c, _ in calls]), (0, [["pnpm", "--filter", "@kaname/web", "exec", "playwright", "test", "tests/skeleton"]]))
                for gid in GATE_IDS:
                    code, calls, _ = go(["gate", gid], {**FULL, **env}, pathlib.Path(t))
                    self.assertEqual(code, 0)
                    self.assertEqual([c[:6] for c, _ in calls], [["pnpm", "--filter", "@kaname/web", "exec", "playwright", "test"]], gid)
                code, calls, text = go(["g48-report"], {**FULL, **env}, pathlib.Path(t))
                self.assertEqual((code, calls), (1, []), "1 組の回に合わせる段は流れない（流れたら赤）")

    def test_K1304_CI_003_one_part_workflow_same_jobs(self) -> None:
        """K1304-CI-003 1 組の回の CI の定義：matrix は ["all"]・組の名前は web・上げるのは ci-results と junit-web だけ・web-report は飛ぶ・
        G48・G59・G70・G73 の段は 1 つずつで if は !cancelled() のまま"""
        web = JOBS["web"]
        parts = web["strategy"]["matrix"]["part"]
        for raw in ("", '["all"]'):
            ctx = web_ctx("all", "1", raw)
            self.assertEqual(ev(parts, ctx), ["all"], raw or "出力が空（static が赤）でも all")
            self.assertEqual(ev(web["name"], ctx), "web", "1 組の回の組の名前は今と同じ web")
            names = upload_names(runs("web", ctx), ctx)
            self.assertEqual(sorted(names), ["ci-results", "junit-web"])
        self.assertEqual(ev(web["env"]["WEB_SHARDS"], web_ctx("all", "")), "1")
        self.assertEqual(ev(web["env"]["WEB_PART"], web_ctx("all", "1")), "all")
        self.assertFalse(ev(JOBS["web-report"]["if"], {**web_ctx("all", "1"), "needs.web.result": "success"}))
        self.assertFalse(ev(JOBS["web-report"]["if"], {**web_ctx("all", ""), "needs.web.result": "failure"}))
        for head in ("G48 ", "G59 ", "G70 ", "G73 "):
            hit = [s for s in web["steps"] if str(s.get("name", "")).startswith(head)]
            self.assertEqual(len(hit), 1, head)
            self.assertEqual(str(hit[0]["if"]), "${{ !cancelled() }}", head)
        self.assertEqual(web["strategy"].get("fail-fast"), False, "1 組が赤でもほかの組を止めない")


def project(d: pathlib.Path) -> None:
    """本物と同じ形の小さな画面の置き場（apps/web・e2e:k・testDir ./tests・describe の中の試験・名前の頭が同じファイル）と、取り台の置き場（素の git）"""
    web = d / "apps/web"
    for rel, n, red in (("k/a1.spec.ts", 1, 0), ("k/a1x.spec.ts", 1, 0), ("k/a2.spec.ts", 2, 0), ("k/a3.spec.ts", 3, 2), ("features/F1/b1.spec.ts", 2, 0),
                        ("skeleton/s1.spec.ts", 2, 0), ("x/out.spec.ts", 1, 0)):
        f = web / "tests" / rel
        f.parent.mkdir(parents=True, exist_ok=True)
        stem = re.sub(r"\W", "", pathlib.Path(rel).stem)
        body = "".join(f'  test("K9-UI-{stem}{j} {rel} {j}", async () => {{ expect({j}).toBe({0 if j == red else j}); }});\n' for j in range(1, n + 1))
        f.write_text('import { test, expect } from "@playwright/test";\n' + (f'test.describe("まとまり {rel}", () => {{\n{body}}});\n' if n % 2 == 0 else body),
                     encoding="utf-8")
    lib = web / "tests/_lib/rows.ts"
    lib.parent.mkdir(parents=True, exist_ok=True)
    lib.write_text('import { test, expect } from "@playwright/test";\nexport function rows(n: string): void {\n'
                   '  test(`K9-UI-lib1 ${n}`, async () => { expect(1).toBe(1); });\n}\n', encoding="utf-8")
    (web / "tests/k/a4.spec.ts").write_text('import { rows } from "../_lib/rows";\nrows("a4");\n', encoding="utf-8")
    (web / "package.json").write_text(json.dumps({"name": "@kaname/web", "scripts": {"e2e:k": "PW_REPORT=pw-reports/k.json playwright test tests/k tests/features"}}),
                                      encoding="utf-8")
    (web / "playwright.config.ts").write_text(
        'import { defineConfig } from "@playwright/test";\n'
        'export default defineConfig({ testDir: "./tests", fullyParallel: false, workers: 1, reporter: [["list"]], projects: [{ name: "chromium" }] });\n',
        encoding="utf-8")
    (web / "node_modules").symlink_to(PW.resolve().parents[2] if PW.name == "cli.js" else ROOT / "apps/web/node_modules")
    git = lambda *a: subprocess.run(["git", *a], cwd=d, check=True, capture_output=True)   # noqa: E731
    subprocess.run(["git", "init", "-q", "--bare", str(d / "origin.git")], check=True)
    git("init", "-q")
    git("add", "-A")
    git("-c", "user.email=t@t", "-c", "user.name=t", "commit", "-qm", "t")
    git("remote", "add", "origin", str(d / "origin.git"))


def pw_cmd() -> list[str]:
    return ["sh", "-c", 'cd apps/web && exec "$0" "$@"', str(PW)]


class Pull(unittest.TestCase):
    """WEB_SHARDS が 2 以上の回：取りに行く台"""

    def test_K1304_CI_004_pull_parts_take_files_one_by_one(self) -> None:
        """K1304-CI-004 本物の Playwright と本物の git：3 台を同時に走らせると、並び（G48 は e2e:k の引数・G59 は tests/skeleton を --list で開いた
        6 ファイル・試験の多い順）のどの番号もちょうど 1 台が取って流し、ファイルの外（x/out・名前の頭が同じ a1x）に当たらない。赤のファイルを流した台は 1・
        ほかは 0。取り台の印は番号の数だけ残り、web-release（web_run.py release）が消す。試験を作る関数が別のファイル（_lib）に在っても、並びは試験のファイルで数える"""
        self.assertTrue(PW.exists(), f"Playwright が入っていない（{PW}。CI の組は pnpm install で入る）")
        with tempfile.TemporaryDirectory() as t, mock.patch.object(web_pull, "PW", pw_cmd()):
            d = pathlib.Path(t)
            project(d)
            self.addCleanup(os.chdir, os.getcwd())
            os.chdir(d)
            env = {k: v for k, v in os.environ.items() if not k.startswith(("PLAYWRIGHT_", "PW_", "CI"))}
            items, h, kinds = web_pull.make_queue(True, [], [], env)
            self.assertEqual([(x["kind"], x["file"]) for x in items],
                             [("g48", "k/a3.spec.ts"), ("g48", "features/F1/b1.spec.ts"), ("g48", "k/a2.spec.ts"), ("g59", "skeleton/s1.spec.ts"),
                              ("g48", "k/a1.spec.ts"), ("g48", "k/a1x.spec.ts"), ("g48", "k/a4.spec.ts")])
            code = (f"import os, sys; sys.path.insert(0, {str(ROOT / 'scripts/ci')!r}); import web_pull; web_pull.PW = {pw_cmd()!r}; "
                    f"items, h, _ = web_pull.make_queue(True, [], [], dict(os.environ)); sys.exit(web_pull.pull(sys.argv[1], items, h, dict(os.environ)))")
            procs = [subprocess.Popen([sys.executable, "-c", code, f"pull-{k}"], cwd=d, env={**env, "GITHUB_RUN_ID": "9"}, stdout=subprocess.PIPE,
                                      stderr=subprocess.STDOUT, text=True) for k in (1, 2, 3)]
            outs = [(p.communicate()[0], p.returncode) for p in procs]
            got = sorted(json.loads(f.read_text(encoding="utf-8"))["i"] for f in (d / "web-part/items").glob("*.json"))
            self.assertEqual(got, list(range(7)), "\n".join(o for o, _ in outs))
            bad, res = web_pull.check_items(items, h)
            self.assertEqual(bad, [])
            self.assertEqual({res[x["i"]]["file"]: res[x["i"]]["rc"] for x in items}["k/a3.spec.ts"], 1)
            red_part = res[0]["part"]
            self.assertEqual({f"pull-{k}": rc for k, (_, rc) in zip((1, 2, 3), outs)}[red_part], 1)
            self.assertEqual(len(list((d / "web-part").glob("blob-g48/*.zip"))), 6)
            self.assertEqual(len(list((d / "web-part").glob("blob-g59/*.zip"))), 1)
            refs = subprocess.run(["git", "ls-remote", "origin", "refs/tf-claim/*"], cwd=d, capture_output=True, text=True).stdout.splitlines()
            self.assertEqual(len(refs), 7)
            self.assertTrue(all(f"refs/tf-claim/9-1-{h}/" in r for r in refs))
            # 合わせる：まとめた試験の集合が並びと同じ・赤の G48 があるので記録と照らしは流さず 1・取り台の印を消す
            (d / "junit").mkdir()
            with mock.patch.dict(os.environ, {**env, "GITHUB_RUN_ID": "9", "CI_FULL": "true", "PLAYWRIGHT_JUNIT_OUTPUT_NAME": str(d / "junit/web.xml")}, clear=True), \
                    mock.patch.object(web_run, "run_all", side_effect=AssertionError("赤の回は記録しない")):
                out = io.StringIO()
                with contextlib.redirect_stdout(out):
                    rc = web_run.report(True, [], {})
            self.assertEqual(rc, 1, out.getvalue())
            self.assertIn("試験が赤のファイル 1 本", out.getvalue())
            self.assertNotIn("流れていない試験", out.getvalue())
            xml = (d / "junit/web.xml").read_text(encoding="utf-8")
            self.assertEqual(len(re.findall("<testcase ", xml)), 10)
            self.assertEqual(len(re.findall("<testcase ", (d / "junit/web-skeleton.xml").read_text(encoding="utf-8"))), 2)
            self.assertNotIn("out.spec", xml)
            self.assertEqual(len(subprocess.run(["git", "ls-remote", "origin", "refs/tf-claim/*"], cwd=d, capture_output=True, text=True).stdout.splitlines()), 7,
                             "g48-report は印を消さない（web-release が並べて消す）")
            with mock.patch.dict(os.environ, {"GITHUB_RUN_ID": "9", "GITHUB_RUN_ATTEMPT": "1"}), contextlib.redirect_stdout(io.StringIO()):
                self.assertEqual(web_run.release(), 0)
            self.assertEqual(subprocess.run(["git", "ls-remote", "origin", "refs/tf-claim/*"], cwd=d, capture_output=True, text=True).stdout, "")

    def test_K1304_CI_005_claim_is_create_only(self) -> None:
        """K1304-CI-005 取り台：同じ番号を 2 回取ろうとすると 2 回目は False（同じ台でも・別の台でも）。番号ごとに別の印。網の誤りは試し直してから RuntimeError"""
        with tempfile.TemporaryDirectory() as t:
            d = pathlib.Path(t)
            subprocess.run(["git", "init", "-q", "--bare", str(d / "o.git")], check=True)
            subprocess.run(["git", "init", "-q", str(d / "w")], check=True)
            (d / "w/a").write_text("a", encoding="utf-8")
            for a in (["add", "a"], ["-c", "user.email=t@t", "-c", "user.name=t", "commit", "-qm", "t"], ["remote", "add", "origin", str(d / "o.git")]):
                subprocess.run(["git", *a], cwd=d / "w", check=True, capture_output=True)
            old = os.getcwd()
            os.chdir(d / "w")
            try:
                ns = "refs/tf-claim/1-1-abc"
                self.assertEqual([web_pull.claim(ns, 0, "pull-1"), web_pull.claim(ns, 0, "pull-2"), web_pull.claim(ns, 0, "pull-1"),
                                  web_pull.claim(ns, 1, "pull-2")], [True, False, False, True])
                self.assertEqual(web_pull.claimed(ns), {0, 1})
                self.assertEqual(web_pull.release("refs/tf-claim/1-1-"), 2)
                self.assertEqual(web_pull.claimed(ns), set())
                subprocess.run(["git", "remote", "set-url", "origin", str(d / "nowhere.git")], check=True)
                with mock.patch.object(web_pull.time, "sleep"), self.assertRaises(RuntimeError):
                    web_pull.claim(ns, 2, "pull-1")
            finally:
                os.chdir(old)

    def test_K1304_CI_006_unknown_part_is_red(self) -> None:
        """K1304-CI-006 組の一覧に無い WEB_PART（台の数の外の pull-5・gates・g48-1・pull-x）や読めない WEB_SHARDS は、命令 0 で赤"""
        with tempfile.TemporaryDirectory() as t:
            for env in ({"WEB_PART": "pull-5", "WEB_SHARDS": "4"}, {"WEB_PART": "gates", "WEB_SHARDS": "4"}, {"WEB_PART": "g48-1", "WEB_SHARDS": "4"},
                        {"WEB_PART": "pull-x", "WEB_SHARDS": "4"}, {"WEB_PART": "pull-1", "WEB_SHARDS": "1"}, {"WEB_PART": "all", "WEB_SHARDS": "abc"}):
                for argv in (["g48"], ["g59"], ["gate", "70"]):
                    with self.subTest(env=env, argv=argv):
                        code, calls, text = go(argv, {**FULL, **env}, pathlib.Path(t))
                        self.assertEqual((code, calls), (1, []))
                        self.assertIn("★", text)

    def test_K1304_CI_007_pull_part_runs_only_pull(self) -> None:
        """K1304-CI-007 pull-<i> の組：G59 と専用の段は命令 0 で 0（G59 は G48 の段が並びに入れて取りに行く）。g70・g73 の組は自分の段だけを今の命令で流す。
        範囲の回で G48・G59 の両方が選ばれず専用の段だけなら、pull の組は命令 0 で 0・印 none。どの段も空なら赤"""
        with tempfile.TemporaryDirectory() as t:
            d = pathlib.Path(t)
            for argv in (["g59"], *[["gate", g] for g in GATE_IDS]):
                code, calls, text = go(argv, {**FULL, "WEB_PART": "pull-2", "WEB_SHARDS": "4"}, d)
                self.assertEqual((code, calls), (0, []), argv)
            gates = {g: (["apps/web/tests/x.spec.ts"] if g == GATE_IDS[0] else []) for g in GATE_IDS}
            env = {**FULL, "CI_FULL": "false", "CI_WEB_GATES": json.dumps(gates), "WEB_PART": "pull-1", "WEB_SHARDS": "4"}
            code, calls, _ = go(["g48"], env, d)
            self.assertEqual((code, calls, (d / "web-part/pull-1.rc").read_text(encoding="utf-8").strip()), (0, [], "none"))
            code, calls, text = go(["g48"], {**env, "CI_WEB_GATES": "{}"}, d)
            self.assertEqual((code, calls), (1, []))
            self.assertIn("★", text)
        for part in [f"g{g}" for g in GATE_IDS]:
            with self.subTest(part), tempfile.TemporaryDirectory() as t:
                d = pathlib.Path(t)
                ran = {}
                for argv in (["g48"], ["g59"], *[["gate", g] for g in GATE_IDS]):
                    code, calls, _ = go(argv, {**FULL, "WEB_PART": part, "WEB_SHARDS": "4"}, d)
                    self.assertEqual(code, 0, argv)
                    ran["g" + argv[-1].lstrip("g")] = [c for c, _ in calls]
                self.assertEqual([k for k, v in ran.items() if v], [part])
                self.assertEqual((d / "web-part" / f"{part}.rc").read_text(encoding="utf-8").strip(), "0")


def put_items(d: pathlib.Path, items: list[dict], h: str, drop: tuple = (), twice: tuple = (), other_hash: tuple = ()) -> None:
    (d / "web-part/items").mkdir(parents=True, exist_ok=True)
    for it in items:
        if it["i"] in drop:
            continue
        for k in range(2 if it["i"] in twice else 1):
            r = {**it, "rc": 0, "part": f"pull-{k + 1}", "hash": "zzz" if it["i"] in other_hash else h, "blob": True}
            (d / "web-part/items" / f"{it['i']}-pull-{k + 1}.json").write_text(json.dumps(r), encoding="utf-8")


class Report(unittest.TestCase):
    def test_K1304_CI_008_report_red_when_missing_twice_or_other_queue(self) -> None:
        """K1304-CI-008 並びのどれかの番号の結果が無い（落ちた）・2 つある（二重）・並びの印が違う・並びに無い番号がある → ★ で赤・まとめも記録も作らない。
        そろえば問題 0"""
        items, h = web_pull.build_queue({"g48": [("k/a.spec.ts", "t1"), ("k/a.spec.ts", "t2"), ("k/b.spec.ts", "t")], "g59": [("skeleton/s.spec.ts", "t")]})
        self.assertEqual([x["file"] for x in items], ["k/a.spec.ts", "k/b.spec.ts", "skeleton/s.spec.ts"])
        for kw, want in (({}, 0), ({"drop": (1,)}, 1), ({"twice": (0,)}, 1), ({"other_hash": (2,)}, 1)):
            with self.subTest(kw), tempfile.TemporaryDirectory() as t:
                d = pathlib.Path(t)
                put_items(d, items, h, **kw)
                old = os.getcwd()
                os.chdir(d)
                try:
                    bad, _ = web_pull.check_items(items, h)
                finally:
                    os.chdir(old)
                self.assertEqual(len(bad), want, bad)
        with tempfile.TemporaryDirectory() as t:
            d = pathlib.Path(t)
            put_items(d, items + [{"i": 9, "kind": "g48", "file": "k/z.spec.ts", "tests": 1}], h)
            old = os.getcwd()
            os.chdir(d)
            try:
                self.assertEqual(len(web_pull.check_items(items, h)[0]), 1)
            finally:
                os.chdir(old)
        self.assertNotEqual(web_pull.build_queue({"g48": [("k/a.spec.ts", "t1")]})[1], h, "並びが違えば印が違う")
        two = web_pull.report_tests(json.load(open(_json([("a", "1"), ("a", "2")]), encoding="utf-8")))
        self.assertEqual(web_pull.same_tests(two, _json([("a", "1"), ("a", "2")])), [])
        self.assertEqual(len(web_pull.same_tests(two, _json([("a", "1")]))), 1, "流れていない試験")
        self.assertEqual(len(web_pull.same_tests(two, _json([("a", "1"), ("a", "2"), ("a", "2")]))), 1, "二重の試験")

    def test_K1304_CI_009_file_filter_hits_only_that_file(self) -> None:
        """K1304-CI-009 1 本のファイルだけに当たる引数：/…/ の正規表現で tests/ からの道を末尾まで（名前の頭が同じ・記号の入った道に当たらない）"""
        rx = web_pull.file_filter("k/a1.spec.ts")
        self.assertTrue(rx.startswith("/") and rx.endswith("$/"))
        body = re.compile(rx[1:-1])
        self.assertTrue(body.search("/w/apps/web/tests/k/a1.spec.ts"))
        for other in ("/w/apps/web/tests/k/a1x.spec.ts", "/w/apps/web/tests/k/a1.spec.tsx", "/w/apps/web/tests/xk/a1.spec.ts", "/w/apps/web/tests/k/a1Xspec.ts"):
            self.assertFalse(body.search(other), other)
        self.assertEqual(web_pull.e2e_k_args.__name__, "e2e_k_args")
        old = os.getcwd()
        os.chdir(ROOT)
        try:
            self.assertEqual(web_pull.e2e_k_args(), ["tests/components.spec.ts", "tests/k-shell.spec.ts", "tests/states.spec.ts", "tests/k", "tests/features"])
        finally:
            os.chdir(old)


def _json(rows: list[tuple[str, str]]) -> str:
    f = tempfile.NamedTemporaryFile("w", suffix=".json", delete=False, encoding="utf-8")
    json.dump({"suites": [{"file": a, "title": a, "specs": [{"title": b, "file": a, "tests": [{"projectName": ""}]}]} for a, b in rows]}, f)
    f.close()
    return f.name


class ManyWorkflow(unittest.TestCase):
    def test_K1304_CI_010_many_parts_workflow(self) -> None:
        """K1304-CI-010 4 台の回の CI の定義：web は pull-1〜4・g70・g73 の 6 組（名前は web (<組>)）。どの組も ci-results・junit-* を上げず、
        web-part-<組> を 1 つずつ（名前が重ならない・web-part/ と junit/ の 2 つ・中の道は作業場所からの道）。web-report は web が赤でも走り、web が飛ばされたら飛び、
        web-part-* を作業場所の根（path が . か無い）に取る"""
        web = JOBS["web"]
        raw = json.dumps(web_run.parts(4, GATE_IDS))
        parts = ev(web["strategy"]["matrix"]["part"], web_ctx("all", "4", raw))
        self.assertEqual(parts, ["pull-1", "pull-2", "pull-3", "pull-4", "g70", "g73"])
        seen: list[str] = []
        for p in parts:
            ctx = web_ctx(p, "4", raw)
            self.assertEqual(ev(web["name"], ctx), f"web ({p})")
            names = upload_names(runs("web", ctx), ctx)
            self.assertEqual(names, [f"web-part-{p}"], p)
            seen += names
        self.assertEqual(len(seen), len(set(seen)), "組の artifact の名前が重ならない")
        up = [s for s in web["steps"] if "web-part-" in str((s.get("with") or {}).get("name", ""))][0]
        self.assertEqual(sorted(str(up["with"]["path"]).split()), ["junit/", "web-part/"])
        self.assertEqual(up["with"].get("if-no-files-found"), "error")
        self.assertTrue(ev(up["if"], {**web_ctx("pull-1", "4"), "@failed": True}), "赤の組でも上げる")
        rep = JOBS["web-report"]
        self.assertEqual(rep.get("needs"), ["static", "web"])
        for result, want in (("success", True), ("failure", True), ("skipped", False)):
            self.assertEqual(ev(rep["if"], {**web_ctx("all", "4"), "needs.web.result": result}), want, result)
        self.assertNotIn("inputs.web", str(rep), "inputs.web を読むのは web の組だけ（K-258）")
        self.assertEqual(rep["runs-on"], web["runs-on"])
        dl = [s for s in rep["steps"] if str(s.get("uses", "")).startswith("actions/download-artifact@")]
        self.assertEqual([(s["with"]["pattern"], s["with"].get("merge-multiple")) for s in dl], [("web-part-*", True)])
        self.assertIn(dl[0]["with"].get("path", "."), (".", "./"), "作業場所の根に取る（junit/web-skeleton.xml などが junit/ に入る）")
        run = [s for s in rep["steps"] if "web_run.py g48-report" in str(s.get("run", ""))]
        self.assertEqual(len(run), 1)
        self.assertEqual(set(run[0]["env"]), {"CI_FULL", "CI_WEB_SPECS", "CI_WEB_OTHER", "CI_WEB_TASKS", "CI_WEB_GATES"})
        self.assertEqual(str(rep["env"]["PLAYWRIGHT_JUNIT_OUTPUT_NAME"]), "${{ github.workspace }}/junit/web.xml")
        ctx = {**web_ctx("", "4"), "needs.web.result": "failure", "@failed": True}
        self.assertEqual(sorted(upload_names(runs("web-report", ctx), ctx)), ["ci-results", "junit-web"], "赤の回も上げる（今の web の組と同じ）")
        ju = [s for s in rep["steps"] if (s.get("with") or {}).get("name") == "junit-web"]
        self.assertEqual((len(ju), str(ju[0]["if"]), ju[0]["with"]["path"], ju[0]["with"]["if-no-files-found"]), (1, "always()", "junit/", "error"))
        junit = JOBS["junit"]
        self.assertTrue({"web", "web-report"} <= set(junit["needs"]))
        self.assertEqual(str(junit["if"]), "always()")

    def test_K1304_CI_011_static_outputs_and_browser_cache(self) -> None:
        """K1304-CI-011 static の組が変数を env で受けて web_shards・web_parts を出す（命令の文字に変数を入れない）。ブラウザの取り込みの使い回しは
        GitHub の台だけで、playwright install の前に在り、install の命令は変えない"""
        st = JOBS["static"]
        sh = [s for s in st["steps"] if s.get("id") == "shards"]
        self.assertEqual(len(sh), 1)
        self.assertEqual(sh[0]["env"], {"WEB_SHARDS_VAR": "${{ vars.WEB_SHARDS }}"})
        self.assertEqual(sh[0]["run"], 'python3 scripts/ci/web_run.py shards --github-output "$GITHUB_OUTPUT"')
        self.assertNotIn("vars.", sh[0]["run"])
        self.assertNotIn("if", sh[0], "毎回流す（変数が無い回も 1 を出す）")
        self.assertEqual((st["outputs"]["web_shards"], st["outputs"]["web_parts"]),
                         ("${{ steps.shards.outputs.web_shards }}", "${{ steps.shards.outputs.web_parts }}"))
        steps = JOBS["web"]["steps"]
        cache = [i for i, s in enumerate(steps) if str(s.get("uses", "")).startswith("actions/cache@")]
        pw = [i for i, s in enumerate(steps) if "playwright install" in str(s.get("run", ""))]
        self.assertEqual((len(cache), len(pw)), (1, 1))
        self.assertLess(cache[0], pw[0])
        c = steps[cache[0]]
        self.assertEqual(c["with"]["path"], "~/.cache/ms-playwright")
        self.assertTrue(ev(c["if"], web_ctx("all", "1", hosted=True)))
        self.assertFalse(ev(c["if"], web_ctx("all", "1", hosted=False)), "自分の台は像に残るので GitHub の cache に上げ下ろししない（K-172）")
        self.assertEqual(str(steps[pw[0]]["run"]).split("#")[0].strip(), "pnpm --filter @kaname/web exec playwright install --with-deps chromium")

    def test_K1304_CI_012_entrance(self) -> None:
        """K1304-CI-012 CI へのつなぎ：g65.d/K-1304.txt がこの試験の命令 1 行で、CI の定義に在る。作り手が同じ形を作る。web-part/ は版に入れない"""
        cmd = "python3 scripts/ci/k1304_web_shards_test.py"
        self.assertEqual((ROOT / "scripts/ci/g65.d/K-1304.txt").read_text(encoding="utf-8").strip(), cmd)
        self.assertIn(cmd, WF_TEXT)
        for piece in ("web_run.py shards", "web-report:", "web_run.py g48-report", "web-part-${{ matrix.part }}", "fail-fast: false"):
            self.assertIn(piece, BUILDER, piece)
        self.assertIn("web-part/", (ROOT / ".gitignore").read_text(encoding="utf-8").splitlines())


    def test_K1304_CI_013_build_once_and_action_timeout(self) -> None:
        """K1304-CI-013 画面の組み立ては web-build の組で 1 回だけ：static を待たず（needs 無し）・web=defer で飛ぶ・.next-prod（cache を除く・. で始まる物も）を上げる。
        web の組は web-build を待ち、緑のときだけ走り、組み立て直さず（build:test が無い）取って立ち上げる。取り台の印を作る web と消す web-report だけが
        contents: write。押す・入れるの待ちの上限は CI だけ 15 秒（expect と同じ）で、設定の既定は 0（今と同じ）"""
        b = JOBS["web-build"]
        self.assertNotIn("needs", b)
        self.assertFalse(ev(b["if"], {"inputs.web": "defer"}))
        self.assertTrue(ev(b["if"], {"inputs.web": "run"}))
        runs_ = [str(s.get("run", "")) for s in b["steps"]]
        self.assertEqual(sum("build:test" in r for r in runs_), 1)
        self.assertTrue(any("build:test && rm -rf apps/web/.next-prod/cache" in r for r in runs_), "組み立ての cache は上げない")
        up = [s for s in b["steps"] if str(s.get("uses", "")).startswith("actions/upload-artifact@")][0]["with"]
        self.assertEqual((up["name"], up["include-hidden-files"], sorted(up["path"].split())), ("web-build", True, ["apps/web/.next-prod/"]))
        web = JOBS["web"]
        self.assertEqual(web["needs"], ["static", "web-build"])
        self.assertIn("needs.web-build.result == 'success'", web["if"])
        self.assertFalse([s for s in web["steps"] if "build:test" in str(s.get("run", ""))], "web の組は組み立て直さない")
        steps = web["steps"]
        dl = [i for i, s in enumerate(steps) if (s.get("with") or {}).get("name") == "web-build"]
        start = [i for i, s in enumerate(steps) if "start:test" in str(s.get("run", ""))]
        self.assertEqual(len(dl), 1)
        self.assertLess(dl[0], start[0])
        self.assertEqual(steps[dl[0]]["with"]["path"], "apps/web/.next-prod")
        for k, v in b["env"].items():
            self.assertEqual(web["env"].get(k), v, f"組み立てと web の env が同じ（{k}）")
        self.assertEqual(web["env"]["PW_ACTION_TIMEOUT"], "15000")
        self.assertEqual(web["permissions"], {"contents": "write"})
        self.assertEqual([j for j, v in JOBS.items() if "permissions" in v and "contents" in v["permissions"] and v["permissions"]["contents"] == "write"],
                         ["web", "web-release", "auto-merge"])
        rel = JOBS["web-release"]
        self.assertEqual(rel["needs"], ["static", "web"])
        # Python の部品は台に置いた venv（K172-CI-003）で流す
        self.assertEqual([s.get("run") for s in rel["steps"] if "run" in s], ["bash scripts/ci/ci_venv.sh", "python3 scripts/ci/web_run.py release"])
        for result, n, want in (("failure", "4", True), ("success", "4", True), ("skipped", "4", False), ("success", "1", False), ("success", "", False)):
            self.assertEqual(ev(rel["if"], {**web_ctx("all", n), "needs.web.result": result}), want, (result, n))
        self.assertNotIn("web-release", JOBS["junit"]["needs"], "印を消すのを待たない")
        cfg = (ROOT / "apps/web/playwright.config.ts").read_text(encoding="utf-8")
        self.assertIn('actionTimeout: Number(process.env["PW_ACTION_TIMEOUT"] ?? 0)', cfg)
        self.assertIn("timeout: 60_000", cfg)
        self.assertIn("expect: { timeout: 15_000 }", cfg)
        self.assertNotIn("navigationTimeout:", cfg, "画面の移りの待ちは変えない")


if __name__ == "__main__":
    unittest.main(verbosity=2)
