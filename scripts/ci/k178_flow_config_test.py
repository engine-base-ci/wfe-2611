"""K-178：ticket-flow.yaml が、CI の定義の組をそのまま手元で流し、重すぎるチケットを止める設定になっている"""
from __future__ import annotations

import json
import pathlib
import sys
import unittest

import yaml

ROOT = pathlib.Path(__file__).resolve().parents[2]
CFG = yaml.safe_load((ROOT / "ticket-flow.yaml").read_text(encoding="utf-8"))
WF = yaml.safe_load((ROOT / ".github/workflows" / CFG["ci"]["workflow"]).read_text(encoding="utf-8"))
SKILL = pathlib.Path.home() / ".claude/skills/ticket-flow/scripts"


class FlowConfigTest(unittest.TestCase):
    def test_K178_CF_001_preflight_runs_workflow_jobs_not_a_hand_list(self) -> None:
        self.assertEqual(CFG.get("preflight_jobs"), ["static", "spec"])
        self.assertEqual(CFG.get("preflight"), ["pnpm install --frozen-lockfile --prefer-offline --silent"])
        self.assertFalse(CFG.get("preflight_skip"), "手元で外す段は持たない（CI と同じに流す）")
        runs = "\n".join(str(s.get("run", "")) for j in CFG["preflight_jobs"] for s in WF["jobs"][j]["steps"])
        for cmd in ("pnpm lint", "scripts/ci/generated_gate.py", "scripts/ci/test_owner_gate.py",
                    "scripts/ci/ci_wiring_gate.py", "scripts/ci/ci_scope.py"):
            self.assertIn(cmd, runs, f"前の手の一覧にあった {cmd} が static・spec の組から外れている")

    def test_K178_CF_002_weight_stops_web_and_db_in_one_ticket(self) -> None:
        w = CFG.get("weight") or {}
        self.assertIs(type(w.get("max")), int)
        self.assertEqual(w["max"], 1)
        if not (SKILL / "flow.py").is_file():
            self.skipTest("ticket-flow のスキルが無い台")
        sys.path.insert(0, str(SKILL))
        import flow  # noqa: PLC0415
        from common import FlowError  # noqa: PLC0415

        class C:
            cfg = CFG
        flow.check_weight(C, "K-x", {"changes": ["apps/web/app/x/page.tsx", "apps/api/src/a.ts"]})
        flow.check_weight(C, "K-x", {"changes": ["packages/db/migrations/0100_x.sql", "apps/api/src/a.ts"]})
        with self.assertRaises(FlowError):
            flow.check_weight(C, "K-x", {"changes": ["apps/web/app/x/page.tsx", "packages/db/migrations/0100_x.sql"]})

    def test_K178_CF_003_changes_ignore_is_exactly_generated_and_records(self) -> None:
        gen = json.loads((ROOT / "scripts/ci/generated.json").read_text(encoding="utf-8"))
        outs = {o for g in gen["generators"] for o in g.get("outputs", [])}
        ign = CFG.get("changes_ignore") or []
        self.assertTrue(ign, "changes_ignore が空")
        self.assertEqual(set(ign), outs | {"01_hearing/decider-answers.jsonl"})


if __name__ == "__main__":
    unittest.main()
