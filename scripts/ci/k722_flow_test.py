#!/usr/bin/env python3
"""K-722 の試験（流れ：画面 rules・work-types と行為 A131・A119・A30 を後のフェーズへ送る・表の凍結の印・親の入れ物）。
行 ID は K722-FL-NNN（11_tickets/K-722.md の表と 1 対 1）。口の外しの行は apps/api/test/features/F9/knowledge-old-retire.test.ts（K722-API-NNN）。
作る段で phase1.py・flows.json・db-catalog.json・親の md を直し、作り手（05_flow/build_flow.py → scripts/tickets/regen_all.py）で
flow.json を作り直してから緑になる（切る段の枝では赤）。
テストはチケットを作る人が書き、実装する人は変えない"""
from __future__ import annotations

import json
import pathlib
import re
import subprocess
import sys
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[2]
FLOW = json.loads((ROOT / "05_flow" / "flow.json").read_text(encoding="utf-8"))
FLOWS = json.loads((ROOT / "05_flow" / "flows.json").read_text(encoding="utf-8"))
CATALOG = json.loads((ROOT / "03_architecture" / "db-catalog.json").read_text(encoding="utf-8"))["tables"]
SCREENS = {s["id"]: s for s in FLOW["screens"]}
ACTS = {a["id"]: a for ph in FLOW["backbone"] for a in ph["acts"]}
NAV = FLOW["navigation"]
SENT_SCREENS = ("rules", "work-types")
SENT_ACTS = ("A131", "A119", "A30")
FROZEN = ("memories", "skills", "skill_versions", "skill_test_runs", "policies", "learning_candidates", "knowledge_links", "imports")
# 段 10 が外した口 66（K-711：決まり 14・業務の型 15／K-712：記憶 5／K-721：覚えたいこと 5・数 1・チケットの形 3／K-722：ナレッジの前の口 23）
GONE_OPS = """listRules getRule checkRule createRule updateRule deleteRule getWorkspaceRules createWorkspaceRule updateWorkspaceRule deleteWorkspaceRule
previewEscalationRule createEscalationRule updateEscalationRule deleteEscalationRule listWorkTypes getWorkType createWorkType copyWorkType
updateWorkTypeDraft listWorkTypeVersions tryWorkType releaseWorkType requestWorkTypeSpread listOpsWorkTypes getOpsWorkType uploadWorkTypePackage
getWorkTypeUpload releaseOpsWorkType rollbackOpsWorkType listMemories createMemory updateMemory deleteMemory promoteMemoryToRule
listLearningCandidates acceptLearningCandidate dismissLearningCandidate postponeLearningCandidate requestRuleException countKnows
getTicketShape previewTicketShapeChange saveTicketShape getKnowledgeHome listKnowledgePages askKnowledge sendKnowledgeAnswerFeedback
uploadKnowledgeAttachment restoreKnowledgeVersion exportKnowledgeMarkdown getKnowledgeUsage getKnowledgeLinks linkKnowledgeMention
searchKnowledgeLinkTargets listKnowledgeMessages postKnowledgeMessage listKnowledgeVerifications verifyKnowledgePage archiveKnowledgePage
unarchiveKnowledgePage listKnowledgeProposals acceptKnowledgeProposal declineKnowledgeProposal createKnowledgeImport getKnowledgeImport
commitKnowledgeImport""".split()


def heads(path: str) -> dict[str, str]:
    t = (ROOT / path).read_text(encoding="utf-8").split("---")[1]
    return dict(re.findall(r"^([a-z_]+):\s*(.*)$", t, re.M))


def listed(value: str) -> list[str]:
    inner = value.strip()[1:-1]
    return [x.strip() for x in inner.split(",") if x.strip()]


class FlowTest(unittest.TestCase):
    def test_K722_FL_001_screens_sent(self) -> None:
        """画面 rules・work-types は後のフェーズへ送られた：第 1 フェーズの画面でなくなり（release が v1 でない）、後のフェーズの一覧（deferred）に D-152 の根拠つきで載る。
        どの役の主ナビにも第 2 ナビにも出ない（K-673 が外した所のまま）"""
        for sid in SENT_SCREENS:
            self.assertNotEqual(SCREENS.get(sid, {}).get("release"), "v1", sid)
            reason = FLOW["deferred"].get(sid, "")
            self.assertRegex(reason, r"D-152\.(8|20|22)", f"deferred の {sid} の根拠")
            for role, ids in NAV["by_role"].items():
                self.assertNotIn(sid, ids, role)
            self.assertNotIn(sid, NAV["sub_by_screen"])

    def test_K722_FL_002_acts_sent(self) -> None:
        """行為 A131・A119・A30 は第 1 フェーズの行為でなくなり（release が v1 でない）、deferred に根拠つきで載る。A114・A118・A93・A136・A137 は第 1 フェーズのまま。
        （v2 の行為は act_to_screen に残るので、act_to_screen は見ない）"""
        for a in SENT_ACTS:
            self.assertNotEqual(ACTS.get(a, {}).get("release"), "v1", a)
            self.assertIn(a, FLOW["deferred"], a)
        for a in ("A114", "A118", "A93", "A136", "A137"):
            self.assertEqual(ACTS[a]["release"], "v1", a)

    def test_K722_FL_003_flows(self) -> None:
        """flows.json の F9 から A131・A119・A30 が外れ、A114・A118・A93・A136・A137 が残る。第 1 フェーズの行為はちょうど 1 つの流れに入る（FD1）"""
        f = {x["id"]: x for x in FLOWS["flows"]}
        for a in SENT_ACTS:
            self.assertNotIn(a, f["F9"]["acts"], a)
            self.assertTrue(all(a not in fl["acts"] for fl in FLOWS["flows"]), a)
        self.assertTrue({"A114", "A118", "A93", "A136", "A137"} <= set(f["F9"]["acts"]))
        v1 = {a for a, v in ACTS.items() if v.get("release") == "v1"}
        seen = [a for fl in FLOWS["flows"] for a in fl["acts"]]
        self.assertEqual(sorted(seen), sorted(set(seen)), "行為が 2 つの流れに入っている")
        self.assertEqual(sorted(set(seen) ^ v1), [], "第 1 フェーズの行為と流れの行為が合わない")

    def test_K722_FL_004_parents(self) -> None:
        """親の入れ物：K-69 の screens と apis が空（口も画面も葉が持つ）。K-71 の apis に listRules・createRule が、K-72 の apis に運営の業務の型の 6 つが無い。
        外した 66 の操作 ID は K-69・K-71・K-72 の apis のどこにも無い"""
        h69 = heads("11_tickets/K-69.md")
        self.assertEqual(listed(h69["screens"]), [])
        self.assertEqual(listed(h69["apis"]), [])
        gone = set(GONE_OPS)
        for k in ("K-69", "K-71", "K-72"):
            self.assertEqual(sorted(gone & set(listed(heads(f"11_tickets/{k}.md")["apis"]))), [], k)

    def test_K722_FL_005_frozen_catalog(self) -> None:
        """目録 03_architecture/db-catalog.json の 8 つの表（memories・skills・skill_versions・skill_test_runs・policies・learning_candidates・knowledge_links・imports）が
        frozen・理由に「無くした」と D-152 を含む。class_axes・kind_sections は段 5（K-563・K-578）の持ち物で、この葉は区分を変えない（試験は見ない）"""
        for t in FROZEN:
            self.assertEqual(CATALOG[t]["class"], "frozen", t)
            why = CATALOG[t].get("why", "")
            self.assertIn("D-152", why, t)
            self.assertRegex(why, "無くした|使わない", t)

    def test_K722_FL_006_er_diagram(self) -> None:
        """ER 図に、凍結した 8 つの表を言う印つきの段落（<!-- 段10:K-722 -->）が 1 つ在り、8 つの表の名前を全部含む"""
        er = (ROOT / "03_architecture" / "ER図.md").read_text(encoding="utf-8")
        marks = er.count("<!-- 段10:K-722 -->")
        self.assertEqual(marks, 1)
        block = er.split("<!-- 段10:K-722 -->")[1].split("\n\n")[0]
        for t in FROZEN:
            self.assertIn(t, block, t)
        self.assertIn("凍結", block)

    def test_K722_FL_007_gates(self) -> None:
        """画面の導出の検査 flow_gate（G1〜G10・G17・G22）と、流れと DB の検査 flow_db_gate（FD1〜FD5・凍結の表をコードが使うと赤）が 0 で終わる"""
        for args in (
            ["scripts/ci/flow_gate.py", "--flow", "05_flow/flow.json", "--choke", "03_architecture/choke-points.json"],
            ["scripts/ci/flow_db_gate.py"],
        ):
            p = subprocess.run([sys.executable, *args], cwd=ROOT, capture_output=True, text=True, timeout=300)
            self.assertEqual(p.returncode, 0, p.stdout + p.stderr)


if __name__ == "__main__":
    unittest.main()
