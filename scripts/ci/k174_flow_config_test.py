#!/usr/bin/env python3
"""K-174 の試験：ticket-flow の設定（CI の台＝組ごとの Linux の VM・出す前の手元の検査）。

  python3 scripts/ci/k174_flow_config_test.py

行 ID は K174-CF-NNN（11_tickets/K-174.md の表と 1 対 1）。
"""
from __future__ import annotations

import pathlib
import re
import unittest

import yaml

ROOT = pathlib.Path(__file__).resolve().parent.parent.parent
CFG = yaml.safe_load((ROOT / "ticket-flow.yaml").read_text(encoding="utf-8"))
WFS = {n: yaml.safe_load((ROOT / ".github" / "workflows" / n).read_text(encoding="utf-8")) for n in ("v3-gate.yml", "release-gate.yml")}


class FlowConfig(unittest.TestCase):
    def test_K174_CF_001_vm_matches_workflow(self):
        vm = CFG.get("vm") or {}
        self.assertTrue(vm.get("account"), "runner の登録に使うアカウント")
        self.assertLessEqual(int(vm["slots"]) * int(vm["cpu"]), 10, "コアの合計は台のコア数まで（K-173 で測った）")
        for wf, doc in WFS.items():
            for job, j in doc["jobs"].items():
                self.assertEqual(j["runs-on"][1], vm["label"], f"{wf} {job}")
        vers = {str((s.get("with") or {}).get("python-version")) for d in WFS.values() for j in d["jobs"].values()
                for s in j.get("steps", []) if str(s.get("uses", "")).startswith("actions/setup-python@")}
        self.assertTrue(vers)
        self.assertEqual(vers, {str(v) for v in vm["tools"]["python"]}, "像の道具の置き場の Python と workflow の版が同じ（毎回取りに行かない）")

    def test_K174_CF_002_preflight_has_fast_checks(self):
        pre = CFG.get("preflight") or []
        text = "\n".join(pre)
        for need in ("pnpm -s lint", "generated_gate.py", "test_owner_gate.py", "ci_wiring_gate.py"):
            self.assertIn(need, text, f"出す前に流す：{need}")
        for path in re.findall(r"scripts/[\w/.-]+\.(?:py|sh)", text):
            self.assertTrue((ROOT / path).is_file(), path)


if __name__ == "__main__":
    unittest.main(verbosity=2)
