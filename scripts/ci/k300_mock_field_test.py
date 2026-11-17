#!/usr/bin/env python3
"""K-300 の試験：部品先行のモックのチケットは「正」を mock:（モックの状態の id）で書く。canvas_field_gate がそれを読む。
あわせて、手で持つ 07_functional/段2-F1 を生成物の置き場から外したこと（generated.json・ticket-flow.yaml）を見る。

  python3 scripts/ci/k300_mock_field_test.py      行 ID は K300-CF-NNN・K300-GN-NNN（11_tickets/K-300.md の行の表と 1 対 1）

mock: の決まり（canvas が無いチケット）：
  ・mock: [<状態の id>, …] が 1 つ以上。id は apps/web/app/(dev)/dev/mock/<置き場>/mocks.tsx の状態（{ id: "…", …, ticket: "K-…" }・折った行も読む）に在る
  ・状態の ticket がこのチケット。ただし、その置き場（apps/web/app/(dev)/dev/mock/<置き場>/）を changes に持つチケット（運ぶチケット）は、ほかの持ち主の状態も書ける
  ・逆向き：状態の ticket が 11_tickets に在り、取り込み済みでなく mock: を持つなら、その mock: に状態の id が在る（11_tickets にまだ無い持ち主は見ない・切る段の枝に在る）
作りもののチケットは tempfile の中に作る。
"""
from __future__ import annotations

import fnmatch
import json
import pathlib
import shutil
import subprocess
import sys
import tempfile
import unittest

import yaml

HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parent.parent
GATE = HERE / "canvas_field_gate.py"
WORKFLOW = ROOT / ".github" / "workflows" / "v3-gate.yml"
MOCK_REL = "apps/web/app/(dev)/dev/mock/f1/mocks.tsx"
STAGE2 = ["07_functional/段2-F1/mock-shots.mjs", "07_functional/段2-F1/切り方.md", "07_functional/段2-F1/機能分解.md"]


def entry(mid: str, owner: str, folded: bool = False) -> str:
    if folded:
        return f'  {{\n    id: "{mid}",\n    screen: "login",\n    label: "折った行",\n    ticket: "{owner}",\n  }},\n'
    return f'  {{ id: "{mid}", screen: "login", label: "試し", ticket: "{owner}" }},\n'


class Fake:
    def __init__(self) -> None:
        self.root = pathlib.Path(tempfile.mkdtemp(prefix="k300-"))
        self.write("04_design/fidelity.json", json.dumps({"_doc": "試し", "groups": []}))
        self.write("scripts/ci/canvas_field_ledger.json", json.dumps({"_doc": "試し", "entries": []}))
        self.mocks([("m1", "K-9"), ("m2", "K-9"), ("m3", "K-8")])

    def write(self, rel: str, text: str) -> None:
        p = self.root / rel
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(text, encoding="utf-8")

    def mocks(self, states: list[tuple[str, str]], folded: set[str] = frozenset()) -> None:
        body = "".join(entry(m, o, m in folded) for m, o in states)
        self.write(MOCK_REL, '"use client";\nexport const MOCKS: readonly MockEntry[] = [\n' + body + "];\n")

    def ticket(self, tid: str, mock: str | None = "[m1, m2]", stage: str = "未着手", **head: str) -> None:
        fields = {"id": tid, "stage": stage, "screens": "[login]", "area": "画面", **head}
        text = "---\n" + "".join(f"{k}: {v}\n" for k, v in fields.items() if v is not None)
        text += (f"mock: {mock}\n" if mock is not None else "") + "---\n\n## 目的\n\n試し\n"
        self.write(f"11_tickets/{tid}.md", text)

    def run(self) -> subprocess.CompletedProcess:
        return subprocess.run([sys.executable, str(GATE), "--root", str(self.root), "--no-base"],
                              capture_output=True, text=True, cwd=self.root)

    def close(self) -> None:
        shutil.rmtree(self.root, ignore_errors=True)


class MockField(unittest.TestCase):
    def setUp(self) -> None:
        self.f = Fake()

    def tearDown(self) -> None:
        self.f.close()

    def red(self, *needles: str) -> None:
        r = self.f.run()
        self.assertEqual(r.returncode, 1, r.stdout + r.stderr)
        self.assertNotIn("Traceback", r.stderr, r.stderr)
        for n in needles:
            self.assertIn(n, r.stdout, (n, r.stdout))

    def green(self) -> None:
        r = self.f.run()
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)

    def test_K300_CF_001_own_states_green(self) -> None:
        """K300-CF-001 canvas の無い画面のチケットが mock: に自分の状態を全部書けば緑（canvas が無いという赤にならない）"""
        self.f.ticket("K-9")
        self.f.ticket("K-8", mock="[m3]")
        self.green()

    def test_K300_CF_002_unknown_state_red(self) -> None:
        """K300-CF-002 mock: の id がモックの置き場の状態に無ければ赤（id を名指しする）"""
        self.f.ticket("K-9", mock="[m1, m2, nope]")
        self.f.ticket("K-8", mock="[m3]")
        self.red("K-9：mock の状態 nope が")

    def test_K300_CF_003_others_state_red(self) -> None:
        """K300-CF-003 運ぶチケットでないのに、ほかの持ち主の状態を mock: に書けば赤（持ち主を出す）"""
        self.f.ticket("K-9", mock="[m1, m2, m3]")
        self.f.ticket("K-8", mock="[m3]")
        self.red("K-9：mock の状態 m3 の持ち主は K-8")

    def test_K300_CF_004_carrier_may_list_all(self) -> None:
        """K300-CF-004 置き場（apps/web/app/(dev)/dev/mock/f1/）を changes に持つ運ぶチケットは、ほかの持ち主の状態も書けて緑"""
        self.f.ticket("K-9")
        self.f.ticket("K-8", mock="[m3]")
        self.f.ticket("K-7", mock="[m1, m2, m3]", changes="[apps/web/components/k/x.tsx, apps/web/app/(dev)/dev/mock/f1/]")
        self.green()

    def test_K300_CF_005_empty_mock_red(self) -> None:
        """K300-CF-005 mock: が空なら赤（正の欄を空で通さない）"""
        self.f.ticket("K-9", mock="[]")
        self.f.ticket("K-8", mock="[m3]")
        self.red("K-9：mock が空")

    def test_K300_CF_006_owner_missing_id_red(self) -> None:
        """K300-CF-006 逆向き：状態の持ち主が 11_tickets に在り mock: を持つのに、その状態の id が無ければ赤"""
        self.f.ticket("K-9", mock="[m1]")
        self.f.ticket("K-8", mock="[m3]")
        self.red("状態 m2 の持ち主 K-9 の mock に m2 が無い")

    def test_K300_CF_007_absent_or_merged_owner_not_checked(self) -> None:
        """K300-CF-007 逆向きは、11_tickets にまだ無い持ち主と取り込み済みの持ち主を見ない（緑）"""
        self.f.mocks([("m1", "K-9"), ("m2", "K-9"), ("m3", "K-8"), ("m4", "K-6")])
        self.f.ticket("K-9")
        self.f.ticket("K-8", mock="[m1]", stage="完了")
        self.green()

    def test_K300_CF_008_folded_entry_read(self) -> None:
        """K300-CF-008 複数の行に折った状態（{ の後で改行）も状態として読む：折った m2 を書けば緑・書かなければ逆向きで赤"""
        self.f.mocks([("m1", "K-9"), ("m2", "K-9"), ("m3", "K-8")], folded={"m2"})
        self.f.ticket("K-9")
        self.f.ticket("K-8", mock="[m3]")
        self.green()
        self.f.ticket("K-9", mock="[m1]")
        self.red("状態 m2 の持ち主 K-9 の mock に m2 が無い")

    def test_K300_CF_009_no_canvas_no_mock_still_red(self) -> None:
        """K300-CF-009 canvas も mock も無い画面のチケットは、これまでどおり赤"""
        self.f.ticket("K-9")
        self.f.ticket("K-8", mock=None)
        self.red("K-8：画面を作る・変えるチケットなのに canvas（正の組の id）が無い")


class RealTree(unittest.TestCase):
    def test_K300_CF_010_real_tree_green(self) -> None:
        """K300-CF-010 本物の木で canvas_field_gate（--no-base）が 0 で終わる（K-300 は mock: で通る）"""
        r = subprocess.run([sys.executable, str(GATE), "--root", str(ROOT), "--no-base"], capture_output=True, text=True, cwd=ROOT)
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)

    def test_K300_CF_011_wired(self) -> None:
        """K300-CF-011 CI の配線：v3-gate.yml の G68 の段がこの試験を流す"""
        wf = yaml.safe_load(WORKFLOW.read_text(encoding="utf-8"))
        runs = [s.get("run", "") for job in wf["jobs"].values() for s in job.get("steps", []) if "G68" in str(s.get("name", ""))]
        self.assertEqual(len(runs), 1, runs)
        self.assertIn("python3 scripts/ci/k300_mock_field_test.py", runs[0])

    def test_K300_GN_001_stage2_not_generated(self) -> None:
        """K300-GN-001 07_functional/段2-F1 の手で持つ 3 ファイルは、generated.json のどの作り手の outputs・dated にも、ticket-flow.yaml の changes_ignore にも当たらない。
        作り手 build_functional.py の 7 つの生成物は outputs と changes_ignore の両方に在る"""
        gen = json.loads((ROOT / "scripts/ci/generated.json").read_text(encoding="utf-8"))
        globs = [g for gn in gen["generators"] for g in gn.get("outputs", []) + gn.get("dated", [])]
        ignore = yaml.safe_load((ROOT / "ticket-flow.yaml").read_text(encoding="utf-8"))["changes_ignore"]
        for f in STAGE2:
            self.assertTrue((ROOT / f).is_file(), f)
            self.assertEqual([g for g in globs if fnmatch.fnmatch(f, g)], [], f)
            self.assertEqual([g for g in ignore if fnmatch.fnmatch(f, g)], [], f)
        built = ["entities.json", "features.json", "roles.json", "screens.json", "traceability-matrix.json",
                 "functional-breakdown.md", "functional-breakdown.html"]
        outs = next(gn["outputs"] for gn in gen["generators"] if gn["run"] == "python3 05_flow/build_functional.py")
        for b in built:
            p = f"07_functional/{b}"
            self.assertTrue(any(fnmatch.fnmatch(p, g) for g in outs), p)
            self.assertTrue(any(fnmatch.fnmatch(p, g) for g in ignore), p)


if __name__ == "__main__":
    unittest.main(verbosity=2)
