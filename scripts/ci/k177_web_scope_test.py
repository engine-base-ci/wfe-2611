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
    "K-36": {"tests": ["apps/web/tests/k/showcase.spec.ts"], "changes": [], "depends_on": []},
    "K-90": {"tests": ["packages/db/test/x.test.ts"], "changes": [], "depends_on": ["K-57"]},
    "K-91": {"tests": ["apps/web/tests/screens/old.spec.ts"], "changes": ["apps/web/app/old/page.tsx"], "depends_on": []},
}
IMP = {"apps/web/tests/_lib/api.ts": {"apps/web/tests/features/F1/sign-up.spec.ts", "apps/web/tests/skeleton/m1.spec.ts"},
       "apps/web/tests/_lib/row.ts": {"apps/web/tests/components.spec.ts", "apps/web/tests/features/F1/sign-up.spec.ts",
                                      "apps/web/tests/skeleton/m1.spec.ts"}}
CFG = {"registry": ["packages/db/src/index.ts", "11_tickets/**"], "all_on": ["apps/web/playwright.config.ts", "apps/web/package.json"]}


def sel(changed, ticket="K-99", tickets=None):
    t = dict(TICKETS if tickets is None else tickets)
    t.setdefault(ticket, {"tests": [], "changes": [], "depends_on": []})
    return web_select.select(changed, ticket, t, G48, G59, IMP, CFG)


class Select(unittest.TestCase):
    def test_K177_WS_001_own_tests(self):
        r = sel(["apps/web/tests/features/F3/connect-pc.spec.ts"], ticket="K-57")
        self.assertIn("apps/web/tests/features/F3/connect-pc.spec.ts", r["g48"])
        r = sel(["README.md"], ticket="K-57")
        self.assertEqual(r["g48"], ["apps/web/tests/features/F3/connect-pc.spec.ts"], "変えていなくても自分の試験は流す")
        self.assertIn("K-57", r["tasks"])

    def test_K177_WS_002_depends_on_one_level(self):
        r = sel(["packages/db/migrations/0094_x.sql"], ticket="K-90")   # K-90 は K-57 に依存（K-57 は K-51 に依存）
        self.assertEqual(r["g48"], ["apps/web/tests/features/F3/connect-pc.spec.ts"], "依存の依存（K-51）はたどらない")

    def test_K177_WS_003_changed_spec(self):
        r = sel(["apps/web/tests/k/showcase.spec.ts"])
        self.assertEqual(r["g48"], ["apps/web/tests/k/showcase.spec.ts"])

    def test_K177_WS_004_changed_test_helper_selects_importers(self):
        r = sel(["apps/web/tests/_lib/api.ts"])
        self.assertEqual(r["g48"], ["apps/web/tests/features/F1/sign-up.spec.ts"])
        self.assertEqual(r["g59"], ["apps/web/tests/skeleton/m1.spec.ts"])
        self.assertNotIn("apps/web/tests/components.spec.ts", r["g48"], "読み込まない試験は選ばない")

    def test_K177_WS_005_built_by(self):
        r = sel(["apps/web/components/k/Button.tsx"])
        self.assertEqual(r["g48"], ["apps/web/tests/components.spec.ts"])
        r = sel(["apps/api/src/bridge/pair.ts"])   # changes の glob で当たる
        self.assertEqual(r["g48"], ["apps/web/tests/features/F3/connect-pc.spec.ts"])

    def test_K177_WS_006_registry_files_do_not_select_by_builder(self):
        r = sel(["packages/db/src/index.ts", "11_tickets/tickets.json"])
        self.assertEqual(r["g48"] + r["g59"], [])

    def test_K177_WS_007_all_on(self):
        r = sel(["apps/web/playwright.config.ts"])
        self.assertEqual(r["g48"], sorted(G48))
        self.assertEqual(r["g59"], sorted(G59))

    def test_K177_WS_008_nothing_hits(self):
        r = sel(["docs/notes.md"])
        self.assertEqual((r["g48"], r["g59"], r["tasks"]), ([], [], []))
        self.assertEqual(len(r["reasons"]), 1)
        self.assertIn("当たる", r["reasons"][0])

    def test_K177_WS_009_g59_and_outside_domain(self):
        r = sel(["README.md"], ticket="K-58")
        self.assertEqual(r["g59"], ["apps/web/tests/skeleton/m2.spec.ts"])
        self.assertEqual(r["g48"], [])
        r = sel(["apps/web/app/old/page.tsx"])   # 作ったチケットの試験が G48 の一覧の外（screens）
        self.assertEqual(r["g48"] + r["g59"], [])

    def test_K177_WS_010_tasks_are_owners_of_g48(self):
        r = sel(["apps/web/tests/_lib/row.ts", "apps/web/components/k/Button.tsx"])
        self.assertEqual(r["tasks"], ["K-24", "K-51"], "重なりなし・並び順。g59 だけの持ち主（照らす一覧の外）は入れない")


class Domain(unittest.TestCase):
    def test_K177_WS_011_g48_from_package_json(self):
        d = web_select.domain_g48(str(ROOT))
        args = json.loads((ROOT / "apps/web/package.json").read_text(encoding="utf-8"))["scripts"]["e2e:k"]
        self.assertTrue(d and all(x.startswith("apps/web/tests/") and x.endswith(".spec.ts") for x in d), d)
        self.assertIn("apps/web/tests/components.spec.ts", d)
        self.assertTrue(any(x.startswith("apps/web/tests/features/") for x in d), "置き場（tests/features）を開く")
        self.assertFalse(any(x.startswith("apps/web/tests/screens/") for x in d), "一覧の外は入れない")
        self.assertIn("tests/features", args)


class ScopeOutputs(unittest.TestCase):
    def base(self, mode="scoped"):
        p = {"mode": mode, "jobs": {"unit": False, "database": False, "web": True}, "unit_shards": 0, "unit_files": [],
             "migration_files": [], "coverage_args": [], "base": "", "reasons": [], "mismatches": [], "errors": [], "gates": [], "py_tests": []}
        return p

    def test_K177_WS_012_outputs_and_web_job(self):
        empty = {"g48": [], "g59": [], "tasks": [], "reasons": ["web：当たる試験が無い"]}
        p = ci_scope.with_web_selection(self.base(), empty)
        self.assertFalse(p["jobs"]["web"], "選べなければ web の組を流さない")
        self.assertIn("web：当たる試験が無い", p["reasons"])
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
        self.assertEqual([last[i + 1] for i, a in enumerate(last) if a == "--task"], ["K-36", "K-24"])
        self.assertEqual(web_run.commands("g48", full=False, specs=[], tasks=[]), [], "空なら流さない")
        full59 = web_run.commands("g59", full=True, specs=[], tasks=[])
        self.assertEqual(full59[0][-1], "tests/skeleton")
        sc59 = web_run.commands("g59", full=False, specs=["apps/web/tests/skeleton/m2.spec.ts"], tasks=[])
        self.assertEqual(sc59[0][-1], "tests/skeleton/m2.spec.ts")
        self.assertEqual(web_run.commands("g59", full=False, specs=[], tasks=[]), [])


class Workflow(unittest.TestCase):
    def test_K177_WS_014_web_job_uses_web_run(self):
        wf = yaml.safe_load((ROOT / ".github/workflows/v3-gate.yml").read_text(encoding="utf-8"))
        outs = wf["jobs"]["static"]["outputs"]
        for k in ("web_g48", "web_g59", "web_tasks"):
            self.assertIn(k, outs)
        steps = {str(s.get("name", ""))[:3]: s for s in wf["jobs"]["web"]["steps"] if str(s.get("name", "")).startswith(("G48", "G59"))}
        for g, part, key in (("G48", "g48", "web_g48"), ("G59", "g59", "web_g59")):
            s = steps[g]
            self.assertIn(f"web_run.py {part}", s["run"], g)
            env = s.get("env") or {}
            self.assertIn(f"needs.static.outputs.{key}", str(env.get("CI_WEB_SPECS")), g)
            self.assertIn("needs.static.outputs.full", str(env.get("CI_FULL")), g)
        self.assertIn("needs.static.outputs.web_tasks", str((steps["G48"].get("env") or {}).get("CI_WEB_TASKS")))


if __name__ == "__main__":
    unittest.main(verbosity=2)
