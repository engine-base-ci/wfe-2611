#!/usr/bin/env python3
"""K-1304：画面の試験の組（web）を、置き場の変数 WEB_SHARDS の数に分けて同時に流す（試験は 1 本も減らさない・照らしは今と同じ 1 回）。

変数が無い（か 1）の回は、web の組は今と全く同じ 1 組（matrix の all）。2 以上なら G48 を N 組・G59 と専用の段を 1 組ずつにし、
web-report の組が G48 の blob を merge-reports で 1 つにまとめ、今と同じ ci_results.py record と op_gate.py を 1 回流す。
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
import web_run  # noqa: E402

WF_TEXT = (ROOT / ".github/workflows/v3-gate.yml").read_text(encoding="utf-8")
WF = yaml.safe_load(WF_TEXT)
JOBS = WF["jobs"]
BUILDER = (ROOT / "05_flow/build_testplan.py").read_text(encoding="utf-8")
GATE_IDS = sorted(json.loads((ROOT / "scripts/ci/ci_scope.json").read_text(encoding="utf-8"))["web_select"]["gates"], key=int)
PW = ROOT / "apps/web/node_modules/.bin/playwright"
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
        self.assertEqual(web_run.parts(4, GATE_IDS), ["g48-1", "g48-2", "g48-3", "g48-4", "g59"] + [f"g{g}" for g in GATE_IDS])
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


class ManyParts(unittest.TestCase):
    """WEB_SHARDS が 2 以上の回"""

    def test_K1304_CI_004_g48_shard_runs_only_its_slice(self) -> None:
        """K1304-CI-004 g48-<i> の組：G48 は e2e:k に --shard=<i>/<N>・blob だけを出す命令 1 つ（record・op_gate は流さない）。終わりの番号を web-part/g48-<i>.rc に残し、
        赤ならその番号で終わる。G59・専用の段はこの組では命令 0 で 0"""
        for rc in (0, 1):
            with self.subTest(rc), tempfile.TemporaryDirectory() as t:
                d = pathlib.Path(t)
                code, calls, _ = go(["g48"], {**FULL, "WEB_PART": "g48-2", "WEB_SHARDS": "4"}, d, rc=rc)
                self.assertEqual(code, rc)
                self.assertEqual([c for c, _ in calls], [OLD_G48[0] + ["--shard=2/4", "--reporter=list,blob", "--pass-with-no-tests"]])
                self.assertEqual(calls[0][1]["PLAYWRIGHT_BLOB_OUTPUT_DIR"], str(d.resolve() / "web-part" / "blob"))
                self.assertEqual((d / "web-part" / "g48-2.rc").read_text(encoding="utf-8").strip(), str(rc))
                for argv in (["g59"], *[["gate", g] for g in GATE_IDS]):
                    code, calls, text = go(argv, {**FULL, "WEB_PART": "g48-2", "WEB_SHARDS": "4"}, d)
                    self.assertEqual((code, calls), (0, []), argv)
                    self.assertIn("この組", text)
        with tempfile.TemporaryDirectory() as t:   # 範囲の回（選んだ試験だけ）も同じ形で分ける
            code, calls, _ = go(["g48"], {**FULL, "CI_FULL": "false", "CI_WEB_SPECS": '["apps/web/tests/k/a.spec.ts"]', "WEB_PART": "g48-1", "WEB_SHARDS": "3"}, pathlib.Path(t))
            self.assertEqual([c for c, _ in calls], [["pnpm", "--filter", "@kaname/web", "exec", "playwright", "test", "tests/k/a.spec.ts",
                                                      "--shard=1/3", "--reporter=list,blob", "--pass-with-no-tests"]])

    def test_K1304_CI_005_other_parts_run_their_own_step_only(self) -> None:
        """K1304-CI-005 g59 の組は G59 だけ・g70 は G70 だけ・g73 は G73 だけを今の命令で流し、G48 は命令 0。web-part の rc は書かない"""
        for part in ["g59"] + [f"g{g}" for g in GATE_IDS]:
            with self.subTest(part), tempfile.TemporaryDirectory() as t:
                d = pathlib.Path(t)
                env = {**FULL, "WEB_PART": part, "WEB_SHARDS": "4"}
                ran = {}
                for argv in (["g48"], ["g59"], *[["gate", g] for g in GATE_IDS]):
                    code, calls, _ = go(argv, env, d)
                    self.assertEqual(code, 0, argv)
                    ran["g" + argv[-1].lstrip("g")] = [c for c, _ in calls]
                self.assertEqual([k for k, v in ran.items() if v], [part])
                self.assertEqual(ran[part][0][:6], ["pnpm", "--filter", "@kaname/web", "exec", "playwright", "test"])
                self.assertNotIn("--shard", " ".join(ran[part][0]))
                self.assertFalse((d / "web-part").exists())

    def test_K1304_CI_006_unknown_part_is_red(self) -> None:
        """K1304-CI-006 組の一覧に無い WEB_PART（分ける数の外の g48-5・gates・g48-x）や読めない WEB_SHARDS は、命令 0 で赤（黙って何も流さずに緑にしない）"""
        with tempfile.TemporaryDirectory() as t:
            for env in ({"WEB_PART": "g48-5", "WEB_SHARDS": "4"}, {"WEB_PART": "gates", "WEB_SHARDS": "4"}, {"WEB_PART": "g48-x", "WEB_SHARDS": "4"},
                        {"WEB_PART": "g48-1", "WEB_SHARDS": "1"}, {"WEB_PART": "all", "WEB_SHARDS": "abc"}):
                for argv in (["g48"], ["g59"], ["gate", "70"]):
                    with self.subTest(env=env, argv=argv):
                        code, calls, text = go(argv, {**FULL, **env}, pathlib.Path(t))
                        self.assertEqual((code, calls), (1, []))
                        self.assertIn("★", text)


def put_results(d: pathlib.Path, n: int, rcs: dict[int, int], zips: list[int]) -> None:
    (d / "web-part" / "blob").mkdir(parents=True, exist_ok=True)
    for i in zips:
        (d / "web-part" / "blob" / f"report-{i}.zip").write_bytes(b"PK")
    for i, rc in rcs.items():
        (d / "web-part" / f"g48-{i}.rc").write_text(f"{rc}\n", encoding="utf-8")


class Report(unittest.TestCase):
    def report(self, d: pathlib.Path, env: dict | None = None) -> tuple[int, list[list[str]], list[dict], str]:
        code, calls, text = go(["g48-report"], {**FULL, "WEB_SHARDS": "3", "PLAYWRIGHT_JUNIT_OUTPUT_NAME": "/w/junit/web.xml", **(env or {})}, d)
        return code, [c for c, _ in calls], [e for _, e in calls], text

    def test_K1304_CI_007_report_merges_then_records_once(self) -> None:
        """K1304-CI-007 3 組とも blob と番号 0 がそろう：merge-reports（json と junit）→ 今と同じ record → 今と同じ op_gate --all の 3 つ。
        まとめた JSON は apps/web/pw-reports/k.json（record と op_gate が読む置き場）、JUnit は junit/web.xml"""
        with tempfile.TemporaryDirectory() as t:
            d = pathlib.Path(t)
            put_results(d, 3, {1: 0, 2: 0, 3: 0}, [1, 2, 3])
            code, cmds, envs, _ = self.report(d)
            self.assertEqual(code, 0)
            self.assertEqual(cmds[0], ["pnpm", "--filter", "@kaname/web", "exec", "playwright", "merge-reports", "--reporter=json,junit",
                                       str(d.resolve() / "web-part" / "blob")])
            self.assertEqual(cmds[1:], OLD_G48[1:])
            self.assertEqual(envs[0]["PLAYWRIGHT_JSON_OUTPUT_NAME"], str(d.resolve() / "apps/web/pw-reports/k.json"))
            self.assertEqual(envs[0]["PLAYWRIGHT_JUNIT_OUTPUT_NAME"], "/w/junit/web.xml")
        with tempfile.TemporaryDirectory() as t:   # 範囲の回は、選んだ試験の行だけを照らす（今と同じ --rows-in）
            d = pathlib.Path(t)
            put_results(d, 3, {1: 0, 2: 0, 3: 0}, [1, 2, 3])
            code, cmds, _, _ = self.report(d, {"CI_FULL": "false", "CI_WEB_SPECS": '["apps/web/tests/k/a.spec.ts"]'})
            self.assertEqual((code, cmds[2][-3:]), (0, ["--rows-in", "apps/web/tests/k/a.spec.ts", "--pending-from-report"]))

    def test_K1304_CI_008_report_red_when_part_missing_or_red(self) -> None:
        """K1304-CI-008 そろわない・赤：blob か番号が 3 つのうち 2 つ → ★ で赤・まとめも record も op_gate も流さない（今の 1 組が途中で落ちた回と同じく web.xml を作らない）。
        番号 1 の組がある → まとめ（JUnit）は流して、
        record と op_gate は流さず赤。番号が数でない → 赤の組として数える。範囲の回で G48 に流す物が無く、ほかの段に在れば命令 0 で 0"""
        cases = [({1: 0, 2: 0}, [1, 2, 3], 1, 0), ({1: 0, 2: 0, 3: 0}, [1, 3], 1, 0), ({1: 0, 2: 1, 3: 0}, [1, 2, 3], 1, 1)]
        for rcs, zips, want, merges in cases:
            with self.subTest(rcs=rcs, zips=zips), tempfile.TemporaryDirectory() as t:
                d = pathlib.Path(t)
                put_results(d, 3, rcs, zips)
                code, cmds, _, text = self.report(d)
                self.assertEqual(code, want)
                self.assertIn("★", text)
                self.assertEqual(sum("merge-reports" in c for c in cmds), merges)
                self.assertFalse([c for c in cmds if "ci_results.py" in " ".join(c) or "op_gate.py" in " ".join(c)], "赤の回は記録も照らしもしない（今の 1 組と同じ）")
        with tempfile.TemporaryDirectory() as t:
            d = pathlib.Path(t)
            put_results(d, 3, {1: 0, 2: 0, 3: 0}, [1, 2, 3])
            (d / "web-part" / "g48-3.rc").write_text("oops\n", encoding="utf-8")
            code, cmds, _, _ = self.report(d)
            self.assertEqual((code, sum("op_gate.py" in " ".join(c) for c in cmds)), (1, 0))
        with tempfile.TemporaryDirectory() as t:
            code, cmds, _, _ = self.report(pathlib.Path(t), {"CI_FULL": "false", "CI_WEB_SPECS": "[]", "CI_WEB_OTHER": '["apps/web/tests/skeleton/m1.spec.ts"]'})
            self.assertEqual((code, cmds), (0, []))
            code, cmds, _, text = self.report(pathlib.Path(t), {"CI_FULL": "false", "CI_WEB_SPECS": "[]"})
            self.assertEqual((code, cmds), (1, []))
            self.assertIn("★", text)

    def test_K1304_CI_009_merged_report_has_same_rows_as_one_part(self) -> None:
        """K1304-CI-009 本物の Playwright：同じ試験を 1 組で流した報告と、--shard で 3 組に分けて blob を merge-reports でまとめた報告で、
        JUnit の testcase（名前とファイル）の並びと数、JSON の行（ファイル・題・結果）の並びが 1 つも違わない"""
        self.assertTrue(PW.exists(), f"Playwright が入っていない（{PW}。CI の組は pnpm install で入る）")
        with tempfile.TemporaryDirectory() as t:
            d = pathlib.Path(t)
            (d / "node_modules").symlink_to(ROOT / "apps/web/node_modules")
            (d / "t").mkdir()
            (d / "playwright.config.ts").write_text(
                'import { defineConfig } from "@playwright/test";\n'
                'export default defineConfig({ testDir: "./t", fullyParallel: false, workers: 1,\n'
                '  reporter: [["list"], ["json", { outputFile: process.env["PW_REPORT"] ?? "r.json" }], ["junit", { outputFile: process.env["PW_JUNIT"] ?? "r.xml" }]] });\n',
                encoding="utf-8")
            for i in range(1, 6):
                (d / "t" / f"a{i}.spec.ts").write_text(
                    'import { test, expect } from "@playwright/test";\n'
                    + "".join(f'test("K9-UI-{i}{j:02d} 行 {i}-{j}", async () => {{ expect({j}).toBe({j}); }});\n' for j in range(1, i + 1)),
                    encoding="utf-8")
            base = {k: v for k, v in os.environ.items() if not k.startswith(("PLAYWRIGHT_", "PW_", "CI"))}
            one = subprocess.run([str(PW), "test"], cwd=d, env={**base, "PW_REPORT": "one.json", "PW_JUNIT": str(d / "one.xml")}, capture_output=True, text=True)
            self.assertEqual(one.returncode, 0, one.stdout + one.stderr)
            blobs = d / "all"
            blobs.mkdir()
            for i in range(1, 4):
                part = d / f"b{i}"
                r = subprocess.run([str(PW), "test", *web_run.shard_args(f"g48-{i}", 3)], cwd=d,
                                   env={**base, "PLAYWRIGHT_BLOB_OUTPUT_DIR": str(part)}, capture_output=True, text=True)
                self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
                for z in part.glob("*.zip"):
                    shutil.copy(z, blobs / z.name)
            self.assertEqual(len(list(blobs.glob("*.zip"))), 3, "組ごとに 1 つの blob（名前が重ならない）")
            m = subprocess.run([str(PW), "merge-reports", "--reporter=json,junit", str(blobs)], cwd=d,
                               env={**base, "PLAYWRIGHT_JSON_OUTPUT_NAME": str(d / "m.json"), "PLAYWRIGHT_JUNIT_OUTPUT_NAME": str(d / "m.xml")},
                               capture_output=True, text=True)
            self.assertEqual(m.returncode, 0, m.stdout + m.stderr)

            def cases(f: pathlib.Path) -> list[tuple[str, str]]:
                return sorted(re.findall(r'<testcase name="([^"]*)" classname="([^"]*)"', f.read_text(encoding="utf-8")))

            def rows(f: pathlib.Path) -> list[tuple]:
                out: list[tuple] = []

                def walk(s: dict) -> None:
                    for sp in s.get("specs", []):
                        out.append((sp["file"], sp["title"], tuple(r["status"] for t in sp["tests"] for r in t["results"])))
                    for c in s.get("suites", []):
                        walk(c)
                for s in json.loads(f.read_text(encoding="utf-8"))["suites"]:
                    walk(s)
                return sorted(out)
            self.assertEqual(len(cases(d / "one.xml")), 15)
            self.assertEqual(cases(d / "m.xml"), cases(d / "one.xml"))
            self.assertEqual(rows(d / "m.json"), rows(d / "one.json"))


class ManyWorkflow(unittest.TestCase):
    def test_K1304_CI_010_many_parts_workflow(self) -> None:
        """K1304-CI-010 4 組の回の CI の定義：web は g48-1〜4・g59・g70・g73 の 7 組（名前は web (<組>)）。どの組も ci-results・junit-* を上げず、
        web-part-<組> を 1 つずつ（名前が重ならない・web-part/ と junit/）。web-report は web が赤でも走り、web が飛ばされたら飛ぶ"""
        web = JOBS["web"]
        raw = json.dumps(web_run.parts(4, GATE_IDS))
        parts = ev(web["strategy"]["matrix"]["part"], web_ctx("all", "4", raw))
        self.assertEqual(parts, ["g48-1", "g48-2", "g48-3", "g48-4", "g59", "g70", "g73"])
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
        self.assertTrue(ev(up["if"], {**web_ctx("g59", "4"), "@failed": True}), "赤の組でも上げる")
        rep = JOBS["web-report"]
        self.assertEqual(rep.get("needs"), ["static", "web"])
        for result, want in (("success", True), ("failure", True), ("skipped", False)):
            self.assertEqual(ev(rep["if"], {**web_ctx("all", "4"), "needs.web.result": result}), want, result)
        self.assertNotIn("inputs.web", str(rep), "inputs.web を読むのは web の組だけ（K-258）")
        self.assertEqual(rep["runs-on"], web["runs-on"])
        dl = [s for s in rep["steps"] if str(s.get("uses", "")).startswith("actions/download-artifact@")]
        self.assertEqual([(s["with"]["pattern"], s["with"].get("merge-multiple")) for s in dl], [("web-part-*", True)])
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


if __name__ == "__main__":
    unittest.main(verbosity=2)
