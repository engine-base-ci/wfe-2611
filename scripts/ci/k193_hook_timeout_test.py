#!/usr/bin/env python3
"""K-193 の試験：DB を使う試験の準備の時間切れ（Hook timed out）を、上限の引き直しと見分けの 1 行で止める。行 ID は K193-HT-NNN。
見るのは、上限の設定（vitest.config.ts）・見分けの台本（scripts/ci/hook_timeout.py note）・CI の定義（v3-gate.yml）"""
from __future__ import annotations

import math
import pathlib
import re
import subprocess
import sys
import tempfile
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[2]
SCRIPT = ROOT / "scripts" / "ci" / "hook_timeout.py"
HOOK = "Error: Hook timed out in 11000ms.\nIf this is a long-running hook, pass a timeout value as the last argument"
MARK = "★ 準備の時間切れ（Hook timed out）："          # 事実だけを言う（台の負荷・中身のどちらとも言い切らない）
TAIL = "この組の試験の本体は流れていない"
ESC = "\x1b"
# 本物の形（2026-11-13 の回 43381413825・spec の組の G27 の記録から。色の印つき）。spec の組の vitest は JUnit を残さないので、段の出力の写しから拾う
REAL_LOG = (
    "  機械 OK                                             0.2s      —  package.json  ← [boundary] OK\n"
    f"  機械 ★ FAIL                                       112.0s  D-135  packages/db/migrations/*.sql  ← {ESC}[31m{ESC}[2m⎯⎯⎯⎯[1/1]⎯{ESC}[22m{ESC}[39m\n"
    f"      │ {ESC}[41m{ESC}[1m FAIL {ESC}[22m{ESC}[49m packages/db/test/audit.test.ts{ESC}[2m [ packages/db/test/audit.test.ts ]{ESC}[22m\n"
    f"      │ {ESC}[31m{ESC}[1mError{ESC}[22m: Hook timed out in 11000ms.\n"
    "  機械 OK                                             1.0s  D-106  packages/db/policies/*.sql  ← [G4] RLS 有効\n"
)


def suite(file: str, cases: str, *, errors: int = 0, failures: int = 0, extra: str = "") -> str:
    return (f'<testsuite name="{file}" tests="2" failures="{failures}" errors="{errors}" skipped="0" time="12.3">'
            f"{extra}{cases}</testsuite>")


def case(file: str, name: str, body: str = "") -> str:
    return f'<testcase classname="{file}" name="{name}" time="0.1">{body}</testcase>'


def failure(text: str) -> str:
    return f'<failure message="{text.splitlines()[0]}" type="Error">{text}</failure>'


def junit(*suites: str) -> str:
    return '<?xml version="1.0" encoding="UTF-8"?>\n<testsuites name="vitest tests">' + "".join(suites) + "</testsuites>\n"


def note(*paths: pathlib.Path) -> tuple[int, str]:
    r = subprocess.run([sys.executable, str(SCRIPT), "note", *map(str, paths)], capture_output=True, text=True, encoding="utf-8")
    return r.returncode, r.stdout + r.stderr


class ConfigTest(unittest.TestCase):
    def test_K193_HT_001_value_follows_measurement(self) -> None:
        text = (ROOT / "vitest.config.ts").read_text(encoding="utf-8")
        lines = text.splitlines()
        at = [i for i, ln in enumerate(lines) if re.search(r"\bhookTimeout\s*:\s*[\d_]+", ln)]
        self.assertEqual(len(at), 1)
        value = int(re.search(r"\bhookTimeout\s*:\s*([\d_]+)", lines[at[0]]).group(1).replace("_", ""))
        self.assertGreater(value, 11000, "11 秒は 2026-11-13 に割れた。同時に走った回を含む実測から引き直す")
        around = "\n".join(lines[max(0, at[0] - 8): at[0] + 1])   # 値の根拠は値のすぐ上の注釈に書く
        mx = re.search(r"最大\s*([\d.]+)\s*秒", around)
        self.assertIsNotNone(mx, "注釈に実測の最大（最大 <秒> 秒）")
        self.assertEqual(value, math.ceil(round(float(mx.group(1)) * 3, 3)) * 1000, "値＝実測の最大 × 3 を秒に切り上げ（D-133.2）")
        for word in ("実測", "× 3", "同時"):
            self.assertIn(word, around)
        self.assertRegex(around, r"20\d\d-\d\d-\d\d", "測った日")
        # 仮の値のまま取り込まない：測った回（GitHub の回の番号）と回の数を書く。「仮」と書いた注釈は通さない
        self.assertRegex(around, r"\b\d{11}\b", "測った回の番号（GitHub の回の番号）が 1 つ以上")
        self.assertRegex(around, r"\d+\s*回", "測った回の数")
        self.assertNotIn("仮", around)

    def test_K193_HT_002_one_place(self) -> None:
        # git の道の絞りの * は / も越える（apps/*.ts は apps の下の全部の .ts）
        out = subprocess.run(["git", "-C", str(ROOT), "grep", "-n", "-I", "-F", "hookTimeout", "--",
                              "vitest.config.ts", "apps/*.ts", "packages/*.ts", "apps/*.mts", "packages/*.mts"],
                             capture_output=True, text=True, encoding="utf-8").stdout
        self.assertTrue(out.strip(), "1 つも当たらない（探し方が壊れている）")
        hits = [ln for ln in out.splitlines() if "node_modules/" not in ln and re.search(r"\bhookTimeout\s*:", ln.split(":", 2)[-1])]
        self.assertEqual([h.split(":")[0] for h in hits], ["vitest.config.ts"], out)


class NoteTest(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = tempfile.TemporaryDirectory(prefix="k193-")
        self.d = pathlib.Path(self.tmp.name) / "junit"
        self.d.mkdir()

    def tearDown(self) -> None:
        self.tmp.cleanup()

    def put(self, name: str, text: str) -> None:
        (self.d / name).write_text(text, encoding="utf-8")

    def test_K193_HT_003_tells_hook_timeout_from_real_failure(self) -> None:
        slow, bad = "packages/db/test/audit.test.ts", "apps/api/test/features/F5/delegate.test.ts"
        self.put("unit-1.xml", junit(
            suite(slow, case(slow, "監査の行が残る", failure(HOOK)), failures=1),
            suite(bad, case(bad, "任せる", failure("AssertionError: expected 201 to be 409")) + case(bad, "通る"), failures=1)))
        rc, out = note(self.d)
        self.assertEqual(rc, 0, out)
        marked = [ln for ln in out.splitlines() if MARK in ln]
        self.assertEqual(len(marked), 1, out)
        self.assertIn(slow, marked[0])
        self.assertIn(TAIL, marked[0])
        self.assertNotIn(bad, marked[0])
        self.assertNotIn("負荷", out)     # 原因を言い切らない（製品の不具合で準備が返らないときも同じ文で出る）
        self.assertIn("準備の時間切れ 1 件／そのほかの赤 1 件", out.strip().splitlines()[-1])

    def test_K193_HT_004_green_says_nothing(self) -> None:
        f = "packages/db/test/audit.test.ts"
        self.put("unit-1.xml", junit(suite(f, case(f, "監査の行が残る") + case(f, "通る"))))
        rc, out = note(self.d)
        self.assertEqual((rc, out.strip()), (0, ""))

    def test_K193_HT_005_japanese_names(self) -> None:
        f = "packages/db/test/監査 の表.test.ts"
        self.put("組 の記録 1.xml", junit(suite(f, case(f, "行が残る", failure(HOOK)), failures=1)))
        rc, out = note(self.d)
        self.assertEqual(rc, 0, out)
        self.assertEqual(len([ln for ln in out.splitlines() if MARK in ln and f in ln]), 1, out)

    def test_K193_HT_006_unreadable_and_missing(self) -> None:
        f = "packages/db/test/audit.test.ts"
        self.put("unit-1.xml", junit(suite(f, case(f, "監査の行が残る", failure(HOOK)), failures=1)))
        self.put("壊れた.xml", "<testsuites><testsuite name=")
        rc, out = note(self.d)
        self.assertEqual(rc, 0, out)
        self.assertIn("壊れた.xml", out)                                   # 読めないファイルは名前を出す（黙って飛ばさない）
        self.assertEqual(len([ln for ln in out.splitlines() if MARK in ln and f in ln]), 1, out)   # ほかの XML は読む
        rc, out = note(self.d.parent / "無い置き場")
        self.assertEqual(rc, 0, out)
        self.assertIn("読む記録が無い", out)

    def test_K193_HT_007_same_file_counted_once(self) -> None:
        # vitest が、準備の時間切れを testsuite の error と、その中の testcase の failure の両方に書く形
        f = "apps/api/test/generated/post_memories.test.ts"
        err = f'<error message="Hook timed out in 11000ms." type="Error">{HOOK}</error>'
        self.put("unit-2.xml", junit(suite(f, case(f, "201 を返す", failure(HOOK)) + case(f, "401 を返す", failure(HOOK)),
                                           errors=1, failures=2, extra=err)))
        rc, out = note(self.d)
        self.assertEqual(rc, 0, out)
        self.assertEqual(len([ln for ln in out.splitlines() if MARK in ln]), 1, out)
        self.assertIn("準備の時間切れ 1 件／そのほかの赤 0 件", out.strip().splitlines()[-1])


    def test_K193_HT_009_timeout_and_real_failure_in_same_file(self) -> None:
        # 同じファイルに、時間切れの試験と中身の失敗の試験：中身の赤を時間切れの中に隠さない
        f = "apps/api/test/features/F5/delegate.test.ts"
        self.put("unit-1.xml", junit(suite(
            f, case(f, "任せる", failure(HOOK)) + case(f, "承認する", failure("AssertionError: expected 201 to be 409")) + case(f, "通る"),
            failures=2)))
        rc, out = note(self.d)
        self.assertEqual(rc, 0, out)
        self.assertEqual(len([ln for ln in out.splitlines() if MARK in ln and f in ln]), 1, out)
        self.assertIn("準備の時間切れ 1 件／そのほかの赤 1 件", out.strip().splitlines()[-1])

    def test_K193_HT_010_real_failures_only_say_nothing(self) -> None:
        # 時間切れでない赤だけ（試験の時間切れ Test timed out も準備の時間切れではない）：何も出さない
        f = "apps/api/test/features/F5/delegate.test.ts"
        self.put("unit-1.xml", junit(suite(
            f, case(f, "任せる", failure("AssertionError: expected 201 to be 409")) + case(f, "遅い", failure("Error: Test timed out in 5000ms.")),
            failures=2)))
        rc, out = note(self.d)
        self.assertEqual((rc, out.strip()), (0, ""))

    def test_K193_HT_011_other_reds_are_counted_by_testcase(self) -> None:
        # 「そのほかの赤」は、時間切れの文を持たない失敗・エラーの testcase の数（ファイルの数ではない）
        slow, bad = "packages/db/test/audit.test.ts", "apps/api/test/features/F5/delegate.test.ts"
        self.put("unit-1.xml", junit(
            suite(slow, case(slow, "監査の行が残る", failure(HOOK)), failures=1),
            suite(bad, case(bad, "任せる", failure("AssertionError: 1")) + case(bad, "承認する", failure("AssertionError: 2"))
                  + case(bad, "完了", '<error message="TypeError: x" type="TypeError">TypeError: x</error>') + case(bad, "通る"),
                  failures=2, errors=1)))
        rc, out = note(self.d)
        self.assertEqual(rc, 0, out)
        self.assertIn("準備の時間切れ 1 件／そのほかの赤 3 件", out.strip().splitlines()[-1])

    def test_K193_HT_012_step_log_of_spec_job(self) -> None:
        # spec の組：vitest は検査の台本の中で流れ、JUnit を残さない。段の出力の写し（色の印つき）から拾う
        logs = self.d.parent / "gate-logs"
        logs.mkdir()
        (logs / "g27.log").write_text(REAL_LOG, encoding="utf-8")
        rc, out = note(self.d, logs)   # JUnit の置き場は空・写しの置き場に 1 つ
        self.assertEqual(rc, 0, out)
        marked = [ln for ln in out.splitlines() if MARK in ln]
        self.assertEqual(len(marked), 1, out)
        self.assertIn("packages/db/test/audit.test.ts", marked[0])
        self.assertNotIn(ESC, out)                                    # 色の印は外して出す
        self.assertIn("準備の時間切れ 1 件", out.strip().splitlines()[-1])
        (logs / "g27.log").write_text("  機械 ★ FAIL  1.0s  D-1  a.sql  ← 1 failed\n      │ AssertionError: expected 1 to be 2\n", encoding="utf-8")
        rc, out = note(self.d, logs)
        self.assertEqual((rc, [ln for ln in out.splitlines() if MARK in ln]), (0, []), out)


class WorkflowTest(unittest.TestCase):
    def test_K193_HT_008_note_step_runs_on_failure(self) -> None:
        lines = (ROOT / ".github/workflows/v3-gate.yml").read_text(encoding="utf-8").splitlines()
        at = [i for i, ln in enumerate(lines) if "hook_timeout.py note " in ln]
        self.assertGreaterEqual(len(at), 3, "unit の各組・spec・database に 1 つずつ")
        for i in at:
            step = "\n".join(lines[max(0, i - 4): i + 1])   # その段の name・if・run
            self.assertRegex(step, r"if:\s*\$\{\{[^}]*failure\(\)[^}]*\}\}", f"{i + 1} 行目の段は赤のときだけ流す")
        # spec の組：層の棚卸し（G27）の出力を置き場に写し（終わりの値は保つ）、見分けの段がその置き場も読む
        g27 = [ln for ln in lines if "layer_audit.py --run" in ln]
        self.assertEqual(len(g27), 1)
        self.assertIn("gate-logs/g27.log", g27[0])
        self.assertIn("pipefail", g27[0])
        self.assertTrue(any("gate-logs" in lines[i] for i in at), "見分けの段が写しの置き場を読む")


if __name__ == "__main__":
    unittest.main(verbosity=2)
