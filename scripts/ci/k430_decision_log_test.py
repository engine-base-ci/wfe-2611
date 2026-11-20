#!/usr/bin/env python3
"""K-430 の試験：段 5 の決定ログ §150（D-150.1〜33）と答えの記録。行 ID は K430-DC-NNN（11_tickets/K-430.md の表と 1 対 1）。
段 9 の K-425 と同じ形（切る段の持ち込みの作り手 build_index.py の K4 が、始める時点の本線に §150 が無いと止まるため、決定ログを先に本線へ入れる葉を分けた）。
見ること：§150 の表が D-150.1〜33 を順に 1 行ずつ持ち、どの行も PM の決めと書く（代表に聞くことは 0 個）・
決定の検査（trace_gate の T3・T8）・この葉の decisions の被覆。テストはチケットを作る人が書き、実装する人は変えない（D-128.125）"""
from __future__ import annotations

import pathlib
import re
import subprocess
import sys
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[2]
DECISIONS = ROOT / "01_hearing" / "決定ログ_進行中.md"
SELF = ROOT / "11_tickets" / "K-430.md"
COUNT = 33


def section_rows() -> tuple[dict[str, list[str]], list[str]]:
    """§150 の「### 決めたこと」の表の行（ID の欄が D-150.n）を表の順に"""
    text = DECISIONS.read_text(encoding="utf-8")
    m = re.search(r"^## 150\.", text, re.M)
    if not m:
        raise AssertionError("決定ログに §150 が無い")
    rest = text[m.start() + 1 :]
    nxt = re.search(r"^## \d+\.", rest, re.M)
    body = text[m.start() :] if not nxt else text[m.start() : m.start() + 1 + nxt.start()]
    rows: dict[str, list[str]] = {}
    order: list[str] = []
    for ln in body.splitlines():
        r = re.match(r"^\|\s*(D-150\.\d+)\s*\|", ln)
        if r:
            rows.setdefault(r.group(1), []).append(ln)
            order.append(r.group(1))
    return rows, order


def run_py(*args: str) -> subprocess.CompletedProcess[str]:
    return subprocess.run([sys.executable, *args], cwd=ROOT, capture_output=True, text=True, timeout=300)


class DecisionLogTest(unittest.TestCase):
    def test_K430_DC_001_section_rows(self) -> None:
        """§150 の表に D-150.1〜33 が順にちょうど 1 回ずつ（n 行目が D-150.n）在り、どの行も「PM の決め」と 2026-11-20 を持って「高本さん」を持たない（代表に聞くことは 0 個・答えの記録は要らない）"""
        rows, order = section_rows()
        want = [f"D-150.{n}" for n in range(1, COUNT + 1)]
        self.assertEqual(order, want, "§150 の表の並び（trace_gate は表の何行目かで番号を数える）")
        bad = []
        for n in range(1, COUNT + 1):
            ln = rows[f"D-150.{n}"][0]
            if "PM の決め" not in ln or "2026-11-20" not in ln:
                bad.append(f"D-150.{n}：PM の決め・日付が無い")
            if "高本さん" in ln or "answer=" in ln:
                bad.append(f"D-150.{n}：高本さん・answer= を書かない（PM の決め）")
        self.assertEqual(bad, [])

    def test_K430_DC_002_trace_gate(self) -> None:
        """決定の検査（trace_gate：T3 文が在る・T6 reflect_in・T8 文の被覆）が 0 で終わり、D-150 の赤が無い"""
        p = run_py("scripts/ci/trace_gate.py")
        out = p.stdout + p.stderr
        self.assertIsNone(re.search(r"\bT3\b[^\n]*D-150\.\d+|\bT8\b[^\n]*D-150\.\d+", out), out)
        self.assertEqual(p.returncode, 0, out)

    def test_K430_DC_003_self_decisions(self) -> None:
        """この葉の頭の decisions: に D-150.1〜33 が全部在る（文の被覆 T8 の導出物）"""
        head = SELF.read_text(encoding="utf-8").split("---")[1]
        m = re.search(r"^decisions:\s*\[(.*)\]$", head, re.M)
        dec = [x.strip() for x in (m.group(1) if m else "").split(",")]
        missing = [f"D-150.{n}" for n in range(1, COUNT + 1) if f"D-150.{n}" not in dec]
        self.assertEqual(missing, [])


if __name__ == "__main__":
    unittest.main()
