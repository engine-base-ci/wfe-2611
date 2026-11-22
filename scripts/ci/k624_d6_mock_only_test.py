#!/usr/bin/env python3
"""K-624 の試験：spec-sync の D6（モック ↔ 画面）が、キャンバスの絵が無く「本番と同じ部品で作った開発用のモック」を正にした画面
（04_design/canvas-screens.json の mock_only・理由つき）を「作っている画面」に数える。

  python3 scripts/ci/k624_d6_mock_only_test.py      行 ID は K624-D6-NNN（11_tickets/K-624.md の行の表と 1 対 1）

決まり（scripts/spec-sync/tier_d.py）：
  ・D6 の「作っている画面」＝ キャンバスの絵が在る画面 ＋ mock_only に理由つきで載せた画面。理由が空の mock_only は数えない
  ・mock_only が実在するか・キャンバスの絵と二重でないかは canvas_gate.py（CV4）が持つ。D6 は数えるだけで、検査を緩めない
  ・画面でない物が mock_only に在れば「どの画面でもないモック」で赤（今までと同じ）
  ・段 2 以降は絵ではなく開発用のモックが正になる（D-143・段 2 からモックは本番の部品で作る）ので、画面が増えても D6 が壊れない
作りものの根は tempfile の中に作る。テストはチケットを切る人が書き、実装する人は変えない（D-128.125）
"""
from __future__ import annotations

import json
import pathlib
import shutil
import subprocess
import sys
import tempfile
import unittest

HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parent.parent
TIER_D = ROOT / "scripts" / "spec-sync" / "tier_d.py"
FILES = ("spec-dependencies.yaml", "01_hearing/決定ログ_進行中.md", "05_flow/flow.json", "04_design/canvas-screens.json")
NEW = "zz-new-screen"


def d6_lines(root: pathlib.Path) -> str:
    """tier_d.py --json の failures のうち D6 の行（text 出力は 6 行で打ち切られるので JSON を読む）"""
    r = subprocess.run([sys.executable, str(TIER_D), "--project-root", str(root), "--json"], capture_output=True, text=True, cwd=root)
    return "\n".join(f for f in json.loads(r.stdout)["failures"] if f.startswith("D6"))


class Tree:
    def __init__(self) -> None:
        self.tmp = tempfile.TemporaryDirectory()
        self.dir = pathlib.Path(self.tmp.name)
        for rel in FILES:
            (self.dir / rel).parent.mkdir(parents=True, exist_ok=True)
            shutil.copy(ROOT / rel, self.dir / rel)

    def edit(self, rel: str, fn) -> None:
        p = self.dir / rel
        d = json.loads(p.read_text(encoding="utf-8"))
        fn(d)
        p.write_text(json.dumps(d, ensure_ascii=False, indent=1), encoding="utf-8")

    def add_screen(self) -> None:
        self.edit("05_flow/flow.json", lambda d: d["screens"].append(
            {"id": NEW, "name": "試し", "release": "v1", "acts": [], "purpose": "試しの画面。作りものの根にだけ在る"}))

    def mock_only(self, reason: str) -> None:
        self.edit("04_design/canvas-screens.json", lambda d: d["mock_only"].__setitem__(NEW, reason))

    def d6(self) -> str:
        return d6_lines(self.dir)


class D6Test(unittest.TestCase):
    def tree(self) -> Tree:
        t = Tree()
        self.addCleanup(t.tmp.cleanup)
        return t

    def test_K624_D6_001_real_tree_counts_the_mock_only_screen_as_made(self) -> None:
        out = d6_lines(ROOT)
        self.assertEqual(out, "", out)
        self.assertIn("help", json.loads((ROOT / "04_design/canvas-screens.json").read_text(encoding="utf-8"))["mock_only"])

    def test_K624_D6_002_a_screen_with_neither_drawing_nor_mock_only_is_red(self) -> None:
        t = self.tree()
        t.add_screen()
        out = t.d6()
        self.assertIn("D6 作っていない画面", out)
        self.assertIn(NEW, out)
        self.assertNotIn("help", out)  # mock_only の help は数えられている

    def test_K624_D6_003_the_same_screen_with_a_reasoned_mock_only_is_green(self) -> None:
        t = self.tree()
        t.add_screen()
        t.mock_only("キャンバスに無い段の画面。正は本番と同じ部品のモック /dev/mock/zz-new（試し）")
        out = t.d6()
        self.assertNotIn("D6 作っていない画面", out)
        self.assertNotIn("D6 どの画面でもないモック", out)

    def test_K624_D6_004_a_mock_only_without_a_reason_is_not_counted(self) -> None:
        t = self.tree()
        t.add_screen()
        for blank in ("", "   "):
            t.mock_only(blank)
            out = t.d6()
            self.assertIn("D6 作っていない画面", out, f"理由 {blank!r} が数えられた")
            self.assertIn(NEW, out)

    def test_K624_D6_005_a_mock_only_that_is_not_a_screen_is_red(self) -> None:
        t = self.tree()
        t.mock_only("flow.json に無い画面の名前。理由はあるが画面ではない")  # 画面 NEW は flow.json に足さない
        out = t.d6()
        self.assertIn("D6 どの画面でもないモック", out)
        self.assertIn(NEW, out)

    def test_K624_D6_006_screens_with_drawings_are_still_checked_both_ways(self) -> None:
        # 絵の側の双方向は今のまま：絵の対応表から画面を 1 つ外すと、その画面が「作っていない」で赤
        t = self.tree()

        def drop(d: dict) -> None:
            first = next(k for k, v in d["screens"].items() if v)
            d["screens"][first] = []
            t.dropped = first  # type: ignore[attr-defined]
        t.edit("04_design/canvas-screens.json", drop)
        out = t.d6()
        self.assertIn("D6 作っていない画面", out)
        self.assertIn(t.dropped, out)  # type: ignore[attr-defined]

    def test_K624_D6_007_g65_place_holds_this_test_exactly_once(self) -> None:
        hits = [p.name for p in (ROOT / "scripts/ci/g65.d").glob("*.txt")
                if "k624_d6_mock_only_test.py" in p.read_text(encoding="utf-8")]
        self.assertEqual(hits, ["K-624.txt"])


if __name__ == "__main__":
    unittest.main()
