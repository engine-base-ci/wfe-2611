#!/usr/bin/env python3
"""K-172 の試験：CI を ticket-flow の形にする（自分の Mac の台・DB は組の中で・重い検査もチケットの範囲だけ・JUnit の記録）。

  python3 scripts/ci/k172_ci_shape_test.py

行 ID は K172-CI-NNN（11_tickets/K-172.md の表と 1 対 1）。作り手（05_flow/build_testplan.py）が作った workflow を読んで形を確かめる。
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
import ci_scope  # noqa: E402

WF = yaml.safe_load((ROOT / ".github" / "workflows" / "v3-gate.yml").read_text(encoding="utf-8"))
JOBS = WF["jobs"]
ON = WF.get("on", WF.get(True))   # YAML 1.1 は on を真偽に読むことがある
HEAVY = ["27", "36", "38", "47", "56", "57", "62"]
DB_JOBS = ["database", "spec", "web"] + [f"unit-{i}" for i in range(1, 7)]


def steps(job: str) -> list[dict]:
    return JOBS[job].get("steps", [])


def run_text(job: str) -> str:
    return "\n".join(str(s.get("run", "")) + str(s.get("uses", "")) for s in steps(job))


class Shape(unittest.TestCase):
    def test_K172_CI_001_all_jobs_on_self_hosted_mac(self):
        for name, job in JOBS.items():
            with self.subTest(name):
                self.assertEqual(job["runs-on"], ["self-hosted", "macOS"])

    def test_K172_CI_002_db_in_job_and_always_removed(self):
        for name in DB_JOBS:
            with self.subTest(name):
                self.assertNotIn("services", JOBS[name])
                start = [s for s in steps(name) if "docker run" in str(s.get("run", ""))]
                stop = [s for s in steps(name) if "docker rm -f" in str(s.get("run", ""))]
                self.assertEqual(len(start), 1, "DB を立てる段が 1 つ")
                self.assertIn("GITHUB_ENV", start[0]["run"], "DATABASE_URL を後の段に渡す")
                self.assertEqual(len(stop), 1, "DB を消す段が 1 つ")
                self.assertEqual(stop[0].get("if"), "always()", "赤でも必ず消す")
                self.assertGreater(steps(name).index(stop[0]), steps(name).index(start[0]))

    def test_K172_CI_003_no_setup_python(self):
        for name in JOBS:
            with self.subTest(name):
                self.assertNotIn("actions/setup-python", run_text(name))

    def test_K172_CI_004_dispatch_inputs(self):
        inputs = ON["workflow_dispatch"]["inputs"]
        for k in ("scope", "ticket", "base"):
            self.assertIn(k, inputs)

    def test_K172_CI_005_junit_from_every_test_job_merged_even_when_red(self):
        for name in [f"unit-{i}" for i in range(1, 7)] + ["spec"]:
            with self.subTest(name):
                up = [s for s in steps(name) if "upload-artifact" in str(s.get("uses", "")) and str(s.get("with", {}).get("name", "")).startswith("junit-")]
                self.assertEqual(len(up), 1, "組ごとに junit-<組> を出す")
                self.assertIn("always()", str(up[0].get("if")))
        merge = JOBS["junit"]
        self.assertIn("always()", str(merge.get("if")))
        m = [s for s in merge["steps"] if "upload-artifact/merge" in str(s.get("uses", ""))]
        self.assertEqual(m[0]["with"]["name"], "junit")
        self.assertEqual(m[0]["with"]["pattern"], "junit-*")

    def test_K172_CI_006_heavy_gates_only_when_relevant_on_ticket_scope(self):
        found = {}
        for name, job in JOBS.items():
            for s in job.get("steps", []):
                for g in HEAVY:
                    if str(s.get("name", "")).startswith(f"G{g} "):
                        found[g] = str(s.get("if", ""))
        self.assertEqual(sorted(found), sorted(HEAVY))
        for g, cond in found.items():
            with self.subTest(g):
                self.assertIn(".full == 'true'", cond, "scope=full では必ず流す")
                self.assertIn(f",{g},", cond, "scope=ticket では gates に入っているときだけ")


class JUnitRunner(unittest.TestCase):
    def test_K172_CI_007_unittest_to_junit_with_row_ids(self):
        d = pathlib.Path(tempfile.mkdtemp(prefix="k172-"))
        t = d / "x_test.py"
        t.write_text("import unittest\nclass T(unittest.TestCase):\n"
                     "    def test_K9_CI_001_ok(self):\n        pass\n"
                     "    def test_K9_CI_002_bad(self):\n        self.fail('落ちた')\n", encoding="utf-8")
        out = d / "py.xml"
        r = subprocess.run([sys.executable, str(HERE / "junit_unittest.py"), "--out", str(out), str(t)], capture_output=True, text=True)
        self.assertEqual(r.returncode, 1, r.stdout + r.stderr)
        cases = {tc.get("name"): [c.tag for c in tc] for tc in ET.parse(out).getroot().iter("testcase")}
        ok = next(k for k in cases if "K9_CI_001" in k)
        bad = next(k for k in cases if "K9_CI_002" in k)
        self.assertEqual(cases[ok], [])
        self.assertIn("failure", cases[bad])


class Gates(unittest.TestCase):
    def test_K172_CI_008_gates_for_changed_files(self):
        rules = json.loads((ROOT / "scripts" / "ci" / "ci_scope.json").read_text(encoding="utf-8"))
        self.assertEqual(sorted(rules["gates"]), sorted(HEAVY), "重い検査は全部、関係するファイルを持つ")
        self.assertIn("57", ci_scope.gates_for(["scripts/ci/ci_scope.py"], rules, full=False))
        self.assertNotIn("57", ci_scope.gates_for(["apps/web/app/page.tsx"], rules, full=False))
        self.assertEqual(set(ci_scope.gates_for([], rules, full=True)), set(HEAVY))
        self.assertEqual(ci_scope.gates_for(["README.md"], rules, full=False), [])


if __name__ == "__main__":
    unittest.main(verbosity=2)
