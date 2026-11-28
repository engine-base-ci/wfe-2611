#!/usr/bin/env python3
"""K-781 の試験（決定ログ §153 の足し・D-153.34〜38）。行 ID は K781-DC-NNN（11_tickets/K-781.md の表と 1 対 1）。
K-780 と同じ形：切る段の枝で書いた控え（07_functional/段6-F5/決定ログに足す行.md）から、2026-11-24 の代表の答え 5 つを運ぶ。
見ること：§153 の表の 34〜38 行目が D-153.34〜38 で、D-153.17 の行に 2026-11-23 の答えの足しが在り、どの行も 2026-11-24 高本さん・answer=<印> を持つ・控えと字が同じ・
答えの記録に印が在る（decision_source_gate）・この葉の decisions の被覆。テストはチケットを作る人が書き、実装する人は変えない"""
from __future__ import annotations

import pathlib
import re
import subprocess
import sys
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[2]
DECISIONS = ROOT / "01_hearing" / "決定ログ_進行中.md"
NOTES = ROOT / "07_functional" / "段6-F5" / "決定ログに足す行.md"
ANSWERS = ROOT / "01_hearing" / "decider-answers.jsonl"
SELF = ROOT / "11_tickets" / "K-781.md"
FIRST, LAST = 34, 38
REP: dict[int, str] = {
    34: "10527a3cb65d",
    35: "cef83a7cef1c",
    36: "8a0eb8180bcb",
    37: "475bf72e7f5e",
    38: "935a519487e9",
}
# D-153.17 の行の末尾に足す 2026-11-23 の代表の答え（K-781 が D-153.34〜38 と一緒に運ぶ）
D17 = "D-153.17"
D17_ANSWER = "85c6211ac1b5"
D17_ADD = "人が直した欄と案が食い違うときは、黙って飛ばさず会話の中で「どちらにしますか」と聞いて人の返事で決める（小窓は出さない・2026-11-23 高本さん・answer=85c6211ac1b5）"
MARKS = [*REP.values(), D17_ANSWER]


def section_rows() -> tuple[dict[str, str], list[str]]:
    text = DECISIONS.read_text(encoding="utf-8")
    m = re.search(r"^## 153\.", text, re.M)
    if not m:
        raise AssertionError("決定ログに §153 が無い")
    rest = text[m.start() + 1 :]
    nxt = re.search(r"^## \d+\.", rest, re.M)
    body = text[m.start() :] if not nxt else text[m.start() : m.start() + 1 + nxt.start()]
    rows: dict[str, str] = {}
    order: list[str] = []
    for ln in body.splitlines():
        r = re.match(r"^\|\s*(D-153\.\d+)\s*\|", ln)
        if r:
            rows.setdefault(r.group(1), ln)
            order.append(r.group(1))
    return rows, order


class DecisionLogTest(unittest.TestCase):
    def test_K781_DC_001_section_rows(self) -> None:
        """§153 の表がちょうど 38 行で、34〜38 行目が D-153.34〜38。どの行も 2026-11-24 高本さん・answer=<印>（印は表のとおり）を持ち、控えと字が同じ。
        D-153.17 の行は 2026-11-23 の答えの足しを持ち、控えの D-153.17 と字が同じ"""
        rows, order = section_rows()
        self.assertEqual(order, [f"D-153.{n}" for n in range(1, LAST + 1)])
        bad: list[str] = []
        notes = NOTES.read_text(encoding="utf-8")
        for n in range(FIRST, LAST + 1):
            ln = rows[f"D-153.{n}"]
            if not ("高本さん" in ln and "2026-11-24" in ln and f"answer={REP[n]}" in ln):
                bad.append(f"D-153.{n}：2026-11-24 高本さん・answer={REP[n]} が無い")
            if ln not in notes:
                bad.append(f"D-153.{n}：控えと字が違う")
        ln17 = rows[D17]
        if D17_ADD not in ln17:
            bad.append(f"{D17}：2026-11-23 の答えの足し（answer={D17_ANSWER}）が無い")
        if ln17 not in notes:
            bad.append(f"{D17}：控えと字が違う")
        self.assertEqual(bad, [])

    def test_K781_DC_002_answers_recorded(self) -> None:
        """答えの記録に 6 つの印（D-153.34〜38 の 5 つと 85c6211ac1b5）がちょうど 1 行ずつ在る（同じ id の行を 2 つ持たない）"""
        text = ANSWERS.read_text(encoding="utf-8")
        counts = {a: len(re.findall(rf'"id": "{a}"', text)) for a in MARKS}
        self.assertEqual({a: c for a, c in counts.items() if c != 1}, {})

    def test_K781_DC_003_self_decisions(self) -> None:
        """この葉の頭の decisions: に D-153.17 と D-153.34〜38 が全部在る（T8 の導出物）"""
        head = SELF.read_text(encoding="utf-8").split("---")[1]
        m = re.search(r"^decisions:\s*\[(.*)\]$", head, re.M)
        dec = [x.strip() for x in (m.group(1) if m else "").split(",")]
        want = [D17, *(f"D-153.{n}" for n in range(FIRST, LAST + 1))]
        self.assertEqual([d for d in want if d not in dec], [])

    def test_K781_DC_004_decision_source_gate(self) -> None:
        """決める人の決定の行の answer=<印> が答えの記録に在る（decision_source_gate が 0 で終わる）"""
        g = subprocess.run(
            [sys.executable, "scripts/ci/decision_source_gate.py", "--log", "01_hearing/決定ログ_進行中.md", "--answers", "01_hearing/decider-answers.jsonl", "--label", "高本さん", "--since", "D-130"],
            cwd=ROOT, capture_output=True, text=True, timeout=300,
        )
        self.assertEqual(g.returncode, 0, g.stdout + g.stderr)


if __name__ == "__main__":
    unittest.main()
