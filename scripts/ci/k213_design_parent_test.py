#!/usr/bin/env python3
"""K-213 の試験：段 1 の画面をモックに合わせる親の文書（ずれの持ち主の表・子とやる順・決定ログ 143 節）が欠けていない。

  python3 scripts/ci/k213_design_parent_test.py      行 ID は K213-DP-NNN（11_tickets/K-213.md の行の表と 1 対 1）

調べの報告（2026-11-15）のずれの番号は版に無いので読まない。番号の一覧はこの試験の中に式で持つ（S1〜S9・T1〜T11・C1〜C13・#1〜#45・D1〜D37・A1〜A10・P1〜P11＝136）。
"""
from __future__ import annotations

import json
import pathlib
import re
import unittest

ROOT = pathlib.Path(__file__).resolve().parent.parent.parent
PARENT = ROOT / "11_tickets" / "K-213.md"
TICKETS = ROOT / "11_tickets"
INDEX = TICKETS / "tickets.json"
LOG = ROOT / "01_hearing" / "決定ログ_進行中.md"

ALL = ([f"S{i}" for i in range(1, 10)] + [f"T{i}" for i in range(1, 12)] + [f"C{i}" for i in range(1, 14)]
       + [f"#{i}" for i in range(1, 46)] + [f"D{i}" for i in range(1, 38)] + [f"A{i}" for i in range(1, 11)]
       + [f"P{i}" for i in range(1, 12)])


def section(text: str, head: str) -> str:
    m = re.search(rf"^### {re.escape(head)}\n(.*?)(?=^### |^## |\Z)", text, re.M | re.S)
    assert m, f"節「{head}」が無い"
    return m.group(1)


def table_rows(block: str) -> list[list[str]]:
    rows = [[c.strip() for c in ln.strip().strip("|").split("|")] for ln in block.splitlines() if ln.startswith("|")]
    return [r for r in rows[2:] if r]


def expand(cell: str) -> list[str]:
    """「S1〜S7・P1・#20〜#21」を番号の一覧に開く"""
    out = []
    for part in cell.split("・"):
        part = part.strip()
        m = re.fullmatch(r"(#|[A-Z])(\d+)〜(#|[A-Z])(\d+)", part)
        if m:
            assert m.group(1) == m.group(3), part
            out += [f"{m.group(1)}{i}" for i in range(int(m.group(2)), int(m.group(4)) + 1)]
        elif part:
            out.append(part)
    return out


def owner_rows() -> list[tuple[str, list[str], int]]:
    rows = table_rows(section(PARENT.read_text(encoding="utf-8"), "ずれの番号の持ち主（調べの §3 の 136 件）"))
    return [(re.match(r"K-\d+", r[0]).group(0), expand(r[1]), int(r[2])) for r in rows]


class ParentTest(unittest.TestCase):
    def test_K213_DP_001_every_number_has_exactly_one_owner(self) -> None:
        """K213-DP-001 持ち主の表が、調べの 136 の番号をちょうど 1 回ずつ持ち、行の件数の欄が開いた番号の数と同じ"""
        self.assertEqual(len(ALL), 136)
        seen: list[str] = []
        for owner, nums, count in owner_rows():
            self.assertEqual(len(nums), count, owner)
            seen += nums
        self.assertEqual(sorted(seen), sorted(ALL))
        self.assertEqual(len(seen), len(set(seen)), "2 つの持ち主を持つ番号がある")

    def test_K213_DP_002_owners_exist_under_parent(self) -> None:
        """K213-DP-002 持ち主のチケットの md が全部在り、どれも親が K-213（別の枝で進めた K-211 は親を問わない）"""
        for owner, _, _ in owner_rows():
            p = TICKETS / f"{owner}.md"
            self.assertTrue(p.exists(), owner)
            if owner != "K-211":
                self.assertRegex(p.read_text(encoding="utf-8").split("\n---", 1)[0], r"(?m)^parent:\s*K-213\s*$", owner)

    def test_K213_DP_003_children_table_in_index(self) -> None:
        """K213-DP-003 子とやる順の表に出るチケット（K-233〜K-237 の範囲も開く）が、全部 tickets.json に在る。
        ただし形の欄が「全欄・試験つき」のチケット（最初の波）は自分の md と試験を自分で運ぶので、まだ本線に無くてよい"""
        ids = {t["id"] for t in json.loads(INDEX.read_text(encoding="utf-8"))["tickets"]}
        named: set[str] = set()
        wave: set[str] = set()
        for r in table_rows(section(PARENT.read_text(encoding="utf-8"), "子とやる順")):
            m = re.fullmatch(r"K-(\d+)〜K-(\d+)", r[1])
            got = {f"K-{i}" for i in range(int(m.group(1)), int(m.group(2)) + 1)} if m else {r[1]}
            named |= got
            if "全欄" in r[3]:
                wave |= got
        self.assertTrue(named)
        self.assertTrue(wave)
        self.assertEqual(named - wave - ids, set())

    def test_K213_DP_004_decisions_have_answer_marks(self) -> None:
        """K213-DP-004 決定ログの 143 節の決めたことの行（D-143.n）がどれも答えの印（answer=…）を持つ"""
        text = LOG.read_text(encoding="utf-8")
        sec = text[text.index("## 143."):]
        sec = sec[: sec.find("\n## ", 1)] if "\n## " in sec[1:] else sec
        rows = [ln for ln in sec.splitlines() if ln.startswith("| D-143.")]
        self.assertGreaterEqual(len(rows), 5)
        for ln in rows:
            self.assertRegex(ln, r"answer=[0-9a-f]{12}", ln[:20])


if __name__ == "__main__":
    unittest.main(verbosity=2)
