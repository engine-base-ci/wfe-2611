#!/usr/bin/env python3
"""K-847 の試験（決定ログ §154・D-154.1〜90）。行 ID は K847-DC-NNN（11_tickets/K-847.md の表と 1 対 1）。
段 6 の K-780・段 10 の K-673 と同じ形：決定ログの新しい節を、切る段の枝で書いた控え（07_functional/段11-F10/決定ログに足す行.md）から運ぶ。
見ること：§154 の表が D-154.1〜90 を順に 1 行ずつ持つ・代表の決めの行（1〜14 は 2026-11-22・50〜54 は 2026-11-23・85・86・88・90 は 2026-11-24）は 高本さん・answer=<印>・15 は答えの記録の無い代表の言葉・
ほかはどの行も「PM の決め」で高本さん・answer= を持たない・決定の検査（trace_gate の T3・T6・T8）・決める人の決定の行と答えの記録の結びつき
（decision_source_gate）・この葉の decisions の被覆。テストはチケットを作る人が書き、実装する人は変えない"""
from __future__ import annotations

import pathlib
import re
import subprocess
import sys
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[2]
DECISIONS = ROOT / "01_hearing" / "決定ログ_進行中.md"
ANSWERS = ROOT / "01_hearing" / "decider-answers.jsonl"
SOURCE = ROOT / "07_functional" / "段11-F10" / "決定ログに足す行.md"
SELF = ROOT / "11_tickets" / "K-847.md"
COUNT = 90
# 代表の答えが返って「高本さん・answer=」を持つ行：番号 → その行に書く答えの印（2026-11-22 に PM が問い合わせで 1 つずつ聞いた）
REP_ANSWERED: dict[int, list[str]] = {
    1: ["2fe7b9f429d4", "48a7438c1bb5"],
    2: ["2fe7b9f429d4", "48a7438c1bb5"],
    3: ["13c921c87491"],
    4: ["5df03feb42c7", "3781e90d23e0"],
    5: ["de10d532efda"],
    6: ["86d16a86035d", "6ce6241c35c7"],
    7: ["5d79e716ebff"],
    8: ["058e030cc12c"],
    9: ["d9d8fb849dcc"],
    10: ["9d8c9ed75e65", "acb841970bde"],
    11: ["065d1e947e8a"],
    12: ["065d1e947e8a"],
    13: ["6a0bb783426f"],
    14: ["1c791f230f1d"],
    50: ["b74c19059dd7"],
    51: ["b74c19059dd7"],
    52: ["b74c19059dd7"],
    53: ["b74c19059dd7"],
    54: ["b74c19059dd7"],
    85: ["f453553c4502"],
    86: ["cf64e5692521"],
    88: ["f5f9cd840af7"],
    90: ["6aceb0be9656", "d8e07fab492a"],
}
# 代表の言葉（答えの記録が無い行）：番号 → 行に書く字。高本さん・answer= は持たない
REP_WORDS: dict[int, str] = {15: "代表の言葉 2026-11-22 18:58"}
# PM の決めの行が、ほかの段の代表の答えを理由として引いている行：番号 → 引いている印（高本さん・日付は持たない。決める人の決定の行ではない）
CITES: dict[int, str] = {22: "4961f0280e9a"}
# 代表の決めの行に書く日付（番号の範囲ごと）
REP_DATE = lambda n: "2026-11-24" if n >= 85 else ("2026-11-23" if n >= 50 else "2026-11-22")  # noqa: E731
ANSWER = re.compile(r"answer=([0-9a-f]{12})")


def section_rows() -> tuple[dict[str, str], list[str]]:
    text = DECISIONS.read_text(encoding="utf-8")
    m = re.search(r"^## 154\.", text, re.M)
    if not m:
        raise AssertionError("決定ログに §154 が無い")
    rest = text[m.start() + 1 :]
    nxt = re.search(r"^## \d+\.", rest, re.M)
    body = text[m.start() :] if not nxt else text[m.start() : m.start() + 1 + nxt.start()]
    rows: dict[str, str] = {}
    order: list[str] = []
    for ln in body.splitlines():
        r = re.match(r"^\|\s*(D-154\.\d+)\s*\|", ln)
        if r:
            rows.setdefault(r.group(1), ln)
            order.append(r.group(1))
    return rows, order


class DecisionLogTest(unittest.TestCase):
    def test_K847_DC_001_section_rows(self) -> None:
        """§154 の表に D-154.1〜90 が順にちょうど 1 回ずつ（n 行目が D-154.n）在り、代表の決めの行（1〜14 は 2026-11-22・50〜54 は 2026-11-23・85・86・88・90 は 2026-11-24）は 高本さん・answer=<印> を持ち、15 は「代表の言葉 2026-11-22 18:58」、ほかの 66 行は「PM の決め」を持ち高本さん・answer= を持たない（22 だけは、段 12 の代表の答え 4961f0280e9a を理由として引く）。「代表に確認中」の行は無い。決定ログに足す控えと字が同じ"""
        rows, order = section_rows()
        self.assertEqual(order, [f"D-154.{n}" for n in range(1, COUNT + 1)], "表の並び（trace_gate は表の何行目かで番号を数える）")
        bad: list[str] = []
        for n in range(1, COUNT + 1):
            ln = rows[f"D-154.{n}"]
            has_rep = "高本さん" in ln or ANSWER.search(ln) is not None
            if "代表に確認中" in ln:
                bad.append(f"D-154.{n}：「代表に確認中」の行は無い（答えがそろった）")
            if n in REP_ANSWERED:
                miss = [a for a in REP_ANSWERED[n] if f"{a}" not in ln]
                date = REP_DATE(n)
                if "高本さん" not in ln or date not in ln or miss:
                    bad.append(f"D-154.{n}：代表の決め（{date} 高本さん・answer={'・'.join(REP_ANSWERED[n])}）が無い {miss}")
                continue
            if n in REP_WORDS:
                if REP_WORDS[n] not in ln or has_rep or "PM の決め" in ln:
                    bad.append(f"D-154.{n}：「{REP_WORDS[n]}」を持ち、高本さん・answer=・「PM の決め」を持たない形でない")
                continue
            if n in CITES:
                if "PM の決め" not in ln or "高本さん" in ln or CITES[n] not in ln:
                    bad.append(f"D-154.{n}：PM の決めで、理由として引いた答え（{CITES[n]}）を持ち、高本さんを持たない形でない")
                continue
            if "PM の決め" not in ln or has_rep:
                bad.append(f"D-154.{n}：PM の決めを持ち高本さん・answer= を持たない形でない")
        self.assertEqual(bad, [])
        src = SOURCE.read_text(encoding="utf-8")
        for ln in rows.values():
            self.assertIn(ln, src, "控えと字が違う行")

    def test_K847_DC_002_trace_gate(self) -> None:
        """決定の検査（trace_gate：T3 文が在る・T6 reflect_in・T8 文の被覆）が 0 で終わり、D-154 の赤が無い（作る段で tickets.json と要件一覧を作り直してから）"""
        p = subprocess.run([sys.executable, "scripts/ci/trace_gate.py"], cwd=ROOT, capture_output=True, text=True, timeout=300)
        out = p.stdout + p.stderr
        self.assertIsNone(re.search(r"\bT3\b[^\n]*D-154\.\d+|\bT8\b[^\n]*D-154\.\d+", out), out)
        self.assertEqual(p.returncode, 0, out)

    def test_K847_DC_003_self_decisions(self) -> None:
        """この葉の頭の decisions: に D-154.1〜90 が全部在る（T8 の導出物）"""
        head = SELF.read_text(encoding="utf-8").split("---")[1]
        m = re.search(r"^decisions:\s*\[(.*)\]$", head, re.M)
        dec = [x.strip() for x in (m.group(1) if m else "").split(",")]
        self.assertEqual([f"D-154.{n}" for n in range(1, COUNT + 1) if f"D-154.{n}" not in dec], [])

    def test_K847_DC_004_decision_source_gate(self) -> None:
        """K847-DC-004 決める人の決定の行（代表の決め 1〜14・50〜54・85・86・88・90）の answer=<印> が、答えの記録 01_hearing/decider-answers.jsonl に在る（decision_source_gate が 0 で終わる）。行の印は全部が記録に在る"""
        recorded = ANSWERS.read_text(encoding="utf-8")
        missing = [a for ids in REP_ANSWERED.values() for a in ids if a not in recorded]
        self.assertEqual(missing, [], "答えの記録に無い印")
        g = subprocess.run(
            [sys.executable, "scripts/ci/decision_source_gate.py", "--log", "01_hearing/決定ログ_進行中.md", "--answers", "01_hearing/decider-answers.jsonl", "--label", "高本さん", "--since", "D-130"],
            cwd=ROOT, capture_output=True, text=True, timeout=300,
        )
        self.assertEqual(g.returncode, 0, g.stdout + g.stderr)


if __name__ == "__main__":
    unittest.main()
