#!/usr/bin/env python3
"""K-300 の試験：部品先行のモックのチケットは「正」を mock:（モックの状態の id）で書く。canvas_field_gate がそれを読む。
あわせて、手で持つ 07_functional/段2-F1 を生成物の置き場から外したこと（generated.json・ticket-flow.yaml）を見る。

  python3 scripts/ci/k300_mock_field_test.py      行 ID は K300-CF-NNN・K300-GN-NNN（11_tickets/K-300.md の行の表と 1 対 1）

mock: の決まり：
  ・mock: [<状態の id>, …]（並びの形）が 1 つ以上。canvas・canvas_none と混ぜない（どちらか 1 つ）
  ・id は apps/web/app/(dev)/dev/mock/<置き場>/mocks.tsx の `export const MOCKS` の並びの中の状態（{ id: "…", …, ticket: "K-…" }・折った行も読む）に在る。
    並びの外の id（見本の値の pk1 など）は状態ではない。mock: を持つチケットがあるのに置き場のファイルが 1 つも無い・読めないなら赤（無ければ読まない）
  ・状態の ticket は K-<数> の形
  ・状態の ticket がこのチケット。ただし、その状態の置き場（apps/web/app/(dev)/dev/mock/<置き場>/）を changes に持つチケット（運ぶチケット）は、ほかの持ち主の状態も書ける（別の置き場・画面のコードだけでは運ぶチケットにならない）
  ・逆向き：状態の ticket が 11_tickets に在り取り込み済みでないなら、その mock: に状態の id が在る（mock: が無いのも赤。11_tickets にまだ無い持ち主は見ない・切る段の枝に在る）
  ・台帳に載ったチケットが mock: を書いたら赤（台帳から消す）
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
        # 本物と同じく、MOCKS の外に ticket の無い id（折った形の pk1・1 行の pk2）を置く
        sample = ('const PASSKEY_USER = {\n  passkeys: [\n    {\n      id: "pk1",\n      name: "MacBook",\n    },\n'
                  '    { id: "pk2", name: "iPhone" },\n  ],\n};\n')
        self.write(MOCK_REL, '"use client";\n' + sample + "export const MOCKS: readonly MockEntry[] = [\n" + body + "];\n")

    def ticket(self, tid: str, mock: str | None = "[m1, m2]", stage: str = "未着手", **head: str) -> None:
        fields = {"id": tid, "stage": stage, "screens": "[login]", "area": "画面", **head}
        text = "---\n" + "".join(f"{k}: {v}\n" for k, v in fields.items() if v is not None)
        text += (f"mock: {mock}\n" if mock is not None else "") + "---\n\n## 目的\n\n試し\n"
        self.write(f"11_tickets/{tid}.md", text)

    def ledger(self, tickets: list[str]) -> None:
        self.write("scripts/ci/canvas_field_ledger.json", json.dumps(
            {"_doc": "試し", "entries": [{"ticket": t, "reason": "前からあるチケット"} for t in tickets]}, ensure_ascii=False))

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

    def test_K300_CF_012_mock_file_missing(self) -> None:
        """K300-CF-012 mock: を持つチケットがあるのに置き場の mocks.tsx が無ければ赤（道を名指し）。mock: を持つチケットが無ければ読まずに緑"""
        (self.f.root / MOCK_REL).unlink()
        self.f.ticket("K-9", mock=None, canvas="[]", canvas_none="見た目を変えない")
        self.f.write("11_tickets/K-9.md", "---\nid: K-9\nstage: 未着手\nscreens: []\narea: 口\n---\n\n試し\n")
        self.green()
        self.f.ticket("K-8", mock="[m3]")
        self.red("apps/web/app/(dev)/dev/mock/*/mocks.tsx")

    def test_K300_CF_013_ids_outside_mocks_not_states(self) -> None:
        """K300-CF-013 MOCKS の並びの外の id（見本の pk1・pk2）は状態ではない：mock: [pk1] は赤。外の折った { が並びの最初の状態を飲み込まない"""
        self.f.ticket("K-9")
        self.f.ticket("K-8", mock="[m3]")
        self.green()
        self.f.ticket("K-8", mock="[m3, pk1]")
        self.red("K-8：mock の状態 pk1 が")

    def test_K300_CF_014_carrier_is_strict(self) -> None:
        """K300-CF-014 運ぶチケットは、その状態の置き場（mock/f1/）を changes に持つものだけ：別の置き場（mock/f2/）や画面のコードだけを持つチケットがほかの持ち主の状態を書けば赤"""
        self.f.ticket("K-9")
        self.f.ticket("K-8", mock="[m3]")
        self.f.ticket("K-7", mock="[m3]", changes="[apps/web/components/k/x.tsx, apps/web/app/(dev)/dev/mock/f2/]")
        self.red("K-7：mock の状態 m3 の持ち主は K-8")

    def test_K300_CF_015_no_mixing_with_canvas(self) -> None:
        """K300-CF-015 mock: と canvas（canvas_none も）を同じチケットに混ぜれば赤（どちらか 1 つ）"""
        self.f.ticket("K-9", canvas="[]", canvas_none="見た目を変えない")
        self.f.ticket("K-8", mock="[m3]")
        self.red("K-9：mock と canvas を混ぜている")

    def test_K300_CF_016_owner_without_mock_red(self) -> None:
        """K300-CF-016 逆向き：状態の持ち主が 11_tickets に在り取り込み済みでないのに mock: が無い（canvas_none にした）なら赤"""
        self.f.ticket("K-9")
        self.f.write("11_tickets/K-8.md", "---\nid: K-8\nstage: 未着手\nscreens: []\narea: 口\ncanvas: []\ncanvas_none: 見た目を変えない\n---\n\n試し\n")
        self.red("状態 m3 の持ち主 K-8 に mock が無い")

    def test_K300_CF_017_ledgered_with_mock_red(self) -> None:
        """K300-CF-017 台帳に載ったチケットが mock: を書いたら赤（台帳から消す）"""
        self.f.ticket("K-9")
        self.f.ticket("K-8", mock="[m3]")
        self.f.ledger(["K-8"])
        self.red("台帳の K-8 は mock を書いた")

    def test_K300_CF_018_mock_not_list_red(self) -> None:
        """K300-CF-018 mock: が並びの形でない（mock: m3）なら赤"""
        self.f.ticket("K-9")
        self.f.ticket("K-8", mock="m3")
        self.red("K-8：mock は [<状態の id>, …] の形で書く")

    def test_K300_CF_019_owner_text_checked(self) -> None:
        """K300-CF-019 mocks.tsx の状態の ticket が K-<数> の形でなければ赤（打ち間違いを、持ち主が無いとして黙って通さない）"""
        self.f.mocks([("m1", "K-9"), ("m2", "K-9"), ("m3", "K8")])
        self.f.ticket("K-9")
        self.red("状態 m3 の持ち主の字 K8 が K-<数> の形でない")


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
        作り手 build_functional.py の 7 つの生成物は outputs・dated・changes_ignore のどれにも在る"""
        gen = json.loads((ROOT / "scripts/ci/generated.json").read_text(encoding="utf-8"))
        globs = [g for gn in gen["generators"] for g in gn.get("outputs", []) + gn.get("dated", [])]
        ignore = yaml.safe_load((ROOT / "ticket-flow.yaml").read_text(encoding="utf-8"))["changes_ignore"]
        for f in STAGE2:
            self.assertTrue((ROOT / f).is_file(), f)
            self.assertEqual([g for g in globs if fnmatch.fnmatch(f, g)], [], f)
            self.assertEqual([g for g in ignore if fnmatch.fnmatch(f, g)], [], f)
        built = ["entities.json", "features.json", "roles.json", "screens.json", "traceability-matrix.json",
                 "functional-breakdown.md", "functional-breakdown.html"]
        bf = next(gn for gn in gen["generators"] if gn["run"] == "python3 05_flow/build_functional.py")
        for b in built:
            p = f"07_functional/{b}"
            self.assertTrue(any(fnmatch.fnmatch(p, g) for g in bf["outputs"]), p)
            self.assertTrue(any(fnmatch.fnmatch(p, g) for g in bf["dated"]), p)
            self.assertTrue(any(fnmatch.fnmatch(p, g) for g in ignore), p)


if __name__ == "__main__":
    unittest.main(verbosity=2)
