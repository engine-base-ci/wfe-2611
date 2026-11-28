#!/usr/bin/env python3
"""K-940 の試験（決定ログ §156・D-156.1〜85）。行 ID は K940-DC-NNN（11_tickets/K-940.md の表と 1 対 1）。
段 5 の K-430・段 10 の K-673 と同じ形：決定ログの新しい節を、切る段の枝で書いたまま運ぶ。
見ること：§156 の表が D-156.1〜85 を順に 1 行ずつ持つ・PM の決め（1〜19・37・38〜50・73・85）と、代表の決め（20〜36・51〜72・74〜84・代表の答え 2026-11-23 つき）を分けて見る・
決定の検査（trace_gate の T3・T8 と decision_source_gate）・この葉の decisions の被覆・行が元に挙げた答えの記録。
テストはチケットを作る人が書き、実装する人は変えない"""
from __future__ import annotations

import pathlib
import re
import subprocess
import sys
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[2]
DECISIONS = ROOT / "01_hearing" / "決定ログ_進行中.md"
ANSWERS = ROOT / "01_hearing" / "decider-answers.jsonl"
SELF = ROOT / "11_tickets" / "K-940.md"
COUNT = 85
PM_ROWS = set(range(1, 20)) | {37} | set(range(38, 51)) | {73, 85}  # 1〜19・37・38〜50・73：PM の決め（「2026-11-23 PM の決め」。38〜50 は葉どうしの食い違いを直した作り方の決め・73 は鈴の文を足す葉＝D-156.41 を改めた・85 はひな形の状態の上限 8 を出す口で止める）
# 20〜36：代表に聞くこと 1〜17 の代表の決め。51：ゲストを人数に数えない代表の決め。番号 → 問い合わせの答えの印（どの行も 2026-11-23 高本さん（代表の決め））
REP_ANSWER = {20: "87516c9d1395", 21: "dc070d77002e", 22: "808a3b8991bf", 23: "976c84852a0f"}
REP_ANSWER.update({n: "e2647a355205" for n in range(24, 28)})
REP_ANSWER.update({n: "7fce7cc704b5" for n in range(28, 32)})
REP_ANSWER.update({n: "b7b2f32fed34" for n in range(32, 36)})
REP_ANSWER[36] = "4541532b8845"
REP_ANSWER[51] = "474977b1ccf8"  # ゲストはプランの人数に数えない（段 12 の問い合わせ・2026-11-23）
# 52〜70：葉を書く間に出た聞くこと 19 件の代表の決め（2026-11-23）。53・54 と 66・67 は 1 つの問い合わせの答えを 2 行に分けた
REP_ANSWER.update({
    52: "1bbff5cb3f92",
    53: "68c64cea7b89",
    54: "68c64cea7b89",
    55: "a747baf1f828",
    56: "030010ba70bf",
    57: "a917ed96a06b",
    58: "b74d26cac99a",
    59: "8849c3b0fc92",
    60: "37a3db05f6a4",
    61: "bbe13cf3a673",
    62: "3b9949573dbf",
    63: "71d990c16969",
    64: "5600254f22ac",
    65: "b20363ad3b89",
    66: "10693ab8cfd1",
    67: "10693ab8cfd1",
    68: "18e7a5455fd2",
    69: "cd396b2be1f4",
    70: "e9850ce48420",
})
# 71・72：その後の代表の答え 2 つ（無料期間の始めた日・気にかけるから上限を外す＝D-156.24 を改めた）。1 つの問い合わせの答えを 2 行に分けた
REP_ANSWER.update({71: "1e8672e4346c", 72: "1e8672e4346c"})
# 74〜81：K-1104・K-1107〜K-1111 を書く間に出た聞くこと 8 件（H＝同じプランの無料は 1 社 1 回＝D-156.71 を改めた・A〜G は勧めのとおり）。1 つの問い合わせの答えを 8 行に分けた
REP_ANSWER.update({n: "acc64a5e9779" for n in range(74, 82)})
# 82〜84：その後の代表の答え 3 つ（止めている会社には届けない・期限から 1 週間の鈴の文・ひな形の種別が 10 のときは保存で赤字）
REP_ANSWER.update({82: "1c2790c955b9", 83: "f950e549255c", 84: "4ca780e41094"})
CITED = {13: "3781e90d23e0", 16: "4961f0280e9a"}  # 元に挙げた代表の言葉・答えの記録（行の中の印と記録の行）
ANSWER = re.compile(r"answer=([0-9a-f]{12})")


def section_rows() -> tuple[dict[str, str], list[str]]:
    text = DECISIONS.read_text(encoding="utf-8")
    m = re.search(r"^## 156\.", text, re.M)
    if not m:
        raise AssertionError("決定ログに §156 が無い")
    rest = text[m.start() + 1 :]
    nxt = re.search(r"^## \d+\.", rest, re.M)
    body = text[m.start() :] if not nxt else text[m.start() : m.start() + 1 + nxt.start()]
    rows: dict[str, str] = {}
    order: list[str] = []
    for ln in body.splitlines():
        r = re.match(r"^\|\s*(D-156\.\d+)\s*\|", ln)
        if r:
            rows.setdefault(r.group(1), ln)
            order.append(r.group(1))
    return rows, order


class DecisionLogTest(unittest.TestCase):
    def test_K940_DC_001_section_rows(self) -> None:
        """§156 の表に D-156.1〜85 が順にちょうど 1 回ずつ（n 行目が D-156.n）在り、PM の決め（1〜19・37・38〜50・73・85）は「2026-11-23 PM の決め」を持って「高本さん」を持たない
        （13・16 だけ元の答えの印 3781e90d23e0・4961f0280e9a を 1 つ持ち、ほかは answer= を持たない）。代表の決め（20〜36・51〜72・74〜84）は「2026-11-23 高本さん（代表の決め）」と
        answer=<その行の印> の 1 つだけを持ち、「PM の決め」「確認中」「仮置き」を持たない"""
        rows, order = section_rows()
        self.assertEqual(order, [f"D-156.{n}" for n in range(1, COUNT + 1)], "表の並び（trace_gate は表の何行目かで番号を数える）")
        bad: list[str] = []
        for n in range(1, COUNT + 1):
            ln = rows[f"D-156.{n}"]
            got = ANSWER.findall(ln)
            want = [REP_ANSWER[n]] if n in REP_ANSWER else ([CITED[n]] if n in CITED else [])
            if got != want:
                bad.append(f"D-156.{n}：answer= の印が {got}（{want} のはず）")
            if n in PM_ROWS and ("2026-11-23 PM の決め" not in ln or "高本さん" in ln or "確認中" in ln):
                bad.append(f"D-156.{n}：「2026-11-23 PM の決め」を持ち、高本さん・確認中と書かない形でない")
            if n in REP_ANSWER and (
                "2026-11-23 高本さん（代表の決め）" not in ln or "PM の決め" in ln or "確認中" in ln or "仮置き" in ln
            ):
                bad.append(f"D-156.{n}：「2026-11-23 高本さん（代表の決め）」を持ち、PM の決め・確認中・仮置きと書かない形でない")
        self.assertEqual(bad, [])

    def test_K940_DC_002_trace_gate(self) -> None:
        """決定の検査（trace_gate：T3 文が在る・T8 文の被覆）が 0 で終わり、D-156 の赤が無い（作る段で tickets.json と要件一覧を作り直してから）"""
        p = subprocess.run([sys.executable, "scripts/ci/trace_gate.py"], cwd=ROOT, capture_output=True, text=True, timeout=300)
        out = p.stdout + p.stderr
        self.assertIsNone(re.search(r"\bT3\b[^\n]*D-156\.\d+|\bT8\b[^\n]*D-156\.\d+", out), out)
        self.assertEqual(p.returncode, 0, out)

    def test_K940_DC_003_self_decisions(self) -> None:
        """この葉の頭の decisions: に D-156.1〜85 が全部在る（T8 の導出物）"""
        head = SELF.read_text(encoding="utf-8").split("---")[1]
        m = re.search(r"^decisions:\s*\[(.*)\]$", head, re.M)
        dec = [x.strip() for x in (m.group(1) if m else "").split(",")]
        self.assertEqual([f"D-156.{n}" for n in range(1, COUNT + 1) if f"D-156.{n}" not in dec], [])

    def test_K940_DC_004_answers_and_gate(self) -> None:
        """答えの記録に、行 13・16 が元に挙げた 2 つの印と代表の決め（20〜36・51〜72・74〜84）の 31 の印（合わせて 33 個）が在り、決める人の決定の検査（decision_source_gate・label 高本さん・since D-130）が 0 で終わる"""
        answers = ANSWERS.read_text(encoding="utf-8")
        need = sorted(set(CITED.values()) | set(REP_ANSWER.values()))
        self.assertEqual(len(need), 33)
        self.assertEqual([a for a in need if f'"id": "{a}"' not in answers], [], "答えの記録に無い印")
        p = subprocess.run(
            [sys.executable, "scripts/ci/decision_source_gate.py", "--log", str(DECISIONS), "--answers", str(ANSWERS),
             "--label", "高本さん", "--since", "D-130"],
            cwd=ROOT, capture_output=True, text=True, timeout=120,
        )
        self.assertEqual(p.returncode, 0, p.stdout + p.stderr)


if __name__ == "__main__":
    unittest.main()
