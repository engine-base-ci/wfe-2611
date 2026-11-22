#!/usr/bin/env python3
"""K-623 の試験：決定ログの D-129〜D-148 の確定済みの決定を、spec-dependencies.yaml の alignment_decisions に
本当に確かめられる線つきで登録する（spec-sync の D0・D8 が緑になる）。

  python3 scripts/ci/k623_decisions_registered_test.py      行 ID は K623-REG-NNN（11_tickets/K-623.md の行の表と 1 対 1）

決まり：
  ・件数は正本が決める：決定ログで status: confirmed かつ reflect_in を持つ D-129〜D-148 の決定は全部登録する（人が件数を決めない。D-148 より後は、決定を足す枝が自分で登録する）
  ・線の file は実在するファイル（フォルダ名だけ・節の名前だけを書かない。書くと「1 件も無い」で空回りする）
  ・画面の決定でないもの（D-133 の CI の範囲）は not_applicable に理由を書く。画面の線が要るもの（D-145・D-147）は gate を持つ
  ・D-147 の gate は、作った小さな絵の木で（上の帯を持つ絵だけ＝緑・持たない絵が混じる＝赤）確かめる。本物の木全体で tier_d が緑かは、K-629 の完了の条件が見る（G65 に『今の全体』を見る行を入れない・PM の決め 2026-11-21）
テストはチケットを切る人が書き、実装する人は変えない（D-128.125）
"""
from __future__ import annotations

import glob
import json
import os
import pathlib
import re
import shutil
import subprocess
import sys
import tempfile
import unittest

import yaml

HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parent.parent
LOG = ROOT / "01_hearing" / "決定ログ_進行中.md"
MAP = ROOT / "spec-dependencies.yaml"
TIER_D = ROOT / "scripts" / "spec-sync" / "tier_d.py"
FIRST = 129
LAST = 148  # この葉が登録する範囲（D-129〜D-148）。これより後の決定は、それを足す枝が自分で登録する（ここで赤にして他の枝の CI を止めない）


def log_decisions() -> dict[str, dict]:
    """決定ログの決定 ID（D-129 以降）→ {status, reflect_in}"""
    out: dict[str, dict] = {}
    text = LOG.read_text(encoding="utf-8")
    for m in re.finditer(r"<!--\s*decision:\s*(D-(\d+))\s(.*?)-->", text, re.S):
        if not FIRST <= int(m.group(2)) <= LAST:
            continue
        meta = m.group(3)
        r = re.search(r"reflect_in:\s*\[(.*?)\]", meta, re.S)
        out[m.group(1)] = {
            "confirmed": "status: confirmed" in meta,
            "reflect_in": [x.strip() for x in r.group(1).split(",") if x.strip()] if r else [],
        }
    return out


def wanted() -> list[str]:
    return sorted(d for d, v in log_decisions().items() if v["confirmed"] and v["reflect_in"])


def entries() -> list[dict]:
    return yaml.safe_load(MAP.read_text(encoding="utf-8"))["alignment_decisions"]


def entries_of(did: str) -> list[dict]:
    return [e for e in entries() if re.search(rf"\b{re.escape(did)}\b(?![.\d])", str(e.get("source", "")))]


def run_tier_d(root: pathlib.Path) -> list[str]:
    """tier_d.py --json の failures（text 出力は 6 行で打ち切られるので JSON を読む）"""
    r = subprocess.run([sys.executable, str(TIER_D), "--project-root", str(root), "--json"], capture_output=True, text=True, cwd=root)
    return json.loads(r.stdout)["failures"]


class RegisteredTest(unittest.TestCase):
    def test_K623_REG_001_every_confirmed_decision_from_129_is_registered(self) -> None:
        want = wanted()
        self.assertGreaterEqual(len(want), 19)
        missing = [d for d in want if not entries_of(d)]
        self.assertEqual(missing, [], f"alignment_decisions に無い決定: {missing}")

    def test_K623_REG_002_every_line_points_at_a_real_file_with_a_marker(self) -> None:
        bad = []
        for d in wanted():
            for e in entries_of(d):
                for ref in e.get("must_be_reflected_in") or []:
                    if ref.get("todo") or ref.get("not_applicable"):
                        continue
                    f = str(ref.get("file", ""))
                    hits = glob.glob(str(ROOT / f))
                    if not f or not hits or all(os.path.isdir(h) for h in hits):
                        bad.append(f"{e['id']}:{f}")
                    if not (ref.get("marker") or ref.get("gate") or ref.get("trace") or ref.get("command")):
                        bad.append(f"{e['id']}:{f}:確かめ方なし")
        self.assertEqual(bad, [], f"実在しない・フォルダだけ・確かめ方が無い線: {bad}")

    def test_K623_REG_003_requirements_list_is_pointed_at_by_its_real_path(self) -> None:
        refs = [r.get("file") for e in entries_of("D-129") for r in e.get("must_be_reflected_in") or []]
        self.assertIn("01_hearing/要件一覧.md", refs)
        self.assertNotIn("要件一覧", refs)

    def test_K623_REG_004_non_screen_decision_says_why_it_has_no_screen_line(self) -> None:
        lines = [r for e in entries_of("D-133") for r in e.get("must_be_reflected_in") or []]
        reasons = [str(r.get("not_applicable") or "") for r in lines if r.get("not_applicable")]
        self.assertTrue(any(len(x) >= 15 for x in reasons), f"D-133 に画面の線が無い理由が無い: {lines}")

    def test_K623_REG_005_screen_wide_decisions_have_a_real_gate(self) -> None:
        for did in ("D-145", "D-147"):
            gates = [str(r.get("gate")) for e in entries_of(did) for r in e.get("must_be_reflected_in") or [] if r.get("gate")]
            self.assertTrue(gates, f"{did} に gate の線が無い")
            for g in gates:
                for tok in re.findall(r"scripts/[\w./-]+\.py", g):
                    self.assertTrue((ROOT / tok).is_file(), f"{did} の gate が指す {tok} が無い")

    def test_K623_REG_006_the_d147_gate_passes_only_when_every_drawing_has_a_mobile_top_bar(self) -> None:
        # D-147 の gate を、作った小さな絵の木で確かめる（本物の絵の全部を数える確かめは K-629 の完了の条件へ移した）
        gates = [str(r["gate"]) for e in entries_of("D-147") for r in e.get("must_be_reflected_in") or [] if r.get("gate")]
        self.assertTrue(gates and all("kn-mobile-bar" in g and "kn-mbar" in g for g in gates), gates)
        with tempfile.TemporaryDirectory() as d:
            c = pathlib.Path(d) / "04_design" / "canvas"
            c.mkdir(parents=True)
            (c / "A.dc.html").write_text("<style>/* kn-mobile-bar */</style>", encoding="utf-8")
            (c / "B.dc.html").write_text("<div class=\"kn-mbar\"></div>", encoding="utf-8")
            ok = [subprocess.run(g, shell=True, cwd=d, capture_output=True, text=True).returncode for g in gates]
            self.assertEqual(ok, [0] * len(gates), "上の帯を持つ絵だけの木で gate が赤")
            (c / "C.dc.html").write_text("<div>上の帯なし</div>", encoding="utf-8")
            bad = [subprocess.run(g, shell=True, cwd=d, capture_output=True, text=True).returncode for g in gates]
            self.assertTrue(all(x != 0 for x in bad), "上の帯を持たない絵が混じっても gate が緑")

    def test_K623_REG_007_a_new_confirmed_decision_without_registration_turns_d0_red(self) -> None:
        with tempfile.TemporaryDirectory() as d:
            t = pathlib.Path(d)
            for rel in ("spec-dependencies.yaml", "01_hearing/決定ログ_進行中.md", "05_flow/flow.json", "04_design/canvas-screens.json"):
                (t / rel).parent.mkdir(parents=True, exist_ok=True)
                shutil.copy(ROOT / rel, t / rel)
            with open(t / "01_hearing/決定ログ_進行中.md", "a", encoding="utf-8") as f:
                f.write("\n## 999. 試し\n<!-- decision: D-999\n     status: confirmed\n     decided_at: 2026-11-21\n"
                        "     reflect_in: [要件一覧]\n     summary: 登録していない決定 -->\n")
            out = "\n".join(run_tier_d(t))
            self.assertIn("D0 分母が足りない", out)
            self.assertIn("D-999", out)

    def test_K623_REG_008_g65_place_holds_this_test_exactly_once(self) -> None:
        hits = [p.name for p in (ROOT / "scripts/ci/g65.d").glob("*.txt")
                if "k623_decisions_registered_test.py" in p.read_text(encoding="utf-8")]
        self.assertEqual(hits, ["K-623.txt"])


if __name__ == "__main__":
    unittest.main()
