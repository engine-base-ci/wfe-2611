#!/usr/bin/env python3
"""K-1303：完了は実施事項の区画を書き換えない（K-566・D-150.42）。前からの試験に「完了の後は全部「- [x]」の版」の期待が残っていないかを見る。

  python3 scripts/ci/k1303_complete_no_rewrite_test.py

段 PM-choice の全部の CI（回 45410724654）で、歩く骨格の中間の試験（m3-delegate-approve-complete.spec.ts の K64-M3-01）が
完了の後の区画を「- [x] 見積を作る\\n- [x] 先方に送る」と比べて赤になった。K-566 から完了の口は区画を書き換えないので、
期待を「区画は元のまま」に替えた。同じ形の期待がほかの試験に残っていないかも、ここで毎回見る。
"""
from __future__ import annotations

import re
import subprocess
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
M3 = "apps/web/tests/skeleton/m3-delegate-approve-complete.spec.ts"
G65 = "scripts/ci/g65.d/K-1303.txt"
CMD = "python3 scripts/ci/k1303_complete_no_rewrite_test.py"

# 実施事項の区画を読む助け（todoNow）の答えを、「- [x]」で始まる字と比べる期待。1 つの文の中（; まで）で探す（prettier が折り返しても当たる）
REWRITE = re.compile(r"todoNow\([^;]{0,400}?\.(?:toBe|toEqual|toStrictEqual)\(\s*[\"'`]- \[[xX]\]")
CALL = re.compile(r"todoNow\(")


def rewrite_expectations(text: str) -> list[int]:
    """完了の後の区画を「- [x]」の版と比べる期待の、todoNow の在る行の番号（1 から）"""
    return [text.count("\n", 0, m.start()) + 1 for m in REWRITE.finditer(text)]


def test_files() -> list[str]:
    out = subprocess.run(
        ["git", "ls-files", "-z", "--", "apps/*.spec.ts", "apps/*.test.ts", "apps/*.spec.tsx", "apps/*.test.tsx", "apps/*/tests/*.ts"],
        cwd=ROOT, capture_output=True, text=True, check=True,
    ).stdout.split("\0")
    return sorted({f for f in out if f})


class CompleteNoRewrite(unittest.TestCase):
    def test_K1303_CI_001_m3_expects_section_unchanged(self):
        src = (ROOT / M3).read_text(encoding="utf-8")
        m = re.search(r"async function completeAll\(.*?\n}\n", src, re.S)
        self.assertIsNotNone(m, "m3 に completeAll が無い")
        body = m.group(0)
        self.assertRegex(body, r"todoNow\(r\.t\)[^;]*\.toBe\(SECTIONS\.todo\)", "完了の後の区画を元の SECTIONS.todo と比べていない")
        self.assertEqual(rewrite_expectations(body), [], "completeAll に「- [x]」の版の期待が残っている")
        self.assertEqual(re.search(r"todo:\s*\"([^\"]*)\"", src).group(1), "- 見積を作る\\n- 先方に送る", "元の区画に未済みの行が無いと、書き換えを見分けられない")

    def test_K1303_CI_002_no_rewrite_expectation_anywhere(self):
        files = test_files()
        self.assertGreater(len(files), 50, "試験のファイルを読めていない（検査が何も見ていない）")
        calls, bad = 0, []
        for f in files:
            text = (ROOT / f).read_text(encoding="utf-8", errors="replace")
            calls += len(CALL.findall(text))
            bad += [f"{f}:{n}" for n in rewrite_expectations(text)]
        self.assertGreaterEqual(calls, 2, "todoNow の呼び出し（m3 の完了の後と実行の後）を数えていない（検査が何も見ていない）")
        self.assertEqual(bad, [], "完了の後の区画を「- [x]」の版と比べる期待が残っている（K-566 から完了は書き換えない）")

    def test_K1303_CI_003_detector_catches_forms(self):
        one = 'expect(await todoNow(r.t), "済み").toBe("- [x] 見積を作る\\n- [x] 先方に送る");'
        wrapped = 'expect(\n    await todoNow(r.t),\n    "済み",\n  ).toBe(\n    "- [X] 見積を作る",\n  );'
        eq = "expect(await todoNow(t)).toEqual(`- [x] a`);"
        ok = [
            'expect(await todoNow(r.t), "AI は付けない").toBe(SECTIONS.todo);',
            'expect(await todoNow(r.t)).toBe("- 見積を作る");\nconst x = "- [x] 先方に送る";',
            '// todoNow(r.t) は前は .toBe("- [x] …") だった\nfoo();',
        ]
        self.assertEqual(rewrite_expectations("a\n" + one), [2])
        self.assertEqual(rewrite_expectations(wrapped), [2])  # todoNow の在る行
        self.assertEqual(rewrite_expectations(eq), [1])
        for s in ok[:2]:
            self.assertEqual(rewrite_expectations(s), [], s)
        # コメントの中の字は ; までの 1 文に .toBe("- [x] が在るので当たる。試験のファイルにそう書かない（書けば赤で知らせる）
        self.assertEqual(rewrite_expectations(ok[2]), [1])

    def test_K1303_CI_004_ci_wiring(self):
        reg = (ROOT / G65).read_text(encoding="utf-8").strip()
        self.assertEqual(reg, CMD, "g65.d にこの試験の命令が 1 行で無い")
        wf = (ROOT / ".github/workflows/v3-gate.yml").read_text(encoding="utf-8")
        self.assertIn(CMD, wf, "CI の定義にこの試験の命令が無い（作り手で作り直していない）")


if __name__ == "__main__":
    unittest.main()
