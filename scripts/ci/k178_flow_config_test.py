"""K-178：ticket-flow.yaml が、CI の定義の組をそのまま手元で流し、重すぎるチケットを止める設定になっている"""
from __future__ import annotations

import fnmatch
import json
import pathlib
import unittest

import yaml

ROOT = pathlib.Path(__file__).resolve().parents[2]
CFG = yaml.safe_load((ROOT / "ticket-flow.yaml").read_text(encoding="utf-8"))
WF = yaml.safe_load((ROOT / ".github/workflows" / CFG["ci"]["workflow"]).read_text(encoding="utf-8"))


class FlowConfigTest(unittest.TestCase):
    def test_K178_CF_001_preflight_runs_workflow_jobs_not_a_hand_list(self) -> None:
        self.assertEqual(CFG.get("preflight_jobs"), ["static", "spec"])
        for j in CFG["preflight_jobs"]:
            self.assertIn(j, WF["jobs"])
        self.assertEqual(len(CFG.get("preflight") or []), 1)
        self.assertIn("install", CFG["preflight"][0])

    def test_K178_CF_002_weight_stops_web_and_db_in_one_ticket(self) -> None:
        w = CFG.get("weight") or {}
        self.assertEqual(w.get("max"), 1)
        self.assertIn("apps/web/**", w["groups"]["web"])
        self.assertIn("packages/db/**", w["groups"]["db"])

    def test_K178_CF_003_changes_ignore_is_only_generated_or_records(self) -> None:
        gen = json.loads((ROOT / "scripts/ci/generated.json").read_text(encoding="utf-8"))
        outs = [o for g in gen.get("generators", gen if isinstance(gen, list) else []) for o in g.get("outputs", [])]
        allowed_extra = {"01_hearing/decider-answers.jsonl", "11_tickets/**"}
        for pat in CFG.get("changes_ignore") or []:
            self.assertFalse(fnmatch.fnmatch("apps/api/src/x.ts", pat) or fnmatch.fnmatch("packages/db/src/x.ts", pat), pat)
            self.assertTrue(pat in allowed_extra or pat in outs or any(fnmatch.fnmatch(pat, o) or fnmatch.fnmatch(o, pat) for o in outs), pat)


if __name__ == "__main__":
    unittest.main()
