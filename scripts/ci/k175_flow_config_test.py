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
        for job in ("web", "e2e"):   # ブラウザを使う組（どちらも元の像の Chromium で足りる）
            run = "\n".join(str(st.get("run", "")) for st in WF["jobs"][job].get("steps", []))
            self.assertRegex(run, r"playwright install( --with-deps)? chromium\b", f"{job} の組が使うブラウザも chromium")

    def test_K175_CF_002_scope_script_in_preflight(self):
        # K-178 から：CI の範囲の台本は、CI の定義の組（preflight_jobs）をそのまま手元で流すときに 1 回流れる
        wf = yaml.safe_load((ROOT / ".github/workflows" / CFG["ci"]["workflow"]).read_text(encoding="utf-8"))
        runs = [p.strip() for p in CFG.get("preflight") or []] + [
            str(s.get("run", "")) for j in (CFG.get("preflight_jobs") or [])[:1] for s in wf["jobs"][j]["steps"]]
        hit = [r for r in runs if "python3 scripts/ci/ci_scope.py " in r]
        self.assertEqual(len(hit), 1, "CI の範囲の台本を出す前に 1 回")
        for need in ("--base", "--scope", "--ticket"):
            self.assertIn(need, hit[0])
        self.assertTrue((ROOT / "scripts/ci/ci_scope.py").is_file())

if __name__ == "__main__":
    unittest.main(verbosity=2)
