#!/usr/bin/env python3
"""K-173 の試験：CI の組を、組ごとに使い捨ての Linux の VM で流す（runs-on と Python の用意）。

  python3 scripts/ci/k173_vm_test.py

行 ID は K173-CI-NNN（11_tickets/K-173.md の表と 1 対 1）。
"""
from __future__ import annotations

import pathlib
import unittest

import yaml

ROOT = pathlib.Path(__file__).resolve().parent.parent.parent
WFS = {n: yaml.safe_load((ROOT / ".github" / "workflows" / n).read_text(encoding="utf-8")) for n in ("v3-gate.yml", "release-gate.yml")}
TEXT = "".join((ROOT / ".github" / "workflows" / n).read_text(encoding="utf-8") for n in WFS)


class VmRunner(unittest.TestCase):
    def test_K173_CI_001_all_jobs_on_linux_vm(self):
        n = 0
        for wf, doc in WFS.items():
            for job, j in doc["jobs"].items():
                n += 1
                self.assertEqual(j.get("runs-on"), ["self-hosted", "linux-vm"], f"{wf} {job}")
        self.assertGreater(n, 0)
        self.assertNotIn("macOS", TEXT.replace("macOS の", ""), "Mac の runner の印を残さない")

    def test_K173_CI_002_setup_python_before_venv(self):
        seen = 0
        for wf, doc in WFS.items():
            for job, j in doc["jobs"].items():
                steps = j.get("steps", [])
                runs = [str(s.get("run", "")) for s in steps]
                for i, r in enumerate(runs):
                    if "ci_venv.sh" in r:
                        seen += 1
                        before = [s for s in steps[:i] if str(s.get("uses", "")).startswith("actions/setup-python@")]
                        self.assertTrue(before, f"{wf} {job}：ci_venv.sh の前に setup-python")
                        self.assertEqual(str((before[-1].get("with") or {}).get("python-version")), "3.14", f"{wf} {job}")
        self.assertGreater(seen, 0)


if __name__ == "__main__":
    unittest.main(verbosity=2)
