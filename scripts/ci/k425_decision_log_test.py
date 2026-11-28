#!/usr/bin/env python3
"""K-425 の試験：段 9 の決定ログ §148（D-148.1〜51）と答えの記録。行 ID は K425-DC-NNN（11_tickets/K-425.md の表と 1 対 1）。
K-400 の DC の 4 行を移した（PM の決め 2026-11-20：切る段の持ち込みの作り手 build_index.py の K4 が、始める時点の本線に §148 が無いと止まるため、
決定ログを先に本線へ入れる葉を分けた）。見ること：§148 の表が D-148.1〜51 を順に 1 行ずつ持ち、どの行も決める人の答えに結ぶ・答えの記録（G60）・
決定の検査（trace_gate の T3・T8）・この葉の decisions の被覆。テストはチケットを作る人が書き、実装する人は変えない（D-128.125）"""
from __future__ import annotations

import json
import pathlib
import re
import subprocess
import sys
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[2]
DECISIONS = ROOT / "01_hearing" / "決定ログ_進行中.md"
ANSWERS = ROOT / "01_hearing" / "decider-answers.jsonl"
SELF = ROOT / "11_tickets" / "K-425.md"
COUNT = 51
IDS = ("56812da22008", "eaa451436670", "f5cd1647389f", "fabd031f9b37", "3d444fc8d59f")


def answer_of(n: int) -> str:
    """D-148.n が結ぶ答えの記録（1・2・3・6／5／4・7〜21／22〜38 下絵と知らせの消え方／39〜51 詳細を切って出た問い 21〜33）"""
    if n in (1, 2, 3, 6):
        return "56812da22008"
    if n == 5:
        return "eaa451436670"
    if n >= 39:
        return "3d444fc8d59f"
    if n >= 22:
        return "fabd031f9b37"
    return "f5cd1647389f"


def section_rows() -> tuple[dict[str, list[str]], list[str]]:
    """§148 の「### 決めたこと」の表の行（ID の欄が D-148.n）を表の順に"""
    text = DECISIONS.read_text(encoding="utf-8")
    m = re.search(r"^## 148\.", text, re.M)
    if not m:
        raise AssertionError("決定ログに §148 が無い")
    rest = text[m.start() + 1 :]
    nxt = re.search(r"^## \d+\.", rest, re.M)
    body = text[m.start() :] if not nxt else text[m.start() : m.start() + 1 + nxt.start()]
    rows: dict[str, list[str]] = {}
    order: list[str] = []
    for ln in body.splitlines():
        r = re.match(r"^\|\s*(D-148\.\d+)\s*\|", ln)
        if r:
            rows.setdefault(r.group(1), []).append(ln)
            order.append(r.group(1))
    return rows, order


def run_py(*args: str) -> subprocess.CompletedProcess[str]:
    return subprocess.run([sys.executable, *args], cwd=ROOT, capture_output=True, text=True, timeout=300)


class DecisionLogTest(unittest.TestCase):
    def test_K425_DC_001_section_rows(self) -> None:
        """§148 の表に D-148.1〜51 が順にちょうど 1 回ずつ（n 行目が D-148.n）在り、どの行も「高本さん」・2026-11-20・行ごとに決めた答えの番号を持つ"""
        rows, order = section_rows()
        want = [f"D-148.{n}" for n in range(1, COUNT + 1)]
        self.assertEqual(order, want, "§148 の表の並び（trace_gate は表の何行目かで番号を数える）")
        bad = []
        for n in range(1, COUNT + 1):
            ln = rows[f"D-148.{n}"][0]
            if "高本さん" not in ln or "2026-11-20" not in ln:
                bad.append(f"D-148.{n}：高本さん・日付が無い")
            if f"answer={answer_of(n)}" not in ln:
                bad.append(f"D-148.{n}：answer={answer_of(n)} が無い")
        self.assertEqual(bad, [])

    def test_K425_DC_002_answers_g60(self) -> None:
        """答えの記録（G60）：decider-answers.jsonl に 5 つの番号の行（日付 2026-11-20）が在り、decision_source_gate が 0 で終わる"""
        at: dict[str, str] = {}
        for ln in ANSWERS.read_text(encoding="utf-8").splitlines():
            if ln.strip():
                r = json.loads(ln)
                if r.get("id"):
                    at[r["id"]] = str(r.get("at", ""))
        for i in IDS:
            self.assertEqual(at.get(i, "")[:10], "2026-11-20", f"answer={i}")
        p = run_py(
            "scripts/ci/decision_source_gate.py",
            "--log",
            "01_hearing/決定ログ_進行中.md",
            "--answers",
            "01_hearing/decider-answers.jsonl",
            "--label",
            "高本さん",
            "--since",
            "D-130",
        )
        self.assertEqual(p.returncode, 0, p.stdout + p.stderr)

    def test_K425_DC_003_trace_gate(self) -> None:
        """決定の検査（trace_gate：T3 文が在る・T6 reflect_in・T8 文の被覆）が 0 で終わり、D-148 の赤が無い"""
        p = run_py("scripts/ci/trace_gate.py")
        out = p.stdout + p.stderr
        self.assertIsNone(re.search(r"\bT3\b[^\n]*D-148\.\d+|\bT8\b[^\n]*D-148\.\d+", out), out)
        self.assertEqual(p.returncode, 0, out)

    def test_K425_DC_004_self_decisions(self) -> None:
        """この葉の頭の decisions: に D-148.1〜51 が全部在る（文の被覆 T8 の導出物）"""
        head = SELF.read_text(encoding="utf-8").split("---")[1]
        m = re.search(r"^decisions:\s*\[(.*)\]$", head, re.M)
        dec = [x.strip() for x in (m.group(1) if m else "").split(",")]
        missing = [f"D-148.{n}" for n in range(1, COUNT + 1) if f"D-148.{n}" not in dec]
        self.assertEqual(missing, [])


if __name__ == "__main__":
    unittest.main()
