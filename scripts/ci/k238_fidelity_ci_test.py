#!/usr/bin/env python3
"""K-238 の試験（突き合わせの CI へのつなぎ）：入っていない組の数を毎回出し、持ち主のチケットが取り込み済みなのに入っていない組を赤にする。
CI の spec の組（G69）と web の組（G70）で流れ、比べ方を変えた回も web の組が動く。

  python3 scripts/ci/k238_fidelity_ci_test.py      行 ID は K238-VF-NNN（11_tickets/K-238.md の行の表と 1 対 1）

検査：python3 scripts/ci/fidelity_config.py --owners-done
  ・設定 04_design/fidelity.json の組のうち enrolled でない組の数を「入っていない組 N / M」で出す
  ・組の持ち主のチケット（11_tickets/<owner>.md）の stage が「確認中」か「完了」（＝取り込み済み）なのに enrolled でない組があれば 1（組の id と持ち主を出す）
作りものの設定は tempfile の中に作る。
"""
from __future__ import annotations

import json
import os
import pathlib
import shutil
import subprocess
import sys
import tempfile
import unittest

import yaml

HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parent.parent
GATE = HERE / "fidelity_config.py"
SPEC = ROOT / "apps" / "web" / "tests" / "fidelity" / "fidelity.spec.ts"
STATES = ROOT / "apps" / "web" / "tests" / "_lib" / "fidelity-states.ts"
WORKFLOW = ROOT / ".github" / "workflows" / "v3-gate.yml"
SCOPE = ROOT / "scripts" / "ci" / "ci_scope.json"


def clean_env() -> dict[str, str]:
    return {k: v for k, v in os.environ.items() if not k.startswith("GIT_")}


class Fake:
    def __init__(self) -> None:
        self.root = pathlib.Path(tempfile.mkdtemp(prefix="k238-"))

    def write(self, rel: str, text: str) -> None:
        p = self.root / rel
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(text, encoding="utf-8")

    def ticket(self, tid: str, stage: str) -> None:
        self.write(f"11_tickets/{tid}.md", f"---\nid: {tid}\nstage: {stage}\n---\n")

    def config(self, groups: list[tuple[str, str, bool]]) -> None:
        self.write("04_design/fidelity.json", json.dumps(
            {"_doc": "試し", "groups": [{"id": g, "owner": o, "enrolled": e} for g, o, e in groups]}, ensure_ascii=False))

    def run(self) -> subprocess.CompletedProcess:
        return subprocess.run([sys.executable, str(GATE), "--root", str(self.root), "--owners-done"],
                              capture_output=True, text=True, env=clean_env(), cwd=self.root)

    def close(self) -> None:
        shutil.rmtree(self.root, ignore_errors=True)


class OwnersDoneTest(unittest.TestCase):
    def setUp(self) -> None:
        self.f = Fake()

    def tearDown(self) -> None:
        self.f.close()

    def test_K238_VF_004_counts_not_enrolled(self) -> None:
        """K238-VF-004 持ち主が着手前・作業中なら、入っていない組があっても 0 で終わり、「入っていない組 2 / 3」を出す"""
        self.f.ticket("K-1", "未着手")
        self.f.ticket("K-2", "作業中")
        self.f.config([("a", "K-1", False), ("b", "K-2", False), ("c", "K-1", True)])
        r = self.f.run()
        self.assertEqual(r.returncode, 0, r.stdout)
        self.assertIn("入っていない組 2 / 3", r.stdout)

    def test_K238_VF_005_owner_done_but_not_enrolled_is_red(self) -> None:
        """K238-VF-005 持ち主が確認中・完了（取り込み済み）なのに enrolled でない組があれば 1 で、組の id と持ち主を出す"""
        for stage in ("確認中", "完了"):
            self.f.ticket("K-3", stage)
            self.f.config([("d", "K-3", False)])
            r = self.f.run()
            self.assertEqual(r.returncode, 1, stage)
            self.assertIn("d", r.stdout)
            self.assertIn("K-3", r.stdout)
        self.f.config([("d", "K-3", True)])
        self.assertEqual(self.f.run().returncode, 0)

    def test_K238_VF_006_missing_owner_ticket_is_red(self) -> None:
        """K238-VF-006 組の持ち主のチケットのファイルが無ければ 1（数えずに緑にしない）"""
        self.f.config([("e", "K-404", False)])
        self.assertEqual(self.f.run().returncode, 1)

    def test_K238_VF_007_real_tree(self) -> None:
        """K238-VF-007 本物の木で 0 で終わり、入っていない組の数を出す"""
        r = subprocess.run([sys.executable, str(GATE), "--owners-done"], cwd=ROOT, capture_output=True, text=True, env=clean_env())
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
        self.assertRegex(r.stdout, r"入っていない組 \d+ / \d+")


class RunnerTest(unittest.TestCase):
    def test_K238_VF_008_runner_has_no_fixed_wait(self) -> None:
        """K238-VF-008 実ブラウザの突き合わせと画面を整える道具に、決めた秒数の待ち（waitForTimeout）が無い"""
        for p in (SPEC, STATES):
            self.assertNotIn("waitForTimeout", p.read_text(encoding="utf-8"), p)

    def test_K238_VF_009_states_route_fonts(self) -> None:
        """K238-VF-009 画面を整える道具が、キャンバスの外の書体の道（fonts.googleapis.com・fonts.gstatic.com）を手元の書体（@fontsource-variable/noto-sans-jp）に差し替える routeCanvasFonts を出す"""
        s = STATES.read_text(encoding="utf-8")
        self.assertIn("export async function routeCanvasFonts", s)
        for word in ("fonts.googleapis.com", "fonts.gstatic.com", "@fontsource-variable/noto-sans-jp"):
            self.assertIn(word, s)


class WiringTest(unittest.TestCase):
    def test_K238_VF_010_runs_in_ci(self) -> None:
        """K238-VF-010 spec の組に G69（設定の検査・入っていない組・K-216 と K-238 の試験）、web の組に G70（実ブラウザの突き合わせ）が 1 つずつ在り、continue-on-error が無い"""
        wf = yaml.safe_load(WORKFLOW.read_text(encoding="utf-8"))
        g69 = [s for s in wf["jobs"]["spec"]["steps"] if str(s.get("name", "")).startswith("G69 ")]
        g70 = [s for s in wf["jobs"]["web"]["steps"] if str(s.get("name", "")).startswith("G70 ")]
        self.assertEqual((len(g69), len(g70)), (1, 1))
        for want in ("python3 scripts/ci/fidelity_config.py --base-ref", "python3 scripts/ci/fidelity_config.py --owners-done",
                     "python3 scripts/ci/k216_fidelity_config_test.py", "node --test scripts/ci/k216_fidelity_compare.test.mjs",
                     "python3 scripts/ci/k238_fidelity_ci_test.py"):
            self.assertIn(want, g69[0]["run"])
        self.assertIn("tests/fidelity/fidelity.spec.ts", g70[0]["run"])
        for s in (g69[0], g70[0]):
            self.assertNotIn("continue-on-error", s)

    def test_K238_VF_011_web_job_wakes_on_compare_changes(self) -> None:
        """K238-VF-011 比べ方（scripts/ci/fidelity_compare.mjs・visual_fidelity.mjs）を変えた回も web の組が動く（ci_scope.json の jobs.web.paths に在る。04_design/** は前から在る）"""
        paths = json.loads(SCOPE.read_text(encoding="utf-8"))["jobs"]["web"]["paths"]
        for p in ("scripts/ci/fidelity_compare.mjs", "scripts/ci/visual_fidelity.mjs", "04_design/**"):
            self.assertIn(p, paths)


if __name__ == "__main__":
    unittest.main(verbosity=2)
