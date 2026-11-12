#!/usr/bin/env python3
"""K-175 の試験：CI の台の元の像に実ブラウザ・出す前の検査に CI の範囲の台本。

  python3 scripts/ci/k175_flow_config_test.py

行 ID は K175-CF-NNN（11_tickets/K-175.md の表と 1 対 1）。
"""
from __future__ import annotations

import pathlib
import re
import unittest

import yaml

ROOT = pathlib.Path(__file__).resolve().parent.parent.parent
CFG = yaml.safe_load((ROOT / "ticket-flow.yaml").read_text(encoding="utf-8"))
WF = yaml.safe_load((ROOT / ".github" / "workflows" / "v3-gate.yml").read_text(encoding="utf-8"))


class FlowConfig2(unittest.TestCase):
    def test_K175_CF_001_browser_in_image(self):
        warm = [w.strip() for w in (CFG.get("vm") or {}).get("warm") or []]
        pw = [i for i, w in enumerate(warm) if re.search(r"playwright install --with-deps chromium$", w)]
        inst = [i for i, w in enumerate(warm) if w.startswith("pnpm install")]
        self.assertTrue(pw, "元の像に Chromium を依存の部品ごと入れる")
        self.assertTrue(inst and inst[0] < pw[0], "部品を入れた後（playwright は部品の中にある）")
        web = "\n".join(str(s.get("run", "")) for s in WF["jobs"]["web"].get("steps", []))
        self.assertRegex(web, r"playwright install( --with-deps)? chromium", "web の組が使うブラウザも chromium")

    def test_K175_CF_002_scope_script_in_preflight(self):
        pre = [p.strip() for p in CFG.get("preflight") or []]
        hit = [p for p in pre if p.startswith("python3 scripts/ci/ci_scope.py ")]
        self.assertEqual(len(hit), 1, "CI の範囲の台本を出す前に 1 回")
        for need in ("--base {base}", "--scope ticket", "--ticket {ticket}"):
            self.assertIn(need, hit[0])
        self.assertTrue((ROOT / "scripts/ci/ci_scope.py").is_file())


if __name__ == "__main__":
    unittest.main(verbosity=2)
