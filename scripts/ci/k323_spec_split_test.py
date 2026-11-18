#!/usr/bin/env python3
"""K-323 の試験：CI の spec の組（チケットの CI でいちばん遅い組）を 3 つの組に分けて同時に流し、流す検査の段は 1 つも減らさない・変えない。

  python3 scripts/ci/k323_spec_split_test.py      全部の行（行 ID は K323-CI-NNN。11_tickets/K-323.md の行の表と 1 対 1）

見る物：作り手（05_flow/build_testplan.py）が作った CI の定義（.github/workflows/v3-gate.yml）・試験計画（07_qa/test-plan/test-plan.json）・
根の ticket-flow.yaml（手元の速い検査 preflight_jobs）。
「前と同じ段が全部流れる」は、分ける前の spec の組の段の番号（下の BEFORE）を凍らせて持ち、分けた後の組の段の和と比べる。
段の命令は試験計画の gates（作り手の 1 か所の正本）と 1 文字ずつ比べ、段の if は分ける前の形（重い検査だけ範囲の条件）のままかを見る。
"""
from __future__ import annotations

import json
import pathlib
import re
import unittest

import yaml

HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parent.parent
WF_PATH = ROOT / ".github" / "workflows" / "v3-gate.yml"
PLAN_PATH = ROOT / "07_qa" / "test-plan" / "test-plan.json"
BUILDER = ROOT / "05_flow" / "build_testplan.py"
FLOW_CFG = ROOT / "ticket-flow.yaml"
ME = "python3 scripts/ci/k323_spec_split_test.py"

WF_TEXT = WF_PATH.read_text(encoding="utf-8")
WF = yaml.safe_load(WF_TEXT)
JOBS = WF["jobs"]
PLAN = json.loads(PLAN_PATH.read_text(encoding="utf-8"))
BUILDER_TEXT = BUILDER.read_text(encoding="utf-8")

GROUPS = ["spec", "spec-2", "spec-3"]
# 分ける前（2026-11-18・本線 310daa13）の spec の組の検査の段の番号。分けた後の組の段の和は、これを全部含む（減らさない）
BEFORE = [27, 28, 29, 30, 31, 37, 38, 46, 47, 51, 53, 54, 55, 56, 62, 57, 60, 63, 64, 65, 67, 68, 69, 71, 72, 61]
# 分ける前から「scope=ticket では範囲に入ったときだけ流す」重い検査（K-172）。分けても同じ条件のまま
HEAVY = {27, 38, 47, 56, 57, 62}
# spec の段の実測（秒・2026-11-18 の緑の 3 回 44290743483・44270084957・44268144574 の中央値。.ticket-flow/research/ci-time.md と同じ時期）。
#   載っていない段は 5 秒と見る（実測ではどれも 0〜6 秒）。組の準備（checkout・部品・DB・分かれ目）は 1 組 40 秒
SECONDS = {56: 281, 67: 147, 65: 110, 57: 41, 27: 10}
OTHER_SEC = 5
SETUP_SEC = 40
GATE_NAME = re.compile(r"^G(\d+) ")
PY_STEP = "チケットの Python の試験"


def gate_steps(job: str) -> list[tuple[int, dict]]:
    out = []
    for s in JOBS[job].get("steps", []):
        m = GATE_NAME.match(str(s.get("name", "")))
        if m:
            out.append((int(m.group(1)), s))
    return out


def setup_steps(job: str) -> list[dict]:
    """組の頭の準備の段（検査の段・Python の試験の段より前）"""
    out = []
    for s in JOBS[job].get("steps", []):
        name = str(s.get("name", ""))
        if GATE_NAME.match(name) or name.startswith(PY_STEP):
            break
        out.append(s)
    return out


def spec_jobs() -> list[str]:
    return [j for j in JOBS if j == "spec" or j.startswith("spec-")]


class Groups(unittest.TestCase):
    def test_K323_CI_001_three_spec_groups_after_static_and_not_skipped_by_red_static(self):
        self.assertEqual(spec_jobs(), GROUPS, "spec の組はちょうど spec・spec-2・spec-3 の 3 つ（定義の中の並びもこの順）")
        for j in GROUPS:
            with self.subTest(j):
                job = JOBS[j]
                self.assertEqual(job["runs-on"], ["self-hosted", "linux-vm"])
                self.assertEqual(job.get("needs"), ["static"], "static の後に流す（act・GitHub とも static と並ばない・K-156）")
                cond = str(job.get("if", ""))
                self.assertIn("!cancelled()", cond, "static が赤でも飛ばさない（K-143）")
                self.assertNotIn("needs.static", cond, "static の結果・出力で spec の組を止めない")
                self.assertTrue(gate_steps(j), "検査の段が 1 つも無い組を作らない")


class SameGates(unittest.TestCase):
    def test_K323_CI_002_union_of_groups_equals_before_each_exactly_once(self):
        ids = [g for j in GROUPS for g, _ in gate_steps(j)]
        self.assertEqual(len(ids), len(set(ids)), f"同じ段が 2 つの組で流れている：{sorted(i for i in ids if ids.count(i) > 1)}")
        self.assertTrue(set(BEFORE) <= set(ids), f"分ける前にあった段が消えた：{sorted(set(BEFORE) - set(ids))}")
        plan_spec = sorted(g["id"] for g in PLAN["gates"] if g["job"] in GROUPS)
        self.assertEqual(sorted(ids), plan_spec, "定義の spec の組の段 ＝ 試験計画で spec の組に置いた段（足し引きなし）")
        # spec の組の外（static・database・unit・web など）に、分ける前の spec の段が出ていない
        others = [g for j in JOBS if j not in GROUPS for g, _ in gate_steps(j) if g in BEFORE and j != "static"]
        self.assertEqual(others, [], "spec の段を別の種類の組に移していない")
        py = [(j, s) for j in JOBS for s in JOBS[j].get("steps", []) if str(s.get("name", "")).startswith(PY_STEP)]
        self.assertEqual([j for j, _ in py], ["spec"], "チケットの Python の試験は spec の組で 1 回だけ（二重に数えない）")

    def test_K323_CI_003_each_gate_step_is_unchanged(self):
        by_id = {g["id"]: g for g in PLAN["gates"] if g["job"] in GROUPS}
        for j in GROUPS:
            for gid, s in gate_steps(j):
                with self.subTest(f"{j}/G{gid}"):
                    g = by_id[gid]
                    self.assertEqual(g["job"], j, "試験計画の job は、その段が流れる組の名前")
                    self.assertTrue(str(s["name"]).startswith(f"G{gid} {g['name']}"), "段の名前は前と同じ")
                    self.assertEqual(str(s["run"]).rstrip("\n"), g["script"].rstrip("\n"), "段の命令は前と同じ（1 文字も変えない）")
                    cond = str(s.get("if", ""))
                    if gid in HEAVY:
                        self.assertEqual(cond, f"${{{{ !cancelled() && (steps.scope.outputs.full == 'true' || contains(steps.scope.outputs.gates, ',{gid},')) }}}}",
                                         "重い検査の条件は前と同じ（範囲は自分の組の scope の段から）")
                    else:
                        self.assertEqual(cond, "${{ !cancelled() }}", "前の段が赤でも流す（条件は前と同じ）")
                    self.assertNotIn("continue-on-error", s)


class Values(unittest.TestCase):
    def test_K323_CI_004_every_group_has_same_setup_and_scope_step(self):
        base = setup_steps("spec")
        names = [str(s.get("name") or s.get("uses") or s.get("run")) for s in base]
        self.assertTrue(any(s.get("id") == "scope" for s in base), "spec の組に本線との分かれ目を出す段がある")
        self.assertTrue(any("docker run" in str(s.get("run", "")) for s in base), "spec の組で DB を立てる")
        for j in GROUPS[1:]:
            with self.subTest(j):
                self.assertEqual(setup_steps(j), base, f"{j} の準備の段（checkout・部品・Python・DB・分かれ目）が spec と同じでない：{names}")
                stop = [s for s in JOBS[j]["steps"] if "docker rm -f" in str(s.get("run", ""))]
                self.assertEqual(len(stop), 1, "DB を消す段が 1 つ")
                self.assertEqual(stop[0].get("if"), "always()", "赤でも必ず消す")
                self.assertIs(JOBS[j]["steps"][-1], stop[0], "DB を消す段が最後")

    def test_K323_CI_005_steps_using_scope_outputs_have_scope_in_same_job_before(self):
        for j in GROUPS:
            steps = JOBS[j]["steps"]
            sc = [i for i, s in enumerate(steps) if s.get("id") == "scope"]
            self.assertEqual(len(sc), 1, f"{j} に scope の段がちょうど 1 つ")
            sc_run = steps[sc[0]]["run"]
            self.assertIn('--base "$CI_BASE_INPUT"', sc_run)
            self.assertEqual(steps[sc[0]]["env"], setup_steps("spec")[-1]["env"], "入力の受け方（scope・base・ticket）が spec の組と同じ")
            for i, s in enumerate(steps):
                txt = json.dumps({k: s.get(k) for k in ("if", "env", "run")}, ensure_ascii=False)
                if "steps.scope.outputs" in txt:
                    with self.subTest(f"{j}/{s.get('name')}"):
                        self.assertGreater(i, sc[0], "scope の段の後で読む")
                self.assertNotIn("needs.spec", txt, "組をまたいで spec の出力を読まない（それぞれ自分の scope の段で同じ値を出す）")
        g61 = [s for j in GROUPS for g, s in gate_steps(j) if g == 61]
        self.assertEqual(len(g61), 1)
        self.assertEqual(g61[0]["env"]["CI_LEDGER_BASE"].replace(" ", ""), "${{steps.scope.outputs.base}}", "G61 の比べる元は自分の組の分かれ目")


class JUnitAndWaits(unittest.TestCase):
    def test_K323_CI_006_junit_record_and_waiting_jobs(self):
        up = [s for s in JOBS["spec"]["steps"] if str(s.get("uses", "")).startswith("actions/upload-artifact")
              and str((s.get("with") or {}).get("name", "")) == "junit-spec"]
        self.assertEqual(len(up), 1, "spec の組は今までどおり junit-spec を出す")
        self.assertEqual(up[0]["with"].get("if-no-files-found"), "error")
        self.assertIn("always()", str(up[0].get("if")))
        for j in GROUPS[1:]:
            with self.subTest(j):
                writes_junit = any("junit/" in str(s.get("run", "")) for s in JOBS[j]["steps"])
                ups = [s for s in JOBS[j]["steps"] if str(s.get("uses", "")).startswith("actions/upload-artifact")]
                if writes_junit:
                    self.assertEqual([str(s["with"]["name"]) for s in ups], [f"junit-{j}"], "JUnit を書く組は junit-<組> を出す")
                    self.assertEqual(ups[0]["with"].get("if-no-files-found"), "error")
                else:
                    self.assertEqual(ups, [], "JUnit を書かない組は空の記録を上げない（記録が無いと赤になる決まり・K-172）")
        for waiter in ("junit", "task-gate", "auto-merge"):
            with self.subTest(waiter):
                self.assertTrue(set(GROUPS) <= set(JOBS[waiter]["needs"]), f"{waiter} は spec の組を全部待つ")
        self.assertIn("always()", str(JOBS["junit"].get("if")), "spec の組が赤でも JUnit はまとめる")

    def test_K323_CI_007_split_is_balanced_by_measured_time(self):
        loads = {}
        for j in GROUPS:
            loads[j] = SETUP_SEC + sum(SECONDS.get(g, OTHER_SEC) for g, _ in gate_steps(j))
        before = SETUP_SEC + sum(SECONDS.get(g, OTHER_SEC) for g in BEFORE)
        homes = {g: j for j in GROUPS for g, _ in gate_steps(j)}
        self.assertEqual(len({homes[56], homes[67], homes[65]}), 3, f"重い 3 つ（G56・G67・G65）は別々の組：{loads}")
        self.assertEqual([g for g, _ in gate_steps(homes[56])], [56], "いちばん重い G56 は 1 つで 1 組")
        self.assertLessEqual(max(loads.values()), before / 2, f"いちばん長い組が分ける前の半分以下（{loads}・前 {before} 秒）")


class Config(unittest.TestCase):
    def test_K323_CI_008_preflight_jobs_follow_groups(self):
        cfg = yaml.safe_load(FLOW_CFG.read_text(encoding="utf-8"))
        jobs = list(cfg.get("preflight_jobs") or [])
        self.assertEqual(jobs, ["static", *GROUPS], "手元の速い検査は static と spec の組を全部、定義の順で流す（spec だけでは G56・G67 が漏れる）")
        for j in jobs:
            self.assertIn(j, JOBS, f"preflight_jobs の {j} が定義に無い")

    def test_K323_CI_009_builder_owns_groups_and_header_says_so(self):
        self.assertTrue(WF_TEXT.startswith("# .github/workflows/v3-gate.yml"), "定義は作り手の生成物のまま")
        self.assertIn("SPEC_GROUP", BUILDER_TEXT, "組の割り当ては作り手の 1 か所（SPEC_GROUP）に置く")
        for j in GROUPS[1:]:
            self.assertIn(f'"{j}"', BUILDER_TEXT)
        head = WF_TEXT.split("name: v3-gate", 1)[0]
        self.assertIn("spec-2", head, "定義の頭の段の説明に分けた組を書く")
        self.assertIn("spec-3", head)

    def test_K323_CI_010_this_test_runs_in_g65(self):
        g65 = [s for g, s in gate_steps("spec") if g == 65]
        self.assertEqual(len(g65), 1)
        self.assertIn(ME, str(g65[0]["run"]), "G65 がこの試験を流す")
        self.assertTrue(str(g65[0]["run"]).endswith("&& python3 scripts/ci/k248_scope_reach_test.py"), "G65 の並びの最後は k248 の試験のまま（K248-G57-016）")


if __name__ == "__main__":
    unittest.main(verbosity=2)
