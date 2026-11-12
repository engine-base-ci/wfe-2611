#!/usr/bin/env python3
"""K-177 の試験：web の組の実ブラウザの試験も、チケットの範囲だけを流す。

  python3 scripts/ci/k177_web_scope_test.py

行 ID は K177-WS-NNN（11_tickets/K-177.md の表と 1 対 1）。
"""
from __future__ import annotations

import json
import pathlib
import shutil
import subprocess
import sys
import tempfile
import unittest

import yaml

HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parent.parent
sys.path.insert(0, str(HERE))
import ci_scope  # noqa: E402
import web_run  # noqa: E402
import web_select  # noqa: E402

G48 = ["apps/web/tests/components.spec.ts", "apps/web/tests/features/F1/sign-up.spec.ts",
       "apps/web/tests/features/F3/connect-pc.spec.ts", "apps/web/tests/k/showcase.spec.ts"]
G59 = ["apps/web/tests/skeleton/m1.spec.ts", "apps/web/tests/skeleton/m2.spec.ts"]
TICKETS = {
    "K-24": {"tests": ["apps/web/tests/components.spec.ts"], "changes": ["apps/web/components/k/Button.tsx"], "depends_on": []},
    "K-51": {"tests": ["apps/web/tests/features/F1/sign-up.spec.ts"], "changes": ["apps/web/app/signup/page.tsx", "packages/db/src/index.ts"], "depends_on": []},
    "K-57": {"tests": ["apps/web/tests/features/F3/connect-pc.spec.ts"], "changes": ["apps/api/src/bridge/*.ts", "packages/db/src/index.ts"], "depends_on": ["K-51"]},
    "K-58": {"tests": ["apps/web/tests/skeleton/m2.spec.ts"], "changes": [], "depends_on": ["K-57"]},
    "K-54": {"tests": ["apps/web/tests/skeleton/m1.spec.ts"], "changes": [], "depends_on": []},
    "K-36": {"tests": ["apps/web/tests/k/showcase.spec.ts"], "changes": [], "depends_on": []},
    "K-90": {"tests": ["packages/db/test/x.test.ts"], "changes": [], "depends_on": ["K-57"]},
    "K-91": {"tests": ["apps/web/tests/screens/old.spec.ts"], "changes": ["apps/web/app/old/page.tsx"], "depends_on": []},
}
IMP = {"apps/web/tests/_lib/api.ts": {"apps/web/tests/features/F1/sign-up.spec.ts", "apps/web/tests/skeleton/m1.spec.ts"},
       "apps/web/tests/_lib/row.ts": {"apps/web/tests/components.spec.ts", "apps/web/tests/features/F1/sign-up.spec.ts",
                                      "apps/web/tests/skeleton/m1.spec.ts"}}
CFG = {"registry": ["packages/db/src/index.ts", "11_tickets/**"], "all_on": ["apps/web/playwright.config.ts", "apps/web/package.json", "pnpm-lock.yaml"],
       "web_own": ["apps/web/app/**"], "web_tests": ["apps/web/tests/**"]}


def sel(changed, ticket="K-99", tickets=None):
    t = dict(TICKETS if tickets is None else tickets)
    t.setdefault(ticket, {"tests": [], "changes": [], "depends_on": []})
    return web_select.select(changed, ticket, t, G48, G59, IMP, CFG)


class Select(unittest.TestCase):
    def test_K177_WS_001_own_tests(self):
        r = sel(["README.md"], ticket="K-36")   # K-36 は依存なし
        self.assertEqual(r["g48"], ["apps/web/tests/k/showcase.spec.ts"], "変えていなくても自分の試験は流す")
        self.assertEqual(r["tasks"], ["K-36"])
        r = web_select.select(["README.md"], ["K-36", "K-54"], TICKETS, G48, G59, IMP, CFG)   # チケットが複数：どれの試験も選ぶ
        self.assertEqual((r["g48"], r["g59"]), (["apps/web/tests/k/showcase.spec.ts"], ["apps/web/tests/skeleton/m1.spec.ts"]))

    def test_K177_WS_002_depends_on_one_level(self):
        r = sel(["packages/db/migrations/0094_x.sql"], ticket="K-90")   # K-90 は K-57 に依存（K-57 は K-51 に依存）
        self.assertEqual(r["g48"], ["apps/web/tests/features/F3/connect-pc.spec.ts"], "依存の依存（K-51）はたどらない")

    def test_K177_WS_003_changed_spec(self):
        r = sel(["apps/web/tests/k/showcase.spec.ts", "apps/web/tests/skeleton/m2.spec.ts"])
        self.assertEqual(r["g48"], ["apps/web/tests/k/showcase.spec.ts"])
        self.assertEqual(r["g59"], ["apps/web/tests/skeleton/m2.spec.ts"])

    def test_K177_WS_004_changed_test_helper_selects_importers(self):
        r = sel(["apps/web/tests/_lib/api.ts"])
        self.assertEqual(r["g48"], ["apps/web/tests/features/F1/sign-up.spec.ts"])
        self.assertEqual(r["g59"], ["apps/web/tests/skeleton/m1.spec.ts"])
        self.assertNotIn("apps/web/tests/components.spec.ts", r["g48"], "読み込まない試験は選ばない")

    def test_K177_WS_005_built_by(self):
        r = sel(["apps/web/app/signup/page.tsx"])   # 画面ごとのコード：作ったチケットの試験
        self.assertEqual(r["g48"], ["apps/web/tests/features/F1/sign-up.spec.ts"])
        r = sel(["apps/api/src/bridge/pair.ts"])   # 画面の外：changes の glob で当たる
        self.assertEqual(r["g48"], ["apps/web/tests/features/F3/connect-pc.spec.ts"])
        r = sel(["apps/web/components/k/Button.tsx"])   # 共通の画面のコード（app/ と tests/ の外）：どの画面が使うか決められないので全部
        self.assertEqual((r["g48"], r["g59"]), (sorted(G48), sorted(G59)))
        r = sel(["apps/web/app/brand-new/page.tsx"])   # 画面ごとのコードで、作ったチケットの試験に当たらない：黙って飛ばさず全部
        self.assertEqual((r["g48"], r["g59"]), (sorted(G48), sorted(G59)))
        self.assertTrue(any("当たらない" in w for w in r["reasons"]))

    def test_K177_WS_006_registry_files_do_not_select_by_builder(self):
        r = sel(["packages/db/src/index.ts", "11_tickets/tickets.json"])
        self.assertEqual(r["g48"] + r["g59"], [])

    def test_K177_WS_007_all_on(self):
        for f in ("apps/web/playwright.config.ts", "apps/web/package.json", "pnpm-lock.yaml", "apps/web/tests/global-setup.ts"):
            r = sel([f])   # global-setup は試験の置き場の spec でない物で、どの spec も読み込まない＝設定と同じく全部
            self.assertEqual((r["g48"], r["g59"]), (sorted(G48), sorted(G59)), f)

    def test_K177_WS_008_nothing_hits(self):
        r = sel(["docs/notes.md"])
        self.assertEqual((r["g48"], r["g59"], r["tasks"]), ([], [], []))
        self.assertEqual(len(r["reasons"]), 1)
        self.assertIn("当たる", r["reasons"][0])
        r = sel(["docs/notes.md", "apps/web/tests/k/showcase.spec.ts"])   # 消した・名前を変えた元の道も変えたファイルとして渡る（呼ぶ側）
        self.assertEqual(r["g48"], ["apps/web/tests/k/showcase.spec.ts"])

    def test_K177_WS_009_g59_and_outside_domain(self):
        r = sel(["README.md"], ticket="K-54")   # K-54 は依存なし・試験は skeleton
        self.assertEqual(r["g59"], ["apps/web/tests/skeleton/m1.spec.ts"])
        self.assertEqual(r["g48"], [])
        t = dict(TICKETS)
        t["K-92"] = {"tests": ["apps/web/tests/screens/x.spec.ts"], "changes": ["apps/api/src/x.ts"], "depends_on": []}
        r = sel(["apps/api/src/x.ts"], tickets=t)   # 作ったチケットの試験が G48 の一覧の外（screens）：選ばない
        self.assertEqual(r["g48"] + r["g59"], [])

    def test_K177_WS_010_tasks_are_owners_of_g48(self):
        r = sel(["apps/web/tests/_lib/row.ts", "apps/web/app/signup/page.tsx"])
        self.assertEqual(r["tasks"], ["K-24", "K-51"], "重なりなし・並び順。g59 だけの持ち主（照らす一覧の外）は入れない")
        t = dict(TICKETS)
        t["K-93"] = {"tests": ["apps/web/tests/components.spec.ts"], "changes": [], "depends_on": []}   # 持ち主が 2 つ
        r = sel(["apps/web/tests/components.spec.ts"], tickets=t)
        self.assertEqual(r["tasks"], ["K-24", "K-93"])


class Domain(unittest.TestCase):
    def test_K177_WS_011_g48_from_package_json(self):
        tmp = pathlib.Path(tempfile.mkdtemp())
        try:
            w = tmp / "apps/web"
            for f in ("tests/a.spec.ts", "tests/dir/b.spec.ts", "tests/dir/sub/c.spec.ts", "tests/dir/helper.ts", "tests/other/d.spec.ts"):
                (w / f).parent.mkdir(parents=True, exist_ok=True)
                (w / f).write_text("//\n")
            (w / "package.json").write_text(json.dumps({"scripts": {"e2e:k": "PW_REPORT=x playwright test tests/a.spec.ts tests/dir --workers 1"}}))
            self.assertEqual(web_select.domain_g48(str(tmp)),
                             ["apps/web/tests/a.spec.ts", "apps/web/tests/dir/b.spec.ts", "apps/web/tests/dir/sub/c.spec.ts"],
                             "ファイルと置き場（下まで）を開く・spec でない物・一覧の外・オプションは入れない")
        finally:
            shutil.rmtree(tmp, ignore_errors=True)
        self.assertTrue(web_select.domain_g48(str(ROOT)), "本物の package.json からも読める")

    def test_K177_WS_015_importers_transitive_on_real_files(self):
        tmp = pathlib.Path(tempfile.mkdtemp())
        try:
            t = tmp / "apps/web/tests"
            files = {"_lib/base.ts": "export const x = 1;\n",
                     "_lib/mid.ts": "import { x } from './base';\nexport const y = x;\n",
                     "_lib/idx/index.ts": "export const z = 1;\n",
                     "a.spec.ts": "import { y } from './_lib/mid';\n",
                     "b.spec.ts": "import { z } from './_lib/idx';\nconst m = await import('./_lib/base.ts');\n",
                     "c.spec.ts": "import { test } from '@playwright/test';\n"}
            for f, body in files.items():
                (t / f).parent.mkdir(parents=True, exist_ok=True)
                (t / f).write_text(body)
            imp = web_select.importers(str(tmp))
            self.assertEqual(imp["apps/web/tests/_lib/base.ts"], {"apps/web/tests/a.spec.ts", "apps/web/tests/b.spec.ts"}, "間に挟んで（mid）・動的な import")
            self.assertEqual(imp["apps/web/tests/_lib/idx/index.ts"], {"apps/web/tests/b.spec.ts"}, "置き場の index")
            self.assertNotIn("apps/web/tests/c.spec.ts", set().union(*imp.values()))
        finally:
            shutil.rmtree(tmp, ignore_errors=True)


class ScopeOutputs(unittest.TestCase):
    def base(self, mode="scoped"):
        p = {"mode": mode, "jobs": {"unit": False, "database": False, "web": True}, "unit_shards": 0, "unit_files": [],
             "migration_files": [], "coverage_args": [], "base": "", "reasons": [], "mismatches": [], "errors": [], "gates": [], "py_tests": []}
        return p

    def test_K177_WS_012_outputs_and_web_job(self):
        empty = {"g48": [], "g59": [], "tasks": [], "reasons": ["web：当たる試験が無い"]}
        p = ci_scope.with_web_selection(self.base(), empty)
        self.assertFalse(p["jobs"]["web"], "選べなければ web の組を流さない")
        self.assertTrue(p["errors"] and "web" in p["errors"][0], "web の組を流すはずの変更なのに選べない：黙って止めず、止めて理由を出す（D-133.7）")
        hit = {"g48": ["apps/web/tests/k/showcase.spec.ts"], "g59": [], "tasks": ["K-36"], "reasons": []}
        p = ci_scope.with_web_selection(self.base(), hit)
        self.assertTrue(p["jobs"]["web"])
        o = ci_scope.outputs(p)
        self.assertEqual(json.loads(o["web_g48"]), hit["g48"])
        self.assertEqual(json.loads(o["web_g59"]), [])
        self.assertEqual(json.loads(o["web_tasks"]), ["K-36"])
        full = ci_scope.with_web_selection(self.base("full"), empty)
        self.assertTrue(full["jobs"]["web"], "全部の回は今と同じ")


class Run(unittest.TestCase):
    def test_K177_WS_013_web_run_commands(self):
        full48 = web_run.commands("g48", full=True, specs=[], tasks=[])
        self.assertIn("e2e:k", " ".join(full48[0]))
        self.assertIn("--all", full48[-1])
        sc48 = web_run.commands("g48", full=False, specs=["apps/web/tests/k/showcase.spec.ts"], tasks=["K-36", "K-24"])
        self.assertEqual(sc48[0][-1], "tests/k/showcase.spec.ts", "apps/web からの道で選んだ試験だけ")
        self.assertIn("playwright", sc48[0])
        last = sc48[-1]
        self.assertNotIn("--all", last)
        self.assertNotIn("--task", last, "照らす行は持ち主でなく、流した試験のファイルに書かれた行で決める")
        self.assertEqual([last[i + 1] for i, a in enumerate(last) if a == "--rows-in"], ["apps/web/tests/k/showcase.spec.ts"])
        self.assertEqual(web_run.commands("g48", full=False, specs=[], tasks=[]), [], "空なら流さない")
        full59 = web_run.commands("g59", full=True, specs=[], tasks=[])
        self.assertEqual(full59[0][-1], "tests/skeleton")
        sc59 = web_run.commands("g59", full=False, specs=["apps/web/tests/skeleton/m2.spec.ts"], tasks=[])
        self.assertEqual(sc59[0][-1], "tests/skeleton/m2.spec.ts")
        self.assertEqual(web_run.commands("g59", full=False, specs=[], tasks=[]), [])
        self.assertEqual(sum(1 for c in sc48 if "op_gate.py" in " ".join(c)), 1, "照らすのは 1 回")
        for part in ("g48", "g59"):   # 範囲の回で一覧が空なのに web の組が動いた＝壊れている：黙って緑にしない
            r = subprocess.run([sys.executable, str(HERE / "web_run.py"), part], cwd=ROOT, capture_output=True, text=True,
                               env={**__import__("os").environ, "CI_FULL": "false", "CI_WEB_SPECS": "[]", "CI_WEB_TASKS": "[]"})
            self.assertEqual(r.returncode, 1, part)
        e48, e59 = web_run.env_for("g48", {"X": "1"}), web_run.env_for("g59", {"PLAYWRIGHT_JUNIT_OUTPUT_NAME": "/w/junit/web-skeleton.xml"})
        self.assertEqual(e48["PW_REPORT"], "pw-reports/k.json", "op_gate と ci_results が読む報告")
        self.assertEqual((e59["PW_REPORT"], e59["PLAYWRIGHT_HTML_OUTPUT_DIR"]), ("pw-reports/skeleton.json", "playwright-report-skeleton"))
        self.assertEqual(e59["PLAYWRIGHT_JUNIT_OUTPUT_NAME"], "/w/junit/web-skeleton.xml", "組の段の JUnit の置き場を消さない")


class OpGateRowsIn(unittest.TestCase):
    def test_K177_WS_016_op_gate_checks_only_rows_written_in_given_specs(self):
        tmp = pathlib.Path(tempfile.mkdtemp())
        try:
            spec = tmp / "spec"
            spec.mkdir()
            head = "| ID | 画面 | テスト観点 | テスト項目 | 前提条件 | 操作手順 | 期待結果 | 結果 | 備考 | タスク | 実行条件 |\n|---|---|---|---|---|---|---|---|---|---|---|\n"
            row = lambda rid, task: f"| {rid} | 画面 | 操作 | 押す | - | 押す | 出る |  |  | {task} | L1 |\n"  # noqa: E731
            (spec / "k.md").write_text(head + row("K36-UI-001", "K-36") + row("K36-UI-002", "K-36") + row("K40-UI-001", "K-40"))
            (tmp / "tickets.json").write_text(json.dumps({"tickets": [{"id": "K-36"}, {"id": "K-40"}]}))
            sp = tmp / "a.spec.ts"
            sp.write_text("test('K36-UI-001 出る', ...); test('K40-UI-001 出る', ...);\n")   # 持ち主（K-36）でない行 K40 も書かれている
            def report(states):
                f = tmp / "r.json"
                f.write_text(json.dumps({"suites": [{"specs": [{"title": f"{rid} 出る", "tests": [{"results": [{"status": st}]}]} for rid, st in states.items()]}]}))
                return str(f)
            def gate(rep):
                return subprocess.run([sys.executable, str(HERE / "op_gate.py"), "--spec", str(spec), "--tickets", str(tmp / "tickets.json"),
                                       "--report", rep, "--rows-in", str(sp), "--pending-from-report"], capture_output=True, text=True)
            ok = gate(report({"K36-UI-001": "passed", "K40-UI-001": "passed"}))
            self.assertEqual(ok.returncode, 0, ok.stdout + ok.stderr)   # K36-UI-002 は流していない spec の行：照らさない
            bad = gate(report({"K36-UI-001": "passed", "K40-UI-001": "failed"}))
            self.assertNotEqual(bad.returncode, 0, "書かれた行は持ち主のチケットでなくても照らす")
            self.assertIn("K40-UI-001", bad.stdout + bad.stderr)
        finally:
            shutil.rmtree(tmp, ignore_errors=True)


class Workflow(unittest.TestCase):
    def test_K177_WS_014_web_job_uses_web_run(self):
        wf = yaml.safe_load((ROOT / ".github/workflows/v3-gate.yml").read_text(encoding="utf-8"))
        outs = wf["jobs"]["static"]["outputs"]
        for k in ("web_g48", "web_g59", "web_tasks"):
            self.assertIn(k, outs)
        steps = {g: s for s in wf["jobs"]["web"]["steps"] for g in ("G48", "G59") if str(s.get("name", "")).startswith(g + " ")}
        self.assertEqual(set(steps), {"G48", "G59"}, "web の組に G48 と G59 の段がある")
        for g, part, key in (("G48", "g48", "web_g48"), ("G59", "g59", "web_g59")):
            s = steps[g]
            self.assertIn(f"web_run.py {part}", s["run"], g)
            env = s.get("env") or {}
            self.assertIn(f"needs.static.outputs.{key}", str(env.get("CI_WEB_SPECS")), g)
            self.assertIn("needs.static.outputs.full", str(env.get("CI_FULL")), g)
        self.assertIn("needs.static.outputs.web_tasks", str((steps["G48"].get("env") or {}).get("CI_WEB_TASKS")))


if __name__ == "__main__":
    unittest.main(verbosity=2)
