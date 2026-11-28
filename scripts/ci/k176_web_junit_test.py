#!/usr/bin/env python3
"""K-176 の試験：web の組の実ブラウザの試験の JUnit の記録（K-172 の抜け）。

  python3 scripts/ci/k176_web_junit_test.py

行 ID は K176-CI-NNN（11_tickets/K-176.md の表と 1 対 1）。
"""
from __future__ import annotations

import json
import os
import pathlib
import re
import subprocess
import unittest

import yaml

ROOT = pathlib.Path(__file__).resolve().parent.parent.parent
WF = yaml.safe_load((ROOT / ".github" / "workflows" / "v3-gate.yml").read_text(encoding="utf-8"))
LOAD = "import c from './apps/web/playwright.config.ts'; console.log(JSON.stringify(c.reporter))"


def reporters(env_val: str | None) -> list:
    env = {k: v for k, v in os.environ.items() if k != "PLAYWRIGHT_JUNIT_OUTPUT_NAME"}
    if env_val is not None:
        env["PLAYWRIGHT_JUNIT_OUTPUT_NAME"] = env_val
    r = subprocess.run(["pnpm", "exec", "tsx", "-e", LOAD], cwd=ROOT, env=env, capture_output=True, text=True)
    assert r.returncode == 0, r.stderr
    return json.loads(r.stdout.strip().splitlines()[-1])


class WebJunit(unittest.TestCase):
    def test_K176_CI_001_junit_reporter_only_with_env(self):
        on = reporters("/abs/junit/web.xml")
        off = reporters(None)
        junit = [r for r in on if r[0] == "junit"]
        self.assertEqual(len(junit), 1, on)
        self.assertEqual(junit[0][1]["outputFile"], "/abs/junit/web.xml")
        self.assertFalse([r for r in off if r[0] == "junit"], "無いときは junit を出さない")
        self.assertEqual([r[0] for r in on if r[0] != "junit"], [r[0] for r in off], "ほかの reporter は同じ")

    def test_K176_CI_002_g48_g59_write_distinct_junit_under_workspace(self):
        job = WF["jobs"]["web"]
        default = str((job.get("env") or {}).get("PLAYWRIGHT_JUNIT_OUTPUT_NAME", ""))
        outs = []
        for st in job.get("steps", []):
            name, run = str(st.get("name", "")), str(st.get("run", ""))
            if not (name.startswith("G48 ") or name.startswith("G59 ")):
                continue
            self.assertTrue("playwright test" in run or "e2e:k" in run or "web_run.py" in run, f"{name}：実ブラウザの試験を流す段")   # e2e:k は playwright test の別名・K-177 から web_run.py が流す
            m = re.search(r'PLAYWRIGHT_JUNIT_OUTPUT_NAME="?([^"\s]+)"?', run)
            out = m.group(1) if m else str((st.get("env") or {}).get("PLAYWRIGHT_JUNIT_OUTPUT_NAME", default))
            self.assertRegex(out, r"^(\$\{\{ github\.workspace \}\}|\$GITHUB_WORKSPACE)/junit/[\w-]+\.xml$", f"{name}：{out}")
            outs.append(out.rsplit("/", 1)[-1])
        self.assertEqual(sorted(outs), ["web-skeleton.xml", "web.xml"], "G48 と G59 が別々の記録")


if __name__ == "__main__":
    unittest.main(verbosity=2)
