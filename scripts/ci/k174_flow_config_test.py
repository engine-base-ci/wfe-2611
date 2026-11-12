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


HOST_CORES = 10   # VM を出す台（この Mac・M4 10 コア・K-173 で測った台）。試験を流す台のコア数ではない


class FlowConfig(unittest.TestCase):
    def test_K174_CF_001_vm_matches_workflow(self):
        vm = CFG.get("vm") or {}
        self.assertTrue(vm.get("account"), "runner の登録に使うアカウント")
        self.assertLessEqual(int(vm["slots"]) * int(vm["cpu"]), HOST_CORES, "コアの合計は台のコア数まで（K-173 で測った）")
        n = 0
        for wf, doc in WFS.items():
            for job, j in doc["jobs"].items():
                ro = j.get("runs-on")
                self.assertTrue(isinstance(ro, list) and len(ro) == 2 and ro[0] == "self-hosted", f"{wf} {job}：runs-on の形 {ro!r}")
                self.assertEqual(ro[1], vm["label"], f"{wf} {job}")
                n += 1
        self.assertGreater(n, 0)
        steps = [s for d in WFS.values() for j in d["jobs"].values() for s in j.get("steps", [])]
        py = {str((s.get("with") or {}).get("python-version")) for s in steps if str(s.get("uses", "")).startswith("actions/setup-python@")}
        self.assertTrue(py)
        self.assertEqual(py, {str(v) for v in vm["tools"]["python"]}, "像の Python と workflow の版が同じ（毎回取りに行かない）")
        node = {str(d.get("env", {}).get("NODE_VERSION")) for d in WFS.values()}
        self.assertEqual(node, {str(v) for v in vm["tools"]["node"]}, "像の Node と workflow の NODE_VERSION が同じ")
        warm = vm.get("warm") or []
        self.assertTrue(any(w.startswith("pnpm install") for w in warm), "部品の置き場を温める")
        self.assertTrue(any("ci_venv.sh" in w for w in warm), "Python の部品の venv を温める")
        for path in re.findall(r"scripts/[\w/.-]+\.(?:py|sh)", "\n".join(warm)):
            self.assertTrue((ROOT / path).is_file(), path)

    def test_K174_CF_002_preflight_has_fast_checks(self):
        pre = [p.strip() for p in CFG.get("preflight") or []]
        self.assertTrue(any(p.startswith("pnpm install") for p in pre), "部品を入れる")
        self.assertIn("pnpm -s lint", pre, "整形（命令そのもの）")
        for need in ("generated_gate.py", "test_owner_gate.py", "ci_wiring_gate.py"):
            self.assertTrue(any(re.fullmatch(rf"python3 scripts/ci/{re.escape(need)}( .*)?", p) for p in pre), f"出す前に流す：{need}")
        for path in re.findall(r"scripts/[\w/.-]+\.(?:py|sh)", "\n".join(pre)):
            self.assertTrue((ROOT / path).is_file(), path)

if __name__ == "__main__":
    unittest.main(verbosity=2)
